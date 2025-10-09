/* Raf game — WebApp (сцены из scenes.json)
   build: noir + liquid glass + bulbs sign
*/

const APP_BUILD = 13;

// Telegram
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.expand();
    tg.setBackgroundColor("#03060a");
    tg.setHeaderColor("secondary");
  } catch {}
}

// === API конфиг ===
const API_BASE = "https://kristan-labored-earsplittingly.ngrok-free.dev";
const API_KEY = "super_secret_key_3481gfej83f";
async function api(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
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
async function apiTop(limit=30){
  const res = await fetch(`${API_BASE}/api/leaderboard/top?limit=${limit}`, {
    headers: { "X-API-KEY": API_KEY }
  });
  return res.json();
}
async function apiSubmitLB(tag, nickname, elapsed){
  return api("/api/leaderboard/submit", { tag, nickname, elapsed_sec: elapsed });
}

// DOM
const $descText = document.getElementById("descText");
const $bgImg = document.getElementById("bgImg");
const $opts = document.getElementById("options");
const $bootBar = document.getElementById("bootBar");
const $bootPct = document.getElementById("bootPct");
const $bootCnt = document.getElementById("bootCount");
const $eyetop = document.getElementById("eyelidTop");
const $eyebot = document.getElementById("eyelidBot");
const $timer = document.getElementById("timer");
const $menuBtn = document.getElementById("menuBtn");

// overlay
const $overlay = document.getElementById("overlay");
const $menuPanel = document.getElementById("menuPanel");
const $regPanel = document.getElementById("regPanel");
const $lbPanel = document.getElementById("lbPanel");
const $settingsPanel = document.getElementById("settingsPanel");
const $btnStart = document.getElementById("btnStart");
const $btnContinue = document.getElementById("btnContinue");
const $btnSettings = document.getElementById("btnSettings");
const $btnLeaderboard = document.getElementById("btnLeaderboard");

// registration
const $regNick = document.getElementById("regNick");
const $regTag = document.getElementById("regTag");
const $regMsg = document.getElementById("regMsg");

// gender pills
const $btnMale = document.getElementById("btnMale");
const $btnFemale = document.getElementById("btnFemale");

// verify
const $btnSendCode = document.getElementById("btnSendCode");
const $regCode = document.getElementById("regCode");
const $btnVerify = document.getElementById("btnVerify");

// leaderboard
const $lbList = document.getElementById("lbList");
const $lbBack = document.getElementById("lbBack");

// settings
const $fxEnable = document.getElementById("fxEnable");
const $fxChance = document.getElementById("fxChance");
const $fxChanceVal = document.getElementById("fxChanceVal");
const $settingsBack= document.getElementById("settingsBack");

// ingame overlays / dialogs
const $ingameOverlay = document.getElementById("ingameOverlay");
const $gmInventory = document.getElementById("gmInventory");
const $gmFlags = document.getElementById("gmFlags");
const $gmSaveExit = document.getElementById("gmSaveExit");
const $gmClose = document.getElementById("gmClose");
const $invDlg = document.getElementById("invDlg");
const $flagsDlg = document.getElementById("flagsDlg");
const $invClose = document.getElementById("invClose");
const $flagsClose = document.getElementById("flagsClose");

// lamp sign container
const $lampSign = document.getElementById("lampSign");

// Config
const IMG_BASE = "images/";
const SCENES_URL = "scenes.json";
const LS_SCENES = "scenes_cache_v1";
const LS_SAVE = "game115";
const LS_AUTH = "auth115";
const LS_BUILD = "build115";
const LS_SETTINGS = "settings115";
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
  typing: false,
  auth: { verified:false, nickname:"", tag:"", gender:"m" },
  settings: { fxEnabled: true, fxChance: 50 },
  bulbs: []
};
const imageCache = {};
let preloadDone = false;

