(function () {
  let market = "crypto",
    symbol = "BTCUSDT",
    interval = "1h";
  let autoRef = true,
    refTimer = null,
    symsCache = {},
    dark = true;

  window.addEventListener("DOMContentLoaded", () => {
    Chart.init();
    Chart.setHistoryCallback(loadHist);
    wireAll();
    setInterval(clock, 1000);
    clock();
    load();
    startRef();
  });

  // ─── Load ───
  async function load() {
    show("loadBox", true);
    show("errBox", false);
    try {
      const d = await API.klines(market, symbol, interval, 1000);
      if (!d?.length) throw new Error("داده‌ای دریافت نشد");
      Chart.setData(d);
      show("loadBox", false);
      document.getElementById("sbCount").textContent = d.length + " کندل";
      updInfo(d);
    } catch (e) {
      show("loadBox", false);
      show("errBox", true);
      document.getElementById("errMsg").textContent = e.message;
    }
  }

  async function loadHist(oldest) {
    try {
      const d = await API.klines(market, symbol, interval, 1000, oldest - 1);
      if (d?.length) {
        Chart.setData(d, true);
        document.getElementById("sbCount").textContent =
          Chart.getData().length + " کندل";
      }
    } catch {}
  }

  async function refresh() {
    try {
      const d = await API.klines(market, symbol, interval, 200);
      if (!d?.length) return;
      const old = Chart.getData();
      const minT = Math.min(...d.map((c) => c.time));
      const kept = old.filter((c) => c.time < minT);
      const merged = [...kept, ...d].sort((a, b) => a.time - b.time);
      Chart.setData(merged);
      updInfo(merged);
    } catch {}
  }

  function updInfo(d) {
    if (!d?.length) return;
    const last = d[d.length - 1],
      lb = Math.min(d.length, 24),
      first = d[d.length - lb];
    const chg = ((last.close - first.open) / first.open) * 100;
    document.getElementById("symPrice").textContent = fp(last.close);
    const ce = document.getElementById("symChange");
    ce.textContent = (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%";
    ce.className = "badge " + (chg >= 0 ? "up" : "dn");
    let h = -Infinity,
      l = Infinity,
      v = 0;
    for (let i = d.length - lb; i < d.length; i++) {
      if (d[i].high > h) h = d[i].high;
      if (d[i].low < l) l = d[i].low;
      v += d[i].volume;
    }
    document.getElementById("sHigh").textContent = fp(h);
    document.getElementById("sLow").textContent = fp(l);
    document.getElementById("sVol").textContent = fv(v);
    if (market === "crypto")
      API.ticker(symbol)
        .then((t) => {
          if (!t) return;
          document.getElementById("symPrice").textContent = fp(t.price);
          ce.textContent =
            (t.changePercent >= 0 ? "+" : "") +
            t.changePercent.toFixed(2) +
            "%";
          ce.className = "badge " + (t.changePercent >= 0 ? "up" : "dn");
          document.getElementById("sHigh").textContent = fp(t.high);
          document.getElementById("sLow").textContent = fp(t.low);
          document.getElementById("sVol").textContent = fv(
            t.quoteVolume || t.volume,
          );
        })
        .catch(() => {});
  }

  function fp(p) {
    if (p == null || isNaN(p)) return "—";
    return p >= 1e4
      ? p.toLocaleString("en", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : p >= 1
        ? p.toFixed(4)
        : p >= 0.01
          ? p.toFixed(5)
          : p.toFixed(8);
  }
  function fv(v) {
    return !v || isNaN(v)
      ? "—"
      : v >= 1e9
        ? (v / 1e9).toFixed(2) + "B"
        : v >= 1e6
          ? (v / 1e6).toFixed(2) + "M"
          : v >= 1e3
            ? (v / 1e3).toFixed(1) + "K"
            : v.toFixed(0);
  }
  function show(id, v) {
    const e = document.getElementById(id);
    if (e.classList.contains("overlay")) e.classList.toggle("hide", !v);
    else e.style.display = v ? "flex" : "none";
  }

  function startRef() {
    if (refTimer) clearInterval(refTimer);
    if (!autoRef) return;
    const ms =
      {
        "1m": 5000,
        "3m": 5000,
        "5m": 5000,
        "15m": 15000,
        "30m": 15000,
        "1h": 30000,
        "2h": 30000,
      }[interval] || 60000;
    refTimer = setInterval(refresh, ms);
  }

  // ─── Wiring ───
  function wireAll() {
    // Timeframes
    document.querySelectorAll(".tf").forEach((b) =>
      b.addEventListener("click", () => {
        document
          .querySelectorAll(".tf")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        interval = b.dataset.i;
        document.getElementById("sbTf").textContent = b.textContent;
        load();
        startRef();
      }),
    );

    // Chart types
    document.querySelectorAll(".ct").forEach((b) =>
      b.addEventListener("click", () => {
        document
          .querySelectorAll(".ct")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        Chart.setType(b.dataset.t);
      }),
    );

    // Symbol selector
    const sel = document.getElementById("symbolSel");
    document.getElementById("symBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      sel.classList.toggle("open");
      if (sel.classList.contains("open")) {
        document.getElementById("symSearch").value = "";
        document.getElementById("symSearch").focus();
        loadSyms(market);
      }
    });
    document.addEventListener("click", () => sel.classList.remove("open"));
    document
      .getElementById("symDrop")
      .addEventListener("click", (e) => e.stopPropagation());

    document.querySelectorAll(".sym-tab").forEach((b) =>
      b.addEventListener("click", () => {
        document
          .querySelectorAll(".sym-tab")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        loadSyms(b.dataset.m, document.getElementById("symSearch").value);
      }),
    );

    document.getElementById("symSearch").addEventListener("input", (e) => {
      loadSyms(
        document.querySelector(".sym-tab.active").dataset.m,
        e.target.value,
      );
    });

    document.getElementById("retryBtn").addEventListener("click", load);

    // Theme
    document.getElementById("btnTheme").addEventListener("click", () => {
      dark = !dark;
      document.documentElement.setAttribute(
        "data-theme",
        dark ? "dark" : "light",
      );
      document.getElementById("btnTheme").textContent = dark ? "🌙" : "☀️";
    });

    // Fullscreen
    document.getElementById("btnFs").addEventListener("click", () => {
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen().catch(() => {});
    });
  }

  async function loadSyms(m, filter = "") {
    const list = document.getElementById("symList");
    list.innerHTML =
      '<div style="padding:15px;text-align:center;color:var(--t2)">⏳</div>';
    try {
      if (!symsCache[m]) symsCache[m] = await API.symbols(m);
      let syms = symsCache[m];
      if (filter) {
        const f = filter.toLowerCase();
        syms = syms.filter(
          (s) =>
            s.symbol.toLowerCase().includes(f) ||
            (s.name || "").toLowerCase().includes(f) ||
            (s.fullName || "").toLowerCase().includes(f) ||
            (s.baseAsset || "").toLowerCase().includes(f),
        );
      }
      syms = syms.slice(0, 80);
      if (!syms.length) {
        list.innerHTML =
          '<div style="padding:15px;text-align:center;color:var(--t2)">نمادی یافت نشد</div>';
        return;
      }
      list.innerHTML = "";
      for (const s of syms) {
        const d = document.createElement("div");
        d.className =
          "sym-item" + (s.symbol === symbol && m === market ? " active" : "");
        d.innerHTML = `<span class="sym-item-s">${s.symbol}</span><span class="sym-item-n">${s.fullName || s.name || ""}</span>`;
        d.addEventListener("click", () =>
          pick(m, s.symbol, s.name || s.symbol),
        );
        list.appendChild(d);
      }
    } catch (e) {
      list.innerHTML = `<div style="padding:15px;text-align:center;color:var(--r)">${e.message}</div>`;
    }
  }

  function pick(m, s, name) {
    market = m;
    symbol = s;
    document.getElementById("symName").textContent = name;
    document.getElementById("sbMarket").textContent = {
      crypto: "کریپتو",
      forex: "فارکس",
      stock: "سهام",
    }[m];
    document.getElementById("symbolSel").classList.remove("open");
    document
      .querySelectorAll(".sym-tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.m === m));
    load();
    startRef();
  }

  function clock() {
    document.getElementById("sbClock").textContent =
      new Date().toLocaleTimeString("en", { hour12: false });
  }
})();
