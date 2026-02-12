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

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ============================================================
  // Placement helpers (SOLUTION-AWARE)  ✅ single source of truth
  // ============================================================

  function setFixed(cells, fixed, r, c, v, solution) {
    const i = idx(r, c);
    const s = String(v);
    if (solution) solution[i] = s;
    cells[i] = s;
    fixed.add(i);
  }

  function setOpFixed(cells, fixed, r, c, ch, solution) {
    const i = idx(r, c);
    if (solution) solution[i] = ch;
    cells[i] = ch;
    fixed.add(i);
  }

  function placeHorizontal(cells, fixed, r, { A, B, C }, blanks, solution) {
    setOpFixed(cells, fixed, r, 1, "+", solution);
    setOpFixed(cells, fixed, r, 3, "=", solution);

    if (solution) {
      solution[idx(r, 0)] = String(A);
      solution[idx(r, 2)] = String(B);
      solution[idx(r, 4)] = String(C);
    }

    if (!blanks.A) setFixed(cells, fixed, r, 0, A, solution);
    if (!blanks.B) setFixed(cells, fixed, r, 2, B, solution);
    if (!blanks.C) setFixed(cells, fixed, r, 4, C, solution);
  }

  function placeVertical(cells, fixed, c, { A, B, C }, blanks, solution) {
    setOpFixed(cells, fixed, 1, c, "+", solution);
    setOpFixed(cells, fixed, 3, c, "=", solution);

    if (solution) {
      solution[idx(0, c)] = String(A);
      solution[idx(2, c)] = String(B);
      solution[idx(4, c)] = String(C);
    }

    if (!blanks.A) setFixed(cells, fixed, 0, c, A, solution);
    if (!blanks.B) setFixed(cells, fixed, 2, c, B, solution);
    if (!blanks.C) setFixed(cells, fixed, 4, c, C, solution);
  }

  // Build 5-card hand = correct tokens + decoys (always size 5)
  function buildHand(correctValues, min, max, { trapDecoy } = {}) {
    const hand = correctValues.map(String);

    if (trapDecoy != null && hand.length < 5) {
      const t = String(trapDecoy);
      if (!hand.includes(t)) hand.push(t);
    }

    while (hand.length < 5) {
      const n = randInt(min, max);
      const s = String(n);
      if (!hand.includes(s)) hand.push(s);
    }

    shuffle(hand);
    return hand;
  }

  // ============================================================
  // Validation (declared equations)
  // ============================================================

  function validatePuzzle(puz) {
    let allComplete = true;
    let allCorrect = true;

    for (const eq of puz.equations) {
      const result = validateEquation(eq, puz.cells);
      if (!result.complete) allComplete = false;
      if (result.complete && !result.ok) allCorrect = false;
    }

    return { complete: allComplete, ok: allComplete && allCorrect };
  }

  function validateEquation(eq, cells) {
    let A, OP, B, EQ, C;

    if (eq.type === "horizontal") {
      const r = eq.row;
      A = cells[idx(r, 0)];
      OP = cells[idx(r, 1)];
      B = cells[idx(r, 2)];
      EQ = cells[idx(r, 3)];
      C = cells[idx(r, 4)];
    } else if (eq.type === "vertical") {
      const c = eq.col;
      A = cells[idx(0, c)];
      OP = cells[idx(1, c)];
      B = cells[idx(2, c)];
      EQ = cells[idx(3, c)];
      C = cells[idx(4, c)];
    } else {
      return { complete: true, ok: false };
    }

    if (!A || !OP || !B || !EQ || !C) return { complete: false, ok: false };
    if (OP !== "+" || EQ !== "=") return { complete: true, ok: false };
    if (!isNum(A) || !isNum(B) || !isNum(C)) return { complete: true, ok: false };

    const a = parseInt(A, 10);
    const b = parseInt(B, 10);
    const cVal = parseInt(C, 10);
    return { complete: true, ok: a + b === cVal };
  }

  function getSolvedHorizontalRows(puz) {
    const rows = [];
    for (const eq of puz.equations) {
      if (eq.type !== "horizontal") continue;
      const res = validateEquation(eq, puz.cells);
      if (res.complete && res.ok) rows.push(eq.row);
    }
    return rows;
  }

  // ============================================================
  // Levels 1–10 (now all return solution[])
  // ============================================================

  function makePuzzle({ level = 1 } = {}) {
    if (level <= 1) return makeLevel1();
    if (level === 2) return makeLevel2();
    if (level === 3) return makeLevel3();
    if (level === 4) return makeLevel4();
    if (level === 5) return makeLevel5();
    if (level === 6) return makeLevel6();
    if (level === 7) return makeLevel7();
    if (level === 8) return makeLevel8();
    if (level === 9) return makeLevel9();
    return makeLevel10();
  }

  function makeLevel1() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const A = randInt(1, 9);
    const B = randInt(1, 9);
    const C = A + B;

    const row = 2;
    placeHorizontal(cells, fixed, row, { A, B, C }, { A: false, B: true, C: false }, solution);

    const hand = buildHand([B], 1, 9);

    return { cells, solution, fixed, hand, equations: [{ type: "horizontal", row }] };
  }

  function makeLevel2() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    let Ah, Av, B, Ch, Cv;
    for (let tries = 0; tries < 300; tries++) {
      B = randInt(1, 5);
      Ah = randInt(1, 4);
      Av = randInt(1, 4);
      Ch = Ah + B;
      Cv = Av + B;
      if (Ch <= 9 && Cv <= 9) break;
    }

    const row = 2;
    const col = 2;

    placeHorizontal(cells, fixed, row, { A: Ah, B, C: Ch }, { A: false, B: true, C: true }, solution);
    placeVertical(cells, fixed, col, { A: Av, B, C: Cv }, { A: false, B: true, C: false }, solution);

    const hand = buildHand([B, Ch], 1, 9);

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row },
        { type: "vertical", col },
      ],
    };
  }

  function makeLevel3() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const B = randInt(1, 20);
    const Ah = randInt(1, 20);
    const Av = randInt(1, 20);
    const Ch = Ah + B;
    const Cv = Av + B;

    const row = 2;
    const col = 2;

    placeHorizontal(cells, fixed, row, { A: Ah, B, C: Ch }, { A: false, B: true, C: true }, solution);
    placeVertical(cells, fixed, col, { A: Av, B, C: Cv }, { A: false, B: true, C: false }, solution);

    const hand = buildHand([B, Ch], 1, 40);

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row },
        { type: "vertical", col },
      ],
    };
  }

  function makeLevel4() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    let Av, Bv, Cv, A0, C0, A4, C4;
    for (let tries = 0; tries < 800; tries++) {
      Av = randInt(1, 30);
      Bv = randInt(1, 30);
      Cv = Av + Bv;
      if (Cv > 99) continue;

      A0 = randInt(1, 30);
      C0 = A0 + Av;
      if (C0 > 99) continue;

      A4 = randInt(1, 30);
      C4 = A4 + Cv;
      if (C4 > 99) continue;

      break;
    }

    const col = 2;

    placeVertical(cells, fixed, col, { A: Av, B: Bv, C: Cv }, { A: true, B: true, C: true }, solution);
    placeHorizontal(cells, fixed, 0, { A: A0, B: Av, C: C0 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 4, { A: A4, B: Cv, C: C4 }, { A: false, B: true, C: false }, solution);

    const hand = buildHand([Av, Bv, Cv], 1, 60);

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "vertical", col },
        { type: "horizontal", row: 0 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  function makeLevel5() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    let Av, Bv, Cv, A0, C0, A4, C4;
    for (let tries = 0; tries < 2000; tries++) {
      Av = randInt(10, 49);
      Bv = randInt(10, 49);
      Cv = Av + Bv;
      if (Cv > 99) continue;

      A0 = randInt(10, 49);
      C0 = A0 + Av;
      if (C0 > 99) continue;

      A4 = randInt(10, 49);
      C4 = A4 + Cv;
      if (C4 > 99) continue;

      break;
    }

    const col = 2;

    placeVertical(cells, fixed, col, { A: Av, B: Bv, C: Cv }, { A: true, B: true, C: true }, solution);
    placeHorizontal(cells, fixed, 0, { A: A0, B: Av, C: C0 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 4, { A: A4, B: Cv, C: C4 }, { A: false, B: true, C: false }, solution);

    const hand = buildHand([Av, Bv, Cv], 10, 99);

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "vertical", col },
        { type: "horizontal", row: 0 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  // -------- Levels 6–10 frame generator --------

  function genFrame({ min, max, requireV2 }) {
    for (let tries = 0; tries < 6000; tries++) {
      const A00 = randInt(min, max);

      const X = randInt(min, max);
      const C04 = A00 + X;
      if (C04 > 99) continue;

      const Y = randInt(min, max);
      const C40 = A00 + Y;
      if (C40 > 99) continue;

      const W = randInt(min, max);
      const C44 = C04 + W;
      if (C44 > 99) continue;

      const Z = W - Y;
      if (Z < min || Z > max) continue;

      const B42 = C44 - C40;
      if (B42 < min || B42 > max) continue;

      if (requireV2) {
        if (X + Z !== B42) continue;
      }

      return { A00, X, Y, Z, W, C04, C40, B42, C44 };
    }

    return {
      A00: 10, X: 10, Y: 10, Z: 10, W: 20,
      C04: 20, C40: 20, B42: 10, C44: 30
    };
  }

  function makeLevel6() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const v = genFrame({ min: 10, max: 69, requireV2: false });

    placeHorizontal(cells, fixed, 0, { A: v.A00, B: v.X, C: v.C04 }, { A: false, B: true, C: false }, solution);
    placeVertical(cells, fixed, 0, { A: v.A00, B: v.Y, C: v.C40 }, { A: false, B: true, C: false }, solution);

    placeHorizontal(cells, fixed, 2, { A: v.Y, B: v.Z, C: v.W }, { A: true, B: true, C: true }, solution);
    placeVertical(cells, fixed, 4, { A: v.C04, B: v.W, C: v.C44 }, { A: false, B: true, C: false }, solution);

    placeHorizontal(cells, fixed, 4, { A: v.C40, B: v.B42, C: v.C44 }, { A: false, B: false, C: false }, solution);
    setFixed(cells, fixed, 4, 2, v.B42, solution);

    const hand = buildHand([v.X, v.Y, v.Z, v.W], 10, 99);

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row: 0 },
        { type: "vertical", col: 0 },
        { type: "horizontal", row: 2 },
        { type: "vertical", col: 4 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  function makeLevel7() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const v = genFrame({ min: 10, max: 79, requireV2: true });

    placeHorizontal(cells, fixed, 0, { A: v.A00, B: v.X, C: v.C04 }, { A: false, B: true, C: false }, solution);
    placeVertical(cells, fixed, 0, { A: v.A00, B: v.Y, C: v.C40 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 2, { A: v.Y, B: v.Z, C: v.W }, { A: true, B: true, C: true }, solution);
    placeVertical(cells, fixed, 4, { A: v.C04, B: v.W, C: v.C44 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 4, { A: v.C40, B: v.B42, C: v.C44 }, { A: false, B: false, C: false }, solution);

    placeVertical(cells, fixed, 2, { A: v.X, B: v.Z, C: v.B42 }, { A: true, B: true, C: false }, solution);
    setFixed(cells, fixed, 4, 2, v.B42, solution);

    const hand = buildHand([v.X, v.Y, v.Z, v.W], 10, 99);

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row: 0 },
        { type: "vertical", col: 0 },
        { type: "horizontal", row: 2 },
        { type: "vertical", col: 2 },
        { type: "vertical", col: 4 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  function makeLevel8() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const v = genFrame({ min: 10, max: 89, requireV2: true });

    placeHorizontal(cells, fixed, 0, { A: v.A00, B: v.X, C: v.C04 }, { A: false, B: true, C: false }, solution);
    placeVertical(cells, fixed, 0, { A: v.A00, B: v.Y, C: v.C40 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 2, { A: v.Y, B: v.Z, C: v.W }, { A: true, B: true, C: true }, solution);
    placeVertical(cells, fixed, 4, { A: v.C04, B: v.W, C: v.C44 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 4, { A: v.C40, B: v.B42, C: v.C44 }, { A: false, B: false, C: false }, solution);
    placeVertical(cells, fixed, 2, { A: v.X, B: v.Z, C: v.B42 }, { A: true, B: true, C: false }, solution);
    setFixed(cells, fixed, 4, 2, v.B42, solution);

    const trap = (v.Z + 1 <= 99) ? (v.Z + 1) : (v.Z - 1);
    const hand = buildHand([v.X, v.Y, v.Z, v.W], 10, 99, { trapDecoy: trap });

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row: 0 },
        { type: "vertical", col: 0 },
        { type: "horizontal", row: 2 },
        { type: "vertical", col: 2 },
        { type: "vertical", col: 4 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  function makeLevel9() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const v = genFrame({ min: 10, max: 99, requireV2: true });

    placeHorizontal(cells, fixed, 0, { A: v.A00, B: v.X, C: v.C04 }, { A: false, B: true, C: false }, solution);
    placeVertical(cells, fixed, 0, { A: v.A00, B: v.Y, C: v.C40 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 2, { A: v.Y, B: v.Z, C: v.W }, { A: true, B: true, C: true }, solution);
    placeVertical(cells, fixed, 4, { A: v.C04, B: v.W, C: v.C44 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 4, { A: v.C40, B: v.B42, C: v.C44 }, { A: false, B: false, C: false }, solution);
    placeVertical(cells, fixed, 2, { A: v.X, B: v.Z, C: v.B42 }, { A: true, B: true, C: false }, solution);
    setFixed(cells, fixed, 4, 2, v.B42, solution);

    const trap = (v.W - 1 >= 10) ? (v.W - 1) : (v.W + 1);
    const hand = buildHand([v.X, v.Y, v.Z, v.W], 10, 99, { trapDecoy: trap });

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row: 0 },
        { type: "vertical", col: 0 },
        { type: "horizontal", row: 2 },
        { type: "vertical", col: 2 },
        { type: "vertical", col: 4 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  function makeLevel10() {
    const cells = Array(SIZE * SIZE).fill(null);
    const solution = Array(SIZE * SIZE).fill(null);
    const fixed = new Set();

    const v = genFrame({ min: 10, max: 99, requireV2: true });

    placeHorizontal(cells, fixed, 0, { A: v.A00, B: v.X, C: v.C04 }, { A: false, B: true, C: false }, solution);
    placeVertical(cells, fixed, 0, { A: v.A00, B: v.Y, C: v.C40 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 2, { A: v.Y, B: v.Z, C: v.W }, { A: true, B: true, C: true }, solution);
    placeVertical(cells, fixed, 4, { A: v.C04, B: v.W, C: v.C44 }, { A: false, B: true, C: false }, solution);
    placeHorizontal(cells, fixed, 4, { A: v.C40, B: v.B42, C: v.C44 }, { A: false, B: false, C: false }, solution);
    placeVertical(cells, fixed, 2, { A: v.X, B: v.Z, C: v.B42 }, { A: true, B: true, C: false }, solution);
    setFixed(cells, fixed, 4, 2, v.B42, solution);

    const trap = (v.C04 + 1 <= 99) ? (v.C04 + 1) : (v.C04 - 1);
    const hand = buildHand([v.X, v.Y, v.Z, v.W], 10, 99, { trapDecoy: trap });

    return {
      cells,
      solution,
      fixed,
      hand,
      equations: [
        { type: "horizontal", row: 0 },
        { type: "vertical", col: 0 },
        { type: "horizontal", row: 2 },
        { type: "vertical", col: 2 },
        { type: "vertical", col: 4 },
        { type: "horizontal", row: 4 },
      ],
    };
  }

  // ============================================================
  // UI glue (WRONG CELL = SHAKE + SNAP BACK) ✅
  // ============================================================

  function clearMount(mount) {
    mount.innerHTML = "";
    mount.classList.remove("eq-bad", "eq-shake");
  }

  function createEquationCardsGame({ config = {}, context } = {}) {
    const startLevelRaw =
      config.level ??
      config.playerLevel ??
      context?.playerLevel ??
      context?.level ??
      1;

    let currentLevel = Math.max(1, Math.min(10, Number(startLevelRaw) || 1));

    const mount =
      config.mount ||
      config.host ||
      document.getElementById("grid-area") ||
      document.body;

    let cleanupFns = [];

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
        mount.classList.remove("eq-bad", "eq-shake");
      }
    }

    async function start() {
      return new Promise((resolve) => {
        if (!mount) {
          resolve({ outcome: "lose" });
          return;
        }

        let finished = false;
        let mistakes = 0;

        function finish(outcome, extra = {}) {
          if (finished) return;
          finished = true;
          destroy();
          resolve({
            outcome,
            mistakes,
            ...extra,
          });
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

        const puz = makePuzzle({ level: currentLevel });

        function restartClass(el, className) {
          el.classList.remove(className);
          void el.offsetWidth;
          el.classList.add(className);
        }

        function shakeBad() {
          restartClass(mount, "eq-bad");
          restartClass(mount, "eq-shake");
        }

        function bumpMistakeAndMaybeEnd() {
          mistakes += 1;
          if (mistakes >= 2) {
            finish("lose", { reason: "two-mistakes" });
          }
        }

        function clearHover() {
          mount
            .querySelectorAll(".eq-cell.drop-hover")
            .forEach((el) => el.classList.remove("drop-hover"));
        }

        function cellFromPoint(x, y) {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          const cell = el.closest(".eq-cell");
          if (!cell) return null;
          if (cell.classList.contains("is-fixed")) return null;
          return cell;
        }

        function celebrateSolvedRows(rows) {
          const rowSet = new Set(rows);
          const cells = mount.querySelectorAll(".eq-cell");
          cells.forEach((btn) => {
            const i = parseInt(btn.dataset.cellIndex, 10);
            const r = Math.floor(i / SIZE);
            if (rowSet.has(r)) btn.classList.add("eq-row-win");
          });

          setTimeout(() => {
            const cells2 = mount.querySelectorAll(".eq-cell.eq-row-win");
            cells2.forEach((btn) => btn.classList.remove("eq-row-win"));
          }, 900);
        }

        function revertPlacement(cellIndex, handIndex, token) {
          puz.cells[cellIndex] = null;
          puz.hand[handIndex] = token;
          render();
        }

        // ✅ Primary rule: WRONG CELL -> shake + revert + mistake
        function placeToken(cellIndex, handIndex) {
          const token = puz.hand[handIndex];
          if (token == null) return false;
          if (puz.cells[cellIndex] != null) return false;

          const expected = puz.solution ? puz.solution[cellIndex] : null;

          // If cell isn't part of solution, or wrong value -> reject immediately
          if (!expected || String(token) !== String(expected)) {
            shakeBad();
            bumpMistakeAndMaybeEnd();
            return true; // handled; card stays in hand (snap back)
          }

          // apply
          puz.cells[cellIndex] = token;
          puz.hand[handIndex] = null;
          render();

          // If puzzle fully solved correctly => win
          const res = validatePuzzle(puz);
          if (res.complete && res.ok) {
            const solvedRows = getSolvedHorizontalRows(puz);
            celebrateSolvedRows(solvedRows);
            setTimeout(() => {
              finish("win", { solvedRows });
            }, 350);
            return true;
          }

          return true;
        }

        function render() {
          cleanupFns.forEach((fn) => fn());
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
              if (finished) return;
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

              const moveGhost = (x, y) => {
                ghost.style.transform =
                  `translate(${x - ghost.offsetWidth / 2}px, ${y - ghost.offsetHeight / 2}px) scale(1.06)`;
              };

              moveGhost(ev.clientX, ev.clientY);

              const onMove = (e) => {
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
                  placeToken(ci, hi);
                }

                card.classList.remove("is-dragging");
                ghost.remove();
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