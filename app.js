// app.js
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setBackgroundColor("#0b0e13");
  tg.setHeaderColor("secondary");
}

let SCENES = {};
const state = {
  current: "start",
  inventory: {}, // { "мел":2 }
  flags: {},     // { "opened": true }
  lastBg: null,
  nickname: null,
  tag: null,
  gender: "male",
  verified: false,
  banned: false,
  // таймер:
  startedAt: null, // timestamp (ms) когда запущена попытка
  elapsedSec: 0,   // накопленное время (сек)
  ticking: false
};

// элементы
const $loader = document.getElementById('loader');
const $type   = document.getElementById('type');
const $opts   = document.getElementById('options');
const $bg1    = document.getElementById('bg1');
const $bg2    = document.getElementById('bg2');
const $timer  = document.getElementById('timer');

const $dlgInv = document.getElementById('dlgInv');
const $dlgFlags = document.getElementById('dlgFlags');
const $invList = document.getElementById('invList');
const $flagList= document.getElementById('flagList');

const $dlgSettings = document.getElementById('dlgSettings');
const $optBlink = document.getElementById('optBlink');
const $optType  = document.getElementById('optType');

const $dlgReg = document.getElementById('dlgReg');
const $regNick= document.getElementById('regNick');
const $regTag = document.getElementById('regTag');
const $regCode= document.getElementById('regCode');

const $btnInv = document.getElementById('btnInv');
const $btnFlags = document.getElementById('btnFlags');
const $btnSettings = document.getElementById('btnSettings');
const $btnTrophy = document.getElementById('btnTrophy');
const $btnGetCode= document.getElementById('btnGetCode');
const $btnNewCode= document.getElementById('btnNewCode');
const $btnVerify = document.getElementById('btnVerify');

// ================== УТИЛИТЫ ==================
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function send(event, payload){ if (tg) tg.sendData(JSON.stringify({event, payload})); }
function fmtTime(sec){ sec = Math.max(0, sec|0); const m=(sec/60|0), s=(sec%60|0); return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; }

// предзагрузка набора файлов
function preload(list){
  return Promise.all(list.map(src => new Promise(res=>{
    const img=new Image(); img.onload=img.onerror=()=>res(); img.src=src;
  })));
}

// двойной слой фона
let front = 1;
async function setBackground(src){
  if (!src || src === state.lastBg) return;
  const next = front === 1 ? $bg2 : $bg1;
  next.style.backgroundImage = `url(${src})`;
  await sleep(20);
  next.classList.add('show');
  (front===1?$bg1:$bg2).classList.remove('show');
  front = (front===1?2:1);
  state.lastBg = src;
}

// моргание
async function blink(){
  if (localStorage.getItem('opt_blink') === 'off') return;
  const top = document.querySelector('.eyelid.top');
  const bot = document.querySelector('.eyelid.bot');
  top.style.height = '50%'; bot.style.height = '50%';
  await sleep(180);
  top.style.height = '0'; bot.style.height = '0';
  await sleep(180);
}

// печать текста
async function typeText(text){
  const off = localStorage.getItem('opt_type') === 'off';
  $type.textContent = "";
  if (off){ $type.textContent = text; return; }
  const t = text || "";
  const total = Math.max(700, Math.min(3000, t.length*30)); // ~3s на абзац
  const start = performance.now();
  while (true){
    const p = Math.min(1, (performance.now()-start)/total);
    const n = (t.length*p) | 0;
    $type.textContent = t.slice(0, n);
    if (p>=1) break;
    await sleep(16);
  }
}

// таймер
let tickHandle = null;
function timerStart(){
  state.ticking = true;
  state.startedAt = Date.now();
  if (tickHandle) return;
  tickHandle = setInterval(()=>{
    if (!state.ticking) return;
    const now = Date.now();
    const delta = ((now - state.startedAt)/1000)|0;
    $timer.textContent = fmtTime(state.elapsedSec + delta);
  }, 300);
}
function timerPause(){
  if (!state.ticking) return;
  const now = Date.now();
  const delta = ((now - state.startedAt)/1000)|0;
  state.elapsedSec += delta;
  state.ticking = false;
  state.startedAt = null;
  $timer.textContent = fmtTime(state.elapsedSec);
}
function timerReset(){
  state.elapsedSec = 0;
  state.startedAt = null;
  state.ticking = false;
  $timer.textContent = "00:00";
}
function timerValue(){
  if (!state.ticking) return state.elapsedSec;
  const now = Date.now();
  const delta = ((now - state.startedAt)/1000)|0;
  return state.elapsedSec + delta;
}

