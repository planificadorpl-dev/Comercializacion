"use server";

export interface ExchangeRate {
  moneda: string;
  fuente: string;
  nombre: string;
  valor: number;
  fechaActualizacion: string;
}

// In-memory server cache to avoid scraping BCV on every request
let cachedBCV: { rate: ExchangeRate; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function scrapeBCVRate(): Promise<ExchangeRate | null> {
  const now = Date.now();
  if (cachedBCV && now - cachedBCV.timestamp < CACHE_TTL_MS) {
    return cachedBCV.rate;
  }

  const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s maximum timeout

    const res = await fetch("https://www.bcv.org.ve/", {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const usdRegex = /id="dolar"[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/;
      const match = html.match(usdRegex);

      if (match && match[1]) {
        let rawValue = match[1].trim().replace(",", ".");
        rawValue = rawValue.replace(/[^0-9.]/g, "");
        const valor = parseFloat(rawValue);

        if (!isNaN(valor) && valor > 0) {
          const rate: ExchangeRate = {
            moneda: "USD",
            fuente: "BCV",
            nombre: "Dólar BCV",
            valor,
            fechaActualizacion: new Date().toISOString(),
          };
          cachedBCV = { rate, timestamp: now };
          return rate;
        }
      }
    }
  } catch (error) {
    // If request timed out or failed, use previous cached or fallback
  } finally {
    if (originalRejectUnauthorized !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }

  if (cachedBCV) {
    return cachedBCV.rate;
  }

  // Safe fallback rate if BCV website is offline or slow
  return {
    moneda: "USD",
    fuente: "BCV",
    nombre: "Dólar BCV",
    valor: 36.5,
    fechaActualizacion: new Date().toISOString(),
  };
}
