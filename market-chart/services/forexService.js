const axios = require("axios");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 });

const INT_MS = {
  "1m": 6e4,
  "3m": 18e4,
  "5m": 3e5,
  "15m": 9e5,
  "30m": 18e5,
  "1h": 36e5,
  "2h": 72e5,
  "4h": 144e5,
  "6h": 216e5,
  "8h": 288e5,
  "12h": 432e5,
  "1d": 864e5,
  "3d": 2592e5,
  "1w": 6048e5,
  "1M": 26784e5,
};

const PAIRS = [
  { s: "EUR/USD", n: "یورو / دلار آمریکا", d: 5, v: 0.005 },
  { s: "GBP/USD", n: "پوند / دلار آمریکا", d: 5, v: 0.006 },
  { s: "USD/JPY", n: "دلار / ین ژاپن", d: 3, v: 0.006 },
  { s: "USD/CHF", n: "دلار / فرانک سوئیس", d: 5, v: 0.005 },
  { s: "AUD/USD", n: "دلار استرالیا / دلار", d: 5, v: 0.006 },
  { s: "USD/CAD", n: "دلار / دلار کانادا", d: 5, v: 0.005 },
  { s: "NZD/USD", n: "دلار نیوزلند / دلار", d: 5, v: 0.006 },
  { s: "EUR/GBP", n: "یورو / پوند", d: 5, v: 0.004 },
  { s: "EUR/JPY", n: "یورو / ین", d: 3, v: 0.007 },
  { s: "GBP/JPY", n: "پوند / ین", d: 3, v: 0.009 },
  { s: "EUR/CHF", n: "یورو / فرانک", d: 5, v: 0.004 },
  { s: "AUD/JPY", n: "دلار استرالیا / ین", d: 3, v: 0.007 },
  { s: "XAU/USD", n: "طلا / دلار", d: 2, v: 0.012 },
  { s: "XAG/USD", n: "نقره / دلار", d: 4, v: 0.022 },
  { s: "USD/TRY", n: "دلار / لیر ترکیه", d: 5, v: 0.008 },
  { s: "EUR/TRY", n: "یورو / لیر ترکیه", d: 5, v: 0.009 },
];

const KNOWN = {
  "EUR/USD": 1.085,
  "GBP/USD": 1.268,
  "USD/JPY": 154.5,
  "USD/CHF": 0.882,
  "AUD/USD": 0.647,
  "USD/CAD": 1.372,
  "NZD/USD": 0.598,
  "EUR/GBP": 0.855,
  "EUR/JPY": 167.6,
  "GBP/JPY": 195.9,
  "EUR/CHF": 0.957,
  "AUD/JPY": 100.0,
  "XAU/USD": 2650,
  "XAG/USD": 31.2,
  "USD/TRY": 34.3,
  "EUR/TRY": 37.2,
};

async function req(url, params, timeout = 12000) {
  const { data } = await axios.get(url, { params, timeout });
  return data;
}

// ──── Frankfurter (ECB free API) ────
async function frankfurter(symbol, limit) {
  try {
    const [base, quote] = symbol.split("/");
    if (["XAU", "XAG"].includes(base)) return null;
    const days = Math.min(limit, 5000);
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 864e5)
      .toISOString()
      .split("T")[0];
    const d = await req(
      `https://api.frankfurter.app/${start}..${end}`,
      { from: base, to: quote },
      15000,
    );
    if (!d?.rates) return null;
    const dates = Object.keys(d.rates).sort();
    if (dates.length < 5) return null;
    console.log(`  ✓ Frankfurter ${symbol} (${dates.length})`);
    let prev = null;
    return dates.map((dt) => {
      const p = d.rates[dt][quote];
      const o = prev || p;
      const diff = Math.abs(p - o);
      prev = p;
      return {
        time: new Date(dt).getTime(),
        open: o,
        close: p,
        high: Math.max(o, p) + diff * (0.1 + Math.random() * 0.4),
        low: Math.min(o, p) - diff * (0.1 + Math.random() * 0.4),
        volume: Math.floor(5e4 + Math.random() * 2e5),
      };
    });
  } catch {
    return null;
  }
}

// ──── Metals via CryptoCompare ────
async function metals(symbol, interval, limit, endTime) {
  const [base] = symbol.split("/");
  if (base !== "XAU" && base !== "XAG") return null;
  const cc = base === "XAU" ? "PAXG" : "XAG";
  let ep, aggr;
  if (["1m", "3m", "5m", "15m", "30m"].includes(interval)) {
    ep = "histominute";
    aggr = parseInt(interval) || 15;
  } else if (["1h", "2h", "4h", "6h", "8h", "12h"].includes(interval)) {
    ep = "histohour";
    aggr = parseInt(interval) || 1;
  } else {
    ep = "histoday";
    aggr = 1;
  }
  try {
    const params = {
      fsym: cc,
      tsym: "USD",
      limit: Math.min(limit, 2000),
      aggregate: aggr,
    };
    if (endTime) params.toTs = Math.floor(endTime / 1000);
    const d = await req(
      `https://min-api.cryptocompare.com/data/v2/${ep}`,
      params,
    );
    const raw = d?.Data?.Data?.filter((c) => c.open > 0);
    if (!raw?.length || raw.length < 5) return null;
    console.log(`  ✓ CryptoCompare ${base} (${raw.length})`);
    return raw.map((c) => ({
      time: c.time * 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volumefrom || 0,
    }));
  } catch {
    return null;
  }
}

