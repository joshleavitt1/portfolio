(function () {
  "use strict";

// ---------------------------------------------------------------------
// Debug outcome from URL (?win or ?lose)
// ---------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);

const DEBUG_OUTCOME = params.has("win")
  ? "win"
  : params.has("lose")
  ? "lose"
  : null;

// ---------------------------------------------------------------------
// Stat panel + GAME health helpers
// ---------------------------------------------------------------------

function applyBattleOffset() {
  cinematicHeroCharacter?.classList.add("battle-offset");
  cinematicMonsterCharacter?.classList.add("battle-offset");
}

function clearBattleOffset() {
  cinematicHeroCharacter?.classList.remove("battle-offset");
  cinematicMonsterCharacter?.classList.remove("battle-offset");
}

// Use window.BATTLE_STATS if available, otherwise fall back
const BATTLE_STATS = window.BATTLE_STATS || DEFAULT_STATS;

// IMPORTANT: use BATTLE_STATS, not window.BATTLE_STATS directly
const HERO_BASE = BATTLE_STATS.hero;
const MONSTER_BASE = BATTLE_STATS.monster;

const heroNameEl = document.getElementById("hero-name");
const monsterNameEl = document.getElementById("monster-name");
const heroHealthFillEl = document.getElementById("hero-health-fill");
const monsterHealthFillEl = document.getElementById("monster-health-fill");

// Persistent health for the *current game* (not just one battle)
let heroHealthCurrent = HERO_BASE.maxHealth;
let monsterHealthCurrent = MONSTER_BASE.maxHealth;

// Reset health to full for a brand-new GAME
function resetGameHealth() {
  heroHealthCurrent = HERO_BASE.maxHealth;
  monsterHealthCurrent = MONSTER_BASE.maxHealth;
}

// Render HUD from current game health
function renderStatPanels() {
  if (heroNameEl) heroNameEl.textContent = HERO_BASE.name;
  if (monsterNameEl) monsterNameEl.textContent = MONSTER_BASE.name;

  if (heroHealthFillEl) {
    const heroPct = (heroHealthCurrent / HERO_BASE.maxHealth) * 100;
    heroHealthFillEl.style.width = `${Math.max(0, heroPct)}%`;
  }

  if (monsterHealthFillEl) {
    const monsterPct = (monsterHealthCurrent / MONSTER_BASE.maxHealth) * 100;
    monsterHealthFillEl.style.width = `${Math.max(0, monsterPct)}%`;
  }
}

// ---------------------------------------------------------------------
// Puzzle Data
// ---------------------------------------------------------------------


  // --- Difficulty + current puzzle (from DifficultyEngine) --------------
  let currentDifficulty =
    window.DifficultyEngine?.getInitialDifficulty() ?? 1;

  let currentPuzzle = null;

  function loadNextPuzzle() {
    if (window.DifficultyEngine) {
      currentPuzzle = window.DifficultyEngine.getNextPuzzle(currentDifficulty);
    } else {
      // Fallback: simple 1+1=2 puzzle if the engine isn't loaded
      currentPuzzle = {
        id: "fallback",
        difficulty: 1,
        slots: 5,
        fixedSlots: {},
        cards: ["1", "1", "2", "+", "="],
      };
    }
    resetPuzzle();
  }

  // ---------------------------------------------------------------------
  // Zoom Guard
  // ---------------------------------------------------------------------P

  // --- Double-tap zoom guard (iOS Safari) ----------------------------------
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        // Prevent the second tap from triggering zoom
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );

  const railEl = document.getElementById("equation-rail");
  const handEl = document.getElementById("card-hand");

  // Modal elements
  const modalEl = document.getElementById("result-modal");
  const modalTitleEl = document.getElementById("modal-title");
  const modalMessageEl = document.getElementById("modal-message");
  const modalPrimaryBtn = document.getElementById("modal-primary-btn");

  // Orientation overlay
  const orientationOverlayEl = document.getElementById("orientation-overlay");

  // Cinematic elements
  const cinematicEl = document.getElementById("cinematic");
  const equationAreaEl = document.querySelector(".equation-area");
  const handAreaEl = document.querySelector(".hand-area");

  const cinematicHero = document.getElementById("cinematic-hero");
  const cinematicMonster = document.getElementById("cinematic-monster");
  const cinematicVs = document.getElementById("cinematic-vs");
  const cinematicAttack = document.getElementById("cinematic-attack");
  const cinematicStage = document.querySelector(".cinematic-stage");
  const cinematicHeroCharacter = document.querySelector(".cinematic-character--hero");
const cinematicMonsterCharacter = document.querySelector(".cinematic-character--monster");

  
  // Sync sprite images from battle stats (HTML src becomes just a fallback)
  if (cinematicHero && HERO_BASE.spriteImage) {
    cinematicHero.src = HERO_BASE.spriteImage;
  }
  
  if (cinematicMonster && MONSTER_BASE.spriteImage) {
    cinematicMonster.src = MONSTER_BASE.spriteImage;
  }  

  // --- Drag state ----------------------------------------------------------
  let cardIdCounter = 0;
  const createCardId = () => `card_${cardIdCounter++}`;

  let activeDrag = null;
  // activeDrag = { card, cardEl, offsetX, offsetY, pointerId }
  let highlightedSlot = null;

  // Card / slot state for the current puzzle
  let slotState = [];
  let cardState = [];

  // --- Hand reflow animation (smooth slide) --------------------------------
  let lastHandSnapshot = null;

function captureHandSnapshot() {
  if (!handEl) return null;
  const cards = Array.from(handEl.children);
  const snapshot = new Map();
  cards.forEach((card) => {
    snapshot.set(card, card.getBoundingClientRect());
  });
  return snapshot;
}

function animateHandFromSnapshot(snapshot) {
  if (!snapshot || !handEl) return;

  const cards = Array.from(handEl.children);
  cards.forEach((card) => {
    const first = snapshot.get(card);
    if (!first) return;

    const last = card.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;

    // Ignore tiny moves
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    // Start from old position
    card.style.transition = "none";
    card.style.transform = `translate(${dx}px, ${dy}px)`;

    // Next frame: animate back to natural layout
    requestAnimationFrame(() => {
      card.style.transition =
        "transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)";
      card.style.transform = "translate(0, 0)";
    });
  });
}


  // --- MONSTER Attack Helper
  function positionAttackOverMonster() {
    if (!cinematicStage || !cinematicMonster || !cinematicAttack) return;
  
    const stageRect = cinematicStage.getBoundingClientRect();
    const monsterRect = cinematicMonster.getBoundingClientRect();
  
    const centerX = monsterRect.left + monsterRect.width / 2 - stageRect.left;
    const centerY = monsterRect.top + monsterRect.height / 2 - stageRect.top;
  
    const attackWidth = 200;
    const attackHeight = 200;
  
    cinematicAttack.style.left = `${centerX - attackWidth / 2}px`;
    cinematicAttack.style.top = `${centerY - attackHeight / 2}px`;
  }
  
  // Mirror helper: position attack overlay over the HERO
  function positionAttackOverHero() {
    if (!cinematicStage || !cinematicHero || !cinematicAttack) return;
  
    const stageRect = cinematicStage.getBoundingClientRect();
    const heroRect = cinematicHero.getBoundingClientRect();
  
    const centerX = heroRect.left + heroRect.width / 2 - stageRect.left;
    const centerY = heroRect.top + heroRect.height / 2 - stageRect.top;
  
    const attackWidth = 200;
    const attackHeight = 200;
  
    cinematicAttack.style.left = `${centerX - attackWidth / 2}px`;
    cinematicAttack.style.top = `${centerY - attackHeight / 2}px`;
  }    
  

  // --- Timing helpers ------------------------------------------------------
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function restartAnimation(el, className) {
    if (!el) return;
    el.classList.remove(className);
    // force reflow
    void el.offsetWidth;
    el.classList.add(className);
  }

    function resetStatPanels() {
    document
      .querySelectorAll(".stat-panel")
      .forEach((el) => el.classList.remove("stat-in"));
  }

  function animateStatPanels() {
    document.querySelectorAll(".stat-panel").forEach((el) => {
      // Skip completely hidden panels (e.g., during stage-game)
      if (el.offsetParent === null) return;
      restartAnimation(el, "stat-in");
    });
  }


  // --- Orientation helpers -------------------------------------------------
  function updateOrientationOverlay() {
    const isMobileWidth = window.innerWidth <= 900;
    const isPortrait =
      window.matchMedia("(orientation: portrait)").matches ||
      window.innerHeight > window.innerWidth;
  
    // Basic touch detection (good enough for "mobile")
    const isTouch =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
  
    // ✅ Only allow: mobile-width + touch + portrait
    const isAllowed = isMobileWidth && isTouch && isPortrait;
  
    if (!isAllowed) {
      // Show blocker for everything else
      orientationOverlayEl.classList.add("show");
      orientationOverlayEl.setAttribute("aria-hidden", "false");
      lockScreen();
    } else {
      // Hide blocker on mobile portrait
      orientationOverlayEl.classList.remove("show");
      orientationOverlayEl.setAttribute("aria-hidden", "true");
      unlockScreen();
    }
  }  

  function lockScreen() {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
  }

  function unlockScreen() {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
  }

  window.addEventListener("resize", updateOrientationOverlay);
  window.addEventListener("orientationchange", updateOrientationOverlay);

  // --- Section visibility helpers -----------------------------------------
  function showCinematic() {
    if (cinematicEl) cinematicEl.classList.remove("is-hidden");
  }

  function hideCinematic() {
    if (cinematicEl) cinematicEl.classList.add("is-hidden");
  }

  function showCards() {
    if (equationAreaEl) equationAreaEl.classList.remove("is-hidden");
    if (handAreaEl) handAreaEl.classList.remove("is-hidden");
  }

  function hideCards() {
    if (equationAreaEl) equationAreaEl.classList.add("is-hidden");
    if (handAreaEl) handAreaEl.classList.add("is-hidden");
  }

  function resetCinematicSprites() {
    clearBattleOffset();
    if (!cinematicHero || !cinematicMonster || !cinematicVs || !cinematicAttack) {
      return;
    }
  
    // Reset the stage container (in case it was faded out)
    if (cinematicStage) {
      cinematicStage.classList.remove("cinematic-fade-out");
      cinematicStage.style.opacity = "";
      cinematicStage.style.transform = "";
    }
  
    // Reset base opacity for sprites/overlays
    cinematicHero.style.opacity = "0";
    cinematicMonster.style.opacity = "0";
    cinematicVs.style.opacity = "0";
    cinematicAttack.style.opacity = "0";
  
    // Clear all cinematic classes so we can restart clean
    cinematicHero.classList.remove(
      "cinematic-in",
      "cinematic-fade-out",
      "cinematic-hero-attack",
      "cinematic-hit"
    );
  
    cinematicMonster.classList.remove(
      "cinematic-in",
      "cinematic-hit",
      "cinematic-fade-out",
      "cinematic-monster-attack"
    );
  
    cinematicVs.classList.remove("cinematic-show", "cinematic-fade-out");
  
    cinematicAttack.classList.remove(
      "cinematic-attack-in",
      "cinematic-attack-out"
    );
  }    
  
  // --- Modal helpers -------------------------------------------------------
  function hideModal() {
    modalEl.classList.remove("show");
    modalEl.setAttribute("aria-hidden", "true");
  }

  function showModal(title, message, buttonLabel, onPrimaryClick) {
    modalTitleEl.textContent = title;
    modalMessageEl.textContent = message;
    modalPrimaryBtn.textContent = buttonLabel;

    modalPrimaryBtn.onclick = () => {
      hideModal();
      if (typeof onPrimaryClick === "function") {
        onPrimaryClick();
      }
    };

    modalEl.classList.add("show");
    modalEl.setAttribute("aria-hidden", "false");
  }

    // Start a brand-new GAME (health reset + intro)
    function startNewGame() {
      resetGameHealth();
    
      if (window.DifficultyEngine) {
        currentDifficulty = window.DifficultyEngine.getInitialDifficulty();
        currentPuzzle = window.DifficultyEngine.getNextPuzzle(currentDifficulty);
      }
    
      resetPuzzle();
      hideCards();
      runIntroSequence();
    }        
  
    function showHeroGameWinModal() {
      showModal(
        "You Won the Game!",
        "The monster has been defeated. Continue your journey on the map.",
        "Back to Map",
        () => {
          // Clear this battle, advance to the next node, then show the map
          advanceToNextNodeIfAvailable();
          showMap();
        }
      );
    }

    function showMonsterGameWinModal() {
      showModal(
        "Game Over",
        "The monster defeated you. Return to the map and try again.",
        "Back to Map",
        () => {
          // No node advance – retry same node from the map
          showMap();
        }
      );
    }
  
    // Returns true if the game is over (modal shown), false otherwise
    function checkGameOver() {
      if (monsterHealthCurrent <= 0 && heroHealthCurrent > 0) {
        showHeroGameWinModal();
        return true;
      }
      if (heroHealthCurrent <= 0 && monsterHealthCurrent > 0) {
        showMonsterGameWinModal();
        return true;
      }
      if (heroHealthCurrent <= 0 && monsterHealthCurrent <= 0) {
        // Rare tie: treat as hero victory for now
        showHeroGameWinModal();
        return true;
      }
      return false;
    }  

  // --- Cinematic sequences -------------------------------------------------
  async function runIntroSequence() {
    // Intro stage: battle background
    setStage("intro");

    // New game always starts at full health
    resetGameHealth();

    showCinematic();
    hideCards();
    resetCinematicSprites();
    resetStatPanels();
    renderStatPanels();
  
    // 0.5s pause before sprites spring in
    await delay(750);
  
    // Hero + Monster spring in together
    restartAnimation(cinematicHero, "cinematic-in");
    restartAnimation(cinematicMonster, "cinematic-in");

    // ✅ push hero down, monster up
    applyBattleOffset();
  
    // Let sprites mostly settle (slightly after their 0.6s spring)
    await delay(1500);
  
    // Stat panels spring in shortly AFTER sprites
    animateStatPanels();
  
    // Shorter pause before VS (keep overall timing similar to original)
    await delay(1000);
  
    // VS springs into center
    restartAnimation(cinematicVs, "cinematic-show");
  
    // Let VS hang for a bit
    await delay(2500);
  
    // Fade out the entire stage (HERO, MONSTER, VS, attack)
    if (cinematicStage) {
      restartAnimation(cinematicStage, "cinematic-fade-out");
    }
  
    // Let fade-out play
    await delay(1000);
  
    // Handoff: hide cinematic, show cards
    hideCinematic();
    showCards();
    clearBattleOffset();
  
    // GAME stage: crossfade to card background
    setStage("game");
  
    // Animate equation row + hand fading in
    if (equationAreaEl) {
      restartAnimation(equationAreaEl, "cards-fade-in");
    }
    if (handAreaEl) {
      restartAnimation(handAreaEl, "cards-fade-in");
    }
  }  
  

  async function runHeroBattleWin() {
    setStage("result");

    showCinematic();
    hideCards();
    resetCinematicSprites();
    resetStatPanels();
    renderStatPanels();

    // Short pause before result sprites appear
    await delay(750);

    restartAnimation(cinematicHero, "cinematic-in");
    restartAnimation(cinematicMonster, "cinematic-in");
    
    // ✅ battle spacing
    applyBattleOffset();

    // Stats come in slightly after sprites
    await delay(1500);
    animateStatPanels();

    // Let them fully animate in and settle
    await delay(1000);

    // HERO sword-strike lunge (forward + pull back)
    restartAnimation(cinematicHero, "cinematic-hero-attack");
    await delay(750); // match HERO-sword-strike duration

    // Use HERO attack sprite for this sequence
    if (cinematicAttack && HERO_BASE.attackImage) {
      cinematicAttack.src = HERO_BASE.attackImage;
    }

    // Attack overlay appears over MONSTER + MONSTER shakes
    positionAttackOverMonster();
    restartAnimation(cinematicAttack, "cinematic-attack-in");
    restartAnimation(cinematicMonster, "cinematic-hit");

    // ⏱ let the shake play clearly before HP drops
    await delay(500);

    // ✅ NOW apply damage and animate HP bar downward
    monsterHealthCurrent = Math.max(
      0,
      monsterHealthCurrent - HERO_BASE.damage
    );
    renderStatPanels(); // CSS transition animates the drain

    // Let the player watch the health drop
    await delay(800);

    // Attack sprite springs out (exit animation)
    restartAnimation(cinematicAttack, "cinematic-attack-out");

    // After another 1s, either end game or go back to cards
    await delay(2000);

    if (!checkGameOver()) {
      // Continue game: next puzzle from difficulty engine
      if (window.DifficultyEngine) {
        currentPuzzle = window.DifficultyEngine.getNextPuzzle(currentDifficulty);
      }
      resetPuzzle();
      hideCinematic();
      showCards();
      clearBattleOffset();
      setStage("game");
      if (equationAreaEl) {
        restartAnimation(equationAreaEl, "cards-fade-in");
      }
      if (handAreaEl) {
        restartAnimation(handAreaEl, "cards-fade-in");
      }
    }    
  }

  async function runMonsterBattleWin() {
    setStage("result");

    showCinematic();
    hideCards();
    resetCinematicSprites();
    resetStatPanels();
    renderStatPanels();

    // Short pause before result sprites appear
    await delay(750);

    restartAnimation(cinematicHero, "cinematic-in");
    restartAnimation(cinematicMonster, "cinematic-in");

    // ✅ battle spacing
    applyBattleOffset();

    // Stats come in slightly after sprites
    await delay(1500);
    animateStatPanels();

    // Let them fully animate in and settle
    await delay(1000);

    // MONSTER attack lunge (mirror of HERO's sword-strike)
    restartAnimation(cinematicMonster, "cinematic-monster-attack");
    await delay(750); // match HERO-sword-strike duration

    // Use MONSTER attack sprite for this sequence
    if (cinematicAttack && MONSTER_BASE.attackImage) {
      cinematicAttack.src = MONSTER_BASE.attackImage;
    }

    // Attack overlay appears over HERO + HERO shakes
    positionAttackOverHero();
    restartAnimation(cinematicAttack, "cinematic-attack-in");
    restartAnimation(cinematicHero, "cinematic-hit");

    // ⏱ let the shake play clearly before HP drops
    await delay(500);

    // ✅ NOW apply damage and animate HP bar downward
    heroHealthCurrent = Math.max(
      0,
      heroHealthCurrent - MONSTER_BASE.damage
    );
    renderStatPanels(); // CSS transition animates the drain

    // Let the player watch the health drop
    await delay(800);

    // Attack sprite springs out (exit animation)
    restartAnimation(cinematicAttack, "cinematic-attack-out");

    // After another 1s, either end game or go back to cards
    await delay(1000);

    if (!checkGameOver()) {
      // Continue game: next puzzle from difficulty engine
      if (window.DifficultyEngine) {
        currentPuzzle = window.DifficultyEngine.getNextPuzzle(currentDifficulty);
      }
      resetPuzzle();
      hideCinematic();
      showCards();
      clearBattleOffset();
      setStage("game");
      if (equationAreaEl) {
        restartAnimation(equationAreaEl, "cards-fade-in");
      }
      if (handAreaEl) {
        restartAnimation(handAreaEl, "cards-fade-in");
      }
    }
  }    
  
  // --- Map + Game root elements -------------------------------------------
const gameRoot = document.getElementById("game-root");
const mapScreenEl = document.getElementById("map-screen");
const mapNodes = document.querySelectorAll(".map-node");

const TOTAL_NODES = 6;
let activeNodeIndex = 0; // 0 = bottom node

// You can keep your existing setStage if it's already defined above;
// this version matches what you've been using.
function setStage(stage) {
  // stage: "intro", "game", or "result"
  gameRoot.classList.remove("stage-intro", "stage-game", "stage-result");
  gameRoot.classList.add(`stage-${stage}`);
}

// Show MAP, hide GAME (via opacity classes)
function showMap() {
  if (mapScreenEl) {
    mapScreenEl.classList.remove("map-screen--hidden");
  }
  if (gameRoot) {
    gameRoot.classList.remove("game--visible");
  }

  updateMapNodes();
  animateMapNodesIn();
}

// Show GAME, hide MAP (simple CSS-driven crossfade)
function showGame() {
  if (mapScreenEl) {
    mapScreenEl.classList.add("map-screen--hidden");
  }
  if (gameRoot) {
    gameRoot.classList.add("game--visible");
  }
}

// Node state: only the active node is tappable
function updateMapNodes() {
  mapNodes.forEach((node) => {
    const idx = Number(node.dataset.nodeIndex);
    if (idx === activeNodeIndex) {
      node.classList.add("map-node--active");
      node.classList.remove("map-node--locked");
      node.disabled = false;
    } else {
      node.classList.remove("map-node--active");
      node.classList.add("map-node--locked");
      node.disabled = true;
    }
  });
}

// Spring nodes in from bottom to top
function animateMapNodesIn() {
  if (!mapScreenEl) return;

  const INITIAL_PAUSE_MS = 500;
  const STAGGER_MS = 200;

  // Reset previous animations
  mapNodes.forEach((node) => {
    node.classList.remove("map-node--spawn");
    node.style.animationDelay = "";
  });

  // Force reflow to restart animations
  void mapScreenEl.offsetWidth;

  // Bottom → top cascade
  mapNodes.forEach((node, index) => {
    const delayMs = INITIAL_PAUSE_MS + index * STAGGER_MS;
    node.style.animationDelay = `${delayMs}ms`;
    node.classList.add("map-node--spawn");
  });
}

// When user taps a node
function handleMapNodeClick(idx) {
  // Only allow the active node
  if (idx !== activeNodeIndex) return;

  // Simple crossfade between map + game
  showGame();

  // Kick off your full intro → cards → battle flow
  startNewGame();
}

// Attach listeners once DOM is ready
mapNodes.forEach((node) => {
  const idx = Number(node.dataset.nodeIndex);
  node.addEventListener("click", () => handleMapNodeClick(idx));
});

// After a full win, move to the next node (if any)
function advanceToNextNodeIfAvailable() {
  if (activeNodeIndex < TOTAL_NODES - 1) {
    activeNodeIndex += 1;
  }
}


  // --- Render functions ----------------------------------------------------
    // --- Render functions ----------------------------------------------------
    function resetPuzzle() {
      const puzzle = currentPuzzle;
      if (!puzzle) return;
  
      slotState = [];
      cardState = [];
      highlightedSlot = null;
  
      railEl.innerHTML = "";
      handEl.innerHTML = "";
      railEl.classList.remove(
        "resolve",
        "resolve-win",
        "resolve-error",
        "resolve-fade-out"
      );
      hideModal();
    
      // tell CSS (globally) how many slots this puzzle uses
      document.documentElement.style.setProperty("--slots", puzzle.slots);
    
      const fixedSlots = puzzle.fixedSlots || {};
       
  
      // Create slots (5, 6, 7, or 8)
      for (let i = 0; i < puzzle.slots; i++) {
        const slot = document.createElement("div");
        slot.className = "slot";
        slot.dataset.slotIndex = String(i);
  
        // If this slot is pre-filled (scaffolding), drop a fixed card into it
        if (Object.prototype.hasOwnProperty.call(fixedSlots, i)) {
          const value = fixedSlots[i];
  
          const fixedCard = document.createElement("div");
          fixedCard.className = "card card--fixed";
          fixedCard.dataset.fixed = "true";
          fixedCard.textContent = value;
  
          if (isNumber(value)) {
            fixedCard.classList.add("number");
          } else if (value === "=") {
            fixedCard.classList.add("equal");
          } else {
            fixedCard.classList.add("operator");
          }
  
          slot.classList.add("filled");
          slot.appendChild(fixedCard);
        }
  
        railEl.appendChild(slot);
      }
  
      // Create movable cards in the hand
      puzzle.cards.forEach((value) => {
        const id = createCardId();
        cardState.push({ id, value, inSlot: null });
  
        const cardEl = document.createElement("div");
        cardEl.className = "card";
        cardEl.dataset.cardId = id;
        cardEl.textContent = value;
  
        if (isNumber(value)) {
          cardEl.classList.add("number");
        } else if (value === "=") {
          cardEl.classList.add("equal");
        } else {
          cardEl.classList.add("operator");
        }
  
        attachCardDragListeners(cardEl);
        handEl.appendChild(cardEl);
      });
    }  

  // --- Drag & drop behavior (pointer events) -------------------------------
  function attachCardDragListeners(cardEl) {
    cardEl.addEventListener("pointerdown", (e) => {
      startDrag(e, cardEl);
    });
  }

  function startDrag(e, cardEl) {
    const cardId = cardEl.dataset.cardId;
    const card = cardState.find((c) => c.id === cardId);
    if (!card) return;
  
    // 1️⃣ capture position BEFORE we change the DOM
    const rect = cardEl.getBoundingClientRect();
  
    e.preventDefault();
    cardEl.setPointerCapture(e.pointerId);
  
    // 🔒 NEW: lock the hand height so the equation row doesn't re-center
    if (handEl) {
      const handRect = handEl.getBoundingClientRect();
      handEl.style.minHeight = `${handRect.height}px`;
    }
  
    // 2️⃣ snapshot hand layout BEFORE this card leaves
    lastHandSnapshot = captureHandSnapshot();
  
    // 3️⃣ if card was already in a slot, free that slot
    if (card.inSlot !== null && card.inSlot !== undefined) {
      const index = card.inSlot;
      slotState = slotState.filter((item) => item.cardId !== card.id);
      card.inSlot = null;
      const slotEl = railEl.querySelector(`.slot[data-slot-index="${index}"]`);
      if (slotEl) {
        slotEl.classList.remove("filled");
        slotEl.innerHTML = "";
      }
    }
  
    // 4️⃣ now convert to a floating card at the same screen position
    activeDrag = {
      card,
      cardEl,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  
    cardEl.classList.add("dragging");
    cardEl.style.position = "fixed";
    cardEl.style.left = `${rect.left}px`;
    cardEl.style.top = `${rect.top}px`;
    cardEl.style.zIndex = "1000";
  
    // Move into body so it can float above everything
    document.body.appendChild(cardEl);
  
    // Animate the remaining hand cards sliding together
    animateHandFromSnapshot(lastHandSnapshot);
  
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp, { once: true });
  }    

  function onPointerMove(e) {
    if (!activeDrag) return;

    const { cardEl, offsetX, offsetY } = activeDrag;

    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    cardEl.style.left = `${x}px`;
    cardEl.style.top = `${y}px`;

    // SNAP HINT: detect slot under cursor, ignoring the dragged card
    const prevPointerEvents = cardEl.style.pointerEvents;
    cardEl.style.pointerEvents = "none";
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    cardEl.style.pointerEvents = prevPointerEvents || "";

    const slotEl = findClosestSlot(dropTarget);

    if (slotEl !== highlightedSlot) {
      if (highlightedSlot) {
        highlightedSlot.classList.remove("slot-hover");
      }
      if (slotEl) {
        slotEl.classList.add("slot-hover");
      }
      highlightedSlot = slotEl;
    }
  }

  function onPointerUp(e) {
    if (!activeDrag) return;
  
    const { card, cardEl, pointerId } = activeDrag;
  
    try {
      cardEl.releasePointerCapture(pointerId);
    } catch (_) {
      // ignore if already released
    }
  
    // Clean drag styling
    cardEl.classList.remove("dragging");
    cardEl.style.position = "";
    cardEl.style.left = "";
    cardEl.style.top = "";
    cardEl.style.zIndex = "";
  
    // Hit-test again on drop, ignoring the card itself
    const prevPointerEvents = cardEl.style.pointerEvents;
    cardEl.style.pointerEvents = "none";
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    cardEl.style.pointerEvents = prevPointerEvents || "";
  
    const slotEl = findClosestSlot(dropTarget);
  
    if (highlightedSlot) {
      highlightedSlot.classList.remove("slot-hover");
      highlightedSlot = null;
    }
  
    if (slotEl) {
      placeCardInSlot(card, cardEl, slotEl);
    } else {
      // Drop back into hand
      card.inSlot = null;
  
      const snapshot = captureHandSnapshot();
      handEl.appendChild(cardEl);
      animateHandFromSnapshot(snapshot);
    }
  
    // 🔓 NEW: unlock the hand height now that the drag is done
    if (handEl) {
      handEl.style.minHeight = "";
    }
  
    activeDrag = null;
    document.removeEventListener("pointermove", onPointerMove);
    checkIfReadyToValidate();
  }
  

  function findClosestSlot(el) {
    if (!el) return null;
    if (el.classList && el.classList.contains("slot")) return el;

    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.classList && cur.classList.contains("slot")) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function placeCardInSlot(card, cardEl, slotEl) {
    const slotIndex = Number(slotEl.dataset.slotIndex);

    // If slot already has a card, bump that card back to hand
    const existing = slotState.find((item) => item.slotIndex === slotIndex);
    if (existing) {
      const existingCard = cardState.find((c) => c.id === existing.cardId);
      if (existingCard) {
        existingCard.inSlot = null;
        const existingCardEl = document.querySelector(
          `.card[data-card-id="${existingCard.id}"]`
        );
        if (existingCardEl) {
          const snapshot = captureHandSnapshot();
          handEl.appendChild(existingCardEl);
          animateHandFromSnapshot(snapshot);
        }
      }
      slotState = slotState.filter((item) => item.slotIndex !== slotIndex);
    }    

    card.inSlot = slotIndex;
    slotState.push({ slotIndex, cardId: card.id, value: card.value });

    slotEl.classList.add("filled");
    slotEl.innerHTML = "";
    slotEl.appendChild(cardEl);
  }

   // --- Validation ----------------------------------------------------------
   async function runCardsResolution(isWin) {
    // NEW: compute how far we need to move the rail
    // so its center lines up with the center of the game area
    const gameEl = document.querySelector(".game");
    if (gameEl) {
      const gameRect = gameEl.getBoundingClientRect();
      const railRect = railEl.getBoundingClientRect();

      const gameCenterY = gameRect.top + gameRect.height / 2;
      const railCenterY = railRect.top + railRect.height / 2;
      const offsetY = gameCenterY - railCenterY;

      railEl.style.setProperty("--resolve-translateY", `${offsetY}px`);
    }

    // Clean up any previous resolve states
    railEl.classList.remove(
      "resolve",
      "resolve-win",
      "resolve-error",
      "resolve-fade-out"
    );

    // Slide the cards down as a group (slower: 0.5s in CSS)
    railEl.classList.add("resolve");
    await delay(500); // match eq-resolve-slide-down duration

    if (isWin) {
      // WIN: cards bounce left-to-right, then pause, then fade out → result
      railEl.classList.add("resolve-win");

      const cards = railEl.querySelectorAll(".card");
      const perCardDelay = 100;
      cards.forEach((card, index) => {
        card.style.animationDelay = `${index * perCardDelay}ms`;
      });

      const bounceDuration = 450;
      const maxIndex = Math.max(0, cards.length - 1);
      const totalBounceTime = bounceDuration + maxIndex * perCardDelay;

      await delay(totalBounceTime);
      await delay(1000); // extra pause

      railEl.classList.add("resolve-fade-out");
      await delay(400);

      await runHeroBattleWin();
    } else {
      // LOSS: use same timing spine as WIN
      railEl.querySelectorAll(".card").forEach((card) => {
        card.style.animation = "none";
        card.offsetHeight; // reflow
        card.style.animation = "";
      });

      railEl.classList.add("resolve-error");
      await delay(500);
      await delay(1000);
      railEl.classList.add("resolve-fade-out");
      await delay(400);

      await runMonsterBattleWin();
    }
  }

  function checkIfReadyToValidate() {
    const puzzle = currentPuzzle;
    if (!puzzle) return;

    const slots = railEl.querySelectorAll(".slot");
    const fixedSlots = puzzle.fixedSlots || {};

    const totalSlots = puzzle.slots;
    const fixedCount = Object.keys(fixedSlots).length;
    const movableSlots = totalSlots - fixedCount;

    // We only need the movable slots filled via slotState
    if (slotState.length !== movableSlots) {
      return;
    }

    // Build token list in slot order, mixing fixed + placed cards
    const tokens = Array.from(slots).map((slot) => {
      const slotIndex = Number(slot.dataset.slotIndex);

      // Fixed scaffolding?
      if (Object.prototype.hasOwnProperty.call(fixedSlots, slotIndex)) {
        return fixedSlots[slotIndex];
      }

      // Movable card from slotState
      const item = slotState.find((s) => s.slotIndex === slotIndex);
      return item ? item.value : null;
    });

    if (tokens.includes(null)) {
      return;
    }

    const result = validateEquation(tokens);

    if (result.valid) {
      runCardsResolution(true);
    } else {
      runCardsResolution(false);
    }
  }

  function validateEquation(tokens) {
    // tokens = full equation, e.g. ["2","1","+","1","6","=","3","7"]

    // 1) Ensure exactly one "=" token
    const eqIndices = tokens
      .map((t, idx) => (t === "=" ? idx : -1))
      .filter((idx) => idx >= 0);

    if (eqIndices.length !== 1) {
      return { valid: false, message: "Try using only one equals sign." };
    }

    const eqIndex = eqIndices[0];

    // 2) Split into left and right sides
    const leftTokens = tokens.slice(0, eqIndex);
    const rightTokens = tokens.slice(eqIndex + 1);

    if (leftTokens.length === 0 || rightTokens.length === 0) {
      return { valid: false, message: "Both sides need numbers." };
    }

    // 3) Evaluate both sides
    const leftValue = evalSimpleSide(leftTokens);
    const rightValue = evalSimpleSide(rightTokens);

    if (leftValue === null || rightValue === null) {
      return {
        valid: false,
        message: "That doesn’t look like an attack sentence yet.",
      };
    }

    if (leftValue === rightValue) {
      return {
        valid: true,
        combat: {
          leftValue,
          rightValue,
        },
      };
    }

    return {
      valid: false,
      message: "That attack doesn’t balance yet.",
      combat: { leftValue, rightValue },
    };
  }

  // Supports:
  // - Only digits: ["3","7"] -> 37
  // - One operator: ["2","1","+","1","6"] -> 21 + 16
  // - Still limited to "+" and "-" for now.
  function evalSimpleSide(sideTokens) {
    // Count operators
    const ops = sideTokens.filter((t) => t === "+" || t === "-");
    if (ops.length === 0) {
      // Just a number: join all digits
      if (!sideTokens.every((t) => isNumber(t))) return null;
      return Number(sideTokens.join(""));
    }

    if (ops.length > 1) {
      // For now, we only support one operation per side
      return null;
    }

    const opIndex = sideTokens.findIndex((t) => t === "+" || t === "-");
    const op = sideTokens[opIndex];

    const leftDigits = sideTokens.slice(0, opIndex);
    const rightDigits = sideTokens.slice(opIndex + 1);

    if (
      leftDigits.length === 0 ||
      rightDigits.length === 0 ||
      !leftDigits.every((t) => isNumber(t)) ||
      !rightDigits.every((t) => isNumber(t))
    ) {
      return null;
    }

    const leftVal = Number(leftDigits.join(""));
    const rightVal = Number(rightDigits.join(""));

    if (op === "+") return leftVal + rightVal;
    if (op === "-") return leftVal - rightVal;

    return null;
  }

  function isNumber(str) {
    return /^[0-9]+$/.test(str);
  }

  // --- Init ----------------------------------------------------------------
  function init() {
    loadNextPuzzle();
    updateOrientationOverlay();
    hideCards(); // cards hidden until a node launches a battle

    // Start on the world map by default
    showMap();
    setStage("intro"); // prepare battle stage but keep it hidden

    if (DEBUG_OUTCOME) {
      // 🔧 Debug mode bypasses map and jumps straight to a single battle result
      showGame();
      resetGameHealth();

      if (DEBUG_OUTCOME === "win") {
        monsterHealthCurrent = Math.max(
          0,
          monsterHealthCurrent - HERO_BASE.damage
        );
        renderStatPanels();
        runHeroBattleWin();
      } else {
        heroHealthCurrent = Math.max(
          0,
          heroHealthCurrent - MONSTER_BASE.damage
        );
        renderStatPanels();
        runMonsterBattleWin();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();


window.addEventListener("load", () => {
  setTimeout(() => {
    // Call again on load to be extra safe on mobile
    const evt = new Event("resize");
    window.dispatchEvent(evt);
  }, 100);
});

window.addEventListener("load", () => {
  setTimeout(() => {
    window.scrollTo(0, 1);
  }, 50);
});