// ===== Utils
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const send = (event, payload) => { if (tg?.sendData) tg.sendData(JSON.stringify({ event, payload })); };
const fmtTime = (sec) => `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(Math.floor(sec%60)).padStart(2,"0")}`;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function randInt(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function randFloat(a,b){ return a + Math.random()*(b-a); }

// ===== Timer
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

// ===== Boot progress
function progress(p, loaded, total){
  const pct = Math.round(p*100);
  if ($bootBar) $bootBar.style.width = `${pct}%`;
  if ($bootPct) $bootPct.textContent = `${pct}%`;
  if ($bootCnt) $bootCnt.textContent = `${loaded}/${total}`;
}

// ===== Scenes
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

// ===== Eye blink
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
  $bgImg.style.objectFit = (meta.fit === "contain") ? "contain" : "cover";
  $bgImg.style.objectPosition = typeof meta.focus === "string" ? meta.focus : "center";
  state.lastBg = url;
}

// ===== Typewriter
async function typewrite(node, text){
  const s = String(text||"");
  node.textContent = "";
  if (!s.length) return;
  state.typing = true;
  $opts.classList.add("hidden");
  const per = Math.max(10, Math.floor(TYPEWRITE_MAX_MS / s.length));
  for(let i=0;i<s.length;i++){
    node.textContent += s[i];
    await sleep(per);
  }
  state.typing = false;
  $opts.classList.remove("hidden");
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

// ===== Inventory / Flags
function renderInventory(){
  const list = Object.entries(state.inventory||{}).filter(([,n])=>n>0);
  if (!list.length){ document.getElementById("invList").innerHTML = `<div class="muted">Пусто</div>`; return; }
  document.getElementById("invList").innerHTML = list.map(([k,n])=>`<div>${k}: ${n} шт</div>`).join("");
}
function renderFlags(){
  const list = Object.entries(state.flags||{}).filter(([,v])=>!!v);
  if (!list.length){ document.getElementById("flagsList").innerHTML = `<div class="muted">Пока нет</div>`; return; }
  document.getElementById("flagsList").innerHTML = list.map(([k,v])=>`<div>${k}: ${String(v)}</div>`).join("");
}

// ===== Save / Load local
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

// ===== Auth
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

// ===== Settings
function saveSettings(){ localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings)); }
function loadSettings(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS)||"{}");
    if (typeof s.fxEnabled === "boolean") state.settings.fxEnabled = s.fxEnabled;
    if (typeof s.fxChance === "number") state.settings.fxChance = clamp(s.fxChance, 0, 100);
  }catch{}
  if ($fxEnable) $fxEnable.checked = !!state.settings.fxEnabled;
  if ($fxChance){
    $fxChance.value = String(state.settings.fxChance);
    if ($fxChanceVal) $fxChanceVal.textContent = `${state.settings.fxChance}%`;
  }
}
$fxEnable?.addEventListener("change", () => { state.settings.fxEnabled = $fxEnable.checked; saveSettings(); });
$fxChance?.addEventListener("input", () => { state.settings.fxChance = Number($fxChance.value||"0"); if ($fxChanceVal) $fxChanceVal.textContent = `${state.settings.fxChance}%`; saveSettings(); });

// ===== Overlay helpers
function showOverlay(panel){
  for (const el of [$menuPanel,$regPanel,$lbPanel,$settingsPanel]) el?.classList.add("hidden");
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
  $regNick.value = state.auth.nickname||"";
  $regTag.value = state.auth.tag||"";
  setGender(state.auth.gender||"m");
  $regMsg.textContent = "";
  showOverlay($regPanel);
}
function openLeaderboard(){
  showOverlay($lbPanel);
  $lbList.innerHTML = `<div class="muted">Загрузка…</div>`;
  apiTop().then(r=>{
    if (!r.ok) { $lbList.innerHTML = `<div class="muted">Ошибка.</div>`; return; }
    if (!r.items.length){ $lbList.innerHTML = `<div class="muted">Пока пусто</div>`; return; }
    $lbList.innerHTML = r.items.map((it,i)=>`
      <div class="row">
        <div class="pos">${i+1}</div>
        <div class="tag">${it.tag}</div>
        <div class="nick">${it.nickname}</div>
        <div class="time">${fmtTime(it.elapsed_sec)}</div>
      </div>
    `).join("");
  }).catch(()=>{ $lbList.innerHTML = `<div class="muted">Ошибка сети</div>`; });
}
function openSettings(){ showOverlay($settingsPanel); }

