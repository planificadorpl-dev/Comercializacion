import path from 'path';
import fs from 'fs';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function toBase64Url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem) {
  const normalized = String(pem).replace(/\\n/g, '\n');
  const b64 = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getTokenCache() {
  if (!globalThis.__googleSheetsTokenCache) {
    globalThis.__googleSheetsTokenCache = new Map();
  }
  return globalThis.__googleSheetsTokenCache;
}

async function createServiceAccountJwt(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = toBase64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SHEETS_SCOPE,
      aud: credentials.token_uri || DEFAULT_TOKEN_URI,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claims}`;

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await globalThis.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

async function fetchAccessToken(credentials, forceRefresh = false) {
  const cacheKey = credentials.client_email;
  const cache = getTokenCache();

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }
  } else {
    cache.delete(cacheKey);
  }

  const assertion = await createServiceAccountJwt(credentials);
  const tokenUri = credentials.token_uri || DEFAULT_TOKEN_URI;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Error al autenticar Service Account de Google: ${msg}`);
  }

  const ttlMs = Math.max(((Number(data.expires_in) || 3600) - 120) * 1000, 60_000);
  cache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + ttlMs,
  });

  return data.access_token;
}

function loadServiceAccountCredentials(useDataPL = false) {
  // 1. Check environment variables (Cloudflare / Vercel deployment)
  const envCredentials =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_CREDENTIALS;

  if (envCredentials && envCredentials.trim() !== '') {
    try {
      const trimmed = envCredentials.trim();
      const parsed = trimmed.startsWith('{')
        ? JSON.parse(trimmed)
        : JSON.parse(Buffer.from(trimmed, 'base64').toString('utf-8'));

      if (parsed?.client_email && parsed?.private_key) {
        return parsed;
      }
    } catch (e) {
      console.warn('Error parseando credenciales de Google desde variables de entorno:', e.message);
    }
  }

  // 2. Fallback to local files on disk (development / intranet)
  const fileName = useDataPL ? 'credentials-datapl.json' : 'credentials.json';
  let credentialsPath = path.join(/*turbopackIgnore: true*/ process.cwd(), fileName);

  if (!fs.existsSync(credentialsPath)) {
    const altFileName = useDataPL ? 'credentials.json' : 'credentials-datapl.json';
    const alternativePath = path.join(/*turbopackIgnore: true*/ process.cwd(), altFileName);
    if (fs.existsSync(alternativePath)) {
      credentialsPath = alternativePath;
    } else {
      throw new Error('No se encontró archivo de credenciales de Google Sheets en la raíz ni en variables de entorno.');
    }
  }

  const raw = fs.readFileSync(credentialsPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error('El archivo de credenciales de Google no contiene client_email o private_key.');
  }
  return parsed;
}

function buildQueryString(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) qs.append(key, String(item));
      }
    } else {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

function createSheetsRestClient(credentials) {
  async function request(method, pathSuffix, { query, body } = {}) {
    const url = `${SHEETS_API_BASE}${pathSuffix}${buildQueryString(query)}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await fetchAccessToken(credentials, attempt > 0);
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401 && attempt === 0) {
        continue;
      }

      const text = await res.text();
      /** @type {any} */
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (!res.ok) {
        const apiMessage = data?.error?.message || text || `HTTP ${res.status}`;
        /** @type {any} */
        const err = new Error(apiMessage);
        err.status = res.status;
        err.response = { status: res.status, data };
        throw err;
      }

      return { data, status: res.status };
    }
  }

  return {
    spreadsheets: {
      /** @param {Record<string, any>} params */
      get(params = {}) {
        const { spreadsheetId, fields, ranges, includeGridData } = params;
        return request('GET', `/${encodeURIComponent(spreadsheetId)}`, {
          query: { fields, ranges, includeGridData },
        });
      },
      /** @param {Record<string, any>} params */
      batchUpdate(params = {}) {
        const { spreadsheetId, requestBody, resource } = params;
        return request('POST', `/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
          body: requestBody ?? resource ?? {},
        });
      },
      values: {
        /** @param {Record<string, any>} params */
        get(params = {}) {
          const { spreadsheetId, range, majorDimension, valueRenderOption, dateTimeRenderOption } = params;
          return request(
            'GET',
            `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
            {
              query: { majorDimension, valueRenderOption, dateTimeRenderOption },
            }
          );
        },
        /** @param {Record<string, any>} params */
        batchGet(params = {}) {
          const { spreadsheetId, ranges, majorDimension, valueRenderOption, dateTimeRenderOption } = params;
          return request('GET', `/${encodeURIComponent(spreadsheetId)}/values:batchGet`, {
            query: { ranges, majorDimension, valueRenderOption, dateTimeRenderOption },
          });
        },
        /** @param {Record<string, any>} params */
        update(params = {}) {
          const {
            spreadsheetId,
            range,
            valueInputOption,
            includeValuesInResponse,
            responseValueRenderOption,
            responseDateTimeRenderOption,
            requestBody,
            resource,
          } = params;
          return request(
            'PUT',
            `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
            {
              query: {
                valueInputOption,
                includeValuesInResponse,
                responseValueRenderOption,
                responseDateTimeRenderOption,
              },
              body: requestBody ?? resource ?? {},
            }
          );
        },
        /** @param {Record<string, any>} params */
        append(params = {}) {
          const {
            spreadsheetId,
            range,
            valueInputOption,
            insertDataOption,
            includeValuesInResponse,
            responseValueRenderOption,
            responseDateTimeRenderOption,
            requestBody,
            resource,
          } = params;
          return request(
            'POST',
            `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
            {
              query: {
                valueInputOption,
                insertDataOption,
                includeValuesInResponse,
                responseValueRenderOption,
                responseDateTimeRenderOption,
              },
              body: requestBody ?? resource ?? {},
            }
          );
        },
        /** @param {Record<string, any>} params */
        clear(params = {}) {
          const { spreadsheetId, range, requestBody, resource } = params;
          return request(
            'POST',
            `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
            {
              body: requestBody ?? resource ?? {},
            }
          );
        },
        /** @param {Record<string, any>} params */
        batchUpdate(params = {}) {
          const { spreadsheetId, requestBody, resource } = params;
          return request('POST', `/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
            body: requestBody ?? resource ?? {},
          });
        },
        /** @param {Record<string, any>} params */
        batchClear(params = {}) {
          const { spreadsheetId, requestBody, resource } = params;
          return request('POST', `/${encodeURIComponent(spreadsheetId)}/values:batchClear`, {
            body: requestBody ?? resource ?? {},
          });
        },
      },
    },
  };
}

/**
 * Gets an authenticated Google Sheets client using environment variables or credentials file
 * without bundling the full `googleapis` package (safe for Cloudflare Workers startup limits).
 */
export async function getSheetsClient(useDataPL = false) {
  const credentials = loadServiceAccountCredentials(useDataPL);
  // Warm up token generation up front to preserve getSheetsClient() error-handling semantics
  // (callers like /api/sheets/list wrap getSheetsClient() in try/catch to fall back to API key).
  await fetchAccessToken(credentials);
  return createSheetsRestClient(credentials);
}