// HUD списки
function renderInv(){
  const items = Object.entries(state.inventory).filter(([,q])=>q>0);
  $invList.innerHTML = items.length ? items.map(([k,v])=>`<div>${k}: ${v} шт</div>`).join("") : "<div>пусто</div>";
}
function renderFlags(){
  const items = Object.keys(state.flags||{});
  $flagList.innerHTML = items.length ? items.map(k=>`<div>${k}</div>`).join("") : "<div>—</div>";
}

// опции (кнопки выбора)
function renderOptions(sc){
  $opts.innerHTML = "";
  const opts = sc.options || {};
  for (const [label, nextKey] of Object.entries(opts)){
    // фильтры по предметам/флагам
    // старый scenes.json — без requires; оставляем как есть
    const btn = document.createElement('button');
    btn.className = 'option enter';
    btn.textContent = label;
    btn.onclick = async ()=>{
      // анимация выбора
      Array.from($opts.children).forEach(el=>{
        if (el===btn) { el.classList.add('chosen'); }
        else { el.style.opacity = .0; el.style.transform = 'translateY(-4px)'; el.style.transition='.22s ease'; }
      });
      await sleep(250);
      // смена сцены
      renderScene(nextKey);
    };
    $opts.appendChild(btn);
  }
}

// рендер сцены
async function renderScene(key){
  const sc = SCENES[key];
  if (!sc) return;
  state.current = key;

  // моргание+фон (если новый)
  const img = sc.image ? `images/${sc.image}` : state.lastBg;
  await blink();
  if (img) {
    // прелоад именно этого кадра (guard на первый запуск)
    await preload([img]);
    await setBackground(img);
  }

  // текст
  await typeText(sc.description || "…");

  // опции
  renderOptions(sc);

  // синхронизация в бота
  send('scene_enter', { scene: key });
  send('sync_state', { state: {
    current: state.current,
    inventory: state.inventory,
    flags: state.flags,
    lastBg: state.lastBg,
    elapsedSec: timerValue(),
    startedAt: state.startedAt
  }});

  // запись локальная
  localStorage.setItem('save', JSON.stringify({
    current: state.current, inventory: state.inventory, flags: state.flags,
    lastBg: state.lastBg, elapsedSec: timerValue()
  }));
}

// ================== РЕГИСТРАЦИЯ ==================
function initRegDialog(){
  // подтянем реальный тег из initData
  const uname = tg?.initDataUnsafe?.user?.username || "";
  if (uname) {
    $regTag.value = "@"+uname;
    state.tag = uname.toLowerCase();
  } else {
    $regTag.value = "Установи @username в Telegram и перезапусти";
  }

  $btnGetCode.onclick = ()=>{
    const nick = $regNick.value.trim();
    const tag  = ($regTag.value||"").replace("@","").trim().toLowerCase();
    const gender = (document.querySelector('input[name="rg"]:checked')?.value||"male");
    if (!nick) { alert("Введи никнейм"); return; }
    if (!tag) { alert("Нужен твой @username в Telegram"); return; }
    state.nickname = nick; state.gender = gender;
    // отправим событие старта регистрации
    send('register_start', { nickname:nick, tag:`@${tag}`, gender });
    alert("Код отправлен в Telegram. Проверь чат с ботом.");
  };

  $btnNewCode.onclick = ()=>{
    send('request_code_again', {});
    alert("Если можно, бот отправит новый код. См. чат.");
  };

  $btnVerify.onclick = ()=>{
    const code = $regCode.value.trim();
    const gender = (document.querySelector('input[name="rg"]:checked')?.value||"male");
    if (code.length!==6) { alert("Код должен быть из 6 цифр"); return; }
    send('register_verify', { code, gender });
    // продолжаем UX — пользователь увидит ответ в чате; здесь просто закрываем
    state.verified = true; // допустим прохождение; бан всё равно применится ботом и сломает прогресс в будущем
    $dlgReg.close();
    openMainMenu();
  };
}