$btnSettings?.addEventListener("click", openSettings);
$settingsBack?.addEventListener("click", openMainMenu);

// ===== Main menu
function resetGame(){
  localStorage.removeItem(LS_SAVE);
  state.current = "start";
  state.inventory = {};
  state.flags = {};
  state.lastBg = null;
  state.elapsedSec = 0;
  $timer.textContent = "00:00";
}
$btnStart?.addEventListener("click", () => {
  if (!state.auth.verified) return;
  resetGame();
  state.startedAt = new Date().toISOString();
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
$btnLeaderboard?.addEventListener("click", openLeaderboard);
$lbBack?.addEventListener("click", () => openMainMenu());

// ===== Gender pills
function setGender(val){
  state.auth.gender = val;
  saveAuth();
  $btnMale?.classList.toggle("active", val==="m");
  $btnFemale?.classList.toggle("active", val==="f");
}
$btnMale?.addEventListener("click", () => setGender("m"));
$btnFemale?.addEventListener("click", () => setGender("f"));

// ===== Registration via API
let REG_ID = null;
let REG_STATUS_TIMER = null;
$btnSendCode?.addEventListener("click", async () => {
  const nickname = ($regNick.value||"").trim();
  let tag = ($regTag.value||"").trim();
  const gender = state.auth.gender || "m";
  if (!nickname || !tag){ $regMsg.textContent = "Укажи ник и тег."; return; }
  if (!tag.startsWith("@")) tag = "@"+tag;
  state.auth.nickname = nickname;
  state.auth.tag = tag;
  saveAuth();
  $regMsg.textContent = "Отправляю...";
  try{
    const resp = await api("/api/registration/start", { tag, nickname, gender });
    if (!resp.ok){
      if (resp.reason === "already_verified"){
        state.auth.verified = true; saveAuth();
        $regMsg.textContent = "Ты уже верифицирован. Открываю меню…";
        openMainMenu(); return;
      }
      if (resp.reason === "tag_must_start_with_at"){ $regMsg.textContent = "Тег должен начинаться с @."; return; }
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
    if (s.status === "code_sent"){ $regMsg.textContent = "Код отправлен в Telegram владельцу тега. Введи его ниже."; }
    else if (s.status === "bad_tag"){ clearInterval(REG_STATUS_TIMER); $regMsg.textContent = "Это не ваш тег. У бота нет чата с таким @."; }
    else if (s.status === "cannot_message"){ clearInterval(REG_STATUS_TIMER); $regMsg.textContent = "Бот не может написать этому пользователю."; }
    else if (s.status === "expired"){ clearInterval(REG_STATUS_TIMER); $regMsg.textContent = "Код протух. Отправь заново."; }
    else if (s.status === "locked"){ clearInterval(REG_STATUS_TIMER); $regMsg.textContent = "Много неверных попыток. Блок на час."; }
    else if (s.status === "verified"){ clearInterval(REG_STATUS_TIMER); $regMsg.textContent = "Готово. Верификация пройдена."; }
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
      if (resp.reason === "banned"){ $regMsg.textContent = "Пол женский — доступ запрещён навсегда."; }
      else if (resp.reason === "bad_code"){ $regMsg.textContent = `Неверный код. Осталось попыток: ${resp.left}`; }
      else if (resp.reason === "locked"){ $regMsg.textContent = "Блок на час за перебор неверных кодов."; }
      else if (resp.reason === "expired"){ $regMsg.textContent = "Код истёк. Отправь заново."; }
      else { $regMsg.textContent = "Ошибка: " + (resp.reason || "неизвестная"); }
    }
  }catch(e){
    console.error(e);
    $regMsg.textContent = "Сеть не отвечает.";
  }
});

// ===== Ingame menu / dialogs
$menuBtn?.addEventListener("click", () => {
  if ($ingameOverlay.classList.contains("hidden")) {
    pauseTimer();
    document.body.classList.add("looking-down");
    $ingameOverlay.classList.remove("hidden");
  } else {
    $ingameOverlay.classList.add("hidden");
    document.body.classList.remove("looking-down");
    startTimer();
  }
});
$gmClose?.addEventListener("click", () => {
  $ingameOverlay.classList.add("hidden");
  document.body.classList.remove("looking-down");
  startTimer();
});
$gmInventory?.addEventListener("click", () => { renderInventory(); $invDlg?.showModal(); });
$gmFlags?.addEventListener("click", () => { renderFlags(); $flagsDlg?.showModal(); });
$invClose?.addEventListener("click", () => $invDlg?.close());
$flagsClose?.addEventListener("click", () => $flagsDlg?.close());
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if ($invDlg?.open) $invDlg.close();
    if ($flagsDlg?.open) $flagsDlg.close();
  }
});

