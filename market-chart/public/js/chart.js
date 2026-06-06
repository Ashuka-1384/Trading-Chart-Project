const Chart = (() => {
  // ── State ──
  let data = [],
    type = "candlestick";
  let vs = 0,
    ve = 0;
  let cw = 8,
    cs = 2,
    tw = 10;
  let W = 0,
    H = 0,
    VH = 55;
  let pMin = 0,
    pMax = 0;
  let mx = -1,
    my = -1;

  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartVS = 0;
  let dragStartVE = 0;
  let hasDragged = false; // to differentiate click from drag

  // Price axis state
  let manScale = false,
    mMin = 0,
    mMax = 0;
  let paActive = false;

  // History
  let onHistory = null,
    histLock = false;

  // Render
  let dirty = true;
  let rafId = 0;

  // Canvas
  let cvM, ctxM, cvV, ctxV, cvP, ctxP, cvT, ctxT;
  let C = {};

  function setHistoryCallback(fn) {
    onHistory = fn;
  }

  // ── Colors ──
  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const g = (k) => s.getPropertyValue(k).trim();
    C = {
      bg: g("--cbg"),
      grid: g("--grid"),
      ch: g("--ch"),
      t1: g("--t1"),
      t2: g("--t2"),
      t3: g("--t3"),
      g: g("--g"),
      r: g("--r"),
      b: g("--b"),
      bg2: g("--bg2"),
    };
  }

  // ── Init ──
  function init() {
    cvM = document.getElementById("cvMain");
    cvV = document.getElementById("cvVol");
    cvP = document.getElementById("cvPA");
    cvT = document.getElementById("cvTA");
    ctxM = cvM.getContext("2d");
    ctxV = cvV.getContext("2d");
    ctxP = cvP.getContext("2d");
    ctxT = cvT.getContext("2d");
    readColors();
    resize();
    bindChart();
    bindPriceAxis();
    bindTouch();
    window.addEventListener("resize", resize);
    new MutationObserver(() => {
      readColors();
      markDirty();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    loop();
  }

  function loop() {
    if (dirty) {
      dirty = false;
      doRender();
    }
    rafId = requestAnimationFrame(loop);
  }

  function markDirty() {
    dirty = true;
  }

  // ── Canvas setup ──
  function setupCv(cv, w, h) {
    const d = devicePixelRatio || 1;
    cv.width = w * d;
    cv.height = h * d;
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return ctx;
  }

  function resize() {
    const el = document.getElementById("chartMain");
    W = el.clientWidth;
    H = Math.max(el.clientHeight - VH, 50);

    ctxM = setupCv(cvM, W, H);
    cvM.style.height = H + "px";

    ctxV = setupCv(cvV, W, VH);

    const pa = document.getElementById("priceAxis");
    ctxP = setupCv(cvP, pa.clientWidth, pa.clientHeight);

    const ta = document.getElementById("timeAxis");
    ctxT = setupCv(cvT, ta.clientWidth, ta.clientHeight);

    if (data.length > 0) {
      const visCount = Math.floor(W / tw);
      // Keep view position - only adjust if at the right edge
      if (ve >= data.length - 3) {
        ve = data.length - 1;
        vs = Math.max(0, ve - visCount + 1);
      } else {
        // Keep current center
        const center = Math.floor((vs + ve) / 2);
        vs = Math.max(0, center - Math.floor(visCount / 2));
        ve = Math.min(data.length - 1, vs + visCount - 1);
      }
    }
    markDirty();
  }

  // ── Data ──
  function setData(d, prepend = false) {
    if (prepend && data.length && d?.length) {
      const set = new Set(data.map((c) => c.time));
      const nw = d.filter((c) => !set.has(c.time));
      if (!nw.length) {
        histLock = false;
        return;
      }
      const shift = nw.length;
      data = [...nw, ...data].sort((a, b) => a.time - b.time);
      // Remove duplicates after sort
      const seen = new Set();
      data = data.filter((c) => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      });
      vs += shift;
      ve += shift;
      histLock = false;
      manScale = false;
      markDirty();
      return;
    }

    data = d || [];
    if (!data.length) return;

    // Remove duplicates
    const seen = new Set();
    data = data.filter((c) => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    });

    const visCount = Math.floor(W / tw);
    ve = data.length - 1;
    vs = Math.max(0, ve - visCount + 1);
    manScale = false;
    histLock = false;
    markDirty();
  }

  function setType(t) {
    type = t;
    markDirty();
  }

  // ── View Navigation ──
  function clampView() {
    // Allow scrolling beyond data to the left (for loading history)
    // and some empty space to the right
    const visCount = ve - vs + 1;
    const maxStart = data.length - 1; // can scroll right until only 1 candle visible
    const minStart = -Math.floor(visCount * 0.8); // allow some empty space on left

    if (vs < minStart) {
      vs = minStart;
      ve = vs + visCount - 1;
    }
    if (vs > maxStart) {
      vs = maxStart;
      ve = vs + visCount - 1;
    }
  }

  // ── Price Range ──
  function calcRange() {
    if (manScale) {
      pMin = mMin;
      pMax = mMax;
      return;
    }

    // Get visible candles (only real ones, not empty space)
    const realStart = Math.max(0, vs);
    const realEnd = Math.min(data.length - 1, ve);
    const vis = data.slice(realStart, realEnd + 1);

    if (!vis.length) {
      // If no visible candles, use last known data
      if (data.length > 0) {
        const last = data[data.length - 1];
        pMin = last.low * 0.99;
        pMax = last.high * 1.01;
      }
      return;
    }

    let lo = Infinity,
      hi = -Infinity;
    for (const c of vis) {
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
    }
    const r = hi - lo || lo * 0.01 || 1;
    pMin = lo - r * 0.08;
    pMax = hi + r * 0.08;
  }

  const p2y = (p) => H - ((p - pMin) / (pMax - pMin)) * H;
  const y2p = (y) => pMin + ((H - y) / H) * (pMax - pMin);
  const i2x = (i) => (i - vs) * tw + tw / 2;
  const x2i = (x) => Math.round((x - tw / 2) / tw + vs);

  // ── Heikin Ashi ──
  function haCalc() {
    const out = [];
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const cl = (c.open + c.high + c.low + c.close) / 4;
      const op = i
        ? (out[i - 1].open + out[i - 1].close) / 2
        : (c.open + c.close) / 2;
      out.push({
        time: c.time,
        open: op,
        high: Math.max(c.high, op, cl),
        low: Math.min(c.low, op, cl),
        close: cl,
        volume: c.volume,
      });
    }
    return out;
  }

  // ── Format ──
  function fP(p) {
    if (p == null || isNaN(p)) return "—";
    const a = Math.abs(p);
    if (a >= 1e4) return p.toFixed(2);
    if (a >= 100) return p.toFixed(2);
    if (a >= 1) return p.toFixed(4);
    if (a >= 0.01) return p.toFixed(5);
    if (a >= 1e-4) return p.toFixed(6);
    return p.toFixed(8);
  }

  function fV(v) {
    if (!v) return "—";
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return v.toFixed(0);
  }

  const pad = (n) => String(n).padStart(2, "0");

  function fTShort(ts) {
    const d = new Date(ts);
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fTFull(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function niceStep(v) {
    if (v <= 0) return 1;
    const e = Math.floor(Math.log10(v));
    const f = v / Math.pow(10, e);
    return (f <= 1.5 ? 1 : f <= 3.5 ? 2 : f <= 7.5 ? 5 : 10) * Math.pow(10, e);
  }

  // ════════════ RENDER ════════════
  function doRender() {
    if (!data.length) return;
    calcRange();
    readColors();
    drawMain();
    drawVolume();
    drawPriceAxis();
    drawTimeAxis();
    drawOHLCInfo();

    // Load history when near start
    if (vs <= 5 && !histLock && onHistory && data.length > 0) {
      histLock = true;
      onHistory(data[0].time);
    }
  }

  // ── Main Chart ──
  function drawMain() {
    const ctx = ctxM;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const range = pMax - pMin;
    if (range <= 0) return;

    // Grid lines
    const step = niceStep(range / 8);
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let p = Math.ceil(pMin / step) * step; p <= pMax; p += step) {
      const y = Math.round(p2y(p)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Determine which candles to draw
    let dc = type === "heikinashi" ? haCalc() : data;
    const drawStart = Math.max(0, vs);
    const drawEnd = Math.min(dc.length - 1, ve);

    if (drawStart > drawEnd) return;

    const vis = [];
    for (let i = drawStart; i <= drawEnd; i++) {
      vis.push({ idx: i, candle: dc[i] });
    }

    // Draw candles
    switch (type) {
      case "candlestick":
      case "heikinashi":
        drawCandles(ctx, vis);
        break;
      case "ohlc":
        drawOHLCBars(ctx, vis);
        break;
      case "line":
        drawLine(ctx, vis);
        break;
      case "area":
        drawArea(ctx, vis);
        break;
    }

    // Last price line
    const last = data[data.length - 1];
    const ly = p2y(last.close);
    if (ly >= -10 && ly <= H + 10) {
      const up = last.close >= last.open;
      ctx.strokeStyle = up ? C.g : C.r;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(W, ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Crosshair
    if (mx >= 0 && mx <= W && my >= 0 && my <= H && !paActive && !isDragging) {
      ctx.strokeStyle = C.ch;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, my);
      ctx.lineTo(W, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price tag
      const el = document.getElementById("chPriceTag");
      el.textContent = fP(y2p(my));
      el.style.display = "block";
      el.style.top = Math.max(0, Math.min(H - 18, my - 9)) + "px";

      // Time tag
      const idx = x2i(mx);
      if (idx >= 0 && idx < data.length) {
        const el2 = document.getElementById("chTimeTag");
        el2.textContent = fTFull(data[idx].time);
        el2.style.display = "block";
        el2.style.left = mx + "px";
        el2.style.bottom = VH + "px";
      } else {
        document.getElementById("chTimeTag").style.display = "none";
      }
    } else {
      document.getElementById("chPriceTag").style.display = "none";
      document.getElementById("chTimeTag").style.display = "none";
    }
  }

  function drawCandles(ctx, vis) {
    for (const { idx, candle: c } of vis) {
      const x = (idx - vs) * tw + tw / 2;
      if (x < -tw || x > W + tw) continue;

      const up = c.close >= c.open;
      const col = up ? C.g : C.r;
      const bodyTop = p2y(Math.max(c.open, c.close));
      const bodyBot = p2y(Math.min(c.open, c.close));
      const bodyH = Math.max(bodyBot - bodyTop, 1);

      // Wicks
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      const highY = p2y(c.high);
      const lowY = p2y(c.low);
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, bodyTop);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, bodyBot);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body - BOTH green and red are FILLED (solid)
      ctx.fillStyle = col;
      ctx.fillRect(x - cw / 2, bodyTop, cw, bodyH);

      // Optional: slight border for better visibility
      if (cw >= 4) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - cw / 2, bodyTop, cw, bodyH);
      }
    }
  }

  function drawOHLCBars(ctx, vis) {
    for (const { idx, candle: c } of vis) {
      const x = (idx - vs) * tw + tw / 2;
      if (x < -tw || x > W + tw) continue;

      const up = c.close >= c.open;
      ctx.strokeStyle = up ? C.g : C.r;
      ctx.lineWidth = 1.2;

      // High-Low line
      ctx.beginPath();
      ctx.moveTo(x, p2y(c.high));
      ctx.lineTo(x, p2y(c.low));
      ctx.stroke();

      // Open tick (left)
      const oy = p2y(c.open);
      ctx.beginPath();
      ctx.moveTo(x - cw / 2, oy);
      ctx.lineTo(x, oy);
      ctx.stroke();

      // Close tick (right)
      const cy = p2y(c.close);
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + cw / 2, cy);
      ctx.stroke();
    }
  }

  function drawLine(ctx, vis) {
    if (vis.length < 2) return;
    ctx.strokeStyle = C.b;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let started = false;
    for (const { idx, candle: c } of vis) {
      const x = (idx - vs) * tw + tw / 2;
      const y = p2y(c.close);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawArea(ctx, vis) {
    if (vis.length < 2) return;
    const pts = [];
    ctx.strokeStyle = C.b;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (const { idx, candle: c } of vis) {
      const x = (idx - vs) * tw + tw / 2;
      const y = p2y(c.close);
      pts.push({ x, y });
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (pts.length < 2) return;
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(41,98,255,.22)");
    gr.addColorStop(1, "rgba(41,98,255,.01)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.lineTo(pts[0].x, H);
    ctx.closePath();
    ctx.fill();
  }

  // ── Volume ──
  function drawVolume() {
    const ctx = ctxV;
    ctx.clearRect(0, 0, W, VH);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, VH);

    const dc = type === "heikinashi" ? haCalc() : data;
    const drawStart = Math.max(0, vs);
    const drawEnd = Math.min(dc.length - 1, ve);
    if (drawStart > drawEnd) return;

    let maxV = 0;
    for (let i = drawStart; i <= drawEnd; i++) {
      if (dc[i].volume > maxV) maxV = dc[i].volume;
    }
    if (maxV === 0) return;

    for (let i = drawStart; i <= drawEnd; i++) {
      const c = dc[i];
      const x = (i - vs) * tw + tw / 2;
      if (x < -tw || x > W + tw) continue;

      const h = (c.volume / maxV) * (VH - 4);
      const up = c.close >= c.open;
      ctx.fillStyle = (up ? C.g : C.r) + "40";
      ctx.fillRect(x - cw / 2, VH - h, cw, h);
    }

    // Crosshair vertical line on volume
    if (mx >= 0 && mx <= W && !paActive && !isDragging) {
      ctx.strokeStyle = C.ch;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, VH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Price Axis ──
  function drawPriceAxis() {
    const el = document.getElementById("priceAxis");
    const w = el.clientWidth,
      h = el.clientHeight;
    const ctx = ctxP;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    if (!data.length) return;
    const range = pMax - pMin;
    if (range <= 0) return;

    const step = niceStep(range / 8);
    ctx.fillStyle = C.t2;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    for (let p = Math.ceil(pMin / step) * step; p <= pMax; p += step) {
      const y = p2y(p);
      if (y > 8 && y < H - 8) {
        ctx.fillText(fP(p), 5, y + 4);
      }
    }

    // Last price
    const last = data[data.length - 1];
    const ly = p2y(last.close);
    if (ly > -5 && ly < H + 5) {
      const up = last.close >= last.open;
      ctx.fillStyle = up ? C.g : C.r;
      ctx.fillRect(0, ly - 9, w, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(fP(last.close), 5, ly + 4);
    }

    // Crosshair price
    if (my >= 0 && my <= H && !paActive && !isDragging) {
      ctx.fillStyle = C.b;
      ctx.fillRect(0, my - 9, w, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "11px monospace";
      ctx.fillText(fP(y2p(my)), 5, my + 4);
    }
  }

  // ── Time Axis ──
  function drawTimeAxis() {
    const el = document.getElementById("timeAxis");
    const w = el.clientWidth,
      h = el.clientHeight;
    const ctx = ctxT;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    if (!data.length) return;

    const vc = ve - vs + 1;
    const step = Math.max(1, Math.floor(vc / 8));
    ctx.fillStyle = C.t2;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";

    for (
      let i = Math.max(0, vs);
      i <= Math.min(data.length - 1, ve);
      i += step
    ) {
      const x = (i - vs) * tw + tw / 2;
      if (x >= 0 && x <= w) {
        ctx.fillText(fTShort(data[i].time), x, h / 2 + 4);
      }
    }

    // Crosshair time label
    if (mx >= 0 && mx <= w && !paActive && !isDragging) {
      const idx = x2i(mx);
      if (idx >= 0 && idx < data.length) {
        const txt = fTFull(data[idx].time);
        const m = ctx.measureText(txt);
        const lw = m.width + 10;
        ctx.fillStyle = C.b;
        ctx.fillRect(mx - lw / 2, 0, lw, h);
        ctx.fillStyle = "#fff";
        ctx.fillText(txt, mx, h / 2 + 4);
      }
    }
  }

  // ── OHLC Info Bar ──
  function drawOHLCInfo() {
    const dc = type === "heikinashi" ? haCalc() : data;
    let c;

    if (mx >= 0 && !paActive && !isDragging) {
      const idx = x2i(mx);
      if (idx >= 0 && idx < dc.length) c = dc[idx];
    }
    if (!c && dc.length > 0) c = dc[dc.length - 1];
    if (!c) return;

    const up = c.close >= c.open;
    const col = up ? C.g : C.r;
    document.getElementById("ohlcInfo").innerHTML =
      `<span style="color:${C.t3}">O </span><span style="color:${col}">${fP(c.open)}</span> ` +
      `<span style="color:${C.t3}">H </span><span style="color:${col}">${fP(c.high)}</span> ` +
      `<span style="color:${C.t3}">L </span><span style="color:${col}">${fP(c.low)}</span> ` +
      `<span style="color:${C.t3}">C </span><span style="color:${col}">${fP(c.close)}</span> ` +
      `<span style="color:${C.t3}">V </span><span style="color:${C.t1}">${fV(c.volume)}</span>`;
  }

  // ════════════ EVENTS ════════════

  function bindChart() {
    const el = document.getElementById("chartMain");

    // ── Mouse Move ──
    el.addEventListener("mousemove", (e) => {
      if (paActive) return;

      const r = cvM.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (my > H) my = -1;

      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const pixelsMoved = Math.abs(dx);

        // Only count as drag if moved more than 3 pixels
        if (pixelsMoved > 3) hasDragged = true;

        if (hasDragged) {
          const candleShift = Math.round(dx / tw);
          const visCount = dragStartVE - dragStartVS;

          let newStart = dragStartVS - candleShift;

          // Allow free scrolling with generous limits
          const minStart = -Math.floor(visCount * 0.9);
          const maxStart = data.length - 1;

          newStart = Math.max(minStart, Math.min(maxStart, newStart));

          vs = newStart;
          ve = newStart + visCount;
          manScale = false;
        }
      }

      markDirty();
    });

    // ── Mouse Leave ──
    el.addEventListener("mouseleave", () => {
      if (!paActive && !isDragging) {
        mx = -1;
        my = -1;
        markDirty();
      }
    });

    // ── Mouse Down ──
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;

      isDragging = true;
      hasDragged = false;
      dragStartX = e.clientX;
      dragStartVS = vs;
      dragStartVE = ve;
      el.style.cursor = "grabbing";

      e.preventDefault();
    });

    // ── Mouse Up (on window to catch all cases) ──
    window.addEventListener("mouseup", (e) => {
      if (isDragging) {
        isDragging = false;
        document.getElementById("chartMain").style.cursor = "crosshair";
        // Don't do anything else - just stop dragging
        // The view stays where it is
      }
    });

    // ── Wheel Zoom ──
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();

        const zoomIn = e.deltaY < 0;
        const visCount = ve - vs + 1;

        // Find the candle under mouse for zoom center
        const centerIdx = mx >= 0 ? x2i(mx) : Math.floor((vs + ve) / 2);
        const centerPct =
          visCount > 1 ? (centerIdx - vs) / (visCount - 1) : 0.5;

        if (zoomIn) {
          // Zoom IN - show fewer candles, bigger candles
          if (visCount > 8) {
            if (cw < 50) {
              cw += 1;
              tw = cw + cs;
            }
            const newVisCount = Math.max(8, Math.floor(W / tw));
            vs = Math.round(centerIdx - newVisCount * centerPct);
            ve = vs + newVisCount - 1;
          }
        } else {
          // Zoom OUT - show more candles, smaller candles
          if (cw > 1) {
            cw -= 1;
            tw = cw + cs;
          }
          const newVisCount = Math.floor(W / tw);
          vs = Math.round(centerIdx - newVisCount * centerPct);
          ve = vs + newVisCount - 1;
        }

        // Clamp
        if (vs < -Math.floor((ve - vs) * 0.9)) {
          vs = -Math.floor((ve - vs) * 0.9);
        }
        if (ve > data.length + Math.floor((ve - vs) * 0.5)) {
          ve = data.length + Math.floor((ve - vs) * 0.5);
          vs = ve - Math.floor(W / tw) + 1;
        }

        manScale = false;
        markDirty();
      },
      { passive: false },
    );
  }

  // ── Price Axis Events ──
  function bindPriceAxis() {
    const pa = document.getElementById("priceAxis");

    pa.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!manScale) calcRange();

      paActive = true;
      const startY = e.clientY;
      const startPMin = pMin;
      const startPMax = pMax;
      manScale = true;

      const onMove = (ev) => {
        if (!paActive) return;
        ev.preventDefault();

        const dy = ev.clientY - startY;
        const range = startPMax - startPMin;
        const mid = (startPMax + startPMin) / 2;
        const factor = Math.pow(1.004, dy);
        const newRange = Math.max(
          range * 0.005,
          Math.min(range * 200, range * factor),
        );

        mMin = mid - newRange / 2;
        mMax = mid + newRange / 2;
        pMin = mMin;
        pMax = mMax;
        markDirty();
      };

      const onUp = (ev) => {
        ev.preventDefault();
        paActive = false;
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("mouseup", onUp, true);
      };

      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("mouseup", onUp, true);
    });

    pa.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      manScale = false;
      markDirty();
    });

    pa.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!manScale) {
          calcRange();
          manScale = true;
        }

        const range = pMax - pMin;
        const mid = (pMax + pMin) / 2;
        const factor = e.deltaY > 0 ? 1.06 : 0.94;
        const newRange = Math.max(
          range * 0.005,
          Math.min(range * 200, range * factor),
        );

        mMin = mid - newRange / 2;
        mMax = mid + newRange / 2;
        pMin = mMin;
        pMax = mMax;
        markDirty();
      },
      { passive: false },
    );
  }

  // ── Touch Events ──
  function bindTouch() {
    const el = document.getElementById("chartMain");
    let touchStartX = 0;
    let touchStartVS = 0;
    let touchStartVE = 0;
    let lastPinchDist = 0;

    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartVS = vs;
          touchStartVE = ve;
        } else if (e.touches.length === 2) {
          lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
        }
        e.preventDefault();
      },
      { passive: false },
    );

    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) {
          const dx = e.touches[0].clientX - touchStartX;
          const shift = Math.round(dx / tw);
          const visCount = touchStartVE - touchStartVS;
          vs = Math.max(
            -Math.floor(visCount * 0.9),
            Math.min(data.length - 1, touchStartVS - shift),
          );
          ve = vs + visCount;
          manScale = false;
          markDirty();
        } else if (e.touches.length === 2 && lastPinchDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          const scale = dist / lastPinchDist;
          const visCount = ve - vs + 1;
          const newCount = Math.max(8, Math.round(visCount / scale));
          const mid = Math.floor((vs + ve) / 2);

          vs = Math.max(0, mid - Math.floor(newCount / 2));
          ve = Math.min(data.length - 1, vs + newCount);

          lastPinchDist = dist;
          manScale = false;
          markDirty();
        }
        e.preventDefault();
      },
      { passive: false },
    );

    el.addEventListener("touchend", () => {
      lastPinchDist = 0;
    });
  }

  return {
    init,
    resize,
    setData,
    setType,
    render: markDirty,
    setHistoryCallback,
    getData: () => data,
    getView: () => ({ vs, ve }),
  };
})();
