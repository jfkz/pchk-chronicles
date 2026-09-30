// Страница просмотра с анимацией: сцена синхронизируется с YouTube-плеером.
// Состояние сцены — чистая функция времени видео: любая перемотка сразу даёт правильную картинку.
(() => {
const W = 1280, H = 720, GROUND = 560;
const root = document.getElementById("watch");
const base = root.dataset.base;                // /anim/53/
const cv = document.getElementById("stage"), ctx = cv.getContext("2d");
const capEl = document.getElementById("caption"), plotEl = document.getElementById("plot");
cv.width = W; cv.height = H;

const SPRITE_OF = { peasant1: "shlepa", peasant2: "shlepa", peasant3: "shlepa", didi: "lyosha",
  zombie1: "zombie", zombie2: "zombie", zombie3: "zombie", angel1: "angel", angel2: "angel", angel3: "angel" };
const HEROES = ["sofia", "yulian", "vitya", "bagira", "titus"];
const img = {};                                 // кэш картинок
function load(name, src) {
  if (!img[name]) { const i = new Image(); i.src = src; img[name] = i; }
  return img[name];
}

let TL, MAN, scenes = [], events = [];
Promise.all([fetch(base + "timeline.json").then(r => r.json()), fetch(base + "manifest.json").then(r => r.json())]).then(([tl, man]) => {
  TL = tl; MAN = man; scenes = tl.scenes.slice().sort((a, b) => a.t - b.t);
  events = tl.events.slice().sort((a, b) => a.t - b.t);
  Object.keys(man.sprites).forEach(k => load("s:" + k, base + "sprites/" + k + ".webp"));
  Object.keys(man.bgs).forEach(k => load("b:" + k, base + "bg/" + k + ".webp"));
  buildPlot(tl.plot || []);
  requestAnimationFrame(frame);
});

// ---------- плеер ----------
const DBG = new URLSearchParams(location.search).get("at");   // ?at=SEC — показать сцену на конкретной секунде без плеера (для проверки)
let player = null, ready = false, clock = { t: 0, at: performance.now(), playing: false, rate: 1 };
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("yt", { videoId: root.dataset.video, playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
    events: { onReady: () => { ready = true; }, onStateChange: e => { clock.playing = e.data === 1; sync(); },
      onPlaybackRateChange: e => { clock.rate = e.data; } } });
};
function sync() { if (!ready) return; clock.t = player.getCurrentTime(); clock.at = performance.now(); clock.rate = player.getPlaybackRate(); }
function now() {
  if (DBG != null) return +DBG;
  if (!ready) return clock.t;
  const real = player.getCurrentTime();
  if (!clock.playing) { clock.t = real; clock.at = performance.now(); clock.lastReal = real; return real; }
  let guess = clock.t + (performance.now() - clock.at) / 1000 * clock.rate;
  if (real !== clock.lastReal) {                 // пришло новое значение от плеера: мягко подтягиваем
    clock.lastReal = real;
    guess = Math.abs(real - guess) > 0.4 ? real : guess + (real - guess) * 0.3;
  }
  clock.t = guess; clock.at = performance.now(); return guess;
}
function seek(t) { if (ready) { player.seekTo(Math.max(0, t - 1), true); player.playVideo(); } }
const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);

// ---------- сюжет под сценой ----------
function fmt(t) { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); }
const esc = x => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let plotItems = [];
function buildPlot(items) {
  plotItems = items;
  plotEl.innerHTML = items.map((p, i) => `<li data-i="${i}"><button type="button"><span class="tc">${fmt(p.t)}</span> ${esc(p.text)}</button></li>`).join("");
  plotEl.addEventListener("click", e => { const b = e.target.closest("li"); if (b) seek(items[+b.dataset.i].t); });
}
let lastPlot = -2;
function markPlot(t) {
  let k = -1; plotItems.forEach((p, i) => { if (p.t <= t) k = i; });
  if (k === lastPlot) return; lastPlot = k;
  plotEl.querySelectorAll("li").forEach((li, i) => li.classList.toggle("now", i === k));
}

