export function mountLoom(root, env) {
  const state = {
    env,
    text: "",
    times: [],
    lastTs: 0,
    pattern: null,
    copied: false,
    dayKey: ""
  };

  function dayKey(d=new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function haptic(){ if (navigator.vibrate) navigator.vibrate(10); }

  function hashSeed(str){
    let x = 0;
    for (let i=0;i<str.length;i++) x = (x*31 + str.charCodeAt(i)) >>> 0;
    return x >>> 0;
  }

  function rndFactory(seed){
    let x = seed >>> 0;
    return () => {
      x ^= (x << 13) >>> 0;
      x ^= (x >>> 17) >>> 0;
      x ^= (x << 5) >>> 0;
      return (x >>> 0) / 4294967296;
    };
  }

  function normalizeTimes(arr){
    if (!arr.length) return [];
    const a = arr.slice(-24);
    const min = Math.min(...a);
    const max = Math.max(...a);
    const span = Math.max(1, max - min);
    return a.map(v => (v - min) / span);
  }

  function buildWeave(text, times){
    const norm = normalizeTimes(times);
    const seed = hashSeed("loom:v1:" + state.dayKey + ":" + text + ":" + norm.join(","));
    const rnd = rndFactory(seed);

    const W = 28;
    const H = 18;
    const grid = Array.from({length:H}, () => Array.from({length:W}, () => 0));

    for (let y=0;y<H;y++){
      const t = norm[y % Math.max(1, norm.length)] ?? rnd();
      const density = clamp(0.15 + t*0.65, 0.1, 0.85);
      for (let x=0;x<W;x++){
        const base = ((x + y) % 2 === 0) ? 0.52 : 0.48;
        const noise = (rnd() - 0.5) * 0.35;
        const v = base + noise;
        grid[y][x] = v < density ? 1 : 0;
      }
    }

    const stripeRow = (text.length * 3 + Math.floor(rnd()*H)) % H;
    for (let x=0;x<W;x++){
      if (x % 3 === 0) grid[stripeRow][x] = 1;
    }

    return { seed, grid, W, H, stripeRow };
  }

  function saveToday(pattern){
    const key = "loom:day:" + state.dayKey;
    try {
      localStorage.setItem(key, JSON.stringify({
        text: state.text,
        times: state.times.slice(-48),
        pattern
      }));
    } catch {}
  }

  function loadDay(k){
    try {
      const raw = localStorage.getItem("loom:day:" + k);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function listLastDays(n=7){
    const out = [];
    const d = new Date();
    for (let i=0;i<n;i++){
      const dd = new Date(d.getTime() - i*86400000);
      out.push(dayKey(dd));
    }
    return out;
  }

  function roundRect(ctx,x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function draw(pattern){
    const cv = root.querySelector("#cv");
    if (!cv || !pattern) return;
    const ctx = cv.getContext("2d");

    const card = root.querySelector(".card");
    const cssW = Math.min(640, card.clientWidth - 24);
    const cssH = 240;

    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width = Math.floor(cssW * devicePixelRatio);
    cv.height = Math.floor(cssH * devicePixelRatio);
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

    const ink = "rgba(250,245,255,.92)";
    const copper = "#c77844";
    const teal = "#2dd4bf";

    ctx.clearRect(0,0,cssW,cssH);
    const g = ctx.createLinearGradient(0,0,cssW,cssH);
    g.addColorStop(0, "rgba(250,245,255,.06)");
    g.addColorStop(1, "rgba(0,0,0,.18)");
    roundRect(ctx, 0,0, cssW, cssH, 22);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.fillStyle = "rgba(250,245,255,.10)";
    roundRect(ctx, 14, 14, cssW-28, 44, 16);
    ctx.fill();
    ctx.fillStyle = copper;
    ctx.fillRect(14, 52, cssW-28, 4);

    ctx.fillStyle = ink;
    ctx.font = "900 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("LOOM • " + state.dayKey, 26, 42);

    const pad = 18;
    const top = 74;
    const left = pad;
    const w = cssW - pad*2;
    const h = cssH - top - 18;
    const cellW = w / pattern.W;
    const cellH = h / pattern.H;

    for (let y=0;y<pattern.H;y++){
      for (let x=0;x<pattern.W;x++){
        const on = pattern.grid[y][x] === 1;
        const x0 = left + x*cellW;
        const y0 = top + y*cellH;

        ctx.fillStyle = on ? teal : "rgba(250,245,255,.10)";
        ctx.fillRect(x0, y0, cellW, cellH);

        if (on && (x+y) % 7 === 0){
          ctx.fillStyle = "rgba(250,245,255,.14)";
          ctx.fillRect(x0+cellW*0.12, y0+cellH*0.12, cellW*0.76, cellH*0.76);
        }
      }
    }

    const sr = pattern.stripeRow ?? 0;
    ctx.fillStyle = "rgba(199,120,68,.35)";
    ctx.fillRect(left, top + sr*cellH, w, cellH);

    ctx.strokeStyle = "rgba(250,245,255,.16)";
    ctx.lineWidth = 2;
    roundRect(ctx, 10, 10, cssW-20, cssH-20, 22);
    ctx.stroke();

    ctx.fillStyle = "rgba(250,245,255,.70)";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    const sig = ("00000000" + (pattern.seed >>> 0).toString(16)).slice(-8).toUpperCase();
    ctx.fillText("SIG " + sig, 26, cssH-20);
  }

  async function copyPng(){
    const cv = root.querySelector("#cv");
    if (!cv || !state.pattern) return;
    try {
      const blob = await new Promise(res => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("no blob");
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        state.copied = true;
        render(false);
        haptic();
        return;
      }
    } catch {}
    downloadPng();
  }

  function downloadPng(){
    const cv = root.querySelector("#cv");
    if (!cv || !state.pattern) return;
    const url = cv.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `loom-${state.dayKey}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    state.copied = true;
    render(false);
    haptic();
  }

  async function rebuild(fromTyping=false){
    const t = (state.text || "").trim();
    if (!t) {
      state.pattern = null;
      saveToday(null);
      render(false);
      return;
    }
    state.pattern = buildWeave(t, state.times);
    saveToday(state.pattern);
    render(false);
    draw(state.pattern);
    if (fromTyping) haptic();
  }

  function render(focus=true){
    const days = listLastDays(7);
    const active = state.dayKey;

    root.innerHTML = `
      <div class="wrap">
        <header class="top">
          <div class="brand">
            <div class="logo">LOOM</div>
            <div class="sub">${env.isMini ? "Mini App" : "Web"} • typing → textile</div>
          </div>
          <button class="btn ghost" id="new" title="New weave (clears timing)">Reset</button>
        </header>

        <main class="card">
          <div class="hint">
            Your weave is generated from <b>keystroke timing</b> (not the words). Type slowly, fast, nervous, calm — different cloth.
          </div>

          <div class="field">
            <input id="inp" maxlength="64" placeholder="Type a line… (then press Enter)" value="${esc(state.text)}" />
            <button class="btn" id="weave">Weave</button>
          </div>

          <canvas id="cv" width="640" height="240" aria-label="Loom canvas"></canvas>

          <div class="actions">
            <button class="btn" id="copy">${state.copied ? "Copied" : "Copy PNG"}</button>
            <button class="btn ghost" id="dl">Download</button>
          </div>

          <div class="stripTitle">Last 7 days</div>
          <div class="days">
            ${days.map(d => `<button class="day ${d===active ? "on":""}" data-day="${d}">${d.slice(5)}</button>`).join("")}
          </div>

          <div class="tinyNote">${state.pattern ? "Tip: change your rhythm, not your words." : "Start typing to create your first weave."}</div>
        </main>

        <footer class="foot">
          <div class="envpill">${env.isMini ? "Farcaster/Base" : "Web preview"}</div>
          <div class="tiny">Saved locally.</div>
        </footer>
      </div>
    `;

    const inp = root.querySelector("#inp");

    root.querySelector("#new").addEventListener("click", () => {
      state.times = [];
      state.lastTs = 0;
      state.copied = false;
      try { localStorage.removeItem("loom:day:" + state.dayKey); } catch {}
      rebuild(true);
    });

    root.querySelector("#weave").addEventListener("click", () => rebuild(true));
    root.querySelector("#copy").addEventListener("click", copyPng);
    root.querySelector("#dl").addEventListener("click", downloadPng);

    inp.addEventListener("keydown", async (e) => {
      const now = performance.now();
      if (state.lastTs) {
        const dt = clamp(now - state.lastTs, 12, 900);
        if (e.key.length === 1 || e.key === "Backspace" || e.key === " ") {
          state.times.push(dt);
          if (state.times.length > 120) state.times = state.times.slice(-120);
        }
      }
      state.lastTs = now;

      if (e.key === "Enter") {
        e.preventDefault();
        state.text = inp.value;
        state.copied = false;
        try { localStorage.setItem("loom:lastText", state.text); } catch {}
        await rebuild(true);
      }
    });

    inp.addEventListener("input", () => {
      state.text = inp.value;
      state.copied = false;
    });

    root.querySelectorAll(".day").forEach(btn => {
      btn.addEventListener("click", () => {
        const dk = btn.getAttribute("data-day");
        if (!dk) return;
        state.dayKey = dk;
        const saved = loadDay(dk);
        if (saved) {
          state.text = saved.text || "";
          state.times = Array.isArray(saved.times) ? saved.times : [];
          state.pattern = saved.pattern || null;
        } else {
          state.text = "";
          state.times = [];
          state.pattern = null;
        }
        state.copied = false;
        render(false);
        if (state.pattern) draw(state.pattern);
        haptic();
      });
    });

    if (focus) inp.focus();
    if (state.pattern) draw(state.pattern);
  }

  state.dayKey = dayKey();
  const savedToday = loadDay(state.dayKey);
  if (savedToday) {
    state.text = savedToday.text || "";
    state.times = Array.isArray(savedToday.times) ? savedToday.times : [];
    state.pattern = savedToday.pattern || null;
  } else {
    try { state.text = localStorage.getItem("loom:lastText") || ""; } catch {}
    state.pattern = state.text ? buildWeave(state.text, []) : null;
    if (state.pattern) saveToday(state.pattern);
  }

  render(true);
}