// ===== Save & Exit
$gmSaveExit?.addEventListener("click", async () => {
  saveLocal();
  if (state.auth.tag && state.auth.nickname){
    try { await apiSubmitLB(state.auth.tag, state.auth.nickname, state.elapsedSec); } catch(e){}
  }
  send("sync_state", {
    scene: state.current, inventory: state.inventory,
    flags: state.flags, last_bg: state.lastBg, elapsed_sec: state.elapsedSec
  });
  $ingameOverlay.classList.add("hidden");
  document.body.classList.remove("looking-down");
  openMainMenu();
});

// ===== FX (CRT + Pixel) via Canvas
let fxCanvas = null, fxCtx = null, fxDPR = 1, fxActive = false;
function ensureFxCanvas(){
  if (fxCanvas) return;
  fxCanvas = document.createElement("canvas");
  fxCanvas.id = "fxCanvas";
  fxCanvas.className = "fx-canvas";
  document.body.appendChild(fxCanvas);
  fxCtx = fxCanvas.getContext("2d");
  const resize = () => {
    fxDPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1.5));
    fxCanvas.width = Math.floor(window.innerWidth * fxDPR);
    fxCanvas.height = Math.floor(window.innerHeight * fxDPR);
    fxCanvas.style.width = `${window.innerWidth}px`;
    fxCanvas.style.height = `${window.innerHeight}px`;
    if (fxCtx) fxCtx.imageSmoothingEnabled = false;
  };
  resize();
  window.addEventListener("resize", resize);
}
function clearFx(){ if (!fxCtx) return; fxCtx.clearRect(0,0,fxCanvas.width,fxCanvas.height); }
function drawNoiseBlocky(alpha=0.22){
  const w = Math.max(96, Math.floor(fxCanvas.width / 14));
  const h = Math.max(64, Math.floor(fxCanvas.height/ 14));
  const useOff = (typeof OffscreenCanvas !== "undefined");
  const off = useOff ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  if (!useOff) { off.width = w; off.height = h; }
  const octx = off.getContext("2d", { willReadFrequently: true });
  const id = octx.createImageData(w, h);
  const buf = id.data;
  for (let i=0;i<buf.length;i+=4){
    const v = Math.random()*255;
    buf[i]=buf[i+1]=buf[i+2]=v;
    buf[i+3]=255;
  }
  octx.putImageData(id,0,0);
  fxCtx.globalAlpha = alpha;
  fxCtx.imageSmoothingEnabled = false;
  fxCtx.drawImage(off, 0, 0, w, h, 0, 0, fxCanvas.width, fxCanvas.height);
  fxCtx.globalAlpha = 1;
}
function drawScanlines(){
  const h = fxCanvas.height, w = fxCanvas.width;
  fxCtx.globalAlpha = 0.16;
  fxCtx.fillStyle = "#000";
  const step = Math.max(2, Math.round(2*fxDPR));
  for (let y=0; y<h; y+=step){ fxCtx.fillRect(0, y, w, 1); }
  fxCtx.globalAlpha = 1;
}
function drawTearGlitch(){
  const h = fxCanvas.height, w = fxCanvas.width;
  const bands = randInt(1,3);
  for (let i=0;i<bands;i++){
    const y = randInt(0, h-40);
    const bh = randInt(8*fxDPR, 22*fxDPR);
    const dx = randInt(-20*fxDPR, 20*fxDPR);
    const img = fxCtx.getImageData(0, y, w, bh);
    fxCtx.putImageData(img, dx, y);
  }
}
async function playFxCRT(durationMs){
  ensureFxCanvas();
  if (fxActive) return;
  fxActive = true;
  fxCanvas.classList.add("visible");
  clearFx();
  const t0 = performance.now();
  function frame(t){
    clearFx();
    drawNoiseBlocky(0.22);
    if (Math.random() < 0.35) drawTearGlitch();
    drawScanlines();
    if (t - t0 < durationMs){
      requestAnimationFrame(frame);
    } else {
      fxCanvas.classList.remove("visible");
      clearFx();
      fxActive = false;
    }
  }
  requestAnimationFrame(frame);
}
async function maybeFx(){
  if (!state.settings.fxEnabled) return;
  const chance = Number(state.settings.fxChance||0);
  if (Math.random()*100 <= chance){
    const dur = randInt(420, 820);
    await playFxCRT(dur);
  }
}