// главное меню (просто как сцена start: «Продолжить»/«Начать заново»)
function openMainMenu(){
  timerPause();
  // показываем простые кнопки в правой колонке
  $type.textContent = "Главное меню";
  $opts.innerHTML = "";

  const add = (label, fn)=>{
    const b = document.createElement('button');
    b.className='option enter';
    b.textContent=label;
    b.onclick=fn;
    $opts.appendChild(b);
  };

  add("Продолжить", ()=>{
    // поднимем локальный сейв
    const s = JSON.parse(localStorage.getItem('save')||'{}');
    if (s.current){
      state.current = s.current;
      state.inventory = s.inventory||{};
      state.flags = s.flags||{};
      state.lastBg = s.lastBg||null;
      state.elapsedSec = s.elapsedSec||0;
      state.startedAt = null;
      timerStart();
      renderScene(state.current);
    } else {
      alert("Сохранения не найдено");
    }
  });

  add("Начать заново", ()=>{
    state.current="start";
    state.inventory={}; state.flags={}; state.lastBg=null;
    timerReset(); timerStart();
    renderScene(state.current);
  });

  add("Выйти", ()=>{
    timerPause();
    $type.textContent="Пока 👋";
    $opts.innerHTML="";
  });
}

// ================== КНОПКИ UI ==================
$btnInv.onclick = ()=>{ renderInv(); $dlgInv.showModal(); timerPause(); };
$btnFlags.onclick= ()=>{ renderFlags(); $dlgFlags.showModal(); timerPause(); };
$btnSettings.onclick= ()=>{
  $optBlink.checked = (localStorage.getItem('opt_blink')==='off');
  $optType.checked  = (localStorage.getItem('opt_type')==='off');
  $dlgSettings.showModal(); timerPause();
};
$optBlink.onchange = ()=> localStorage.setItem('opt_blink', $optBlink.checked?'off':'on');
$optType.onchange  = ()=> localStorage.setItem('opt_type',  $optType.checked ?'off':'on');

$btnTrophy.onclick = ()=>{
  // открываем бот с /start=top
  if (tg?.openTelegramLink){
    tg.openTelegramLink(`https://t.me/${encodeURIComponent(window.BOT_USERNAME || "YourBotUsername")}?start=top`);
  } else {
    alert("Открой бот и набери /top");
  }
};

// ================== ЗАПУСК ==================
async function boot(){
  // подставим имя бота для кнопки 🏆
  window.BOT_USERNAME = (tg?.initDataUnsafe?.receiver?.username) || (tg?.initDataUnsafe?.user?.username) || "YourBotUsername";

  // загрузочный экран: прелоад сцен и первых картинок
  const resp = await fetch('scenes.json', { cache:'no-store' });
  SCENES = await resp.json();

  // предзагрузка всех встречающихся картинок (можно ограничить список)
  const allImgs = [...new Set(Object.values(SCENES).map(sc=>sc.image).filter(Boolean))].map(n=>`images/${n}`);
  await preload(allImgs.slice(0, 16)); // первые 16 — хватит для скорости
  // если был сейв — ставим последний фон сразу
  const s = JSON.parse(localStorage.getItem('save')||'{}');
  if (s.lastBg){ await preload([s.lastBg]); await setBackground(s.lastBg); }
  $loader.style.display = 'none';

  // регистрация, если нет verified (мы не можем прочитать его из бота, поэтому просим всегда при первом запуске)
  initRegDialog();
  if (!localStorage.getItem('registered')){
    $dlgReg.showModal();
  } else {
    openMainMenu();
  }
}
boot().catch(err=>{
  console.error(err);
  $loader.querySelector('.hint').textContent = "Ошибка загрузки. Попробуй обновить страницу.";
});

// запомним факт регистрации локально, когда рег. диалог закрыт по verify
$dlgReg.addEventListener('close', ()=>{
  if (state.nickname) localStorage.setItem('registered', '1');
});

// автосейв каждые 2 сек
setInterval(()=>{
  localStorage.setItem('save', JSON.stringify({
    current: state.current, inventory: state.inventory, flags: state.flags,
    lastBg: state.lastBg, elapsedSec: timerValue()
  }));
  // отправим синхронизацию в бота (он хранит глобальный сейв/лидерборд)
  send('sync_state', { state: {
    current: state.current,
    inventory: state.inventory,
    flags: state.flags,
    lastBg: state.lastBg,
    elapsedSec: timerValue(),
    startedAt: state.startedAt
  }});
}, 2000);
