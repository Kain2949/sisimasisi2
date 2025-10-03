let scenes = {};
let currentScene = "start";
let inventory = {};
let flags = {};

async function loadScenes() {
    const response = await fetch("scenes.json");
    scenes = await response.json();
    renderScene();
}

function renderScene() {
    const scene = scenes[currentScene];
    if (!scene) return;

    // Текст и картинка
    document.getElementById("description").innerText = scene.text || "";
    const img = document.getElementById("scene-image");
    if (scene.image) {
        img.src = "images/" + scene.image;
        img.style.display = "block";
    } else {
        img.style.display = "none";
    }

    // Кнопки
    const optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";

    if (scene.options) {
        scene.options.forEach(opt => {
            // Если это строка → превращаем в объект
            if (typeof opt === "string") {
                opt = { text: opt, to: null }; 
            }

            // Проверка на requires (если есть)
            if (opt.requires) {
                if (opt.requires.inventory && !inventory[opt.requires.inventory]) {
                    return;
                }
                if (opt.requires.flag && !flags[opt.requires.flag]) {
                    return;
                }
            }

            // Создаём кнопку
            const btn = document.createElement("button");
            btn.className = "option-button";
            btn.innerText = opt.text || "???";
            btn.onclick = () => {
                // Добавление предметов
                if (opt.add_inventory) {
                    opt.add_inventory.forEach(item => {
                        inventory[item] = (inventory[item] || 0) + 1;
                    });
                }

                // Трата предметов
                if (opt.consume_inventory) {
                    opt.consume_inventory.forEach(item => {
                        if (inventory[item]) {
                            inventory[item]--;
                            if (inventory[item] <= 0) {
                                delete inventory[item];
                            }
                        }
                    });
                }

                // Установка флагов
                if (opt.set_flags) {
                    for (const [key, val] of Object.entries(opt.set_flags)) {
                        flags[key] = val;
                    }
                }

                // Переход в следующую сцену
                if (opt.to) {
                    currentScene = opt.to;
                }
                renderScene();
            };
            optionsDiv.appendChild(btn);
        });
    }

    renderInventory();
    renderFlags();
}

function renderInventory() {
    const invDiv = document.getElementById("inventory-list");
    invDiv.innerHTML = "";

    for (const [item, count] of Object.entries(inventory)) {
        const el = document.createElement("div");
        el.innerText = `${item}: ${count} шт`;
        invDiv.appendChild(el);
    }
}

function renderFlags() {
    const flDiv = document.getElementById("flags-list");
    flDiv.innerHTML = "";

    for (const [key, val] of Object.entries(flags)) {
        const el = document.createElement("div");
        el.innerText = `${key}: ${val}`;
        flDiv.appendChild(el);
    }
}

window.onload = loadScenes;