// ===== Scene render
async function renderScene(key){
  const sc = state.scenes[key];
  if (!sc) return;
  state.current = key;
  await maybeFx();
  if (sc.image){
    await blink(200);
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
      if (state.typing) return;
      saveLocal();
      send("choice_made", { from:key, to:opt.next, label:opt.label });
      await sleep(100);
      renderScene(opt.next);
    };
    $opts.appendChild(b);
  }
  saveLocal();
  startTimer();
  send("scene_enter", { scene:key });
}

// ===== Heartbeat
let hb = null;
function startHeartbeat(){
  if (hb) clearInterval(hb);
  hb = setInterval(() => {
    if (!state.running) return;
    send("heartbeat", { scene:state.current, elapsed_sec:state.elapsedSec });
    saveLocal();
  }, HEARTBEAT_MS);
}

/* ================================
   LAMP SIGN (Raf Game) — DOM bulbs
================================ */
function injectLampStyles(){
  const css = `
.lamp-sign.has-bulbs::after{ display:none; }
.lamp-sign{ position:relative; }
.lamp-sign .bulb{
position:absolute; width:10px; height:10px;
transform: translate(-50%,-50%);
border-radius:50%;
background: radial-gradient(circle at 45% 40%, #ffdba0 0%, #7a4a1a 65%, #321c0b 100%);
box-shadow:0 0 0 1px rgba(255,255,255,.06) inset,0 2px 6px rgba(0,0,0,.6);
filter: saturate(1.1);
}
.lamp-sign .bulb .b-core{position:absolute; inset:0; border-radius:50%; background: radial-gradient(circle at 50% 50%, rgba(255,210,120,.95) 0%, rgba(255,180,70,.65) 30%, rgba(255,160,40,.0) 65%); opacity:.0; transition: opacity .14s ease; mix-blend-mode: screen;}
.lamp-sign .bulb .b-glow{position:absolute; left:50%; top:50%; width:0; height:0; pointer-events:none; box-shadow:0 0 18px 6px rgba(255,200,90,.85), 0 0 34px 12px rgba(255,200,90,.35); opacity:0; transition: opacity .14s ease;}
.lamp-sign .bulb .b-glass{position:absolute; inset:0; border-radius:50%; pointer-events:none; background: radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.45), rgba(255,255,255,0) 60%), radial-gradient(80% 80% at 70% 70%, rgba(255,255,255,.12), rgba(255,255,255,0) 70%); mix-blend-mode: screen; opacity:.55;}
.lamp-sign .bulb.on .b-core{ opacity:1; }
.lamp-sign .bulb.on .b-glow{ opacity:1; }
.lamp-sign .bulb.off{ filter: grayscale(.6) brightness(.65); }
.lamp-sign .bulb.dead{ filter: grayscale(1) brightness(.35); box-shadow: 0 1px 4px rgba(0,0,0,.7) inset; } 
@keyframes microFlick { 0%,100% { opacity:1; filter:brightness(1) } 50% { opacity:.96; filter:brightness(.98) } }
.lamp-sign .bulb.on { animation: microFlick 2.6s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 27ms); }
`;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}

