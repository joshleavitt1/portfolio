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

  const railEl = document.getElementById("equation-rail");
  const handEl = document.getElementById("card-hand");

  // Modal elements
  const modalEl = document.getElementById("result-modal");
  const modalTitleEl = document.getElementById("modal-title");
  const modalMessageEl = document.getElementById("modal-message");
  const modalPrimaryBtn = document.getElementById("modal-primary-btn");

  // Orientation overlay
  const orientationOverlayEl = document.getElementById("orientation-overlay");

  let modalState = null; // "success" | "error" | null

  // --- Drag state ----------------------------------------------------------
  let cardIdCounter = 0;
  const createCardId = () => `card_${cardIdCounter++}`;

  let activeDrag = null;
  // activeDrag = { card, cardEl, offsetX, offsetY, pointerId }
  let highlightedSlot = null;

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

  // --- Modal helpers -------------------------------------------------------
  function showResultModal(type, message) {
    modalState = type;

    if (type === "success") {
      modalTitleEl.textContent = "Nice! That works!";
      modalMessageEl.textContent = "Want to try another one?";
      modalPrimaryBtn.textContent = "Play Another";
    } else {
      modalTitleEl.textContent = "That doesn’t balance yet.";
      modalMessageEl.textContent =
        message || "Try moving the cards around and balance both sides.";
      modalPrimaryBtn.textContent = "Try Again";
    }

    modalEl.classList.add("show");
    modalEl.setAttribute("aria-hidden", "false");
  }

  function hideResultModal() {
    modalEl.classList.remove("show");
    modalEl.setAttribute("aria-hidden", "true");
    modalState = null;
  }

  modalPrimaryBtn.addEventListener("click", () => {
    if (modalState === "success") {
      currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzles.length;
      renderPuzzle();
    }
    hideResultModal();
  });

  // Optional: click backdrop to close error state only
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl && modalState === "error") {
      hideResultModal();
    }
  });

  // --- Render functions ----------------------------------------------------
  function renderPuzzle() {
    const puzzle = puzzles[currentPuzzleIndex];
    slotState = [];
    cardState = [];
    highlightedSlot = null;
    railEl.innerHTML = "";
    handEl.innerHTML = "";
    hideResultModal();

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
      handEl.appendChild(cardEl);
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
          handEl.appendChild(existingCardEl);
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
      showResultModal("success");
    } else {
      wiggleSlots();
      showResultModal("error", result.message);
    }
  }

  function validateEquation(tokens) {
    // Ensure exactly one '=' token
    const eqIndices = tokens
      .map((t, idx) => (t === "=" ? idx : -1))
      .filter((idx) => idx >= 0);

    if (eqIndices.length !== 1) {
      return { valid: false, message: "Try using only one equals sign." };
    }

    const eqIndex = eqIndices[0];
    const leftTokens = tokens.slice(0, eqIndex);
    const rightTokens = tokens.slice(eqIndex + 1);

    if (leftTokens.length === 0 || rightTokens.length === 0) {
      return { valid: false, message: "Both sides need numbers." };
    }

    const leftVal = evalSimpleSide(leftTokens);
    const rightVal = evalSimpleSide(rightTokens);

    if (leftVal === null || rightVal === null) {
      return {
        valid: false,
        message: "That doesn’t look like a math sentence yet.",
      };
    }

    if (leftVal === rightVal) {
      return { valid: true };
    }

    return { valid: false, message: "That doesn’t balance yet." };
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

  function wiggleSlots() {
    const slots = railEl.querySelectorAll(".slot");
    slots.forEach((slot) => {
      slot.classList.remove("wiggle");
      // force reflow
      void slot.offsetWidth;
      slot.classList.add("wiggle");
    });
  }

  // --- Init ----------------------------------------------------------------
  renderPuzzle();
  updateOrientationOverlay();
})();

window.addEventListener("load", () => {
  setTimeout(updateOrientationOverlay, 100);
});

