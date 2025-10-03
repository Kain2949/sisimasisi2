// Телега
const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); tg?.setHeaderColor("#0b0e13"); tg?.setBackgroundColor("#0b0e13"); } catch {}

const uid = (tg?.initDataUnsafe?.user?.id ?? "anon") + "";
const LSKEY = `tbor:v2:state:${uid}`;

const $descText = document.getElementById("descText");
const $bg = document.getElementById("bg");
const $opts = document.getElementById("options");
const $btnInv = document.getElementById("btnInv");
const $btnFlags = document.getElementById("btnFlags");
const $btnReset = document.getElementById("btnReset");
const $dlgInv = document.getElementById("dlgInv");
const $dlgFlags = document.getElementById("dlgFlags");
$dlgInv.querySelector(".close").onclick = () => $dlgInv.close();
$dlgFlags.querySelector(".close").onclick = () => $dlgFlags.close();

let SCENES = {};
let state = loadStateFromUrl() || loadStateLS() || { current:"start", inventory:{}, flags:{}, lastBg:null };
let typingAbort = null;

// ===== helpers =====
function send(event, payload){ try{ tg?.sendData(JSON.stringify({event, payload})) }catch{} }
function loadStateLS(){ try{ return JSON.parse(localStorage.getItem(LSKEY)||"") }catch{ return null } }
function saveStateLS(){ localStorage.setItem(LSKEY, JSON.stringify(state)) }

function loadStateFromUrl(){
  try{
    const u = new URL(location.href);
    const s = u.searchParams.get("s");
    if (!s) return null;
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const json = atob(s.replace(/-/g,'+').replace(/_/g,'/') + pad);
    const snap = JSON.parse(json);
    return {
      current: snap.current || "start",
      inventory: snap.inventory || {},
      flags: snap.flags || {},
      lastBg: snap.lastBg || null
    };
  }catch{ return null }
}

function setBg(img){
  // если у сцены нет image — оставляем предыдущий фон
  if (!img) return;
  if (img === state.lastBg) return;
  state.lastBg = img;
  $bg.style.opacity = .0;
  $bg.style.backgroundImage = `url(images/${img})`;
  requestAnimationFrame(()=>{ $bg.style.transition="opacity .2s"; $bg.style.opacity=.35; setTimeout(()=>{ $bg.style.transition="" }, 220); });
}

function openInv(){
  const ul = document.getElementById("invList"); ul.innerHTML = "";
  const items = Object.entries(state.inventory).filter(([,n])=>n>0);
  if (!items.length){ ul.innerHTML = "<li>пусто</li>"; }
  else items.forEach(([k,n])=>{
    const li = document.createElement("li"); li.textContent = `${k}: ${n} шт`; ul.appendChild(li);
  });
  $dlgInv.showModal();
}
function openFlags(){
  const ul = document.getElementById("flagsList"); ul.innerHTML = "";
  const items = Object.entries(state.flags).filter(([,v])=>!!v);
  if (!items.length){ ul.innerHTML = "<li>—</li>"; }
  else items.forEach(([k,v])=>{
    const li = document.createElement("li"); li.textContent = `${k}: ${v}`; ul.appendChild(li);
  });
  $dlgFlags.showModal();
}
function resetGame(){
  state = { current:"start", inventory:{}, flags:{}, lastBg:null };
  saveStateLS();
  send("reset", {});
  render();
}

$btnInv.onclick = openInv;
$btnFlags.onclick = openFlags;
$btnReset.onclick = resetGame;

// ===== scenes load =====
init().catch(err=>{
  console.error(err);
  $descText.textContent = "Не удалось загрузить сцены.";
});

async function init(){
  const res = await fetch("scenes.json", { cache: "no-store" });
  SCENES = await res.json();
  // если нет такой сцены — в начало
  if (!SCENES[state.current]) state.current = "start";
  render();
}

// ===== render =====
async function render(){
  const sc = SCENES[state.current];
  if (!sc){ $descText.textContent = "Сцена не найдена."; $opts.innerHTML=""; return; }

  // моргание (верх+низ), короткое
  await blink();

  // фон: если задан — меняем, если нет — оставляем прежний
  if (sc.image) setBg(sc.image);

  // описание — тайпрайтер ~3s
  typeText($descText, (sc.description || sc.text || "").trim(), 3000);

  // варианты
  const options = normOptions(sc.options);
  $opts.innerHTML = "";
  $opts.classList.remove("options-exit");

  options.forEach(opt=>{
    // требования: скрываем недоступные
    if (!checkRequires(opt.requires)) return;

    const btn = document.createElement("button");
    btn.className = "option";
    if (opt.requires) btn.classList.add("req");
    btn.textContent = opt.text;
    btn.classList.add("enter");

    btn.onclick = () => {
      playChoice(opt, btn);
    };
    $opts.appendChild(btn);
  });

  // лог в бота
  send("scene_enter", { scene: state.current });

  // синхронизация состояния (лениво, но надёжно)
  syncState();
  saveStateLS();
}

function normOptions(opts){
  // старый формат: объект "текст" : "ключ_сцены"
  if (opts && !Array.isArray(opts) && typeof opts === "object"){
    return Object.entries(opts).map(([text, to]) => ({ text, to }));
  }
  // новый формат: массив объектов / строк
  if (Array.isArray(opts)){
    return opts.map(o => {
      if (typeof o === "string") return ({ text:o });
      return ({
        text: o.text ?? o.title ?? o.label ?? "",
        to:   o.to   ?? o.next  ?? o.goto  ?? null,
        requires: parseRequires(o.requires ?? o.require ?? null),
        give:  normalizeItems(o.give  ?? o.add ?? o.items ?? null),
        use:   normalizeItems(o.use   ?? o.take ?? null),
        setFlags: normalizeFlags(o.setFlags ?? o.set ?? o.flags ?? null, true),
        clearFlags: normalizeFlags(o.clearFlags ?? o.unset ?? null, false),
        image: o.image ?? null
      });
    });
  }
  return [];
}

