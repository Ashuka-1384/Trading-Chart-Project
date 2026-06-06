const axios = require("axios");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 120 });

const INT_MS = {
  "1m": 6e4,
  "5m": 3e5,
  "15m": 9e5,
  "30m": 18e5,
  "1h": 36e5,
  "4h": 144e5,
  "1d": 864e5,
  "1w": 6048e5,
  "1M": 26784e5,
};

const STOCKS = [
  { s: "AAPL", n: "Apple اپل", p: 195 },
  { s: "MSFT", n: "Microsoft مایکروسافت", p: 430 },
  { s: "GOOGL", n: "Alphabet گوگل", p: 175 },
  { s: "AMZN", n: "Amazon آمازون", p: 190 },
  { s: "NVDA", n: "NVIDIA انویدیا", p: 140 },
  { s: "META", n: "Meta متا", p: 570 },
  { s: "TSLA", n: "Tesla تسلا", p: 350 },
  { s: "JPM", n: "JPMorgan جی‌پی‌مورگان", p: 235 },
  { s: "V", n: "Visa ویزا", p: 290 },
  { s: "WMT", n: "Walmart والمارت", p: 90 },
  { s: "MA", n: "Mastercard مسترکارت", p: 520 },
  { s: "DIS", n: "Disney دیزنی", p: 112 },
  { s: "NFLX", n: "Netflix نتفلیکس", p: 900 },
  { s: "AMD", n: "AMD ای‌ام‌دی", p: 125 },
  { s: "INTC", n: "Intel اینتل", p: 21 },
  { s: "BA", n: "Boeing بوئینگ", p: 170 },
  { s: "CRM", n: "Salesforce سیلزفورس", p: 330 },
  { s: "PYPL", n: "PayPal پی‌پال", p: 85 },
  { s: "UBER", n: "Uber اوبر", p: 78 },
  { s: "COIN", n: "Coinbase کوین‌بیس", p: 305 },
  { s: "SHOP", n: "Shopify شاپیفای", p: 110 },
  { s: "SPOT", n: "Spotify اسپاتیفای", p: 480 },
  { s: "ABNB", n: "Airbnb ایربی‌ان‌بی", p: 135 },
  { s: "SQ", n: "Block بلاک", p: 90 },
  { s: "PLTR", n: "Palantir پلنتیر", p: 70 },
  { s: "SNOW", n: "Snowflake اسنوفلیک", p: 165 },
  { s: "MSTR", n: "MicroStrategy مایکرواستراتژی", p: 400 },
];

async function yahoo(symbol, interval, limit) {
  try {
    const iMap = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1h",
      "4h": "1h",
      "1d": "1d",
      "1w": "1wk",
      "1M": "1mo",
    };
    const rMap = {
      "1m": "7d",
      "5m": "60d",
      "15m": "60d",
      "30m": "60d",
      "1h": "2y",
      "4h": "2y",
      "1d": "10y",
      "1w": "max",
      "1M": "max",
    };
    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        params: {
          interval: iMap[interval] || "1d",
          range: rMap[interval] || "1y",
        },
        timeout: 12000,
        headers: { "User-Agent": "Mozilla/5.0" },
      },
    );
    const r = data?.chart?.result?.[0];
    if (!r?.timestamp) return null;
    const q = r.indicators?.quote?.[0];
    if (!q) return null;
    console.log(`  ✓ Yahoo ${symbol} (${r.timestamp.length})`);
    const candles = [];
    for (let i = 0; i < r.timestamp.length; i++) {
      if (q.open[i] != null && q.close[i] != null)
        candles.push({
          time: r.timestamp[i] * 1000,
          open: q.open[i],
          high: q.high[i] || q.open[i],
          low: q.low[i] || q.open[i],
          close: q.close[i],
          volume: q.volume[i] || 0,
        });
    }
    return candles.slice(-limit);
  } catch (e) {
    console.log(`  ✗ Yahoo ${symbol}: ${e.message}`);
    return null;
  }
}

function generate(stock, interval, limit, endTime) {
  const ms = INT_MS[interval] || 864e5;
  const end = endTime || Date.now();
  const vol = stock.p * 0.018 * Math.sqrt(ms / 864e5);
  let seed = 0;
  for (let i = 0; i < stock.s.length; i++) seed += stock.s.charCodeAt(i);
  seed = seed * 251 + Math.floor(end / ms);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const out = [];
  let price = stock.p * (1 + (rand() - 0.5) * 0.1);
  for (let i = 0; i < limit; i++) {
    const time = end - (limit - i) * ms;
    if (ms >= 864e5) {
      const d = new Date(time).getDay();
      if (d === 0 || d === 6) continue;
    }
    const open = price;
    const change =
      Math.sin(time / (864e5 * 25)) * vol * 0.4 +
      (rand() - 0.5) * 2 * vol +
      (stock.p - price) * 0.002;
    const close = Math.max(open + change, stock.p * 0.3);
    out.push({
      time,
      open: +open.toFixed(2),
      close: +close.toFixed(2),
      high: +Math.max(open, close, open + rand() * vol * 0.3).toFixed(2),
      low: +Math.max(
        Math.min(open, close) - rand() * vol * 0.3,
        stock.p * 0.2,
      ).toFixed(2),
      volume: Math.floor(5e5 + rand() * 5e6),
    });
    price = close;
  }
  return out;
}

async function getKlines(symbol, interval, limit = 500, endTime) {
  const ck = `s_${symbol}_${interval}_${limit}_${endTime || "n"}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  console.log(`\n🔍 Stock: ${symbol} @ ${interval} ×${limit}`);
  let data = await yahoo(symbol, interval, limit);
  if (!data || data.length < 5) {
    const st = STOCKS.find((s) => s.s === symbol) || {
      s: symbol,
      n: symbol,
      p: 100,
    };
    data = generate(st, interval, limit, endTime);
  }
  if (endTime) data = data.filter((c) => c.time <= endTime);
  data = data.slice(-limit);
  if (data) cache.set(ck, data);
  return data;
}

function getSymbols() {
  return STOCKS.map((s) => ({ symbol: s.s, name: s.n }));
}
module.exports = { getKlines, getSymbols };
