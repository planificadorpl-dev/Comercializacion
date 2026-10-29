import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

/**
 * Gets an authenticated Google Sheets client using environment variables or credentials file
 */
export async function getSheetsClient(useDataPL = false) {
  // 1. Check environment variables (ideal for Vercel deployment)
  const envCredentials =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_CREDENTIALS;

  if (envCredentials && envCredentials.trim() !== '') {
    try {
      let credentialsObj;
      const trimmed = envCredentials.trim();
      if (trimmed.startsWith('{')) {
        credentialsObj = JSON.parse(trimmed);
      } else {
        // Support base64 encoded JSON
        const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
        credentialsObj = JSON.parse(decoded);
      }

      const auth = new google.auth.GoogleAuth({
        credentials: credentialsObj,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const client = await auth.getClient();
      return google.sheets({ version: 'v4', auth: client });
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

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}
