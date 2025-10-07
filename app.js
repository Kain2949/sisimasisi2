/* Raf game — WebApp (сцены из scenes.json) */

const APP_BUILD = 7;

// Telegram
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.expand();
    tg.setBackgroundColor("#06080c");
    tg.setHeaderColor("secondary");
  } catch {}
}

// DOM
const $stage       = document.getElementById("stage");
const $descText    = document.getElementById("descText");
const $bgImg       = document.getElementById("bgImg");
const $opts        = document.getElementById("options");

const $bootBar     = document.getElementById("bootBar");
const $bootPct     = document.getElementById("bootPct");
const $bootCnt     = document.getElementById("bootCount");

const $eyetop      = document.getElementById("eyelidTop");
const $eyebot      = document.getElementById("eyelidBot");

const $timer       = document.getElementById("timer");
const $menuBtn     = document.getElementById("menuBtn");

const $invDlg      = document.getElementById("invDlg");
const $flagsDlg    = document.getElementById("flagsDlg");
const $invClose    = document.getElementById("invClose");
const $flagsClose  = document.getElementById("flagsClose");
const $invList     = document.getElementById("invList");
const $flagsList   = document.getElementById("flagsList");

// overlay
const $overlay     = document.getElementById("overlay");
const $menuPanel   = document.getElementById("menuPanel");
const $regPanel    = document.getElementById("regPanel");
const $btnStart    = document.getElementById("btnStart");
const $btnContinue = document.getElementById("btnContinue");
const $btnSettings = document.getElementById("btnSettings");
const $btnLeaderboard = document.getElementById("btnLeaderboard");

const $regNick     = document.getElementById("regNick");
const $regTag      = document.getElementById("regTag");
const $regGender   = document.getElementById("regGender");
const $btnSendCode = document.getElementById("btnSendCode");
const $regCode     = document.getElementById("regCode");
const $btnVerify   = document.getElementById("btnVerify");
const $regMsg      = document.getElementById("regMsg");

// внутр. меню
const $ingameOverlay = document.getElementById("ingameOverlay");
const $gmInventory   = document.getElementById("gmInventory");
const $gmFlags       = document.getElementById("gmFlags");
const $gmSaveExit    = document.getElementById("gmSaveExit");
const $gmBack        = document.getElementById("gmBack");

// === API конфиг ===
const API_BASE = "https://kristan-labored-earsplittingly.ngrok-free.dev";
const API_KEY  = "super_secret_key_3481gfej83f";

async function api(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY
    },
    body: JSON.stringify(body || {})
  });
  return res.json();
}
async function apiStatus(regId) {
  const res = await fetch(`${API_BASE}/api/registration/status?reg_id=${encodeURIComponent(regId)}`, {
    headers: { "X-API-KEY": API_KEY }
  });
  return res.json();
}

// Config
const IMG_BASE = "images/";
const SCENES_URL = "scenes.json";
const LS_SCENES = "scenes_cache_v1";
const LS_SAVE   = "game115";
const LS_AUTH   = "auth115";
const LS_BUILD  = "build115";
const TYPEWRITE_MAX_MS = 3000;
const HEARTBEAT_MS = 15000;

// State
const state = {
  scenes: {},
  current: "start",
  inventory: {},
  flags: {},
  lastBg: null,
  startedAt: null,
  elapsedSec: 0,
  running: false,
  tick: null,
  auth: { verified:false, nickname:"", tag:"", gender:"m" }
};

const imageCache = {};
let preloadDone = false;

// Utils
const sleep = ms => new Promise(r => setTimeout(r, ms));
const send  = (event, payload) => { if (tg?.sendData) tg.sendData(JSON.stringify({ event, payload })); };

