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
// Stat panel helpers
// ---------------------------------------------------------------------

// Use window.BATTLE_STATS if available, otherwise fall back
const BATTLE_STATS = window.BATTLE_STATS || DEFAULT_STATS;

// IMPORTANT: use BATTLE_STATS, not window.BATTLE_STATS directly
const HERO_BASE = BATTLE_STATS.hero;
const MONSTER_BASE = BATTLE_STATS.monster;

const heroNameEl = document.getElementById("hero-name");
const monsterNameEl = document.getElementById("monster-name");
const heroHealthFillEl = document.getElementById("hero-health-fill");
const monsterHealthFillEl = document.getElementById("monster-health-fill");

/**
 * Compute current health values based on outcome.
 * outcome: "intro" | "win" | "lose"
 */
function computeBattleState(outcome) {
  const hero = {
    ...HERO_BASE,
    health: HERO_BASE.maxHealth,
  };
  const monster = {
    ...MONSTER_BASE,
    health: MONSTER_BASE.maxHealth,
  };

  if (outcome === "win") {
    // Hero hits monster
    monster.health = Math.max(
      0,
      MONSTER_BASE.maxHealth - HERO_BASE.damage
    );
  } else if (outcome === "lose") {
    // Monster hits hero
    hero.health = Math.max(
      0,
      HERO_BASE.maxHealth - MONSTER_BASE.damage
    );
  }

  return { hero, monster };
}

function renderStatPanels(outcome) {
  const { hero, monster } = computeBattleState(outcome);

  if (heroNameEl) heroNameEl.textContent = hero.name;
  if (monsterNameEl) monsterNameEl.textContent = monster.name;

  if (heroHealthFillEl) {
    const heroPct = (hero.health / hero.maxHealth) * 100;
    heroHealthFillEl.style.width = `${heroPct}%`;
  }

  if (monsterHealthFillEl) {
    const monsterPct = (monster.health / monster.maxHealth) * 100;
    monsterHealthFillEl.style.width = `${monsterPct}%`;
  }
}

