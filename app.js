// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.expand();
    tg.setBackgroundColor("#070a0f");   // не везде поддерживается — и ладно
    tg.setHeaderColor("secondary");
  } catch {}
}

// DOM
const $descText   = document.getElementById("descText");
const $bg         = document.getElementById("bg");
const $opts       = document.getElementById("options");

const $bootBar    = document.getElementById("bootBar");
const $bootPct    = document.getElementById("bootPct");
const $bootCnt    = document.getElementById("bootCount");

const $eyetop     = document.getElementById("eyelidTop");
const $eyebot     = document.getElementById("eyelidBot");

const $invBtn     = document.getElementById("invBtn");
const $flagsBtn   = document.getElementById("flagsBtn");
const $invDlg     = document.getElementById("invDlg");
const $flagsDlg   = document.getElementById("flagsDlg");
const $invClose   = document.getElementById("invClose");
const $flagsClose = document.getElementById("flagsClose");
const $invList    = document.getElementById("invList");
const $flagsList  = document.getElementById("flagsList");

// Config
const IMG_BASE           = "images/";
const SCENES_URL         = "scenes.json"; // живём на JSON
const CACHE_KEY_SCENES   = "scenes_cache_v1";
const TYPEWRITE_MAX_MS   = 3000;
const HEARTBEAT_MS       = 15000;

// State
const state = {
  scenes: {},
  current: "start",
  inventory: {},
  flags: {},
  lastBg: null,
  startedAt: null,
  elapsedSec: 0
};

// Cache
const imageCache = {};
let preloadDone = false;

// Utils
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function send(event, payload) {
  if (tg && typeof tg.sendData === "function") {
    tg.sendData(JSON.stringify({ event, payload }));
  }
}

function updateBoot(progress, loaded, total) {
  const pct = Math.round(progress * 100);
  $bootBar.style.width = `${pct}%`;
  $bootPct.textContent = `${pct}%`;
  $bootCnt.textContent = `${loaded}/${total}`;
}

// ===== Scenes: JSON + локальный кэш =====
async function fetchScenesJson() {
  // пробуем сеть
  try {
    const res = await fetch(`${SCENES_URL}?v=4`, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    localStorage.setItem(CACHE_KEY_SCENES, JSON.stringify(data));
    return data;
  } catch (e) {
    // если сеть не дала — из локального кэша
    const cached = localStorage.getItem(CACHE_KEY_SCENES);
    if (cached) return JSON.parse(cached);
    throw e;
  }
}

function uniqueImagesFromScenes(scenes) {
  const set = new Set();
  for (const key in scenes) {
    const sc = scenes[key];
    if (sc && sc.image) set.add(sc.image);
  }
  return Array.from(set);
}

// ===== Aggressive preloading (≤10s) =====
function fastPreloadImages(names, onProgress) {
  let loaded = 0;
  const total = names.length;

  if (total === 0) {
    onProgress(1, 0, 0);
    preloadDone = true;
    return;
  }

  const timer = setTimeout(() => { preloadDone = true; }, 10000);

  names.forEach(name => {
    const img = new Image();

    img.onload = () => {
      if (!imageCache[name]) imageCache[name] = img;
      loaded += 1;
      onProgress(loaded / total, loaded, total);
      if (loaded >= total) {
        preloadDone = true;
        clearTimeout(timer);
      }
    };

    img.onerror = () => {
      loaded += 1;
      onProgress(loaded / total, loaded, total);
    };

    img.src = IMG_BASE + name + "?v=" + Date.now();
  });
}

// ===== Background + blink =====
function setBackground(imageName, meta = {}) {
  if (!imageName) return;

  const url = IMG_BASE + imageName;
  if (state.lastBg === url) return;

  $bg.style.backgroundSize     = meta.fit === "contain" ? "contain" : "cover";
  $bg.style.backgroundColor    = meta.fit === "contain" ? "#070a0f" : "";
  $bg.style.backgroundPosition = typeof meta.focus === "string" ? meta.focus : "center";
  $bg.style.backgroundImage    = `url(${url})`;

  state.lastBg = url;
}

async function blink(ms = 320) {
  $eyetop.style.height = "52%";
  $eyebot.style.height = "52%";
  await sleep(ms);
  $eyetop.style.height = "0";
  $eyebot.style.height = "0";
}

// ===== Typewriter (tap-to-skip) =====
async function typewrite($node, text) {
  const s = String(text || "");
  $node.textContent = "";
  if (!s.length) return;

  let stop = false;
  const onTap = () => { stop = true; };
  $node.addEventListener("pointerdown", onTap, { once: true });

  const per = Math.max(10, Math.floor(TYPEWRITE_MAX_MS / s.length));
  for (let i = 0; i < s.length; i += 1) {
    if (stop) {
      $node.textContent = s;
      break;
    }
    $node.textContent += s[i];
    // eslint-disable-next-line no-await-in-loop
    await sleep(per);
  }
}

// ===== Options =====
function normalizeOptions(sc) {
  if (!sc) return [];
  if (Array.isArray(sc.options)) {
    return sc.options.map(o => ({
      label: o.label,
      next: o.next,
      requires: o.requires || null
    }));
  }
  const out = [];
  const obj = sc.options || {};
  for (const [label, next] of Object.entries(obj)) {
    out.push({ label, next, requires: null });
  }
  return out;
}

// ===== Inventory / Flags =====
function renderInventory() {
  const list = Object.entries(state.inventory || {}).filter(([, n]) => n > 0);
  if (!list.length) {
    $invList.innerHTML = `<div class="muted">Пусто</div>`;
    return;
  }
  $invList.innerHTML = list.map(([name, n]) => `<div>${name}: ${n} шт</div>`).join("");
}

function renderFlags() {
  const list = Object.entries(state.flags || {}).filter(([, v]) => !!v);
  if (!list.length) {
    $flagsList.innerHTML = `<div class="muted">Пока нет</div>`;
    return;
  }
  $flagsList.innerHTML = list.map(([k, v]) => `<div>${k}: ${String(v)}</div>`).join("");
}

// ===== Save / Load local =====
function saveLocal() {
  localStorage.setItem("game115", JSON.stringify({
    current: state.current,
    inventory: state.inventory,
    flags: state.flags,
    lastBg: state.lastBg,
    startedAt: state.startedAt,
    elapsedSec: state.elapsedSec
  }));
}

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem("game115") || "{}");
    if (saved && saved.current && saved.current in state.scenes) {
      state.current    = saved.current;
      state.inventory  = saved.inventory || {};
      state.flags      = saved.flags || {};
      state.lastBg     = saved.lastBg || null;
      state.startedAt  = saved.startedAt || null;
      state.elapsedSec = saved.elapsedSec || 0;

      if (state.lastBg) {
        $bg.style.backgroundImage = state.lastBg;
      }
    }
  } catch {}
}