// ---------- симуляция ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = p => p * p * (3 - 2 * p);
function sceneAt(t) { let s = scenes[0]; for (const c of scenes) if (c.t <= t) s = c; return s; }
function hashy(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const px = x => x / 100 * W;

function simulate(t) {
  const sc = sceneAt(t), i = scenes.indexOf(sc), end = i + 1 < scenes.length ? scenes[i + 1].t : 1e9;
  const A = {}, fx = [], bubbles = [], floats = [];
  const get = id => A[id] || (A[id] = { id, x: 50, face: 1, vis: false, alive: true, mv: null, hitAt: -9, status: null, lunge: null, dieAt: null, reviveAt: null });
  for (const [id, c] of Object.entries(sc.cast || {})) { const a = get(id); a.x = c.x; a.vis = true; a.face = c.face || (c.x > 62 ? -1 : 1); }
  const X = (a, tm) => { const m = a.mv; if (!m) return a.x; const p = clamp((tm - m.t0) / m.dur, 0, 1); return m.x0 + (m.x1 - m.x0) * ease(p); };
  for (const e of events) {
    if (e.t < sc.t || e.t >= end) continue;
    if (e.t > t) break;
    const a = e.id ? get(e.id) : null;
    const cur = a ? X(a, e.t) : 0;
    switch (e.do) {
      case "move": a.vis = true; a.mv = { x0: cur, x1: e.x, t0: e.t, dur: Math.max(e.dur || 2, .3) }; a.x = cur; a.face = e.x >= cur ? 1 : -1; break;
      case "face": a.face = e.dir; break;
      case "enter": a.vis = true; a.alive = true; a.x = e.from; a.mv = { x0: e.from, x1: e.x, t0: e.t, dur: Math.max(e.dur || 2, .3) }; a.face = e.x >= e.from ? 1 : -1; break;
      case "exit": a.mv = { x0: cur, x1: e.x, t0: e.t, dur: Math.max(e.dur || 2, .3), gone: true }; a.x = cur; a.face = e.x >= cur ? 1 : -1; break;
      case "attack": {
        const tg = get(e.target), tx = X(tg, e.t + (e.dur || 1) / 2);
        a.face = tx >= cur ? 1 : -1;
        a.lunge = { t0: e.t, dur: e.dur || 1, from: cur, to: tx - a.face * 9, kind: e.kind || "melee" };
        tg.hitAt = e.t + (e.dur || 1) * .5; tg.hitDir = a.face;
        floats.push({ id: e.target, text: e.dmg, t0: e.t + (e.dur || 1) * .5 });
        if (e.kind === "shot" || e.kind === "spell") fx.push({ kind: e.kind === "shot" ? "shot" : "spellbolt", x0: cur, x1: tx, t0: e.t, dur: (e.dur || 1) * .5, id: e.id });
        break;
      }
      case "hurt": { const tg = get(e.id); tg.hitAt = e.t; tg.hitDir = 0; floats.push({ id: e.id, text: e.dmg, t0: e.t }); break; }
      case "die": a.alive = false; a.dieAt = e.t; a.x = cur; a.mv = null; break;
      case "revive": a.alive = true; a.reviveAt = e.t; break;
      case "status": a.status = e.kind === "none" ? null : e.kind; break;
      case "say": bubbles.push({ id: e.id, text: e.text, t0: e.t, dur: e.dur || 3 }); break;
      case "fx": fx.push({ kind: e.kind, x: e.x, t0: e.t, dur: e.dur || 2, id: e.id }); break;
    }
  }
  return { sc, i, end, A, fx, bubbles, floats, X };
}

// ---------- отрисовка ----------
const baseY = id => GROUND + (hashy(id) % 5) * 13 - 14;
function drawBg(name, alpha = 1) {
  const im = img["b:" + name]; if (!im || !im.complete || !im.naturalWidth) { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, W, H); return; }
  const r = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r;
  ctx.globalAlpha = alpha; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); ctx.globalAlpha = 1;
}
const tintCv = document.createElement("canvas"), tintCtx = tintCv.getContext("2d");
function drawSprite(id, x, y, o) {
  const key = SPRITE_OF[id] || id, im = img["s:" + key], meta = MAN.sprites[key];
  if (!im || !im.complete || !im.naturalWidth) return null;
  const h = meta.h * (o.scale || 1), w = im.naturalWidth * h / im.naturalHeight;
  ctx.save();
  ctx.translate(x, y + (o.dy || 0));
  if (o.rot) ctx.rotate(o.rot);
  if (o.face < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.tint) {
    tintCv.width = Math.ceil(w); tintCv.height = Math.ceil(h);
    tintCtx.clearRect(0, 0, w, h); tintCtx.drawImage(im, 0, 0, w, h);
    tintCtx.globalCompositeOperation = "source-atop"; tintCtx.fillStyle = `rgba(255,30,30,${o.tint})`; tintCtx.fillRect(0, 0, w, h);
    tintCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(tintCv, -w / 2, -h);
  } else ctx.drawImage(im, -w / 2, -h, w, h);
  ctx.restore();
  return { h, w };
}
function shadow(x, y, w, a = .35) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y - 2, w * .42, w * .09, 0, 0, 7); ctx.fill(); ctx.restore(); }

