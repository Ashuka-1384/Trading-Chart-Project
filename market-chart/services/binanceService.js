const axios = require("axios");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 15 });

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

// === API Configs ===
const GECKO_IDS = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  BNBUSDT: "binancecoin",
  SOLUSDT: "solana",
  XRPUSDT: "ripple",
  ADAUSDT: "cardano",
  DOGEUSDT: "dogecoin",
  DOTUSDT: "polkadot",
  LINKUSDT: "chainlink",
  AVAXUSDT: "avalanche-2",
  SHIBUSDT: "shiba-inu",
  LTCUSDT: "litecoin",
  UNIUSDT: "uniswap",
  ATOMUSDT: "cosmos",
  TRXUSDT: "tron",
  ETCUSDT: "ethereum-classic",
  NEARUSDT: "near",
  TONUSDT: "the-open-network",
  APTUSDT: "aptos",
  OPUSDT: "optimism",
  ARBUSDT: "arbitrum",
  SUIUSDT: "sui",
  INJUSDT: "injective-protocol",
  TIAUSDT: "celestia",
  FETUSDT: "fetch-ai",
  WLDUSDT: "worldcoin-wld",
  SEIUSDT: "sei-network",
  PENDLEUSDT: "pendle",
  JUPUSDT: "jupiter-exchange-solana",
  STXUSDT: "blockstack",
  IMXUSDT: "immutable-x",
  RENDERUSDT: "render-token",
  WIFUSDT: "dogwifcoin",
  AAVEUSDT: "aave",
  MKRUSDT: "maker",
  CRVUSDT: "curve-dao-token",
  SANDUSDT: "the-sandbox",
  GRTUSDT: "the-graph",
  ALGOUSDT: "algorand",
  ICPUSDT: "internet-computer",
  FTMUSDT: "fantom",
  THETAUSDT: "theta-token",
  FILUSDT: "filecoin",
  EOSUSDT: "eos",
  XTZUSDT: "tezos",
  HBARUSDT: "hedera-hashgraph",
  XLMUSDT: "stellar",
  XMRUSDT: "monero",
  VETUSDT: "vechain",
  MATICUSDT: "matic-network",
  MANAUSDT: "decentraland",
  AXSUSDT: "axie-infinity",
  LDOUSDT: "lido-dao",
  GMXUSDT: "gmx",
  PEPEUSDT: "pepe",
  BONKUSDT: "bonk",
  FLOKIUSDT: "floki",
  GALAUSDT: "gala",
  ENJUSDT: "enjincoin",
  CHZUSDT: "chiliz",
  CAKEUSDT: "pancakeswap-token",
  APEUSDT: "apecoin",
  DYDXUSDT: "dydx",
  RUNEUSDT: "thorchain",
  COMPUSDT: "compound-governance-token",
  SNXUSDT: "havven",
  KSMUSDT: "kusama",
  NEOUSDT: "neo",
  DASHUSDT: "dash",
  ZECUSDT: "zcash",
  BATUSDT: "basic-attention-token",
  LRCUSDT: "loopring",
  QNTUSDT: "quant-network",
  EGLDUSDT: "multiversx-egld",
  MINAUSDT: "mina-protocol",
  CFXUSDT: "conflux-token",
  ONDOUSDT: "ondo-finance",
  ENAUSDT: "ethena",
  PYTHUSDT: "pyth-network",
  WOOUSDT: "woo-network",
  BLURUSDT: "blur",
};