// простые «скелеты» букв (координаты 0..1)
const Letter = {
  R: [
    [[0.05,0.05],[0.05,0.95]],
    [[0.05,0.05],[0.65,0.05]],
    [[0.65,0.05],[0.75,0.15]],
    [[0.75,0.15],[0.75,0.42]],
    [[0.75,0.42],[0.65,0.50]],
    [[0.65,0.50],[0.05,0.50]],
    [[0.05,0.50],[0.80,0.95]]
  ],
  A: [
    [[0.05,0.95],[0.35,0.05]],
    [[0.35,0.05],[0.65,0.95]],
    [[0.18,0.55],[0.52,0.55]]
  ],
  F: [
    [[0.05,0.05],[0.05,0.95]],
    [[0.05,0.05],[0.75,0.05]],
    [[0.05,0.50],[0.60,0.50]]
  ],
  G: [
    [[0.70,0.25],[0.55,0.10]],
    [[0.55,0.10],[0.25,0.10]],
    [[0.25,0.10],[0.10,0.25]],
    [[0.10,0.25],[0.10,0.75]],
    [[0.10,0.75],[0.25,0.90]],
    [[0.25,0.90],[0.60,0.90]],
    [[0.60,0.90],[0.75,0.75]],
    [[0.40,0.58],[0.78,0.58]]
  ],
  M: [
    [[0.05,0.95],[0.05,0.05]],
    [[0.05,0.05],[0.35,0.55]],
    [[0.35,0.55],[0.65,0.05]],
    [[0.65,0.05],[0.65,0.95]]
  ],
  E: [
    [[0.70,0.05],[0.10,0.05]],
    [[0.10,0.05],[0.10,0.95]],
    [[0.10,0.50],[0.60,0.50]],
    [[0.10,0.95],[0.70,0.95]]
  ],
  SPACE: []
};

function sampleSegment(p1, p2, stepPx, boxW, boxH){
  const [x1,y1] = p1, [x2,y2] = p2;
  const dx = (x2-x1)*boxW, dy=(y2-y1)*boxH;
  const dist = Math.hypot(dx,dy);
  const steps = Math.max(1, Math.floor(dist / stepPx));
  const out = [];
  for(let i=0;i<=steps;i++){
    const t = i/steps;
    out.push([ (x1 + (x2-x1)*t)*boxW, (y1 + (y2-y1)*t)*boxH ]);
  }
  return out;
}

function createBulb(x, y, idx){
  const b = document.createElement("div");
  b.className = "bulb on";
  b.style.left = `${x}px`;
  b.style.top = `${y}px`;
  b.style.setProperty("--i", String(idx%200));
  const core = document.createElement("span"); core.className="b-core";
  const glow = document.createElement("span"); glow.className="b-glow";
  const glass= document.createElement("span"); glass.className="b-glass";
  b.appendChild(core); b.appendChild(glow); b.appendChild(glass);
  return b;
}