// ===== Sync / Heartbeat =====
let hbTimer = null;

function syncState(reason = "auto") {
  send("sync_state", {
    reason,
    scene: state.current,
    inventory: state.inventory,
    flags: state.flags,
    last_bg: state.lastBg,
    elapsed_sec: state.elapsedSec
  });
}

function startHeartbeat() {
  if (hbTimer) clearInterval(hbTimer);
  hbTimer = setInterval(() => {
    state.elapsedSec += HEARTBEAT_MS / 1000;
    send("heartbeat", {
      scene: state.current,
      elapsed_sec: state.elapsedSec
    });
    saveLocal();
  }, HEARTBEAT_MS);
}

// ===== Render scene =====
async function renderScene(key) {
  const sc = state.scenes[key];
  if (!sc) return;

  state.current = key;

  if (sc.image) {
    await blink(220);
    setBackground(sc.image, { fit: sc.fit, focus: sc.focus });
  }

  await typewrite($descText, sc.description || "…");

  $opts.classList.remove("options-exit");
  $opts.innerHTML = "";

  const options = normalizeOptions(sc);

  for (const opt of options) {
    if (opt.requires && opt.requires.type === "item") {
      const need  = opt.requires.name;
      const count = opt.requires.count || 1;
      if (!state.inventory[need] || state.inventory[need] < count) {
        continue;
      }
    }

    const btn = document.createElement("button");
    btn.className = "option enter" + (opt.requires ? " req" : "");
    btn.textContent = opt.label;

    btn.onclick = async () => {
      const kids = Array.from($opts.querySelectorAll(".option"));
      kids.forEach(k => { if (k !== btn) k.classList.add("fade"); });
      btn.classList.add("chosen");
      $opts.classList.add("options-exit");

      send("choice_made", { from: key, to: opt.next, label: opt.label });
      saveLocal();
      syncState("choice");

      await sleep(340);
      renderScene(opt.next);
    };

    $opts.appendChild(btn);
  }

  send("scene_enter", { scene: key });
  saveLocal();
}

// ===== Init =====
(async function init(){
  try {
    // 1) грузим scenes.json (или из локального кэша)
    state.scenes = await fetchScenesJson();

    // 2) прелоадим фоны агрессивно, но не дольше 10 сек
    const imgs = uniqueImagesFromScenes(state.scenes);
    fastPreloadImages(imgs, updateBoot);

    // 3) поднимаем локальный сейв, если валиден
    loadLocal();
    if (!state.startedAt) state.startedAt = new Date().toISOString();

    // 4) ждём максимум 10 сек и стартуем игру
    const t0 = Date.now();
    while (!preloadDone && Date.now() - t0 < 10000) {
      await sleep(100);
    }

    document.body.classList.remove("booting");
    document.body.classList.add("ready");

    renderScene(state.current);
    startHeartbeat();
    syncState("start");
  } catch (err) {
    console.error(err);
    document.body.classList.remove("booting");
    document.body.classList.add("ready");
    $descText.textContent = "Не удалось загрузить игру. Проверь подключение и обнови.";
  }
})();

// HUD
$invBtn?.addEventListener("click", () => { renderInventory(); $invDlg.showModal(); });
$flagsBtn?.addEventListener("click", () => { renderFlags(); $flagsDlg.showModal(); });
$invClose?.addEventListener("click", () => $invDlg.close());
$flagsClose?.addEventListener("click", () => $flagsDlg.close());