// ──── Current rate from open.er-api ────
async function liveRate(symbol) {
  try {
    const [base, quote] = symbol.split("/");
    if (["XAU", "XAG"].includes(base)) return null;
    const d = await req(`https://open.er-api.com/v6/latest/${base}`, {}, 8000);
    return d?.rates?.[quote] || null;
  } catch {
    return null;
  }
}

// ──── Interpolate daily → intraday ────
function interpolate(daily, interval, limit) {
  const ms = INT_MS[interval] || 36e5;
  const cpd = Math.max(1, Math.floor(864e5 / ms));
  const out = [];
  for (const dc of daily) {
    const range = dc.high - dc.low || dc.close * 0.001;
    let price = dc.open;
    for (let i = 0; i < cpd; i++) {
      const prog = (i + 1) / cpd;
      const target = dc.open + (dc.close - dc.open) * prog;
      const noise = (Math.random() - 0.5) * range * 0.1;
      const close = target + noise;
      const open = price;
      out.push({
        time: dc.time + i * ms,
        open,
        close,
        high: Math.max(open, close) + Math.random() * range * 0.03,
        low: Math.min(open, close) - Math.random() * range * 0.03,
        volume: Math.floor((dc.volume || 5e4) / cpd + Math.random() * 500),
      });
      price = close;
    }
  }
  return out.slice(-limit);
}

// ──── Resample ────
function resample(candles, interval) {
  const ms = INT_MS[interval];
  if (!ms) return candles;
  const m = new Map();
  for (const c of candles) {
    const k = Math.floor(c.time / ms) * ms;
    if (!m.has(k)) m.set(k, { ...c, time: k });
    else {
      const b = m.get(k);
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += c.volume;
    }
  }
  return [...m.values()].sort((a, b) => a.time - b.time);
}

// ──── Generate from base price ────
function generate(symbol, basePrice, interval, limit, endTime) {
  const pair = PAIRS.find((p) => p.s === symbol) || { d: 5, v: 0.005 };
  const ms = INT_MS[interval] || 36e5;
  const end = endTime || Date.now();
  const vol = basePrice * pair.v * Math.sqrt(ms / 864e5);

  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);
  seed = seed * 173 + Math.floor(end / ms);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const out = [];
  let price = basePrice * (1 + (rand() - 0.5) * 0.02);

  for (let i = 0; i < limit; i++) {
    const time = end - (limit - i) * ms;
    const dow = new Date(time).getDay();
    if (ms >= 36e5 && (dow === 0 || dow === 6)) continue;

    const open = price;
    const change =
      Math.sin(time / (864e5 * 10)) * vol * 0.3 +
      (rand() - 0.5) * 2 * vol +
      (basePrice - price) * 0.003;
    const close = open + change;
    out.push({
      time,
      open: +open.toFixed(pair.d),
      close: +close.toFixed(pair.d),
      high: +Math.max(open, close, open + rand() * vol * 0.4).toFixed(pair.d),
      low: +Math.min(open, close, open - rand() * vol * 0.4).toFixed(pair.d),
      volume: Math.floor(5000 + rand() * 50000),
    });
    price = close;
  }
  return out;
}

async function getKlines(symbol, interval, limit = 500, endTime) {
  const ck = `f_${symbol}_${interval}_${limit}_${endTime || "n"}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  console.log(`\n🔍 Forex: ${symbol} @ ${interval} ×${limit}`);

  let data = null;
  if (symbol.startsWith("XAU") || symbol.startsWith("XAG"))
    data = await metals(symbol, interval, limit, endTime);

  if (!data) {
    const daily = await frankfurter(symbol, Math.max(limit, 1000));
    if (daily?.length > 5) {
      data = ["1d", "3d", "1w", "1M"].includes(interval)
        ? resample(daily, interval).slice(-limit)
        : interpolate(daily, interval, limit);
    }
  }

  if (!data) {
    const rate = await liveRate(symbol);
    data = generate(
      symbol,
      rate || KNOWN[symbol] || 1,
      interval,
      limit,
      endTime,
    );
  }

  if (endTime && data) data = data.filter((c) => c.time <= endTime);
  data = data?.slice(-limit);
  if (data?.length) cache.set(ck, data);
  return data;
}

function getSymbols() {
  return PAIRS.map((p) => ({ symbol: p.s, name: p.n }));
}
module.exports = { getKlines, getSymbols };
