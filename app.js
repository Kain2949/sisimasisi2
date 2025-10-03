// Telegram WebApp (не обязателен для сайта, но не мешает)
const tg = window.Telegram?.WebApp;
tg?.expand();

const state = {
  scenes: {},
  current: "start",
  flags: {},
  inv: {},        // { item: count }
  lastImg: null,
};

// DOM
const $desc = document.getElementById("desc");
const $descText = document.getElementById("descText");
const $opts = document.getElementById("opts");
const $btnInv = document.getElementById("btnInv");
const $btnFlags = document.getElementById("btnFlags");
const $ovInv = document.getElementById("overlayInv");
const $ovFlags = document.getElementById("overlayFlags");
const $invList = document.getElementById("invList");
const $flagsList = document.getElementById("flagsList");
const $blink = document.getElementById("blink");

// helpers
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function save() {
  localStorage.setItem("bwa_save", JSON.stringify({
    current: state.current,
    inv: state.inv,
    flags: state.flags,
    lastImg: state.lastImg
  }));
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem("bwa_save")||"{}");
    Object.assign(state, s);
  } catch {}
}
async function preload(src){
  if (!src) return;
  await new Promise(res=>{
    const i = new Image(); i.onload=res; i.onerror=res; i.src=src;
  });
}
function setDescBg(imgName){
  const url = imgName ? `images/${imgName}` : null;
  if (url === state.lastImg) return;
  $desc.style.opacity = 0.0;
  setTimeout(async ()=>{
    if (url) await preload(url);
    $desc.style.setProperty("--bg", `url(${url})`);
    $desc.style.opacity = 1;
    state.lastImg = url;
  }, 180);
}
Object.defineProperty($desc.style, "backgroundImage", {
  set(_){} // защитимся от внезапных внешних вмешательств
});
$desc.style.setProperty("--bg","none");
$desc.addEventListener("transitionend",()=>{});

// обновление панелей
function renderInv(){
  $invList.innerHTML = "";
  const items = Object.entries(state.inv).filter(([,c])=>c>0);
  if (!items.length) {
    $invList.innerHTML = "<li>пусто</li>";
  } else {
    for (const [k,v] of items){
      const li = document.createElement("li");
      li.textContent = `${k}: ${v} шт`;
      $invList.appendChild(li);
    }
  }
}
function renderFlags(){
  $flagsList.innerHTML = "";
  const items = Object.entries(state.flags);
  if (!items.length) $flagsList.innerHTML = "<li>—</li>";
  for (const [k,v] of items){
    const li = document.createElement("li");
    li.textContent = `${k}=${v}`;
    $flagsList.appendChild(li);
  }
}

// требования
function hasItems(req){
  if (!req) return true;
  for (const [k,v] of Object.entries(req)){
    if ((state.inv[k]||0) < Number(v)) return false;
  }
  return true;
}
// применение
function addItems(map){
  if (!map) return;
  for (const [k,v] of Object.entries(map)){
    state.inv[k] = (state.inv[k]||0) + Number(v);
    if (state.inv[k] <= 0) delete state.inv[k];
  }
}
function useItems(map){
  if (!map) return true;
  if (!hasItems(map)) return false;
  for (const [k,v] of Object.entries(map)){
    state.inv[k] = (state.inv[k]||0) - Number(v);
    if (state.inv[k] <= 0) delete state.inv[k];
  }
  return true;
}

function blink(){
  $blink.classList.remove("hidden");
  $blink.classList.add("active");
  setTimeout(()=>{
    $blink.classList.remove("active");
    $blink.classList.add("hidden");
  }, 360);
}

function optionButton(opt){
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = opt.label || "Выбор";
  if (opt.requires) b.classList.add("extra");
  if (opt.use_items) b.classList.add("spend");
  b.onclick = async ()=>{
    // анимация выбора
    b.classList.add("selected");
    for (const el of $opts.querySelectorAll(".btn")){
      if (el !== b) el.classList.add("fadeout");
    }
    await sleep(700);

    // трата/получение/флаги
    if (opt.use_items && !useItems(opt.use_items)) return;
    if (opt.add_items) addItems(opt.add_items);
    if (opt.set_flags) Object.assign(state.flags, opt.set_flags);

    // переход
    if (opt.restart){
      state.inv = {};
      state.flags = {};
      state.current = "start";
    } else {
      state.current = opt.to || state.current;
    }

    save();
    await showScene(state.current, {withBlink:true});
  };
  return b;
}

async function showScene(key, {withBlink=false}={}){
  const sc = state.scenes[key];
  if (!sc) return;

  if (withBlink) blink();

  setDescBg(sc.image || null);
  $desc.style.setProperty("--img", sc.image ? `url(images/${sc.image})` : "none");
  $desc.style.setProperty("background-image", `var(--bg)`); // управляем через ::before
  $descText.textContent = sc.description || "…";

  // варианты
  $opts.innerHTML = "";
  const avail = (sc.options||[]).filter(opt => hasItems(opt.requires));
  for (const opt of avail){
    const btn = optionButton(opt);
    $opts.appendChild(btn);
  }

  renderInv();
  renderFlags();
}

async function init(){
  // фон ::before
  const sheet = document.styleSheets[0];
  for (let i=0;i<sheet.cssRules.length;i++){
    const r = sheet.cssRules[i];
    if (r.selectorText === ".desc::before"){
      // динамическая подмена из JS
      new MutationObserver(()=>{}); // фиктивно, чтобы не ругался
      // будем менять через style.setProperty("--bg", ...)
      document.getElementById("desc").style.backgroundImage = ""; // no-op
      break;
    }
  }

  const res = await fetch("scenes.json?_=" + Date.now());
  state.scenes = await res.json();
  load();

  // ui
  $btnInv.onclick = ()=>{$ovInv.classList.toggle("hidden"); renderInv();};
  $btnFlags.onclick = ()=>{$ovFlags.classList.toggle("hidden"); renderFlags();};
  $ovInv.onclick = (e)=>{ if (e.target=== $ovInv) $ovInv.classList.add("hidden")};
  $ovFlags.onclick = (e)=>{ if (e.target=== $ovFlags) $ovFlags.classList.add("hidden")};

  await showScene(state.current || "start", {withBlink:true});
}

init();