const fmtTime = sec => {
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

function startTimer(){
  if (state.tick) clearInterval(state.tick);
  state.running = true;
  state.tick = setInterval(() => {
    if (!state.running) return;
    state.elapsedSec += 1;
    $timer.textContent = fmtTime(state.elapsedSec);
  }, 1000);
}
function pauseTimer(){ state.running = false; }

// Boot progress
function progress(p, loaded, total){
  const pct = Math.round(p*100);
  $bootBar.style.width = `${pct}%`;
  $bootPct.textContent = `${pct}%`;
  $bootCnt.textContent = `${loaded}/${total}`;
}

// Scenes
async function fetchScenes(){
  try{
    const res = await fetch(`${SCENES_URL}?v=${APP_BUILD}`, { cache: "no-cache" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    localStorage.setItem(LS_SCENES, JSON.stringify(data));
    return data;
  }catch(e){
    const cached = localStorage.getItem(LS_SCENES);
    if (cached) return JSON.parse(cached);
    throw e;
  }
}

function uniqueImages(scenes){
  const set = new Set();
  for(const k in scenes){
    const sc = scenes[k];
    if (sc?.image) set.add(sc.image);
  }
  return Array.from(set);
}

function fastPreload(names, onp){
  let loaded = 0;
  const total = names.length;
  if (total === 0){ onp(1,0,0); preloadDone = true; return; }

  const t = setTimeout(() => { preloadDone = true; }, 10000);

  names.forEach(name => {
    const img = new Image();
    img.onload = () => {
      if (!imageCache[name]) imageCache[name] = img;
      loaded += 1; onp(loaded/total, loaded, total);
      if (loaded >= total){ preloadDone = true; clearTimeout(t); }
    };
    img.onerror = () => { loaded += 1; onp(loaded/total, loaded, total); };
    img.src = IMG_BASE + name + `?v=${APP_BUILD}`;
  });
}

async function blink(ms=320){
  document.body.offsetTop;
  $eyetop.style.height = "52%";
  $eyebot.style.height = "52%";
  await sleep(ms);
  $eyetop.style.height = "0";
  $eyebot.style.height = "0";
}

function setBackground(name, meta={}){
  if (!name) return;
  const url = IMG_BASE + name + `?v=${APP_BUILD}`;
  if ($bgImg.dataset.src === url) return;
  $bgImg.dataset.src = url;
  $bgImg.src = url;
  if (meta.fit === "contain"){
    $bgImg.style.objectFit = "contain";
    $bgImg.style.backgroundColor = "#06080c";
  } else {
    $bgImg.style.objectFit = "cover";
    $bgImg.style.backgroundColor = "transparent";
  }
  $bgImg.style.objectPosition = typeof meta.focus === "string" ? meta.focus : "center";
  state.lastBg = url;
}

// Typewriter
async function typewrite(node, text){
  const s = String(text||"");
  node.textContent = "";
  if (!s.length) return;
  let stop=false;
  const onTap = () => { stop=true; };
  node.addEventListener("pointerdown", onTap, { once:true });

  const per = Math.max(10, Math.floor(TYPEWRITE_MAX_MS / s.length));
  for(let i=0;i<s.length;i++){
    if (stop){ node.textContent = s; break; }
    node.textContent += s[i];
    await sleep(per);
  }
}

function normalizeOptions(sc){
  if (!sc) return [];
  if (Array.isArray(sc.options)) {
    return sc.options.map(o => ({ label:o.label, next:o.next, requires:o.requires||null }));
  }
  const out=[]; const obj=sc.options||{};
  for (const [label, next] of Object.entries(obj)) out.push({ label, next, requires:null });
  return out;
}

// Inventory / Flags
function renderInventory(){
  const list = Object.entries(state.inventory||{}).filter(([,n])=>n>0);
  if (!list.length){ $invList.innerHTML = `<div class="muted">Пусто</div>`; return; }
  $invList.innerHTML = list.map(([k,n])=>`<div>${k}: ${n} шт</div>`).join("");
}
function renderFlags(){
  const list = Object.entries(state.flags||{}).filter(([,v])=>!!v);
  if (!list.length){ $flagsList.innerHTML = `<div class="muted">Пока нет</div>`; return; }
  $flagsList.innerHTML = list.map(([k,v])=>`<div>${k}: ${String(v)}</div>`).join("");
}

// Save / Load local
function saveLocal(){
  localStorage.setItem(LS_SAVE, JSON.stringify({
    build: APP_BUILD,
    current: state.current,
    inventory: state.inventory,
    flags: state.flags,
    lastBg: state.lastBg,
    startedAt: state.startedAt,
    elapsedSec: state.elapsedSec
  }));
}
function loadLocal(){
  try{
    const saved = JSON.parse(localStorage.getItem(LS_SAVE)||"{}");
    if (saved.build !== APP_BUILD) return;
    if (saved && saved.current){
      state.current = saved.current;
      state.inventory = saved.inventory||{};
      state.flags = saved.flags||{};
      state.lastBg = saved.lastBg||null;
      state.startedAt = saved.startedAt||null;
      state.elapsedSec = saved.elapsedSec||0;
      $timer.textContent = fmtTime(state.elapsedSec);
      if (state.lastBg) $bgImg.src = state.lastBg;
    }
  }catch{}
}

// Auth
function saveAuth(){ localStorage.setItem(LS_AUTH, JSON.stringify(state.auth)); }
function loadAuth(){
  try{
    const a = JSON.parse(localStorage.getItem(LS_AUTH)||"{}");
    state.auth = {
      verified: !!a.verified,
      nickname: a.nickname||"",
      tag: a.tag||"",
      gender: a.gender||"m"
    };
  }catch{}
}

// Overlay
function showOverlay(panel){
  $menuPanel.classList.add("hidden");
  $regPanel.classList.add("hidden");
  if (panel) panel.classList.remove("hidden");
  $overlay.classList.remove("hidden");
  pauseTimer();
}
function hideOverlay(){
  $overlay.classList.add("hidden");
  startTimer();
}
function openMainMenu(){
  $btnStart.disabled = !state.auth.verified;
  const hasSave = !!(localStorage.getItem(LS_SAVE));
  $btnContinue.disabled = !hasSave;
  showOverlay($menuPanel);
}
function openRegistration(){
  $regNick.value   = state.auth.nickname||"";
  $regTag.value    = state.auth.tag||"";
  $regGender.value = state.auth.gender||"m";
  $regMsg.textContent = "";
  showOverlay($regPanel);
}
function openIngameMenu(){
  pauseTimer();
  document.body.classList.add("looking-down");
  $ingameOverlay.classList.remove("hidden");
}
function closeIngameMenu(){
  $ingameOverlay.classList.add("hidden");
  document.body.classList.remove("looking-down");
  startTimer();
}

// Main menu handlers
$btnStart?.addEventListener("click", () => {
  if (!state.auth.verified) return;
  state.startedAt = new Date().toISOString();
  state.elapsedSec = 0;
  $timer.textContent = "00:00";
  hideOverlay();
  renderScene("start");
  send("start_new", {});
});
$btnContinue?.addEventListener("click", () => {
  hideOverlay();
  const has = state.current && state.current in state.scenes;
  renderScene(has ? state.current : "start");
  send("continue_game", {});
});
$btnSettings?.addEventListener("click", () => alert("Настройки позже."));
$btnLeaderboard?.addEventListener("click", () => alert("Лидерборд доступен командой /top у бота."));

// === Регистрация через API ===
let REG_ID = null;
let REG_STATUS_TIMER = null;

$btnSendCode?.addEventListener("click", async () => {
  const nickname = ($regNick.value||"").trim();
  let tag = ($regTag.value||"").trim();
  const gender = $regGender.value || "m";

  if (!nickname || !tag){ $regMsg.textContent = "Укажи ник и тег."; return; }
  if (!tag.startsWith("@")) tag = "@"+tag;

  state.auth.nickname = nickname;
  state.auth.tag = tag;
  state.auth.gender = gender;
  saveAuth();

  $regMsg.textContent = "Отправляю...";
  try{
    const resp = await api("/api/registration/start", { tag, nickname, gender });
    if (!resp.ok){
      if (resp.reason === "already_verified"){
        state.auth.verified = true; saveAuth();
        $regMsg.textContent = "Ты уже верифицирован. Открываю меню…";
        openMainMenu();
        return;
      }
      if (resp.reason === "tag_must_start_with_at"){
        $regMsg.textContent = "Тег должен начинаться с @.";
        return;
      }
      $regMsg.textContent = "Не получилось: " + (resp.reason || "ошибка");
      return;
    }
    REG_ID = resp.reg_id;
    $regMsg.textContent = "Жду отправки кода…";
    if (REG_STATUS_TIMER) clearInterval(REG_STATUS_TIMER);
    REG_STATUS_TIMER = setInterval(checkRegStatus, 1000);
  }catch(e){
    console.error(e);
    $regMsg.textContent = "Сеть не отвечает.";
  }
});

async function checkRegStatus(){
  if (!REG_ID) return;
  try{
    const s = await apiStatus(REG_ID);
    if (!s.ok) return;

    if (s.status === "code_sent"){
      $regMsg.textContent = "Код отправлен в Telegram владельцу тега. Введи его ниже.";
    } else if (s.status === "bad_tag"){
      clearInterval(REG_STATUS_TIMER);
      $regMsg.textContent = "Это не ваш тег. У бота нет чата с таким @.";
    } else if (s.status === "cannot_message"){
      clearInterval(REG_STATUS_TIMER);
      $regMsg.textContent = "Бот не может написать этому пользователю.";
    } else if (s.status === "expired"){
      clearInterval(REG_STATUS_TIMER);
      $regMsg.textContent = "Код протух. Отправь заново.";
    } else if (s.status === "locked"){
      clearInterval(REG_STATUS_TIMER);
      $regMsg.textContent = "Много неверных попыток. Блок на час.";
    } else if (s.status === "verified"){
      clearInterval(REG_STATUS_TIMER);
      $regMsg.textContent = "Готово. Верификация пройдена.";
    }
  }catch{}
}

$btnVerify?.addEventListener("click", async () => {
  if (!REG_ID){ $regMsg.textContent = "Сначала отправь код."; return; }
  const code = ($regCode.value||"").trim();
  if (!code || code.length !== 6){ $regMsg.textContent = "Введи 6 цифр."; return; }

  try{
    const resp = await api("/api/registration/verify", { reg_id: REG_ID, code });
    if (resp.ok){
      if (REG_STATUS_TIMER) clearInterval(REG_STATUS_TIMER);
      state.auth.verified = true; saveAuth();
      $regMsg.textContent = "Верификация пройдена. Можно играть.";
      openMainMenu();
    } else {
      if (resp.reason === "bad_code"){
        $regMsg.textContent = `Неверный код. Осталось попыток: ${resp.left}`;
      } else if (resp.reason === "locked"){
        $regMsg.textContent = "Блок на час за перебор неверных кодов.";
      } else if (resp.reason === "expired"){
        $regMsg.textContent = "Код истёк. Отправь заново.";
      } else {
        $regMsg.textContent = "Ошибка: " + (resp.reason || "неизвестная");
      }
    }
  }catch(e){
    console.error(e);
    $regMsg.textContent = "Сеть не отвечает.";
  }
});

// Ingame menu
$menuBtn?.addEventListener("click", () => {
  if ($ingameOverlay.classList.contains("hidden")) openIngameMenu();
  else closeIngameMenu();
});
$gmInventory?.addEventListener("click", () => { renderInventory(); $invDlg.showModal(); });
$gmFlags?.addEventListener("click", () => { renderFlags(); $flagsDlg.showModal(); });
$invClose?.addEventListener("click", () => $invDlg.close());
$flagsClose?.addEventListener("click", () => $flagsDlg.close());
$gmSaveExit?.addEventListener("click", () => {
  saveLocal();
  send("sync_state", {
    scene: state.current, inventory: state.inventory,
    flags: state.flags, last_bg: state.lastBg, elapsed_sec: state.elapsedSec
  });
  closeIngameMenu();
  openMainMenu();
});
$gmBack?.addEventListener("click", () => { closeIngameMenu(); });

// Scene render
async function renderScene(key){
  const sc = state.scenes[key];
  if (!sc) return;
  state.current = key;

  if (sc.image){
    await blink(220);
    setBackground(sc.image, { fit: sc.fit, focus: sc.focus });
  }
  await typewrite($descText, sc.description||"…");

  $opts.innerHTML = "";
  const options = normalizeOptions(sc);
  for (const opt of options){
    if (opt.requires && opt.requires.type === "item"){
      const need=opt.requires.name, count=opt.requires.count||1;
      if (!state.inventory[need] || state.inventory[need] < count) continue;
    }
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = opt.label;
    b.onclick = async () => {
      saveLocal();
      send("choice_made", { from:key, to:opt.next, label:opt.label });
      await sleep(120);
      renderScene(opt.next);
    };
    $opts.appendChild(b);
  }

  saveLocal();
  startTimer();
  send("scene_enter", { scene:key });
}

// Heartbeat
let hb = null;
function startHeartbeat(){
  if (hb) clearInterval(hb);
  hb = setInterval(() => {
    if (!state.running) return;
    send("heartbeat", { scene:state.current, elapsed_sec:state.elapsedSec });
    saveLocal();
  }, HEARTBEAT_MS);
}

// Init
(async function init(){
  try{
    const oldBuild = Number(localStorage.getItem(LS_BUILD)||"0");
    if (oldBuild !== APP_BUILD){
      localStorage.removeItem(LS_SAVE);
      localStorage.setItem(LS_BUILD, String(APP_BUILD));
    }

    state.scenes = await fetchScenes();
    const imgs = uniqueImages(state.scenes);
    fastPreload(imgs, progress);

    loadAuth();
    loadLocal();
    if (!state.startedAt) state.startedAt = new Date().toISOString();

    const t0 = Date.now();
    while (!preloadDone && Date.now()-t0 < 10000) await sleep(80);

    document.body.classList.remove("booting");
    document.body.classList.add("ready");

    if (state.auth.verified) openMainMenu();
    else openRegistration();

    pauseTimer();
    startHeartbeat();
    send("app_ready", {});
  }catch(err){
    console.error(err);
    document.body.classList.remove("booting");
    document.body.classList.add("ready");
    $descText.textContent = "Не удалось загрузить игру. Обнови страницу.";
  }
})();
