// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.expand();
    tg.setBackgroundColor("#070a0f");
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

const $timer      = document.getElementById("timer");

const $invBtn     = document.getElementById("invBtn");
const $flagsBtn   = document.getElementById("flagsBtn");
const $invDlg     = document.getElementById("invDlg");
const $flagsDlg   = document.getElementById("flagsDlg");
const $invClose   = document.getElementById("invClose");
const $flagsClose = document.getElementById("flagsClose");
const $invList    = document.getElementById("invList");
const $flagsList  = document.getElementById("flagsList");

// Overlay + меню/регистрация
const $overlay    = document.getElementById("overlay");
const $menuPanel  = document.getElementById("menuPanel");
const $regPanel   = document.getElementById("regPanel");

const $btnStart       = document.getElementById("btnStart");
const $btnContinue    = document.getElementById("btnContinue");
const $btnSettings    = document.getElementById("btnSettings");
const $btnLeaderboard = document.getElementById("btnLeaderboard");

const $regNick    = document.getElementById("regNick");
const $regTag     = document.getElementById("regTag");
const $regGender  = document.getElementById("regGender");
const $btnSendCode= document.getElementById("btnSendCode");
const $regCode    = document.getElementById("regCode");
const $btnVerify  = document.getElementById("btnVerify");
const $regMsg     = document.getElementById("regMsg");
const $btnRegBack = document.getElementById("btnRegBack");

// Config
const IMG_BASE           = "images/";
const SCENES_URL         = "scenes.json";
const CACHE_KEY_SCENES   = "scenes_cache_v1";
const CACHE_KEY_AUTH     = "auth115";
const CACHE_KEY_SAVE     = "game115";
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
  elapsedSec: 0,

  // регистрация
  auth: {
    verified: false,
    nickname: "",
    tag: "",
    gender: "m",
    pendingCode: ""
  },

  // таймер
  _tickTimer: null,
  running: false
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

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function startTimer() {
  if (state._tickTimer) clearInterval(state._tickTimer);
  state.running = true;
  state._tickTimer = setInterval(() => {
    if (!state.running) return;
    state.elapsedSec += 1;
    $timer.textContent = fmtTime(state.elapsedSec);
  }, 1000);
}

function pauseTimer() {
  state.running = false;
}

