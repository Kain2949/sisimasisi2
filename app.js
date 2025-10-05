// ===== Telegram bootstrap =====
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.setBackgroundColor("#0b0e13");
  tg.setHeaderColor("secondary");
}

// ===== DOM =====
const $descText = document.getElementById('descText');
const $bg       = document.getElementById('bg');
const $opts     = document.getElementById('options');

const $boot     = document.getElementById('boot');
const $bootBar  = document.getElementById('bootBar');
const $bootPct  = document.getElementById('bootPct');
const $bootCnt  = document.getElementById('bootCount');

const $eyetop   = document.getElementById('eyelidTop');
const $eyebot   = document.getElementById('eyelidBot');

// ===== Config =====
const SCENES_URL = "scenes.json";     // лежит рядом с index.html
const IMG_BASE   = "images/";         // папка с фонами
const TYPEWRITE_MAX_MS = 3000;        // печать текста ~ до 3 сек

// ===== State =====
const state = {
  scenes: {},
  current: "start",
  inventory: {},      // { "мел": 2 } — если вдруг пригодится
  flags: {},          // { opened: true }
  lastBg: null,
};

// ===== Utils =====
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function send(event, payload) {
  if (tg) tg.sendData(JSON.stringify({ event, payload }));
}

function setBackground(imageName, meta = {}) {
  // если сцена без image — фон не менять
  if (!imageName) return;

  const url = `url(${IMG_BASE}${imageName})`;
  if (state.lastBg === url) return; // тот же самый — не моргаем

  // настройка позиционирования (если будут sc.focus/sc.fit)
  if (meta.fit === 'contain') {
    $bg.style.backgroundSize = 'contain';
    $bg.style.backgroundColor = '#0b0e13';
  } else {
    $bg.style.backgroundSize = 'cover';
    $bg.style.backgroundColor = '';
  }
  $bg.style.backgroundPosition = typeof meta.focus === 'string' ? meta.focus : 'center';

  $bg.style.backgroundImage = url;
  state.lastBg = url;
}

async function blink(ms = 320) {
  // «моргание» — верхнее/нижнее веко сходятся и обратно
  $eyetop.style.height = "52%";
  $eyebot.style.height = "52%";
  await sleep(ms);
  $eyetop.style.height = "0";
  $eyebot.style.height = "0";
}

async function typewrite($node, text) {
  // быстрый тайпрайтер ~до 3 секунд
  $node.textContent = "";
  const len = (text || "").length;
  if (len === 0) return;
  const per = Math.max(10, Math.floor(TYPEWRITE_MAX_MS / len)); // минимум 10мс
  for (let i = 0; i < len; i++) {
    $node.textContent += text[i];
    await sleep(per);
  }
}

// поддержка двух форматов options:
// 1) объект: { "Лейбл": "nextScene", ... }
// 2) массив: [ { label, next, requires? } ... ]
function normalizeOptions(sc) {
  if (!sc) return [];
  if (Array.isArray(sc.options)) return sc.options.map(o => ({
    label: o.label,
    next: o.next,
    requires: o.requires || null,
  }));
  const out = [];
  const obj = sc.options || {};
  for (const [label, next] of Object.entries(obj)) {
    out.push({ label, next, requires: null });
  }
  return out;
}

// ===== Прелоад =====
async function fetchScenes() {
  const res = await fetch(`${SCENES_URL}?_=${Date.now()}`);
  if (!res.ok) throw new Error("Не могу загрузить scenes.json");
  return res.json();
}

function uniqueImagesFromScenes(scenes) {
  const set = new Set();
  for (const key in scenes) {
    const sc = scenes[key];
    if (sc && sc.image) set.add(sc.image);
  }
  return Array.from(set);
}

function preloadImages(names, onProgress) {
  let loaded = 0;
  const total = names.length;
  if (total === 0) {
    onProgress(1, 0, 0);
    return Promise.resolve();
  }
  return Promise.all(names.map(name => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { loaded++; onProgress(loaded/total, loaded, total); resolve(); };
    img.onerror = () => { loaded++; onProgress(loaded/total, loaded, total); resolve(); };
    img.src = IMG_BASE + name;
  })));
}

function updateBoot(progress, loaded, total) {
  const pct = Math.round(progress * 100);
  $bootBar.style.width = `${pct}%`;
  $bootPct.textContent = `${pct}%`;
  $bootCnt.textContent = `${loaded}/${total}`;
}

// ===== Рендер сцены =====
async function renderScene(key) {
  const sc = state.scenes[key];
  if (!sc) return;
  state.current = key;

  // фон: меняем только если в сцене указан image
  if (sc.image) {
    await blink(220);
    setBackground(sc.image, { fit: sc.fit, focus: sc.focus });
  }

  // текст — «печатаем»
  await typewrite($descText, sc.description || "…");

  // варианты
  $opts.classList.remove('options-exit');
  $opts.innerHTML = '';
  const options = normalizeOptions(sc);

  for (const opt of options) {
    // базовая фильтрация по requires (если вдруг указано)
    if (opt.requires && opt.requires.type === 'item') {
      const need = opt.requires.name;
      const count = opt.requires.count || 1;
      if (!state.inventory[need] || state.inventory[need] < count) {
        continue; // скрываем недоступные — как ты просил
      }
    }

    const btn = document.createElement('button');
    btn.className = 'option enter' + (opt.requires ? ' req' : '');
    btn.textContent = opt.label;

    btn.onclick = async () => {
      // анимация выбора
      const kids = Array.from($opts.querySelectorAll('.option'));
      kids.forEach(k => { if (k !== btn) k.classList.add('fade'); });
      btn.classList.add('chosen');
      $opts.classList.add('options-exit');

      // синхронизация (если надо)
      send('choice_made', { from: key, to: opt.next, label: opt.label });

      // переход
      await sleep(340);
      renderScene(opt.next);
    };

    $opts.appendChild(btn);
  }

  // лог входа
  send('scene_enter', { scene: key });
  // локальный сейв
  localStorage.setItem('game115', JSON.stringify({
    current: state.current,
    inventory: state.inventory,
    flags: state.flags,
    lastBg: state.lastBg,
  }));
}

// ===== Init =====
(async function init(){
  try {
    // 1) грузим сцены (один файл)
    state.scenes = await fetchScenes();

    // 2) собираем уникальные имена картинок и прелоадим только их
    const imgs = uniqueImagesFromScenes(state.scenes);
    await preloadImages(imgs, updateBoot);

    // 3) пробуем восстановить локальный сейв
    try {
      const saved = JSON.parse(localStorage.getItem('game115') || '{}');
      if (saved && state.scenes[saved.current]) {
        state.current  = saved.current;
        state.inventory = saved.inventory || {};
        state.flags     = saved.flags || {};
        state.lastBg    = saved.lastBg || null;
        if (state.lastBg) $bg.style.backgroundImage = state.lastBg;
      }
    } catch {}

    // 4) прячем загрузчик, показываем сцену
    document.body.classList.remove('booting');
    document.body.classList.add('ready');

    // небольшой фейд между загрузкой и первой сценой
    await blink(220);
    await renderScene(state.current);

  } catch (e) {
    console.error(e);
    $boot.querySelector('.boot-title').textContent = 'Ошибка загрузки данных';
    $boot.querySelector('.boot-tip').textContent = 'Проверь интернет или попробуй перезайти в игру.';
  }

  // безопасный финальный sync снапшота
  send('sync_state', {
    state: {
      current: state.current,
      inventory: state.inventory,
      flags: state.flags,
      lastBg: state.lastBg,
    }
  });
})();
