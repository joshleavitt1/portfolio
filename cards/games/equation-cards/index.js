// games/equation-cards/index.js
(function () {
  "use strict";

  const SIZE = 5;

  function idx(r, c) {
    return r * SIZE + c;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function isNum(t) {
    return typeof t === "string" && /^\d+$/.test(t);
  }

  // Goal:
  // - 5x5 board is visible
  // - vertical equation lives in targetCol:
  //     row0: A (fixed)
  //     row1: + (fixed)
  //     row2: B (empty, from hand)
  //     row3: = (fixed)
  //     row4: C (empty, from hand)
  // - clue row (like your example): row1 col0 = A, row1 col2 = C (fixed)
  function makePuzzle({ targetCol = 1 } = {}) {
    // Allow 1–99 (two digits). Keep sums within 99 for now.
    const A = randInt(1, 49);
    const B = randInt(1, 50);
    const C = A + B; // 2..99

    const cells = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    // Vertical equation (target column)
    cells[idx(0, targetCol)] = String(A); fixed.add(idx(0, targetCol));
    cells[idx(1, targetCol)] = "+";       fixed.add(idx(1, targetCol));
    cells[idx(3, targetCol)] = "=";       fixed.add(idx(3, targetCol));
    // row2 (B) empty
    // row4 (C) empty

    // Clue row (matches your “1 + 4” idea)
    // If targetCol is 1, this becomes: [A] [+] [C] on row 1
    cells[idx(1, 0)] = String(A); fixed.add(idx(1, 0));
    cells[idx(1, 2)] = String(C); fixed.add(idx(1, 2));

    // Hand of 5: must include correct B and C, plus 3 decoys
    const hand = [];
    hand.push(String(B));
    hand.push(String(C));

    while (hand.length < 5) {
      // Decoys: numbers 1–99, avoid duplicates and avoid accidentally adding B/C again
      const n = randInt(1, 99);
      const s = String(n);
      if (!hand.includes(s)) hand.push(s);
    }

    // Shuffle
    for (let i = hand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hand[i], hand[j]] = [hand[j], hand[i]];
    }

    return {
      targetCol,
      cells,
      fixed,
      hand,
      equation: { aRow: 0, opRow: 1, bRow: 2, eqRow: 3, cRow: 4 },
    };
  }

  function validatePuzzle(puz) {
    const col = puz.targetCol;
    const { aRow, opRow, bRow, eqRow, cRow } = puz.equation;

    const A = puz.cells[idx(aRow, col)];
    const OP = puz.cells[idx(opRow, col)];
    const B = puz.cells[idx(bRow, col)];
    const EQ = puz.cells[idx(eqRow, col)];
    const C = puz.cells[idx(cRow, col)];

    if (!A || !OP || !B || !EQ || !C) return { complete: false, ok: false };
    if (OP !== "+" || EQ !== "=") return { complete: true, ok: false };
    if (!isNum(A) || !isNum(B) || !isNum(C)) return { complete: true, ok: false };

    const a = parseInt(A, 10);
    const b = parseInt(B, 10);
    const c = parseInt(C, 10);
    return { complete: true, ok: a + b === c };
  }

  function clearMount(mount) {
    mount.innerHTML = "";
    mount.classList.remove("eq-bad");
  }

  function createEquationCardsGame({ config = {}, context } = {}) {
    const mount =
      config.mount ||
      config.host ||
      document.getElementById("grid-area") ||
      document.body;

    let cleanupFns = [];
    let finished = false;

    function addCleanup(fn) {
      cleanupFns.push(fn);
    }

    function destroy() {
      try { cleanupFns.forEach((fn) => fn()); } catch (e) {}
      cleanupFns = [];
      if (mount) {
        const grid = mount.querySelector(".eq-grid");
        const hand = mount.querySelector(".eq-hand");
        if (grid) grid.remove();
        if (hand) hand.remove();
        mount.classList.remove("eq-bad");
      }
    }

    async function start() {
      return new Promise((resolve) => {
        if (!mount) {
          resolve({ outcome: "lose" });
          return;
        }

        let gridEl = mount.querySelector(".eq-grid");
        let handEl = mount.querySelector(".eq-hand");

        mount.classList.remove("is-hidden");

        if (!gridEl || !handEl) {
          clearMount(mount);

          gridEl = document.createElement("div");
          gridEl.className = "eq-grid";
          mount.appendChild(gridEl);

          handEl = document.createElement("div");
          handEl.className = "eq-hand";
          mount.appendChild(handEl);
        }

        const puz = makePuzzle({ targetCol: 1 });

        function finish(outcome) {
          if (finished) return;
          finished = true;
          resolve({ outcome });
        }

        function flashBad() {
          mount.classList.remove("eq-bad");
          void mount.offsetWidth;
          mount.classList.add("eq-bad");
        }

        let drag = null; // { hi, token, ghostEl }

        function clearHover() {
          mount.querySelectorAll(".eq-cell.drop-hover")
            .forEach(el => el.classList.remove("drop-hover"));
        }

        function cellFromPoint(x, y) {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          const cell = el.closest(".eq-cell");
          if (!cell) return null;
          if (cell.classList.contains("is-fixed")) return null;
          return cell;
        }

        function placeToken(cellIndex, handIndex) {
          const token = puz.hand[handIndex];
          if (token == null) return false;
          if (puz.cells[cellIndex] != null) return false;

          puz.cells[cellIndex] = token;
          puz.hand[handIndex] = null;
          render();

          const res = validatePuzzle(puz);
          if (res.complete && res.ok) {
            setTimeout(() => finish("win"), 250);
          } else if (res.complete && !res.ok) {
            flashBad();
            setTimeout(() => finish("lose"), 450);
          }
          return true;
        }


        function render() {
          cleanupFns.forEach(fn => fn());
          cleanupFns = [];
        
          gridEl.innerHTML = "";

          for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
              const i = idx(r, c);

              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "eq-cell";
              btn.dataset.cellIndex = String(i);

              const v = puz.cells[i];
              if (v != null) {
                btn.textContent = v;
                btn.classList.add("has-token");
              } else {
                btn.textContent = "";
                btn.classList.remove("has-token");
              }

              if (puz.fixed.has(i)) {
                btn.classList.add("is-fixed");
                btn.disabled = true;
              } else {
                btn.disabled = false;
              }              

              gridEl.appendChild(btn);
            }
          }

          handEl.innerHTML = "";
          puz.hand.forEach((token, hi) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "eq-card";
            card.dataset.handIndex = String(hi);

            if (token == null) {
              card.classList.add("is-used");
              card.disabled = true;
              card.textContent = "";
            } else {
              card.textContent = token;
              card.disabled = false;
            }
            card.style.touchAction = "none";

            const onDown = (ev) => {
              if (puz.hand[hi] == null) return;
            
              ev.preventDefault();

              card.classList.add("is-dragging");

              const ghost = card.cloneNode(true);
              ghost.classList.add("drag-ghost");
              ghost.style.left = "0px";
              ghost.style.top = "0px";
              ghost.style.transform = "translate(-9999px, -9999px) scale(1.06)";
              ghost.style.position = "fixed";
              ghost.style.pointerEvents = "none";
              ghost.style.zIndex = "9999";
              ghost.style.width = card.offsetWidth + "px";
              ghost.style.height = card.offsetHeight + "px";
              document.body.appendChild(ghost);
            
              drag = { hi, ghost };
            
              const moveGhost = (x, y) => {
                ghost.style.transform =
                  `translate(${x - ghost.offsetWidth / 2}px, ${y - ghost.offsetHeight / 2}px) scale(1.06)`;
              };              
            
              moveGhost(ev.clientX, ev.clientY);
            
              const onMove = (e) => {
                if (!drag) return;
            
                moveGhost(e.clientX, e.clientY);
            
                clearHover();
                const cell = cellFromPoint(e.clientX, e.clientY);
                if (cell) cell.classList.add("drop-hover");
              };
            
              const onUp = (e) => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
            
                clearHover();
            
                const cell = cellFromPoint(e.clientX, e.clientY);
                if (cell) {
                  const ci = parseInt(cell.dataset.cellIndex, 10);
                  const ok = placeToken(ci, hi);
                  if (!ok) flashBad();
                }
            
                card.classList.remove("is-dragging");
                ghost.remove();
                drag = null;
              };
            
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            };
            
            card.addEventListener("pointerdown", onDown);
            addCleanup(() => card.removeEventListener("pointerdown", onDown));
            

            handEl.appendChild(card);
          });
        }

        render();
      });
    }

    return { start, destroy };
  }

  if (window.GameRegistry && typeof window.GameRegistry.register === "function") {
    window.GameRegistry.register("equation-cards", createEquationCardsGame);
  } else {
    console.error("[EquationCards] GameRegistry missing. Did registry.js load first?");
  }
})();
