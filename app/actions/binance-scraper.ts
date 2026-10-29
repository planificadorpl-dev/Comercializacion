"use server";

export interface BinanceRate {
  price: number;
  asset: string;
  fiat: string;
  merchantName: string;
  tradeType: string;
}

let cachedBinance: { rate: BinanceRate; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function scrapeBinanceRate(): Promise<BinanceRate | null> {
  const now = Date.now();
  if (cachedBinance && now - cachedBinance.timestamp < CACHE_TTL_MS) {
    return cachedBinance.rate;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        page: 1,
        rows: 1,
        payTypes: [],
        asset: "USDT",
        tradeType: "BUY",
        fiat: "VES",
      }),
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.data && data.data.length > 0) {
        const topAd = data.data[0];
        const rate: BinanceRate = {
          price: parseFloat(topAd.adv.price),
          asset: topAd.adv.asset,
          fiat: topAd.adv.fiatUnit,
          merchantName: topAd.advertiser.nickName,
          tradeType: topAd.adv.tradeType,
        };
        cachedBinance = { rate, timestamp: now };
        return rate;
      }
    }
  } catch (error) {
    // Timeout or network error
  }

  if (cachedBinance) {
    return cachedBinance.rate;
  }

  return {
    price: 38.5,
    asset: "USDT",
    fiat: "VES",
    merchantName: "Mercado P2P",
    tradeType: "BUY",
  };
}