// Scenes: JSON + локальный кэш
async function fetchScenesJson() {
  try {
    const res = await fetch(`${SCENES_URL}?v=7`, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    localStorage.setItem(CACHE_KEY_SCENES, JSON.stringify(data));
    return data;
  } catch (e) {
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

// Aggressive preloading (≤10s)
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

// Background + blink
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

// Typewriter (tap-to-skip)
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

// Options
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

// Inventory / Flags
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

// Save / Load local
function saveLocal() {
  localStorage.setItem(CACHE_KEY_SAVE, JSON.stringify({
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
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY_SAVE) || "{}");
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

// Auth: local
function saveAuth() {
  localStorage.setItem(CACHE_KEY_AUTH, JSON.stringify(state.auth));
}

function loadAuth() {
  try {
    const a = JSON.parse(localStorage.getItem(CACHE_KEY_AUTH) || "{}");
    if (a && typeof a === "object") {
      state.auth = {
        verified: !!a.verified,
        nickname: a.nickname || "",
        tag: a.tag || "",
        gender: a.gender || "m",
        pendingCode: ""
      };
    }
  } catch {}
}

// Sync / Heartbeat
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
    if (!state.running) return;
    send("heartbeat", {
      scene: state.current,
      elapsed_sec: state.elapsedSec
    });
    saveLocal();
  }, HEARTBEAT_MS);
}

// Registration
function genCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function showOverlay(show) {
  $overlay.classList.toggle("hidden", !show);
}

function showPanel(panel) {
  $menuPanel.classList.add("hidden");
  $regPanel.classList.add("hidden");
  panel.classList.remove("hidden");
  showOverlay(true);
  pauseTimer();
}

function hideOverlay() {
  showOverlay(false);
  startTimer();
}

function openMenu() {
  $btnContinue.disabled = !(state.current && state.current in state.scenes);
  $btnStart.disabled    = !state.auth.verified;
  showPanel($menuPanel);
}

function openRegistration() {
  $regNick.value = state.auth.nickname || "";
  $regTag.value  = state.auth.tag || "";
  $regGender.value = state.auth.gender || "m";
  $regMsg.textContent = "";
  showPanel($regPanel);
}

// UI handlers
$btnStart?.addEventListener("click", () => {
  state.startedAt = new Date().toISOString();
  state.elapsedSec = 0;
  $timer.textContent = "00:00";
  hideOverlay();
  renderScene("start");
  syncState("start_new");
});

$btnContinue?.addEventListener("click", () => {
  hideOverlay();
  renderScene(state.current || "start");
  syncState("continue");
});

$btnSettings?.addEventListener("click", () => {
  alert("Настройки появятся позже.");
});

$btnLeaderboard?.addEventListener("click", () => {
  alert("Лидерборд реализован в боте командой /top.");
});

$btnRegBack?.addEventListener("click", openMenu);

$btnSendCode?.addEventListener("click", () => {
  const nickname = ($regNick.value || "").trim();
  const tag      = ($regTag.value || "").trim().replace(/^@+/, "");
  const gender   = $regGender.value;

  if (!nickname || !tag) {
    $regMsg.textContent = "Укажи ник и тег.";
    return;
  }

  const code = genCode6();

  state.auth.nickname   = nickname;
  state.auth.tag        = tag;
  state.auth.gender     = gender;
  state.auth.pendingCode= code;
  saveAuth();

  send("request_code", {
    nickname,
    tag,
    gender,
    code
  });

  $regMsg.textContent = "Код отправлен тебе в Telegram. Введи его ниже.";
});

$btnVerify?.addEventListener("click", () => {
  const inCode = ($regCode.value || "").trim();

  if (!state.auth.pendingCode) {
    $regMsg.textContent = "Сначала нажми «Отправить код».";
    return;
  }

  if (inCode !== state.auth.pendingCode) {
    $regMsg.textContent = "Неверный код.";
    return;
  }

  if (state.auth.gender === "f") {
    // Я НЕ буду тебя банить по полу. Просто не пускаю в эту ветку.
    $regMsg.textContent = "Сейчас доступна только мужская ветка. Выбери 'мужской'.";
    return;
  }

  state.auth.verified = true;
  state.auth.pendingCode = "";
  saveAuth();

  send("verify_code", { ok: true });

  openMenu();
});

// Inventory / Flags modals
$invBtn?.addEventListener("click", () => { renderInventory(); $invDlg.showModal(); pauseTimer(); });
$flagsBtn?.addEventListener("click", () => { renderFlags(); $flagsDlg.showModal(); pauseTimer(); });
$invClose?.addEventListener("click", () => { $invDlg.close(); startTimer(); });
$flagsClose?.addEventListener("click", () => { $flagsDlg.close(); startTimer(); });

// Render scene
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
      if (!state.inventory[need] || state.inventory[need] < count) continue;
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
  startTimer();
}

// Init
(async function init(){
  try {
    state.scenes = await fetchScenesJson();

    const imgs = uniqueImagesFromScenes(state.scenes);
    fastPreloadImages(imgs, updateBoot);

    // load local
    loadAuth();
    loadLocal();
    if (!state.startedAt) state.startedAt = new Date().toISOString();

    // wait preload up to 10s
    const t0 = Date.now();
    while (!preloadDone && Date.now() - t0 < 10000) {
      await sleep(100);
    }

    document.body.classList.remove("booting");
    document.body.classList.add("ready");

    // show menu or registration
    if (state.auth.verified) openMenu();
    else openRegistration();

    // do not start timer while in overlay
    pauseTimer();

    startHeartbeat();
    syncState("app_ready");
  } catch (err) {
    console.error(err);
    document.body.classList.remove("booting");
    document.body.classList.add("ready");
    $descText.textContent = "Не удалось загрузить игру. Проверь подключение и обнови.";
  }
})();