function buildLampSign(){
  if (!$lampSign) return;
  injectLampStyles();
  const text = "RAF GAME";
  const rect = $lampSign.getBoundingClientRect();
  const W = rect.width || 640;
  const H = rect.height || 160;
  const letterCount = 7;
  const spacing = Math.max(10, Math.floor(W * 0.012));
  const letterW = Math.min((W - spacing*6) / letterCount, 86);
  const letterH = Math.min(H * 0.78, 120);
  const offsetY = (H - letterH)/2 + 6;
  const step = Math.max(8, Math.floor(letterW/8));
  const arcAmp = Math.min(18, H*0.12);
  const map = { "R":"R", "A":"A", "F":"F", "G":"G", "M":"M", "E":"E", " ":"SPACE" };
  let xCursor = (W - (letterW*letterCount + spacing*6)) / 2;
  const bulbs = [];
  let idx=0;
  for (const ch of text){
    const key = map[ch] || "SPACE";
    if (key === "SPACE"){ xCursor += letterW + spacing; continue; }
    const segs = Letter[key];
    for (const seg of segs){
      const pts = sampleSegment(seg[0], seg[1], step, letterW, letterH);
      for (const [lx,ly] of pts){
        const gx = xCursor + lx;
        const rel = (gx / W) - 0.5;
        const gy = offsetY + ly - (arcAmp * (1 - Math.pow(rel*2, 2)) * 0.30);
        const el = createBulb(gx, gy, idx++);
        $lampSign.appendChild(el);
        bulbs.push({ el, state:"on", timer:null });
      }
    }
    xCursor += letterW + spacing;
  }
  const burnedPct = 0.08;
  bulbs.forEach(b=>{
    if (Math.random() < burnedPct){
      b.state = "dead";
      b.el.classList.remove("on"); b.el.classList.remove("off"); b.el.classList.add("dead");
    }
  });
  setInterval(() => {
    for (const b of bulbs){
      if (b.state === "dead" || b.state === "off") continue;
      if (Math.random() < 0.05){
        b.state = "off";
        b.el.classList.remove("on"); b.el.classList.add("off");
        const t = randInt(1000, 5000);
        b.timer = setTimeout(()=>{
          if (b.state === "off"){
            b.state = "on";
            b.el.classList.remove("off"); b.el.classList.add("on");
          }
        }, t);
      }
    }
  }, 1000);
  $lampSign.classList.add("has-bulbs");
  $lampSign.setAttribute("aria-label","");
  state.bulbs = bulbs;
}

// ===== Liquid glass breathing + cursor reaction (added)
(function(){
  const turb = document.getElementById('lqgNoise');
  const disp = document.getElementById('lqgDisp');
  if (!turb || !disp) return;
  let t = 0;
  function tick(){
    t += 0.013;
    const f1 = 0.006 + Math.sin(t * 0.68) * 0.0019;
    const f2 = 0.008 + Math.cos(t * 0.92) * 0.0019;
    turb.setAttribute('baseFrequency', `${f1} ${f2}`);
    const base = 28;
    const scale = Math.max(12, base + Math.sin(t * 0.9) * 6);
    disp.setAttribute('scale', String(Math.round(scale)));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  document.addEventListener('mousemove', e=>{
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    document.querySelectorAll('.glass__lens').forEach(L=>{
      L.style.transform = `translate(${x*18}px, ${y*10}px) scale(${1 + Math.hypot(x,y)/4})`;
    });
  }, { passive:true });

  // ensure lampSign exists (fallback)
  if (!document.getElementById('lampSign')) {
    const raf = document.getElementById('rafLogo');
    if (raf && raf.parentElement) {
      const wrapper = document.createElement('div');
      wrapper.id = 'lampSign';
      wrapper.className = 'lamp-sign';
      raf.parentElement.replaceChild(wrapper, raf);
      wrapper.appendChild(raf);
    }
  }
})();

// ===== Init
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
    loadSettings();
    loadLocal();
    if (!state.startedAt) state.startedAt = new Date().toISOString();
    const t0 = Date.now();
    while (!preloadDone && Date.now()-t0 < 10000) await sleep(80);
    document.body.classList.remove("booting");
    document.body.classList.add("ready");

    // build lamp sign (DOM bulbs)
    buildLampSign();

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
