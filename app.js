(function () {
  "use strict";

  const STORAGE_KEY = "lali-birthday-v1";
  const STORAGE_VERSION = 3;
  const TARGET_SCORE = 100;
  const screens = Array.from(document.querySelectorAll(".screen"));
  const introScreen = document.querySelector("#intro-screen");
  const gameScreen = document.querySelector("#game-screen");
  const winScreen = document.querySelector("#win-screen");
  const giftsScreen = document.querySelector("#gifts-screen");
  const startButton = document.querySelector("#start-button");
  const skipToGifts = document.querySelector("#skip-to-gifts");
  const openGiftsButton = document.querySelector("#open-gifts-button");
  const replayButton = document.querySelector("#replay-button");
  const arena = document.querySelector("#game-arena");
  const fallingLayer = document.querySelector("#falling-layer");
  const player = document.querySelector("#player");
  const scoreValue = document.querySelector("#score-value");
  const meterFill = document.querySelector("#meter-fill");
  const gameToast = document.querySelector("#game-toast");
  const categoryCards = Array.from(document.querySelectorAll(".category-card"));
  const generatorPanel = document.querySelector("#generator-panel");
  const generatorKicker = document.querySelector("#generator-kicker");
  const generatorTitle = document.querySelector("#generator-title");
  const surprisePaper = document.querySelector("#surprise-paper");
  const surpriseText = document.querySelector("#surprise-text");
  const paperNumber = document.querySelector(".paper-number");
  const generateButton = document.querySelector("#generate-button");
  const collectionButton = document.querySelector("#collection-button");
  const collectionPanel = document.querySelector("#collection-panel");
  const collectionList = document.querySelector("#collection-list");
  const closeGenerator = document.querySelector("#close-generator");
  const moveLeftButton = document.querySelector("#move-left");
  const moveRightButton = document.querySelector("#move-right");

  const itemTypes = [
    { icon: "❤️", label: "La famille", value: 10, good: true },
    { icon: "📺", label: "Un épisode de série", value: 8, good: true },
    { icon: "🧣", label: "Le plaid", value: 7, good: true },
    { icon: "🥂", label: "Le Muscadet", value: 8, good: true },
    { icon: "🍪", label: "Une gourmandise", value: 7, good: true },
    { icon: "🎮", label: "La télécommande", value: 8, good: true },
    { icon: "⏰", label: "Le réveil", value: -5, good: false },
    { icon: "📩", label: "Une notification", value: -4, good: false },
    { icon: "🧺", label: "La lessive", value: -5, good: false },
    { icon: "🧹", label: "Une corvée", value: -5, good: false }
  ];

  let savedState = loadState();
  let currentCategory = null;
  let game = createGameState();
  let toastTimer = null;
  let controlTimer = null;

  function createGameState() {
    return {
      running: false,
      score: 0,
      playerX: 50,
      items: [],
      animationFrame: null,
      spawnTimer: null,
      lastFrame: 0
    };
  }

  function defaultState() {
    return {
      version: STORAGE_VERSION,
      unlocked: false,
      discoveries: {
        compliments: [],
        treats: []
      }
    };
  }

  function loadState() {
    const fallback = defaultState();

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || typeof parsed !== "object") return fallback;

      fallback.unlocked = Boolean(parsed.unlocked);
      Object.keys(fallback.discoveries).forEach((category) => {
        const values = parsed.discoveries && parsed.discoveries[category];
        if (!Array.isArray(values)) return;

        // Version 3 remet les deux collections à zéro avant la remise du cadeau.
        if (parsed.version !== STORAGE_VERSION) return;

        fallback.discoveries[category] = values.filter((value, index) => {
          return Number.isInteger(value) &&
            value >= 0 &&
            value < window.SURPRISE_DATA[category].items.length &&
            values.indexOf(value) === index;
        });
      });
    } catch (error) {
      return fallback;
    }

    return fallback;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
  }

  function showScreen(screen) {
    screens.forEach((item) => {
      item.hidden = item !== screen;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateIntro() {
    skipToGifts.hidden = !savedState.unlocked;
  }

  function startGame() {
    stopGame();
    game = createGameState();
    game.running = true;
    updateScore(0);
    setPlayerPosition(50);
    fallingLayer.replaceChildren();
    showScreen(gameScreen);
    arena.focus({ preventScroll: true });

    window.setTimeout(() => {
      spawnItem(itemTypes[0]);
      scheduleSpawn();
      game.lastFrame = performance.now();
      game.animationFrame = requestAnimationFrame(updateGame);
    }, 350);
  }

  function stopGame() {
    game.running = false;
    if (game.spawnTimer) window.clearTimeout(game.spawnTimer);
    if (game.animationFrame) cancelAnimationFrame(game.animationFrame);
    game.items.forEach((item) => item.element.remove());
    game.items = [];
    stopControlMove();
  }

  function scheduleSpawn() {
    if (!game.running) return;
    const delay = 680 + Math.random() * 420;
    game.spawnTimer = window.setTimeout(() => {
      spawnItem();
      scheduleSpawn();
    }, delay);
  }

  function chooseItemType() {
    const goodItems = itemTypes.filter((item) => item.good);
    const badItems = itemTypes.filter((item) => !item.good);
    const source = Math.random() < 0.76 ? goodItems : badItems;
    return source[Math.floor(Math.random() * source.length)];
  }

  function spawnItem(forcedType) {
    if (!game.running || game.items.length >= 9) return;

    const type = forcedType || chooseItemType();
    const element = document.createElement("div");
    const size = window.innerWidth <= 680 ? 52 : 58;
    const maxX = Math.max(0, arena.clientWidth - size - 8);
    const x = 4 + Math.random() * maxX;
    element.className = `falling-item${type.good ? "" : " bad"}`;
    element.textContent = type.icon;
    element.title = type.label;
    element.style.left = `${x}px`;
    fallingLayer.appendChild(element);

    game.items.push({
      element,
      type,
      x,
      y: -72,
      size,
      speed: 88 + Math.random() * 32,
      rotation: -8 + Math.random() * 16
    });
  }

  function updateGame(now) {
    if (!game.running) return;

    const deltaSeconds = Math.min((now - game.lastFrame) / 1000, 0.05);
    game.lastFrame = now;
    const playerRect = player.getBoundingClientRect();

    for (let index = game.items.length - 1; index >= 0; index -= 1) {
      const item = game.items[index];
      item.y += item.speed * deltaSeconds;
      item.element.style.transform = `translateY(${item.y}px) rotate(${item.rotation}deg)`;

      const itemRect = item.element.getBoundingClientRect();
      if (rectanglesOverlap(itemRect, playerRect)) {
        collectItem(index);
        continue;
      }

      if (itemRect.top > arena.getBoundingClientRect().bottom + 20) {
        item.element.remove();
        game.items.splice(index, 1);
      }
    }

    game.animationFrame = requestAnimationFrame(updateGame);
  }

  function rectanglesOverlap(first, second) {
    const padding = 10;
    return first.right - padding > second.left + padding &&
      first.left + padding < second.right - padding &&
      first.bottom - padding > second.top + padding &&
      first.top + padding < second.bottom - padding;
  }

  function collectItem(index) {
    const item = game.items[index];
    item.element.remove();
    game.items.splice(index, 1);
    const nextScore = Math.max(0, Math.min(TARGET_SCORE, game.score + item.type.value));
    updateScore(nextScore);
    showToast(item.type.good ? `${item.type.label}  +${item.type.value}` : `${item.type.label}  ${item.type.value}`);

    if (game.score >= TARGET_SCORE) finishGame();
  }

  function updateScore(value) {
    game.score = value;
    scoreValue.textContent = String(value);
    meterFill.style.width = `${(value / TARGET_SCORE) * 100}%`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    gameToast.textContent = message;
    gameToast.classList.add("show");
    toastTimer = window.setTimeout(() => gameToast.classList.remove("show"), 900);
  }

  function finishGame() {
    stopGame();
    savedState.unlocked = true;
    saveState();
    updateIntro();
    showToast("Soirée parfaite !");
    window.setTimeout(() => showScreen(winScreen), 850);
  }

  function setPlayerPosition(percent) {
    game.playerX = Math.max(8, Math.min(92, percent));
    player.style.left = `${game.playerX}%`;
  }

  function movePlayer(amount) {
    if (!game.running) return;
    setPlayerPosition(game.playerX + amount);
  }

  function startControlMove(amount) {
    movePlayer(amount);
    stopControlMove();
    controlTimer = window.setInterval(() => movePlayer(amount), 80);
  }

  function stopControlMove() {
    if (controlTimer) window.clearInterval(controlTimer);
    controlTimer = null;
  }

  function openGifts() {
    stopGame();
    savedState.unlocked = true;
    saveState();
    updateCounters();
    closeGeneratorPanel();
    showScreen(giftsScreen);
  }

  function updateCounters() {
    categoryCards.forEach((card) => {
      const category = card.dataset.category;
      const counter = card.querySelector(".category-counter strong");
      counter.textContent = String(savedState.discoveries[category].length);
    });
  }

  function openCategory(category) {
    const data = window.SURPRISE_DATA[category];
    if (!data) return;

    currentCategory = category;
    categoryCards.forEach((card) => {
      card.classList.toggle("active", card.dataset.category === category);
    });

    generatorKicker.textContent = data.kicker;
    generatorTitle.textContent = data.title;
    generateButton.textContent = savedState.discoveries[category].length >= data.items.length
      ? "Relire une surprise"
      : data.button;
    collectionPanel.hidden = true;
    collectionButton.setAttribute("aria-expanded", "false");
    collectionButton.textContent = "Voir ma collection";
    generatorPanel.hidden = false;

    const discovered = savedState.discoveries[category];
    if (discovered.length > 0) {
      const lastIndex = discovered[discovered.length - 1];
      surpriseText.textContent = data.items[lastIndex];
      paperNumber.textContent = `${discovered.length} / 50`;
    } else {
      surpriseText.textContent = "Appuie sur le bouton pour découvrir une surprise.";
      paperNumber.textContent = "0 / 50";
    }

    window.setTimeout(() => {
      generatorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function closeGeneratorPanel() {
    generatorPanel.hidden = true;
    currentCategory = null;
    categoryCards.forEach((card) => card.classList.remove("active"));
  }

  function generateSurprise() {
    if (!currentCategory) return;

    const data = window.SURPRISE_DATA[currentCategory];
    const discovered = savedState.discoveries[currentCategory];
    let itemIndex;

    if (discovered.length < data.items.length) {
      const remaining = data.items
        .map((item, index) => index)
        .filter((index) => !discovered.includes(index));
      itemIndex = remaining[Math.floor(Math.random() * remaining.length)];
      discovered.push(itemIndex);
      saveState();
      updateCounters();
    } else {
      itemIndex = discovered[Math.floor(Math.random() * discovered.length)];
    }

    surprisePaper.classList.remove("reveal");
    void surprisePaper.offsetWidth;
    surpriseText.textContent = data.items[itemIndex];
    paperNumber.textContent = `${discovered.length} / 50`;
    surprisePaper.classList.add("reveal");
    generateButton.textContent = discovered.length >= data.items.length
      ? "Relire une surprise"
      : data.button;

    if (!collectionPanel.hidden) renderCollection();
  }

  function toggleCollection() {
    if (!currentCategory) return;
    const willOpen = collectionPanel.hidden;
    collectionPanel.hidden = !willOpen;
    collectionButton.setAttribute("aria-expanded", String(willOpen));
    collectionButton.textContent = willOpen ? "Masquer ma collection" : "Voir ma collection";
    if (willOpen) renderCollection();
  }

  function renderCollection() {
    const data = window.SURPRISE_DATA[currentCategory];
    const discovered = savedState.discoveries[currentCategory];
    collectionList.replaceChildren();

    if (discovered.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "Aucune surprise découverte pour le moment.";
      collectionList.appendChild(emptyItem);
      return;
    }

    discovered.forEach((itemIndex) => {
      const item = document.createElement("li");
      item.textContent = data.items[itemIndex];
      collectionList.appendChild(item);
    });
  }

  startButton.addEventListener("click", startGame);
  skipToGifts.addEventListener("click", openGifts);
  openGiftsButton.addEventListener("click", openGifts);
  replayButton.addEventListener("click", startGame);
  generateButton.addEventListener("click", generateSurprise);
  collectionButton.addEventListener("click", toggleCollection);
  closeGenerator.addEventListener("click", closeGeneratorPanel);

  categoryCards.forEach((card) => {
    card.addEventListener("click", () => openCategory(card.dataset.category));
  });

  arena.addEventListener("pointermove", (event) => {
    if (!game.running) return;
    const bounds = arena.getBoundingClientRect();
    setPlayerPosition(((event.clientX - bounds.left) / bounds.width) * 100);
  });

  arena.addEventListener("pointerdown", (event) => {
    if (!game.running) return;
    const bounds = arena.getBoundingClientRect();
    setPlayerPosition(((event.clientX - bounds.left) / bounds.width) * 100);
  });

  document.addEventListener("keydown", (event) => {
    if (!game.running) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      movePlayer(-7);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      movePlayer(7);
    }
  });

  [moveLeftButton, moveRightButton].forEach((button, index) => {
    const amount = index === 0 ? -5 : 5;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startControlMove(amount);
    });
    button.addEventListener("pointerup", stopControlMove);
    button.addEventListener("pointercancel", stopControlMove);
    button.addEventListener("pointerleave", stopControlMove);
  });

  window.addEventListener("blur", stopControlMove);
  window.addEventListener("resize", () => setPlayerPosition(game.playerX));

  updateIntro();
  updateCounters();
  saveState();
  showScreen(introScreen);

  window.__laliBirthday = {
    openGifts,
    completeGame: finishGame
  };
}());