function parseRequires(x){
  if (!x) return null;
  const out = { items:[], flags:[] };
  if (typeof x === "string"){
    x.split(",").map(s=>s.trim()).filter(Boolean).forEach(n=> out.items.push({item:n, count:1}));
    return out;
  }
  if (Array.isArray(x)){
    x.forEach(v=>{
      if (typeof v === "string") out.items.push({item:v, count:1});
      else if (v && v.item) out.items.push({item:v.item, count:v.count?+v.count:1});
    });
    return out;
  }
  if (x.item){ out.items.push({item:x.item, count:x.count?+x.count:1}); return out; }
  if (x.items){
    const arr = Array.isArray(x.items) ? x.items : [x.items];
    arr.forEach(v=>{
      if (typeof v === "string") out.items.push({item:v, count:1});
      else if (v && v.item) out.items.push({item:v.item, count:v.count?+v.count:1});
    });
  }
  if (x.flags){
    const arr = Array.isArray(x.flags) ? x.flags :
                (typeof x.flags === "string" ? x.flags.split(",").map(s=>s.trim()) : Object.keys(x.flags));
    arr.forEach(f => out.flags.push({flag:f, val:true}));
  }
  return out;
}
function normalizeItems(v){
  if (!v) return [];
  const out = [];
  if (typeof v === "string") v.split(",").map(s=>s.trim()).filter(Boolean).forEach(n=> out.push({item:n, count:1}));
  else if (Array.isArray(v)) v.forEach(o=> {
    if (typeof o === "string") out.push({item:o, count:1});
    else if (o && o.item) out.push({item:o.item, count:o.count?+o.count:1});
  });
  else if (v.item) out.push({item:v.item, count:v.count?+v.count:1});
  return out;
}
function normalizeFlags(v, set=true){
  if (!v) return [];
  const arr = Array.isArray(v) ? v : (typeof v==="string" ? v.split(",").map(s=>s.trim()).filter(Boolean) : Object.keys(v));
  return arr.map(f => set ? {flag:f, val:true} : {flag:f, val:false});
}

function checkRequires(req){
  if (!req) return true;
  for (const it of (req.items||[])){
    const have = state.inventory[it.item]||0;
    if (have < (it.count||1)) return false;
  }
  for (const fl of (req.flags||[])){
    if (!state.flags[fl.flag]) return false;
  }
  return true;
}

function applyItems(arr, sign){
  arr.forEach(({item, count})=>{
    const cur = state.inventory[item]||0;
    const next = Math.max(0, cur + sign*(count||1));
    if (next) state.inventory[item]=next; else delete state.inventory[item];
  });
}
function applyFlags(arr){
  arr.forEach(({flag, val})=>{
    if (val) state.flags[flag]=true; else delete state.flags[flag];
  });
}

function playChoice(o, clickedBtn){
  // постановка: выбранная — подчёркнуть, остальные — погасить
  if (clickedBtn){
    clickedBtn.classList.add('chosen');
    $opts.classList.add('options-exit');
  }

  // предметы/флаги
  if (o.use?.length)  applyItems(o.use, -1);
  if (o.give?.length) applyItems(o.give, +1);
  if (o.setFlags?.length)   applyFlags(o.setFlags);
  if (o.clearFlags?.length) applyFlags(o.clearFlags);
  if (o.image) setBg(o.image);

  // финальный переход
  const go = () => {
    if (o.to && SCENES[o.to]) state.current = o.to;
    $opts.classList.remove('options-exit');
    render();
  };

  // даём доиграть выбору (~0.35с), затем моргнуть и перейти
  setTimeout(()=>{ blink().then(go); }, 350);

  // синк в бота
  syncState();
  saveStateLS();
}

function syncState(){
  send("sync_state", { state: {
    current: state.current,
    inventory: state.inventory,
    flags: state.flags,
    lastBg: state.lastBg
  }});
}

/* ===== моргание веками (две створки) — коротко ===== */
function blink(){
  return new Promise(res=>{
    const top = document.createElement('div'); top.className = 'eyelid top';
    const bot = document.createElement('div'); bot.className = 'eyelid bot';
    document.body.append(top, bot);
    requestAnimationFrame(()=>{
      top.style.height='55%'; bot.style.height='55%';
      setTimeout(()=>{
        top.style.height='0'; bot.style.height='0';
        setTimeout(()=>{ top.remove(); bot.remove(); res(); }, 220);
      }, 140);
    });
  });
}

/* ===== Тайпрайтер ≈3с, с возможностью «докликать» ===== */
function typeText(node, full, durationMs){
  if (typingAbort){ typingAbort(); typingAbort = null; }
  if (!full){ node.textContent = ""; return; }

  // уважаем reduce motion
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce){ node.textContent = full; return; }

  let stop = false;
  typingAbort = () => { stop = true; node.textContent = full; node.classList.add("typewriter","done"); };
  node.onclick = typingAbort;

  node.textContent = "";
  node.classList.remove("done");
  node.classList.add("typewriter");

  const len = full.length;
  const start = performance.now();
  function tick(t){
    if (stop) return;
    const p = Math.min(1, (t - start) / durationMs);
    const n = Math.max(1, Math.floor(len * p));
    node.textContent = full.slice(0, n);
    if (p < 1) requestAnimationFrame(tick);
    else {
      node.classList.add("done");
      node.onclick = null;
      typingAbort = null;
    }
  }
  requestAnimationFrame(tick);
}