const BADGE = { paralyzed: "парализован", sleep: "спит", naked: "голый", stun: "оглушён", shrunk: "уменьшен" };
function drawActors(S, t) {
  const list = Object.values(S.A).filter(a => a.vis || a.mv);
  const info = {};
  const rows = list.map(a => {
    let x = S.X(a, t), vis = a.vis, alpha = 1, dy = 0, rot = 0, tint = 0, face = a.face, scale = 1, off = 0;
    if (a.mv && a.mv.gone && t >= a.mv.t0 + a.mv.dur) vis = false;
    if (a.lunge) {                                   // удар: сближение → отскок
      const p = (t - a.lunge.t0) / a.lunge.dur;
      if (p >= 0 && p <= 1) { const k = Math.sin(Math.PI * p); x = a.lunge.from + (a.lunge.to - a.lunge.from) * (a.lunge.kind === "melee" || a.lunge.kind === "claw" ? k : k * .15); face = a.lunge.to >= a.lunge.from ? 1 : -1; dy = -Math.sin(Math.PI * p) * 10; }
    }
    const since = t - a.hitAt;
    if (since >= 0 && since < .7) {                  // урон: красная вспышка, тряска, отброс
      tint = .7 * (1 - since / .7); off = (a.hitDir || 0) * 26 * Math.sin(Math.min(since / .25, 1) * Math.PI / 2) * (1 - since / .7) + Math.sin(since * 70) * 5 * (1 - since / .7);
    }
    if (!a.alive && a.dieAt != null) { const p = clamp((t - a.dieAt) / .6, 0, 1); rot = -ease(p) * Math.PI / 2 * (a.face || 1) * -1; dy = ease(p) * 0; alpha = .9 - .2 * p; tint = Math.max(tint, .15 * p); }
    else if (a.reviveAt != null && t - a.reviveAt < .8) { rot = (1 - (t - a.reviveAt) / .8) * 1.3 * a.face; }
    if (a.status === "invisible") alpha = .35;
    const moving = a.mv && t < a.mv.t0 + a.mv.dur && t >= a.mv.t0;
    if (moving || (a.lunge && t - a.lunge.t0 < a.lunge.dur && t >= a.lunge.t0)) dy += -Math.abs(Math.sin(t * 9 + hashy(a.id))) * 7;
    else if (a.alive) dy += Math.sin(t * 2 + hashy(a.id)) * 1.6;   // дыхание
    return { a, x: px(x) + off, y: baseY(a.id), vis, alpha, dy, rot, tint, face, scale };
  }).filter(r => r.vis).sort((p, q) => p.y - q.y);
  for (const r of rows) {
    const key = SPRITE_OF[r.a.id] || r.a.id, meta = MAN.sprites[key] || { h: 280 };
    shadow(r.x, r.y, meta.h * .5, r.a.alive ? .35 : .2);
    const sz = drawSprite(r.a.id, r.x, r.y, { face: r.face, alpha: r.alpha, dy: r.dy, rot: r.rot, tint: r.tint });
    info[r.a.id] = { x: r.x, y: r.y, top: r.y + r.dy - (sz ? sz.h : meta.h), h: sz ? sz.h : meta.h };
    if (r.a.status && BADGE[r.a.status] && r.a.alive) badge(BADGE[r.a.status], r.x, info[r.a.id].top - 6);
  }
  return info;
}
function badge(text, x, y) {
  ctx.save(); ctx.font = "600 17px system-ui,sans-serif"; const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = "rgba(20,14,30,.85)"; ctx.strokeStyle = "#e8b64c"; ctx.lineWidth = 1.5;
  rr(x - w / 2, y - 26, w, 24, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f3d58a"; ctx.textAlign = "center"; ctx.fillText(text, x, y - 9); ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const tt = cur ? cur + " " + w : w; if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }
  if (cur) lines.push(cur); return lines;
}
function drawBubbles(S, t, info) {
  for (const b of S.bubbles) {
    if (t < b.t0 || t > b.t0 + b.dur) continue;
    const p = info[b.id]; if (!p) continue;
    ctx.save(); ctx.font = "500 21px system-ui,sans-serif";
    const lines = wrap(b.text, 300), w = Math.min(330, Math.max(...lines.map(l => ctx.measureText(l).width)) + 28), h = lines.length * 26 + 18;
    const a = clamp((t - b.t0) / .2, 0, 1) * clamp((b.t0 + b.dur - t) / .25, 0, 1);
    ctx.globalAlpha = a;
    let bx = clamp(p.x - w / 2, 10, W - w - 10), by = Math.max(10, p.top - h - 18);
    ctx.fillStyle = "#fbf3dc"; ctx.strokeStyle = "#2a1d12"; ctx.lineWidth = 2.5;
    rr(bx, by, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.beginPath(); const tx = clamp(p.x, bx + 20, bx + w - 20); ctx.moveTo(tx - 9, by + h - 1); ctx.lineTo(tx + 3, by + h + 15); ctx.lineTo(tx + 10, by + h - 1); ctx.fillStyle = "#fbf3dc"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 9, by + h); ctx.lineTo(tx + 3, by + h + 15); ctx.lineTo(tx + 10, by + h); ctx.stroke();
    ctx.fillStyle = "#2a1d12"; ctx.textAlign = "left"; lines.forEach((l, i) => ctx.fillText(l, bx + 14, by + 31 + i * 26));
    ctx.restore();
  }
}
function drawFloats(S, t, info) {
  for (const f of S.floats) {
    const p = info[f.id], k = (t - f.t0) / 1.5; if (!p || k < 0 || k > 1 || !f.text) continue;
    const crit = /крит/i.test(f.text), miss = /мимо|промах/i.test(f.text);
    ctx.save(); ctx.globalAlpha = 1 - Math.pow(k, 3); ctx.textAlign = "center";
    ctx.font = `800 ${crit ? 46 : 36}px system-ui,sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = "#1a0b0b"; ctx.lineJoin = "round";
    const x = p.x + Math.sin(k * 5) * 6, y = p.top + 40 - k * 80 - (crit ? 10 : 0), txt = /^\d+$/.test(f.text) ? "−" + f.text : f.text;
    ctx.strokeText(txt, x, y); ctx.fillStyle = miss ? "#c9c9d4" : crit ? "#ffd23f" : "#ff5a4a"; ctx.fillText(txt, x, y); ctx.restore();
  }
}
function drawFx(S, t, info) {
  for (const f of S.fx) {
    const k = (t - f.t0) / f.dur; if (k < 0 || k > 1) continue;
    ctx.save();
    const fade = Math.min(k * 6, 1) * Math.min((1 - k) * 5, 1);
    if (f.kind === "shot") { const x = px(f.x0 + (f.x1 - f.x0) * k), p = info[f.id]; ctx.fillStyle = "#e8d9a0"; ctx.fillRect(x - 14, (p ? p.top + p.h * .4 : 400) - 2, 28, 4); }
    else if (f.kind === "spellbolt") { const x = px(f.x0 + (f.x1 - f.x0) * k), p = info[f.id]; const g = ctx.createRadialGradient(x, p ? p.top + p.h * .4 : 400, 2, x, p ? p.top + p.h * .4 : 400, 26); g.addColorStop(0, "#fff"); g.addColorStop(1, "rgba(150,220,120,0)"); ctx.fillStyle = g; ctx.fillRect(x - 30, (p ? p.top + p.h * .4 : 400) - 30, 60, 60); }
    else if (f.kind === "holy") {
      const cx = px(f.x), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,236,160,${.35 * fade})`); g.addColorStop(1, "rgba(255,236,160,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - 260, 0, 520, H);
      for (let i = 0; i < 46; i++) { const h = hashy("h" + i), xx = cx - 250 + (h % 500), sp = 260 + (h >> 4) % 220, yy = ((t * sp + h) % (GROUND + 60)); ctx.fillStyle = `rgba(255,244,190,${.8 * fade})`; ctx.beginPath(); ctx.arc(xx, yy, 3 + h % 3, 0, 7); ctx.fill(); }
    } else if (f.kind === "light") {
      const cx = px(f.x), g = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0); g.addColorStop(0, "rgba(255,255,230,0)"); g.addColorStop(.5, `rgba(255,255,235,${.85 * fade})`); g.addColorStop(1, "rgba(255,255,230,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - 120 - 100 * (1 - k), 0, 240 + 200 * (1 - k), H);
    } else if (f.kind === "explosion") {
      const cx = px(f.x), cy = GROUND - 60, r = 40 + k * 190; const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r); g.addColorStop(0, `rgba(255,250,200,${1 - k})`); g.addColorStop(.5, `rgba(255,140,30,${.8 * (1 - k)})`); g.addColorStop(1, "rgba(120,30,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    } else if (f.kind === "poison") {
      const cx = px(f.x); for (let i = 0; i < 14; i++) { const h = hashy("p" + i); ctx.fillStyle = `rgba(110,220,90,${.55 * fade})`; ctx.beginPath(); ctx.arc(cx - 70 + h % 140 + Math.sin(t * 3 + i) * 10, GROUND - ((t * 60 + h) % 200), 6 + h % 8, 0, 7); ctx.fill(); }
    } else if (f.kind === "vines") {
      const cx = px(f.x); ctx.strokeStyle = `rgba(60,150,50,${fade})`; ctx.lineWidth = 7; ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) { ctx.beginPath(); const len = 220 * Math.min(k * 3, 1); for (let s2 = 0; s2 <= 20; s2++) { const u = s2 / 20, yy = GROUND - u * len, xx = cx - 50 + i * 25 + Math.sin(u * 7 + i + t * 2) * 18; s2 ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
    } else if (f.kind === "gold") {
      const cx = px(f.x); for (let i = 0; i < 70; i++) { const h = hashy("g" + i), u = (k * 1.2 + (h % 100) / 400) % 1.2; ctx.fillStyle = `rgba(255,${200 + h % 50},70,${(1 - k) * .9})`; ctx.beginPath(); ctx.arc(cx - 60 + (h >> 3) % 120 + Math.sin(u * 6 + i) * 25, GROUND - 40 - u * 260, 2 + h % 4, 0, 7); ctx.fill(); }
    } else if (f.kind === "portal") {
      const cx = px(f.x), cy = GROUND - 140; ctx.translate(cx, cy);
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = `rgba(${170 + i * 15},${90 + i * 20},255,${(.8 - i * .12) * fade})`; ctx.lineWidth = 6 - i; ctx.beginPath(); ctx.ellipse(0, 0, (60 - i * 9) * Math.min(k * 4, 1), (150 - i * 22) * Math.min(k * 4, 1), t * (i % 2 ? 1 : -1) * .8, 0, 7); ctx.stroke(); }
    } else if (f.kind === "sparkle") {
      const cx = px(f.x); for (let i = 0; i < 20; i++) { const h = hashy("s" + i), a2 = t * 2 + h; ctx.fillStyle = `rgba(255,245,200,${fade * (.4 + .6 * Math.abs(Math.sin(a2)))})`; ctx.beginPath(); ctx.arc(cx - 90 + h % 180, GROUND - 40 - (h >> 4) % 240, 2 + h % 3, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
}

// ---------- карта маршрута ----------
function drawMap(S, t) {
  drawBg("map");
  const N = MAN.nodes, sc = S.sc, a = N[sc.from], b = N[sc.to] || a;
  const k = clamp((t - sc.t) / Math.max(S.end - sc.t, 1), 0, 1);
  ctx.save(); ctx.lineCap = "round";
  const order = MAN.route; ctx.setLineDash([10, 12]); ctx.strokeStyle = "rgba(60,30,10,.55)"; ctx.lineWidth = 5;
  ctx.beginPath(); order.forEach((n, i) => { const p = N[n]; i ? ctx.lineTo(px(p.x), p.y / 100 * H) : ctx.moveTo(px(p.x), p.y / 100 * H); }); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = "#c03a2b"; ctx.lineWidth = 7;
  const ia = order.indexOf(sc.from); ctx.beginPath();
  for (let i = 0; i <= ia; i++) { const p = N[order[i]]; i ? ctx.lineTo(px(p.x), p.y / 100 * H) : ctx.moveTo(px(p.x), p.y / 100 * H); }
  const cx = px(a.x + (b.x - a.x) * ease(k)), cy = (a.y + (b.y - a.y) * ease(k)) / 100 * H; ctx.lineTo(cx, cy); ctx.stroke();
  for (const n of order) { const p = N[n]; ctx.fillStyle = "#2a1d12"; ctx.beginPath(); ctx.arc(px(p.x), p.y / 100 * H, 9, 0, 7); ctx.fill(); ctx.fillStyle = "#f3d58a"; ctx.beginPath(); ctx.arc(px(p.x), p.y / 100 * H, 5, 0, 7); ctx.fill();
    ctx.font = "700 22px Georgia,serif"; ctx.textAlign = "center"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(245,230,190,.95)"; ctx.strokeText(p.name, px(p.x), p.y / 100 * H + 34); ctx.fillStyle = "#2a1d12"; ctx.fillText(p.name, px(p.x), p.y / 100 * H + 34); }
  ctx.restore();
  HEROES.forEach((h, i) => { const meta = MAN.sprites[h]; const s2 = 0.42; const im = img["s:" + h]; if (!im || !im.naturalWidth) return;
    const hh = meta.h * s2, ww = im.naturalWidth * hh / im.naturalHeight, bob = Math.abs(Math.sin(t * 6 + i)) * 4;
    ctx.save(); ctx.translate(cx + (i - 2) * 26, cy - bob + (i % 2) * 8); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, ww * .45, 6, 0, 0, 7); ctx.fill();
    if (b.x < a.x) ctx.scale(-1, 1); ctx.drawImage(im, -ww / 2, -hh, ww, hh); ctx.restore(); });
}

// ---------- кадр ----------
let fadeAt = -99, lastSceneId = null;
function frame() {
  const t = now();
  const S = simulate(t), sc = S.sc;
  if (sc.id !== lastSceneId) { lastSceneId = sc.id; fadeAt = performance.now(); capEl.textContent = sc.title || ""; }
  ctx.clearRect(0, 0, W, H);
  if (sc.bg === "map") { drawMap(S, t); }
  else {
    drawBg(sc.bg);
    // лёгкое затемнение по краям для читаемости
    const v = ctx.createLinearGradient(0, H * .55, 0, H); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.35)"); ctx.fillStyle = v; ctx.fillRect(0, H * .55, W, H * .45);
    const info = drawActors(S, t);
    drawFx(S, t, info); drawFloats(S, t, info); drawBubbles(S, t, info);
  }
  const fd = (performance.now() - fadeAt) / 450; if (fd < 1) { ctx.fillStyle = `rgba(8,6,12,${1 - fd})`; ctx.fillRect(0, 0, W, H); }
  markPlot(t);
  requestAnimationFrame(frame);
}
})();