const CAP_IDS = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  BNBUSDT: "binance-coin",
  SOLUSDT: "solana",
  XRPUSDT: "xrp",
  ADAUSDT: "cardano",
  DOGEUSDT: "dogecoin",
  DOTUSDT: "polkadot",
  LINKUSDT: "chainlink",
  AVAXUSDT: "avalanche",
  LTCUSDT: "litecoin",
  ATOMUSDT: "cosmos",
  TRXUSDT: "tron",
  ETCUSDT: "ethereum-classic",
  XLMUSDT: "stellar",
  NEARUSDT: "near-protocol",
  ALGOUSDT: "algorand",
  FTMUSDT: "fantom",
  TONUSDT: "toncoin",
  APTUSDT: "aptos",
  ARBUSDT: "arbitrum",
  OPUSDT: "optimism",
  INJUSDT: "injective",
  FILUSDT: "filecoin",
  ICPUSDT: "internet-computer",
  VETUSDT: "vechain",
  EOSUSDT: "eos",
  AAVEUSDT: "aave",
  SHIBUSDT: "shiba-inu",
  HBARUSDT: "hedera",
  XTZUSDT: "tezos",
  NEOUSDT: "neo",
  DASHUSDT: "dash",
  XMRUSDT: "monero",
  MATICUSDT: "polygon",
  GRTUSDT: "the-graph",
};

// Request helper with timeout
async function req(url, params, timeout = 12000) {
  const { data } = await axios.get(url, {
    params,
    timeout,
    headers: { Accept: "application/json", "User-Agent": "MarketChart/4.0" },
  });
  return data;
}

// ──────── Nobitex (Iranian) ────────
async function nobitex(sym, interval, limit, endTime) {
  const base = sym.replace("USDT", "").toLowerCase();
  const ok = [
    "btc",
    "eth",
    "bnb",
    "sol",
    "xrp",
    "ada",
    "doge",
    "dot",
    "link",
    "avax",
    "shib",
    "ltc",
    "uni",
    "atom",
    "trx",
    "etc",
    "xlm",
    "matic",
    "near",
    "ton",
    "apt",
    "arb",
    "op",
    "inj",
    "fil",
    "sand",
    "mana",
    "aave",
    "ftm",
    "hbar",
  ];
  if (!ok.includes(base)) return null;

  const resMap = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
  };
  const res = resMap[interval];
  if (!res) return null;

  try {
    const to = endTime
      ? Math.floor(endTime / 1000)
      : Math.floor(Date.now() / 1000);
    const from = to - Math.floor((limit * (INT_MS[interval] || 36e5)) / 1000);
    const d = await req("https://api.nobitex.ir/market/udf/history", {
      symbol: `${base.toUpperCase()}USDT`,
      resolution: res,
      from,
      to,
    });
    if (d?.s !== "ok" || !d.t?.length || d.t.length < 2) return null;
    console.log(`  ✓ Nobitex  ${base.toUpperCase()} (${d.t.length})`);
    return d.t.map((t, i) => ({
      time: t * 1000,
      open: d.o[i],
      high: d.h[i],
      low: d.l[i],
      close: d.c[i],
      volume: d.v[i] || 0,
    }));
  } catch {
    return null;
  }
}

// ──────── Wallex (Iranian) ────────
async function wallex(sym, interval, limit, endTime) {
  const base = sym.replace("USDT", "");
  const resMap = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "1D",
    "1w": "1W",
  };
  const res = resMap[interval];
  if (!res) return null;

  try {
    const to = endTime
      ? Math.floor(endTime / 1000)
      : Math.floor(Date.now() / 1000);
    const from = to - Math.floor((limit * (INT_MS[interval] || 36e5)) / 1000);
    const d = await req("https://api.wallex.ir/v1/udf/history", {
      symbol: `${base}USDT`,
      resolution: res,
      from,
      to,
    });
    if (d?.s !== "ok" || !d.t?.length || d.t.length < 2) return null;
    console.log(`  ✓ Wallex   ${base} (${d.t.length})`);
    return d.t.map((t, i) => ({
      time: t * 1000,
      open: +d.o[i],
      high: +d.h[i],
      low: +d.l[i],
      close: +d.c[i],
      volume: +d.v[i] || 0,
    }));
  } catch {
    return null;
  }
}

