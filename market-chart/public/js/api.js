const API = (() => {
  const B = "/api/market";
  async function j(u) {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d.success) throw new Error(d.error || "Error");
    return d.data;
  }
  return {
    klines(m, s, i, l, end) {
      let u = `${B}/${m}/klines?symbol=${encodeURIComponent(s)}&interval=${i}&limit=${l}`;
      if (end) u += `&endTime=${end}`;
      return j(u);
    },
    symbols: (m) => j(`${B}/${m}/symbols`),
    ticker: (s) => j(`${B}/crypto/ticker?symbol=${encodeURIComponent(s)}`),
  };
})();