(() => {
  // --- Puzzle data ---------------------------------------------------------
  // Simple, guaranteed-solvable puzzles using A op B = C or C = A op B
  const puzzles = [
    { id: 1, cards: ["1", "1", "2", "+", "="], slots: 5 },
    { id: 2, cards: ["2", "3", "5", "+", "="], slots: 5 },
    { id: 3, cards: ["3", "1", "2", "+", "="], slots: 5 },
    { id: 4, cards: ["4", "2", "2", "-", "="], slots: 5 },
    { id: 5, cards: ["2", "2", "4", "+", "="], slots: 5 },
  ];

  let currentPuzzleIndex = 0;
  let slotState = []; // { slotIndex, cardId, value }
  let cardState = []; // { id, value, inSlot: number|null }

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

  const cinematicKnight = document.getElementById("cinematic-knight");
  const cinematicDragon = document.getElementById("cinematic-dragon");
  const cinematicVs = document.getElementById("cinematic-vs");
  const cinematicAttack = document.getElementById("cinematic-attack");
  const cinematicStage = document.querySelector(".cinematic-stage");

  // Sync sprite images from battle stats (HTML src becomes just a fallback)
if (cinematicKnight && HERO_BASE.spriteImage) {
  cinematicKnight.src = HERO_BASE.spriteImage;
}

if (cinematicDragon && MONSTER_BASE.spriteImage) {
  cinematicDragon.src = MONSTER_BASE.spriteImage;
}

if (cinematicAttack && HERO_BASE.attackImage) {
  cinematicAttack.src = HERO_BASE.attackImage;
}

  // --- Drag state ----------------------------------------------------------
  let cardIdCounter = 0;
  const createCardId = () => `card_${cardIdCounter++}`;

  let activeDrag = null;
  // activeDrag = { card, cardEl, offsetX, offsetY, pointerId }
  let highlightedSlot = null;

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


  // --- Dragon Attack Helper
  function positionAttackOverDragon() {
    if (!cinematicStage || !cinematicDragon || !cinematicAttack) return;
  
    const stageRect = cinematicStage.getBoundingClientRect();
    const dragonRect = cinematicDragon.getBoundingClientRect();
  
    // Center of the dragon relative to the stage
    const centerX = dragonRect.left + dragonRect.width / 2 - stageRect.left;
    const centerY = dragonRect.top + dragonRect.height / 2 - stageRect.top;
  
    const attackWidth = 200;   // match CSS width
    const attackHeight = 200;  // match CSS height
  
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

  // --- Orientation helpers -------------------------------------------------
  function updateOrientationOverlay() {
    const isMobile = window.innerWidth <= 900;

    const isPortrait =
      window.matchMedia("(orientation: portrait)").matches ||
      window.innerHeight > window.innerWidth;

    if (isMobile && isPortrait) {
      orientationOverlayEl.classList.add("show");
      orientationOverlayEl.setAttribute("aria-hidden", "false");
      lockScreen();
    } else {
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
    if (!cinematicKnight || !cinematicDragon || !cinematicVs || !cinematicAttack) {
      return;
    }
  
    // Reset the stage container (in case it was faded out)
    if (cinematicStage) {
      cinematicStage.classList.remove("cinematic-fade-out");
      cinematicStage.style.opacity = "";
      cinematicStage.style.transform = "";
    }
  
    // Reset base opacity for sprites/overlays
    cinematicKnight.style.opacity = "0";
    cinematicDragon.style.opacity = "0";
    cinematicVs.style.opacity = "0";
    cinematicAttack.style.opacity = "0";
  
    // Clear all cinematic classes so we can restart clean
    cinematicKnight.classList.remove(
      "cinematic-in",
      "cinematic-fade-out",
      "cinematic-knight-attack"
    );
  
    cinematicDragon.classList.remove(
      "cinematic-in",
      "cinematic-hit",
      "cinematic-fade-out"
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

  function showLossModal() {
    showModal(
      "Try Again!",
      "Your attack just missed. Give it another try.",
      "Redo",
      () => {
        // Reset same puzzle and stay in cards phase
        resetPuzzle();
        showCards();
        setStage("game");
      }
    );
  }  

  function showWinModal() {
    showModal(
      "Nice Job!",
      "You slayed the dragon! Prepare for the next battle.",
      "Next",
      () => {
        // Next puzzle + re-run intro for the new battle
        currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzles.length;
        resetPuzzle();
        runIntroSequence();
      }
    );
  }

  // --- Cinematic sequences -------------------------------------------------
  async function runIntroSequence() {
    // Intro stage: battle background
    setStage("intro");
  
    showCinematic();
    hideCards();
    resetCinematicSprites();

        // ⬇️ ADD THIS
        renderStatPanels("intro");
  
    // 0.5s pause before sprites spring in
    await delay(500);
  
    // Knight + Dragon spring in together
    restartAnimation(cinematicKnight, "cinematic-in");
    restartAnimation(cinematicDragon, "cinematic-in");
  
    // Let them fully animate in and settle
    await delay(1500);
  
    // VS springs into center
    restartAnimation(cinematicVs, "cinematic-show");
  
    // Let VS hang for a bit
    await delay(1500);
  
    // Fade out the entire stage (knight, dragon, VS, attack)
    if (cinematicStage) {
      restartAnimation(cinematicStage, "cinematic-fade-out");
    }
  
    // Let fade-out play
    await delay(1000);
  
    // Handoff: hide cinematic, show cards
    hideCinematic();
    showCards();
  
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
  

  async function runResultSequence(playerWon) {
    // We should already be in stage-result, but this keeps it explicit
    setStage("result");

     // ⬇️ ADD THIS BLOCK
     const outcome = DEBUG_OUTCOME || (playerWon ? "win" : "lose");
     renderStatPanels(outcome);
  
    showCinematic();
    hideCards();
    resetCinematicSprites();
  
    // Short pause before result sprites appear
    await delay(500);
  
    // Knight + Dragon spring in together (same as intro)
    restartAnimation(cinematicKnight, "cinematic-in");
    restartAnimation(cinematicDragon, "cinematic-in");  
  
    // Let them fully animate in and settle
    await delay(1500);
  
    if (!playerWon) {
      // If you ever want a loss cinematic, you can wire it here.
      // For now, just show the loss modal immediately.
      showLossModal();
      return;
    }
  
    // --- WIN PATH ---
  
    // 1) Knight sword-strike lunge (forward + pull back)
    restartAnimation(cinematicKnight, "cinematic-knight-attack");
    await delay(600); // match knight-sword-strike duration
  
    // 2) Attack overlay appears over dragon + dragon shakes
    positionAttackOverDragon();
    restartAnimation(cinematicAttack, "cinematic-attack-in");
    restartAnimation(cinematicDragon, "cinematic-hit");
  
    // Attack overlay animates (0.6s) + extra 500ms hang time
    await delay(600 + 1000);
  
    // 3) Attack sprite springs out (exit animation)
    restartAnimation(cinematicAttack, "cinematic-attack-out");
  
    // 4) After another 500ms, push the modal
    await delay(1000);
    showWinModal();
  }
  
  const gameRoot = document.getElementById('game-root');

function setStage(stage) {
  // stage is "intro", "game", or "result"
  gameRoot.classList.remove('stage-intro', 'stage-game', 'stage-result');
  gameRoot.classList.add(`stage-${stage}`);
}


  // --- Render functions ----------------------------------------------------
  function resetPuzzle() {
    const puzzle = puzzles[currentPuzzleIndex];
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

    // Create slots
    for (let i = 0; i < puzzle.slots; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.slotIndex = String(i);
      railEl.appendChild(slot);
    }

    // Create cards in hand
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
  
    e.preventDefault();
    cardEl.setPointerCapture(e.pointerId);
  
    // Snapshot hand layout BEFORE this card leaves
    lastHandSnapshot = captureHandSnapshot();
  
    // If card was already in a slot, free that slot immediately
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

    const rect = cardEl.getBoundingClientRect();

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
    const perCardDelay = 100; // a bit slower than 80ms
    cards.forEach((card, index) => {
      card.style.animationDelay = `${index * perCardDelay}ms`;
    });

    // Bounce duration (0.45s) + max stagger (for up to 5 cards)
    const bounceDuration = 450;
    const maxIndex = Math.max(0, cards.length - 1);
    const totalBounceTime = bounceDuration + maxIndex * perCardDelay;

    // Wait for bounce to finish
    await delay(totalBounceTime);

    // EXTRA: 1s pause with cards in place
    await delay(1000);

    // Fade the whole rail out
    railEl.classList.add("resolve-fade-out");
    await delay(400); // match eq-resolve-fade-out duration

           // Move into RESULT stage (battle background again)
    setStage("result");

    // Hide cards and show result cinematic
    hideCards();

    const outcome = DEBUG_OUTCOME || (isWin ? "win" : "lose");
    await runResultSequence(outcome === "win");

  } else {
    // LOSS: group wiggle to show error
    railEl.classList.add("resolve-error");

    await delay(2000); // 2s pause after wiggle

    // Show Try Again modal
    showLossModal();
  }
} 

  function checkIfReadyToValidate() {
    const puzzle = puzzles[currentPuzzleIndex];
    const slots = railEl.querySelectorAll(".slot");

    // Are all slots filled?
    if (slotState.length !== puzzle.slots) {
      return;
    }

    // Build token list in slot order
    const tokens = Array.from(slots).map((slot) => {
      const slotIndex = Number(slot.dataset.slotIndex);
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
    // tokens = your full attack sentence
    // e.g. ["1", "+", "1", "=", "2"]

    // 1) Ensure exactly one "=" token
    const eqIndices = tokens
      .map((t, idx) => (t === "=" ? idx : -1))
      .filter((idx) => idx >= 0);

    if (eqIndices.length !== 1) {
      return { valid: false, message: "Try using only one equals sign." };
    }

    const eqIndex = eqIndices[0];

    // 2) Split into attack side (left) and result side (right)
    const attackTokens = tokens.slice(0, eqIndex);
    const resultTokens = tokens.slice(eqIndex + 1);

    if (attackTokens.length === 0 || resultTokens.length === 0) {
      return { valid: false, message: "Both sides need numbers." };
    }

    // 3) Evaluate numeric meaning of each side
    const attackPower = evalSimpleSide(attackTokens);   // total attack
    const finalDamage = evalSimpleSide(resultTokens);   // declared damage

    if (attackPower === null || finalDamage === null) {
      return {
        valid: false,
        message: "That doesn’t look like an attack sentence yet.",
      };
    }

    // 4) Core rule: attack must match declared damage
    if (attackPower === finalDamage) {
      return {
        valid: true,
        combat: {
          attackPower,
          finalDamage,
        },
      };
    }

    return {
      valid: false,
      message: "That attack doesn’t balance yet.",
      combat: { attackPower, finalDamage },
    };
  }

  // Only supports forms: A op B, e.g. 1 + 1 or 4 - 2
  function evalSimpleSide(sideTokens) {
    if (sideTokens.length === 1 && isNumber(sideTokens[0])) {
      return Number(sideTokens[0]);
    }

    if (sideTokens.length !== 3) return null;
    const [a, op, b] = sideTokens;

    if (!isNumber(a) || !isNumber(b)) return null;
    const n1 = Number(a);
    const n2 = Number(b);

    if (op === "+") return n1 + n2;
    if (op === "-") return n1 - n2;

    return null;
  }

  function isNumber(str) {
    return /^[0-9]+$/.test(str);
  }

  // --- Init ----------------------------------------------------------------
  // --- Init ----------------------------------------------------------------
  function init() {
    resetPuzzle();
    updateOrientationOverlay();
    hideCards(); // start without cards visible

    if (DEBUG_OUTCOME) {
      // 🔧 Debug mode: jump straight to RESULT cinematic
      setStage("result");
      showCinematic();
      resetCinematicSprites();
      renderStatPanels(DEBUG_OUTCOME);

      // Fire the result sequence (win/lose) immediately
      runResultSequence(DEBUG_OUTCOME === "win");
    } else {
      // Normal flow: Intro → Cards → Result
      runIntroSequence();
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