// ──────── KuCoin ────────
async function kucoin(sym, interval, limit, endTime) {
  const base = sym.replace("USDT", "");
  const iMap = {
    "1m": "1min",
    "3m": "3min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1hour",
    "2h": "2hour",
    "4h": "4hour",
    "6h": "6hour",
    "8h": "8hour",
    "12h": "12hour",
    "1d": "1day",
    "1w": "1week",
  };
  const ki = iMap[interval];
  if (!ki) return null;

  try {
    const endSec = endTime
      ? Math.floor(endTime / 1000)
      : Math.floor(Date.now() / 1000);
    const startSec =
      endSec - Math.floor((limit * (INT_MS[interval] || 36e5)) / 1000);
    const d = await req("https://api.kucoin.com/api/v1/market/candles", {
      type: ki,
      symbol: `${base}-USDT`,
      startAt: startSec,
      endAt: endSec,
    });
    if (d?.code !== "200000" || !d.data?.length || d.data.length < 2)
      return null;
    console.log(`  ✓ KuCoin   ${base} (${d.data.length})`);
    return d.data
      .map((c) => ({
        time: +c[0] * 1000,
        open: +c[1],
        high: +c[3],
        low: +c[4],
        close: +c[2],
        volume: +c[5],
      }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return null;
  }
}

// ──────── CryptoCompare ────────
async function cryptoCompare(sym, interval, limit, endTime) {
  const base = sym.replace(/USDT|BUSD/g, "");
  let ep, aggr;
  if (["1m", "3m", "5m"].includes(interval)) {
    ep = "histominute";
    aggr = interval === "1m" ? 1 : interval === "3m" ? 3 : 5;
  } else if (["15m", "30m"].includes(interval)) {
    ep = "histominute";
    aggr = interval === "15m" ? 15 : 30;
  } else if (["1h", "2h", "4h", "6h", "8h", "12h"].includes(interval)) {
    ep = "histohour";
    aggr = parseInt(interval);
  } else {
    ep = "histoday";
    aggr =
      interval === "3d"
        ? 3
        : interval === "1w"
          ? 7
          : interval === "1M"
            ? 30
            : 1;
  }

  try {
    const params = {
      fsym: base,
      tsym: "USD",
      limit: Math.min(limit, 2000),
      aggregate: aggr,
    };
    if (endTime) params.toTs = Math.floor(endTime / 1000);
    const d = await req(
      `https://min-api.cryptocompare.com/data/v2/${ep}`,
      params,
    );
    const raw = d?.Data?.Data?.filter((c) => c.open > 0 && c.high > 0);
    if (!raw?.length || raw.length < 2) return null;
    console.log(`  ✓ CryptoCompare ${base} (${raw.length})`);
    return raw.map((c) => ({
      time: c.time * 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volumefrom || c.volumeto || 0,
    }));
  } catch {
    return null;
  }
}

// ──────── CoinGecko ────────
async function coinGecko(sym, interval, limit) {
  const id = GECKO_IDS[sym];
  if (!id) return null;
  const daysMap = {
    "1m": 1,
    "3m": 1,
    "5m": 1,
    "15m": 1,
    "30m": 2,
    "1h": 14,
    "2h": 30,
    "4h": 90,
    "6h": 90,
    "8h": 180,
    "12h": 180,
    "1d": 365,
    "3d": 365,
    "1w": 730,
    "1M": 1825,
  };
  try {
    const ohlc = await req(
      `https://api.coingecko.com/api/v3/coins/${id}/ohlc`,
      {
        vs_currency: "usd",
        days: daysMap[interval] || 14,
      },
    );
    if (!Array.isArray(ohlc) || ohlc.length < 2) return null;

    let candles = ohlc.map((c) => ({
      time: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: 0,
    }));

    // Get volume data
    try {
      const mc = await req(
        `https://api.coingecko.com/api/v3/coins/${id}/market_chart`,
        {
          vs_currency: "usd",
          days: daysMap[interval] || 14,
        },
        10000,
      );
      if (mc?.total_volumes?.length) {
        const vols = mc.total_volumes;
        for (const cd of candles) {
          let best = vols[0],
            bestD = Math.abs(vols[0][0] - cd.time);
          for (let i = 1; i < vols.length; i++) {
            const d = Math.abs(vols[i][0] - cd.time);
            if (d < bestD) {
              bestD = d;
              best = vols[i];
            }
          }
          cd.volume = Math.round(best[1]);
        }
      }
    } catch {
      candles.forEach(
        (c) => (c.volume = Math.round(5e4 + Math.random() * 5e5)),
      );
    }

    // Resample
    const ms = INT_MS[interval];
    if (ms) {
      const buckets = new Map();
      for (const c of candles) {
        const k = Math.floor(c.time / ms) * ms;
        if (!buckets.has(k)) buckets.set(k, { ...c, time: k });
        else {
          const b = buckets.get(k);
          b.high = Math.max(b.high, c.high);
          b.low = Math.min(b.low, c.low);
          b.close = c.close;
          b.volume += c.volume;
        }
      }
      candles = Array.from(buckets.values()).sort((a, b) => a.time - b.time);
    }

    console.log(`  ✓ CoinGecko ${id} (${candles.length})`);
    return candles.slice(-limit);
  } catch {
    return null;
  }
}

// ──────── CoinCap ────────
async function coinCap(sym, interval, limit, endTime) {
  const id = CAP_IDS[sym];
  if (!id) return null;
  const ccMap = {
    "1m": "m1",
    "5m": "m5",
    "15m": "m15",
    "30m": "m30",
    "1h": "h1",
    "2h": "h2",
    "4h": "h6",
    "6h": "h6",
    "12h": "h12",
    "1d": "d1",
    "3d": "d1",
    "1w": "d1",
    "1M": "d1",
  };
  const ccMs = {
    m1: 6e4,
    m5: 3e5,
    m15: 9e5,
    m30: 18e5,
    h1: 36e5,
    h2: 72e5,
    h6: 216e5,
    h12: 432e5,
    d1: 864e5,
  };
  const ci = ccMap[interval] || "h1";
  try {
    const end = endTime || Date.now();
    const start = end - limit * (ccMs[ci] || 36e5);
    const d = await req(`https://api.coincap.io/v2/assets/${id}/history`, {
      interval: ci,
      start,
      end,
    });
    if (!d?.data?.length || d.data.length < 5) return null;

    const ms = INT_MS[interval] || 36e5;
    const buckets = new Map();
    for (const p of d.data) {
      const price = +p.priceUsd;
      const k = Math.floor(p.time / ms) * ms;
      if (!buckets.has(k))
        buckets.set(k, {
          time: k,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        });
      else {
        const b = buckets.get(k);
        b.high = Math.max(b.high, price);
        b.low = Math.min(b.low, price);
        b.close = price;
      }
    }
    const candles = Array.from(buckets.values()).sort(
      (a, b) => a.time - b.time,
    );
    candles.forEach((c) => (c.volume = Math.round(1e5 + Math.random() * 9e5)));
    console.log(`  ✓ CoinCap  ${id} (${candles.length})`);
    return candles.slice(-limit);
  } catch {
    return null;
  }
}

// ──────── Main ────────
async function getKlines(symbol, interval, limit = 500, endTime) {
  const s = symbol.toUpperCase().replace("/", "");
  const ck = `c_${s}_${interval}_${limit}_${endTime || "n"}`;
  const hit = cache.get(ck);
  if (hit) return hit;

  console.log(
    `\n🔍 ${s} @ ${interval} ×${limit} ${endTime ? "← " + new Date(endTime).toISOString().slice(0, 16) : ""}`,
  );

  let data =
    (await nobitex(s, interval, limit, endTime)) ||
    (await wallex(s, interval, limit, endTime)) ||
    (await kucoin(s, interval, limit, endTime)) ||
    (await cryptoCompare(s, interval, limit, endTime)) ||
    (await coinGecko(s, interval, limit)) ||
    (await coinCap(s, interval, limit, endTime));

  if (!data?.length) throw new Error(`داده‌ای برای ${s} یافت نشد`);

  data.sort((a, b) => a.time - b.time);
  const seen = new Set();
  data = data.filter((c) => {
    if (seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  });
  cache.set(ck, data);
  return data;
}

async function getSymbols() {
  const ck = "csyms";
  const hit = cache.get(ck);
  if (hit) return hit;

  try {
    const d = await req(
      "https://api.coingecko.com/api/v3/coins/markets",
      {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: 100,
        page: 1,
      },
      15000,
    );
    if (d?.length) {
      const syms = d.map((c) => ({
        symbol: `${c.symbol.toUpperCase()}USDT`,
        baseAsset: c.symbol.toUpperCase(),
        quoteAsset: "USDT",
        name: `${c.symbol.toUpperCase()}/USDT`,
        fullName: c.name,
        price: c.current_price,
        change24h: c.price_change_percentage_24h,
        image: c.image,
      }));
      cache.set(ck, syms, 1800);
      return syms;
    }
  } catch {}

  const fb = [
    "BTC",
    "ETH",
    "BNB",
    "SOL",
    "XRP",
    "ADA",
    "DOGE",
    "DOT",
    "LINK",
    "AVAX",
    "SHIB",
    "LTC",
    "UNI",
    "ATOM",
    "TRX",
    "ETC",
    "FIL",
    "APT",
    "NEAR",
    "TON",
    "OP",
    "ARB",
    "SUI",
    "PEPE",
    "INJ",
    "TIA",
    "FET",
    "RENDER",
    "WLD",
    "SEI",
    "PENDLE",
    "JUP",
    "STX",
    "IMX",
    "WIF",
    "AAVE",
    "MKR",
    "CRV",
    "SAND",
    "GRT",
    "ALGO",
    "ICP",
    "FTM",
    "THETA",
    "EOS",
    "XTZ",
    "HBAR",
    "XLM",
    "XMR",
    "DYDX",
    "BONK",
    "FLOKI",
    "GALA",
    "NEO",
    "DASH",
    "ZEC",
    "LDO",
    "GMX",
    "CAKE",
    "APE",
    "ENJ",
    "CHZ",
    "BAT",
    "LRC",
    "RUNE",
    "KSM",
    "QNT",
    "MINA",
    "EGLD",
    "CFX",
    "WOO",
    "MATIC",
    "VET",
    "MANA",
    "AXS",
    "COMP",
    "SNX",
  ].map((s) => ({
    symbol: `${s}USDT`,
    baseAsset: s,
    quoteAsset: "USDT",
    name: `${s}/USDT`,
  }));
  cache.set(ck, fb, 3600);
  return fb;
}

async function getTicker(symbol) {
  const s = symbol.toUpperCase().replace("/", "");
  const base = s.replace(/USDT|BUSD/g, "");
  const ck = `tk_${s}`;
  const hit = cache.get(ck);
  if (hit) return hit;

  try {
    const d = await req(
      "https://min-api.cryptocompare.com/data/pricemultifull",
      { fsyms: base, tsyms: "USD" },
      8000,
    );
    const r = d?.RAW?.[base]?.USD;
    if (r) {
      const t = {
        symbol: s,
        price: r.PRICE,
        change: r.CHANGE24HOUR,
        changePercent: r.CHANGEPCT24HOUR,
        high: r.HIGH24HOUR,
        low: r.LOW24HOUR,
        volume: r.VOLUME24HOUR,
        quoteVolume: r.VOLUME24HOURTO,
      };
      cache.set(ck, t, 12);
      return t;
    }
  } catch {}

  try {
    const id = GECKO_IDS[s];
    if (id) {
      const d = await req(
        "https://api.coingecko.com/api/v3/simple/price",
        {
          ids: id,
          vs_currencies: "usd",
          include_24hr_change: true,
          include_24hr_vol: true,
        },
        8000,
      );
      const c = d?.[id];
      if (c) {
        const t = {
          symbol: s,
          price: c.usd,
          change: 0,
          changePercent: c.usd_24h_change || 0,
          high: c.usd * 1.02,
          low: c.usd * 0.98,
          volume: c.usd_24h_vol || 0,
          quoteVolume: c.usd_24h_vol || 0,
        };
        cache.set(ck, t, 30);
        return t;
      }
    }
  } catch {}
  return null;
}

module.exports = { getKlines, getSymbols, getTicker };
