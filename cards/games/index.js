// games/number-blast/index.js
(function () {
  "use strict";

  const DEFAULT_SIZE = 5;
  const HAND_SIZE = 1;
  const LEVEL_MAX = 20;
  const ROW_EXPLODE_MS = 420;
  let shouldAnimateBoardSpawn = false;

  const WINS_KEY = "NB_GAME_WINS";
  const RUN_ROUNDS = 15;
  const NB_DIFFICULTY_KEY = "NB_CURRENT_DIFFICULTY";
  const NB_DIFFICULTY_WINS_KEY = "NB_DIFFICULTY_WINS";
  const NB_RUN_WINS_KEY = "NB_RUN_WINS";

  const SHAPES = [
    { id: "s1", cells: [{ x: 0, y: 0 }] },
    { id: "h2", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    { id: "v2", cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
    { id: "h3", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
    { id: "v3", cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] },
    { id: "l3a", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
    { id: "l3b", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
    { id: "l3c", cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
    { id: "l3d", cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
    { id: "sq4", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  ];

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function idx(state, r, c) {
    return r * state.size + c;
  }

  function rc(state, i) {
    return { r: Math.floor(i / state.size), c: i % state.size };
  }

  function readNumber(key, fallback) {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) ? n : fallback;
    } catch (e) {}
    return fallback;
  }

  function writeNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {}
  }

  function readWins() {
    try {
      return Math.max(0, Number(localStorage.getItem(WINS_KEY) || 0) || 0);
    } catch (e) {}
    return 0;
  }

  function writeWins(n) {
    try {
      localStorage.setItem(WINS_KEY, String(Math.max(0, n | 0)));
    } catch (e) {}
  }

  function getNumberColorClass(value) {
    if (value === 1 || value === 6) return "nb-c1";
    if (value === 2 || value === 7) return "nb-c2";
    if (value === 3 || value === 8) return "nb-c3";
    if (value === 4 || value === 9) return "nb-c4";
    return "nb-c5";
  }

  function shapeWeight(shapeId, level) {
    if (shapeId === "s1") return level <= 2 ? 14 : 8;
    if (shapeId === "h2" || shapeId === "v2") return level <= 4 ? 10 : 8;
    if (shapeId === "h3" || shapeId === "v3") return level <= 6 ? 6 : 8;
    if (shapeId.startsWith("l3")) return level <= 6 ? 4 : 7;
    if (shapeId === "sq4") return level <= 7 ? 3 : 5;
    return 1;
  }

  function weightedPickShape(level, rules) {
    const allow = Array.isArray(rules?.allowShapes) ? rules.allowShapes : null;
    const candidates = [];

    for (const shape of SHAPES) {
      if (allow && !allow.includes(shape.id)) continue;
      const wt = shapeWeight(shape.id, level);
      if (wt > 0) candidates.push({ shape, wt });
    }

    if (!candidates.length) {
      for (const shape of SHAPES) {
        const wt = shapeWeight(shape.id, level);
        if (wt > 0) candidates.push({ shape, wt });
      }
    }

    let total = 0;
    for (const c of candidates) total += c.wt;
    let r = Math.random() * total;

    for (const c of candidates) {
      r -= c.wt;
      if (r <= 0) return c.shape;
    }

    return candidates[candidates.length - 1].shape;
  }

  function normalizePieceCells(cells) {
    let minX = Infinity;
    let minY = Infinity;

    for (const p of cells) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    }

    return cells.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }));
  }

  function levelNumberMax(level) {
    if (level <= 3) return 5;
    if (level <= 7) return 7;
    return 9;
  }

  function randTileValue(state) {
    const min = clamp(Number(state.numberMin || 1) || 1, 1, 9);
    const max = clamp(Number(state.numberMax || levelNumberMax(state.level)) || 5, min, 9);

    if (state.level <= 4) {
      const values = [];
      for (let v = min; v <= max; v++) {
        let weight = 1;
        if (v === min) weight = 10;
        else if (v === min + 1) weight = 7;
        else if (v === min + 2) weight = 4;
        else if (v === min + 3) weight = 2;

        for (let i = 0; i < weight; i++) values.push(v);
      }
      return values[Math.floor(Math.random() * values.length)];
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function makePiece(state, opts = {}) {
    if (opts.forceClearNow) {
      const forced = findGuaranteedClearPiece(state);
      if (forced) return forced;
    }

    const shape = weightedPickShape(state.level, state.rules);
    const norm = normalizePieceCells(shape.cells);

    return {
      id: `${shape.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      shapeId: shape.id,
      cells: norm.map((p) => ({ x: p.x, y: p.y, v: randTileValue(state) })),
    };
  }

  function pieceBounds(piece) {
    let maxX = 0;
    let maxY = 0;
    for (const p of piece.cells) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { w: maxX + 1, h: maxY + 1 };
  }

  function handAllowedWithCandidate(hand, candidate) {
    const cB = pieceBounds(candidate);
    const hasW3 = hand.some((p) => pieceBounds(p).w >= 3) || cB.w >= 3;
    const hasH3 = hand.some((p) => pieceBounds(p).h >= 3) || cB.h >= 3;
  
    const all = hand.slice();
    all.push(candidate);
  
    // never allow more than one exact h2 piece in hand
    if (all.filter((p) => p.shapeId === "h2").length > 1) return false;
  
    if (hasW3) {
      if (all.filter((p) => pieceBounds(p).w >= 2).length > 1) return false;
    }
  
    if (hasH3) {
      if (all.filter((p) => pieceBounds(p).h >= 2).length > 1) return false;
    }
  
    return true;
  }

  function generateHand(state, handSize = HAND_SIZE, maxLargePieces = 1) {
    const hand = [];
    let largeCount = 0;

    for (let i = 0; i < handSize; i++) {
      let piece = null;

      for (let tries = 0; tries < 40; tries++) {
        const candidate = makePiece(state);
        const b = pieceBounds(candidate);
        const isLarge = b.w >= 3 || b.h >= 3;

        if (isLarge && largeCount >= maxLargePieces) continue;
        if (!handAllowedWithCandidate(hand, candidate)) continue;

        piece = candidate;
        if (isLarge) largeCount++;
        break;
      }

      if (!piece) {
        piece = makePiece(state);
      
        for (let tries = 0; tries < 40; tries++) {
          const b = pieceBounds(piece);
          const isLarge = b.w >= 3 || b.h >= 3;
      
          if (isLarge && largeCount >= maxLargePieces) {
            piece = makePiece(state);
            continue;
          }
      
          if (!handAllowedWithCandidate(hand, piece)) {
            piece = makePiece(state);
            continue;
          }
      
          break;
        }
      
        const b2 = pieceBounds(piece);
        if (b2.w >= 3 || b2.h >= 3) largeCount++;
      }

      hand.push(piece);
    }

    return hand;
  }

  function makeGameState(level) {
    const savedDifficulty = clamp(readNumber(NB_DIFFICULTY_KEY, Number(level || 1) || 1), 1, LEVEL_MAX);
    const difficultyRules = window.NumberBlastLevelPlan?.getNumberBlastRules(savedDifficulty) || null;
    const difficultySize = difficultyRules?.boardSize ?? DEFAULT_SIZE;

    const st = {
      level: savedDifficulty,
      forcedSolveCounter: 0,
      size: difficultySize,
      board: Array(difficultySize * difficultySize).fill(null),
      hand: [],
      clears: 0,
      score: 0,
      wins: readWins(),
      roundWins: clamp(readNumber(NB_RUN_WINS_KEY, 0), 0, RUN_ROUNDS),
      difficultyWins: Math.max(0, readNumber(NB_DIFFICULTY_WINS_KEY, 0)),
      numberMin: difficultyRules?.numberMin ?? 1,
      numberMax: difficultyRules?.numberMax ?? levelNumberMax(savedDifficulty),
      targetSum: difficultyRules?.target ?? 10,
      rules: difficultyRules || {},
    };

    const handSize = difficultyRules?.handSize ?? HAND_SIZE;
    const maxLargePieces = difficultyRules?.maxLargePieces ?? 1;
    st.hand = generateHand(st, handSize, maxLargePieces);
    return st;
  }

  function applyBoardPreset(state) {
    const preset = state.rules?.boardPreset;
    if (!Array.isArray(preset) || !preset.length) return;

    state.board = Array(state.size * state.size).fill(null);

    preset.forEach(({ r, c, v }) => {
      if (Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < state.size && c >= 0 && c < state.size) {
        state.board[idx(state, r, c)] = { v };
      }
    });
  }

  function boardHasAutoClear(state) {
    const result = findGroupsToClear(state, state.board);
    return result.groups.length > 0;
  }
  
  function removeAutoClearsFromPreset(state, maxPasses = 12) {
    let pass = 0;
  
    while (pass < maxPasses) {
      const result = findGroupsToClear(state, state.board);
      if (!result.groups.length) return;
  
      // remove one tile from each offending group
      for (const group of result.groups) {
        const indices = group.indices || [];
        if (!indices.length) continue;
  
        // prefer removing the highest-value tile so the shape of the board stays mostly intact
        let removeIndex = indices[0];
        let bestValue = state.board[removeIndex]?.v ?? -1;
  
        for (const i of indices) {
          const v = state.board[i]?.v ?? -1;
          if (v >= bestValue) {
            bestValue = v;
            removeIndex = i;
          }
        }
  
        state.board[removeIndex] = null;
      }
  
      pass += 1;
    }
  }

  function applyPresetHand(state) {
    const presetHand = state.rules?.presetHand;
    if (!Array.isArray(presetHand) || !presetHand.length) return false;

    state.hand = presetHand.map((pieceDef, pieceIndex) => {
      const shapeId = pieceDef?.shapeId || "s1";
      const shape = SHAPES.find((s) => s.id === shapeId) || SHAPES[0];
      const cells = normalizePieceCells(shape.cells).map((cell, cellIndex) => ({
        x: cell.x,
        y: cell.y,
        v: clamp(Number(pieceDef?.values?.[cellIndex]) || 1, 1, 9),
      }));

      return {
        id: `preset_${state.level}_${pieceIndex}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        shapeId,
        cells,
      };
    });

    return true;
  }

  function findGroupsToClear(state, board) {
    const groups = [];
    const hit = new Set();
    const seen = new Set();
    const N = state.size;

    function addGroup(run) {
      const key = run.slice().sort((a, b) => a - b).join(",");
      if (seen.has(key)) return;
      seen.add(key);
      groups.push({ indices: run });
      run.forEach((i) => hit.add(i));
    }

    function scanLine(indices) {
      let start = 0;

      while (start < indices.length) {
        while (start < indices.length && !board[indices[start]]) start++;
        if (start >= indices.length) break;

        let end = start;
        while (end < indices.length && board[indices[end]]) end++;

        for (let i = start; i < end; i++) {
          let sum = 0;
          for (let j = i; j < end; j++) {
            sum += board[indices[j]].v;
            const len = j - i + 1;
            if (len >= 2 && sum === state.targetSum) addGroup(indices.slice(i, j + 1));
            if (sum >= state.targetSum) break;
          }
        }

        start = end;
      }
    }

    for (let r = 0; r < N; r++) {
      const row = [];
      for (let c = 0; c < N; c++) row.push(idx(state, r, c));
      scanLine(row);
    }

    for (let c = 0; c < N; c++) {
      const col = [];
      for (let r = 0; r < N; r++) col.push(idx(state, r, c));
      scanLine(col);
    }

    return { groups, hit };
  }

  function clearHitCells(state, hitSet) {
    hitSet.forEach((i) => {
      state.board[i] = null;
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function applyGravity(state) {
    const moved = [];

    for (let c = 0; c < state.size; c++) {
      for (let r = state.size - 2; r >= 0; r--) {
        const i = idx(state, r, c);
        const below = idx(state, r + 1, c);

        if (!state.board[i] || state.board[below]) continue;

        let targetRow = r;
        while (targetRow + 1 < state.size && !state.board[idx(state, targetRow + 1, c)]) {
          targetRow++;
        }

        if (targetRow !== r) {
          const from = idx(state, r, c);
          const to = idx(state, targetRow, c);
          state.board[to] = state.board[from];
          state.board[from] = null;
          moved.push({ from, to });
        }
      }
    }

    return moved;
  }

  async function resolveBoardChains(state, render, animateBlast, animateGravity, showComboText, gridEl) {
    
    let totalBlasts = 0;
    let chainStep = 0;

    while (true) {
      const { groups, hit } = findGroupsToClear(state, state.board);
      if (!groups.length) break;

      chainStep += 1;
      totalBlasts += groups.length;
      animateBlast(hit, { chainStep, groupCount: groups.length });
      await wait(ROW_EXPLODE_MS + 80);

      clearHitCells(state, hit);
      gridEl.querySelectorAll(".nb-tile.nb-explode-source-hide").forEach((el) => {
        el.classList.remove("nb-explode-source-hide");
      });
      render();
      await wait(140);

      const moved = applyGravity(state);
      render();

      if (moved.length) {
        animateGravity(moved, { chainStep });
        await wait(460);
      }

      if (chainStep >= 2) {
        showComboText(chainStep);
        await wait(320);
      } else {
        await wait(200);
      }
    }

    return totalBlasts;
  }

  function wouldClearAfterPlacement(state, anchor, piece) {
    if (!canPlacePiece(state, anchor, piece)) return false;

    const covered = getCoveredIndices(state, anchor, piece);
    const shadow = state.board.slice();

    for (let k = 0; k < covered.length; k++) {
      shadow[covered[k]] = { v: piece.cells[k].v };
    }

    const { groups } = findGroupsToClear(state, shadow);
    return groups.length > 0;
  }

  function distributeNeededSum(cellCount, total, state) {
    const min = clamp(Number(state.numberMin || 1) || 1, 1, 9);
    const max = clamp(Number(state.numberMax || 9) || 9, min, 9);
    const out = [];
    let remaining = total;

    for (let i = 0; i < cellCount; i++) {
      const cellsLeft = cellCount - i - 1;
      const minHere = Math.max(min, remaining - cellsLeft * max);
      const maxHere = Math.min(max, remaining - cellsLeft * min);
      if (minHere > maxHere) return null;

      let pickValue = minHere;
      if (maxHere > minHere) {
        const choices = [];
        for (let v = minHere; v <= maxHere; v++) {
          const weight = Math.max(1, maxHere - v + 1);
          for (let w = 0; w < weight; w++) choices.push(v);
        }
        pickValue = choices[Math.floor(Math.random() * choices.length)];
      }

      out.push(pickValue);
      remaining -= pickValue;
    }

    return remaining === 0 ? out : null;
  }

  function findGuaranteedClearPiece(state) {
    const allow = Array.isArray(state.rules?.allowShapes) ? state.rules.allowShapes : SHAPES.map((s) => s.id);

    for (const shape of SHAPES) {
      if (!allow.includes(shape.id)) continue;
      const norm = normalizePieceCells(shape.cells);

      for (let bi = 0; bi < state.board.length; bi++) {
        const covered = getCoveredIndices(state, bi, { cells: norm });
        if (!covered || !canPlacePiece(state, bi, { cells: norm })) continue;

        const testCells = covered.map((boardIndex) => {
          const pos = rc(state, boardIndex);
          return { boardIndex, r: pos.r, c: pos.c };
        });

        const rowNeed = new Map();
        const colNeed = new Map();

        for (const cell of testCells) {
          if (!rowNeed.has(cell.r)) rowNeed.set(cell.r, []);
          if (!colNeed.has(cell.c)) colNeed.set(cell.c, []);
          rowNeed.get(cell.r).push(cell.boardIndex);
          colNeed.get(cell.c).push(cell.boardIndex);
        }

        for (const [r, fillIndices] of rowNeed.entries()) {
          let sumExisting = 0;
          let possible = true;

          for (let c = 0; c < state.size; c++) {
            const i = idx(state, r, c);
            if (fillIndices.includes(i)) continue;
            const boardCell = state.board[i];
            if (!boardCell) {
              possible = false;
              break;
            }
            sumExisting += boardCell.v;
          }

          if (!possible) continue;
          const need = state.targetSum - sumExisting;
          if (need < fillIndices.length || need > fillIndices.length * 9) continue;
          const values = distributeNeededSum(fillIndices.length, need, state);
          if (!values) continue;

          return {
            id: `${shape.id}_forced_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            shapeId: shape.id,
            cells: norm.map((p, i) => ({ x: p.x, y: p.y, v: values[i] })),
          };
        }

        for (const [c, fillIndices] of colNeed.entries()) {
          let sumExisting = 0;
          let possible = true;

          for (let r = 0; r < state.size; r++) {
            const i = idx(state, r, c);
            if (fillIndices.includes(i)) continue;
            const boardCell = state.board[i];
            if (!boardCell) {
              possible = false;
              break;
            }
            sumExisting += boardCell.v;
          }

          if (!possible) continue;
          const need = state.targetSum - sumExisting;
          if (need < fillIndices.length || need > fillIndices.length * 9) continue;
          const values = distributeNeededSum(fillIndices.length, need, state);
          if (!values) continue;

          return {
            id: `${shape.id}_forced_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            shapeId: shape.id,
            cells: norm.map((p, i) => ({ x: p.x, y: p.y, v: values[i] })),
          };
        }
      }
    }

    return null;
  }

  function hasClearMove(state) {
    for (let hi = 0; hi < state.hand.length; hi++) {
      const piece = state.hand[hi];
      for (let bi = 0; bi < state.board.length; bi++) {
        if (state.board[bi] != null) continue;
        if (wouldClearAfterPlacement(state, bi, piece)) return true;
      }
    }
    return false;
  }

  function ensurePlayableHand(state, tries = 24) {
    if (!anyMovesAvailable(state)) return false;

    for (let t = 0; t < tries; t++) {
      if (hasClearMove(state)) return true;
      state.hand = generateHand(state);
    }

    return hasClearMove(state);
  }

  function clearMount(mount) {
    mount.innerHTML = "";
    mount.classList.remove("eq-bad", "eq-shake");
  }

  function createNumberBlastGame({ config = {}, context } = {}) {
    const startLevelRaw = config.level ?? config.playerLevel ?? context?.playerLevel ?? context?.level ?? 1;
    const level = clamp(Number(startLevelRaw) || 1, 1, LEVEL_MAX);

    let mount =
      config.mount ||
      config.host ||
      document.getElementById("game-mount") ||
      document.body;

    let cleanupFns = [];
    let activeDrag = null;
    let hoverPreview = new Map();

    function addCleanup(fn) {
      cleanupFns.push(fn);
    }

    function stopActiveDrag() {
      if (!activeDrag) return;
      const { ghost, onMove, onUp, card, pointerId } = activeDrag;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try { card && card.classList.remove("is-dragging"); } catch (e) {}
      try { ghost && ghost.remove(); } catch (e) {}
      try { card && card.releasePointerCapture(pointerId); } catch (e) {}
      activeDrag = null;
    }

    function destroy() {
      stopActiveDrag();
      try {
        cleanupFns.forEach((fn) => {
          try { fn(); } catch (e) {}
        });
      } catch (e) {}
      cleanupFns = [];
      if (mount) {
        mount.innerHTML = "";
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

        function finish(outcome, extra = {}) {
          if (finished) return;
          finished = true;

          const root = mount.closest("#game-root") || document.getElementById("game-root");
          if (root) {
            root.classList.add("eq-exiting");
            void root.offsetHeight;
          }

          queueMicrotask(() => resolve({ outcome, ...extra }));

          setTimeout(() => {
            destroy();
            if (root) root.classList.remove("eq-exiting");
          }, 350);
        }

        clearMount(mount);

        const wrap = document.createElement("div");
        wrap.className = "nb-wrap";
        mount.appendChild(wrap);

        const top = document.createElement("div");
        top.className = "nb-topbar";
        wrap.appendChild(top);

        const boardWrap = document.createElement("div");
        boardWrap.className = "nb-board-wrap";
        wrap.appendChild(boardWrap);

        const sparkLayer = document.createElement("div");
        sparkLayer.className = "nb-spark-layer";
        boardWrap.appendChild(sparkLayer);

        const gridEl = document.createElement("div");
        gridEl.className = "nb-grid";
        boardWrap.appendChild(gridEl);

        const handEl = document.createElement("div");
        handEl.className = "nb-hand";
        const handRail = document.createElement("div");
        handRail.className = "nb-hand-rail";
        handRail.appendChild(handEl);
        wrap.appendChild(handRail);

        const state = makeGameState(level);

        function resetRoundBoard() {
          const latestRules = window.NumberBlastLevelPlan?.getNumberBlastRules(state.level) || {};
          state.rules = latestRules;
          state.size = latestRules.boardSize ?? DEFAULT_SIZE;
          state.numberMin = latestRules.numberMin ?? 1;
          state.numberMax = latestRules.numberMax ?? levelNumberMax(state.level);
          state.targetSum = latestRules.target ?? 10;
          state.board = Array(state.size * state.size).fill(null);
          applyBoardPreset(state);
          removeAutoClearsFromPreset(state);
        
          const handSize = latestRules.handSize ?? HAND_SIZE;
          const maxLargePieces = latestRules.maxLargePieces ?? 1;
          state.hand = generateHand(state, handSize, maxLargePieces);
        
          if (!applyPresetHand(state)) {
            ensurePlayableHand(state, 24);
          }
        
          shouldAnimateBoardSpawn = true;
        }

        resetRoundBoard();

        function restartClass(el, className) {
          el.classList.remove(className);
          void el.offsetWidth;
          el.classList.add(className);
        }

        function shakeBad() {
          restartClass(mount, "eq-bad");
          restartClass(mount, "eq-shake");
        }

        function showComboText() {}

        function getPointerAnchor(clientX, clientY) {
          const biasY = Math.min(window.innerHeight * 0.025, 18);
          return cellIndexFromPointer(clientX, clientY - biasY);
        }

        function getAdjustedAnchor(clientX, clientY, piece, grabCell) {
          const hoverIndex = cellIndexFromPointer(
            clientX,
            clientY - Math.min(window.innerHeight * 0.025, 18)
          );
        
          if (hoverIndex == null || !piece || !grabCell) return hoverIndex;
        
          const hoverRC = rc(state, hoverIndex);
          const anchorR = hoverRC.r - grabCell.y;
          const anchorC = hoverRC.c - grabCell.x;
        
          if (
            anchorR < 0 ||
            anchorC < 0 ||
            anchorR >= state.size ||
            anchorC >= state.size
          ) {
            return null;
          }
        
          return idx(state, anchorR, anchorC);
        }

        function cellIndexFromPointer(x, y) {
          const rect = gridEl.getBoundingClientRect();
          const cellPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-cell")) || 62;
          const gapPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-gap")) || 8;
          const step = cellPx + gapPx;
          const extraX = step * 0.14;
          const extraY = step * 0.14;

          const withinX = x >= rect.left - extraX && x <= rect.right + extraX;
          const withinY = y >= rect.top - extraY && y <= rect.bottom + extraY;
          if (!withinX || !withinY) return null;

          const cx = Math.min(Math.max(x, rect.left), rect.right - 1);
          const cy = Math.min(Math.max(y, rect.top), rect.bottom - 1);
          const col = Math.floor((cx - rect.left) / step);
          const row = Math.floor((cy - rect.top) / step);

          if (row < 0 || row >= state.size || col < 0 || col >= state.size) return null;
          return row * state.size + col;
        }

        function cellElFromIndex(i) {
          return wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`) || null;
        }

        function clearHover() {
          if (hoverPreview && hoverPreview.size) {
            hoverPreview.forEach((prev, i) => {
              const el = cellElFromIndex(i);
              if (!el) return;
              const tile = el.querySelector(".nb-tile");
              if (!tile) return;
              tile.textContent = prev;
              tile.removeAttribute("data-preview");
            });
            hoverPreview.clear();
          }

          wrap.querySelectorAll(".nb-cell.drop-hover, .nb-cell.drop-bad").forEach((el) => {
            el.classList.remove("drop-hover", "drop-bad");
          });
        }

        function highlightPlacement(anchorIndex, piece) {
          clearHover();
          if (anchorIndex == null || !piece) return;

          const covered = getCoveredIndices(state, anchorIndex, piece);
          if (!covered) return;

          const ok = canPlacePiece(state, anchorIndex, piece);
          if (!ok) return;

          for (let k = 0; k < covered.length; k++) {
            const i = covered[k];
            const el = cellElFromIndex(i);
            if (!el) continue;
            el.classList.add("drop-hover");

            const tile = el.querySelector(".nb-tile");
            if (!state.board[i] && tile) {
              if (!hoverPreview.has(i)) hoverPreview.set(i, tile.textContent || "");
              tile.textContent = String(piece.cells[k].v);
              tile.setAttribute("data-preview", "1");
            }
          }
        }

        function updateTopbar() {
          const progress = clamp((state.roundWins / RUN_ROUNDS) * 100, 0, 100);

          if (!top.querySelector(".nb-power-fill")) {
            top.innerHTML = `
            <div class="nb-crystals">
            <img src="images/games/number-blast/crystal.png" style="width: 120px; height: 120px;" alt="Crystal" />
            </div>
              <div class="nb-power-wrap">
                <div class="nb-power-label"></div>
                <div class="nb-power-bar" aria-label="Progress">
                  <div class="nb-power-fill"></div>
                </div>
              </div>
            `;
          }

          const fill = top.querySelector(".nb-power-fill");
          requestAnimationFrame(() => {
            fill.style.width = progress + "%";
          });
        }

        function renderGrid() {
          gridEl.style.gridTemplateColumns = `repeat(${state.size}, var(--nb-cell))`;
          gridEl.style.gridTemplateRows = `repeat(${state.size}, var(--nb-cell))`;
          gridEl.innerHTML = "";

          for (let r = 0; r < state.size; r++) {
            for (let c = 0; c < state.size; c++) {
              const i = idx(state, r, c);
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "nb-cell";
              btn.setAttribute("data-cell-index", String(i));
          
              const tile = document.createElement("div");
              tile.className = "nb-tile";
              btn.appendChild(tile);
          
              const cell = state.board[i];
              if (cell) {
                tile.classList.add("is-filled", getNumberColorClass(cell.v));
                tile.textContent = String(cell.v);
          
                if (shouldAnimateBoardSpawn) {
                  const index = r * state.size + c;
                  const stagger = index * 18;
                
                  tile.style.setProperty("--spawn-delay", stagger + "ms");
                  tile.classList.add("nb-spawn");
                
                  setTimeout(() => {
                    tile.classList.remove("nb-spawn");
                    tile.style.removeProperty("--spawn-delay");
                  }, 360 + stagger);
                }
              }
          
              gridEl.appendChild(btn);
            }
          }
          
          shouldAnimateBoardSpawn = false;
        }

        function renderHand() {
          handEl.innerHTML = "";

          state.hand.forEach((piece, hi) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "nb-piece";
            btn.dataset.handIndex = String(hi);

            const shapeEl = document.createElement("div");
            shapeEl.className = "nb-piece-shape";
            btn.appendChild(shapeEl);

            requestAnimationFrame(() => {
              const handSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-hand-size")) || 150;
              const MAX_DIM = 3;
              const pad = 10;
              const gap = 6;
              const cell = Math.floor((handSize - pad * 2 - gap * (MAX_DIM - 1)) / MAX_DIM);
              const b = pieceBounds(piece);
              const shapeW = b.w * cell + (b.w - 1) * gap;
              const shapeH = b.h * cell + (b.h - 1) * gap;

              btn.style.width = `${shapeW + pad * 2}px`;
              btn.style.height = `${shapeH + pad * 2}px`;
              shapeEl.style.width = `${shapeW + pad * 2}px`;
              shapeEl.style.height = `${shapeH + pad * 2}px`;

              const startX = pad;
              const startY = pad;
              shapeEl.innerHTML = "";

              piece.cells.forEach((pc) => {
                const d = document.createElement("div");
                d.className = `nb-mini ${getNumberColorClass(pc.v)}`;
                d.textContent = String(pc.v);
                d.dataset.px = String(pc.x);
                d.dataset.py = String(pc.y);
                d.style.width = `${cell}px`;
                d.style.height = `${cell}px`;
                d.style.left = `${startX + pc.x * (cell + gap)}px`;
                d.style.top = `${startY + pc.y * (cell + gap)}px`;
                shapeEl.appendChild(d);
              });
            });

            const onDown = (ev) => {
              if (finished) return;
              ev.preventDefault();

              stopActiveDrag();
              btn.classList.add("is-dragging");

              const rect = btn.getBoundingClientRect();
              const grabOffsetX = ev.clientX - rect.left;
              const grabOffsetY = ev.clientY - rect.top;
              const grabbedMini = ev.target.closest(".nb-mini");
              const grabCell = grabbedMini
                ? {
                    x: Number(grabbedMini.dataset.px || 0),
                    y: Number(grabbedMini.dataset.py || 0),
                  }
  : { x: 0, y: 0 };
              const ghostNudgeY = 10;

              const ghost = btn.cloneNode(true);
              ghost.classList.add("drag-ghost");
              ghost.classList.remove("is-dragging");
              ghost.style.position = "fixed";
              ghost.style.left = `${rect.left}px`;
              ghost.style.top = `${rect.top}px`;
              ghost.style.width = rect.width + "px";
              ghost.style.height = rect.height + "px";
              ghost.style.pointerEvents = "none";
              ghost.style.zIndex = "9999";
              ghost.style.willChange = "transform";
              ghost.style.margin = "0";
              document.body.appendChild(ghost);

              let raf = 0;
              let lastX = ev.clientX;
              let lastY = ev.clientY;

              function applyGhost() {
                raf = 0;
                const targetX = lastX - grabOffsetX - rect.left;
                const targetY = lastY - grabOffsetY - ghostNudgeY - rect.top;
                ghost.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1.03) rotate(-1.5deg)`;
              }

              function queueGhost(x, y) {
                lastX = x;
                lastY = y;
                if (!raf) raf = requestAnimationFrame(applyGhost);
              }

              applyGhost();
              highlightPlacement(
                getAdjustedAnchor(ev.clientX, ev.clientY, state.hand[hi], grabCell),
                state.hand[hi]
              );

              try { btn.setPointerCapture(ev.pointerId); } catch (e) {}

              const onMove = (e) => {
                queueGhost(e.clientX, e.clientY);
                const ci = getAdjustedAnchor(e.clientX, e.clientY, state.hand[hi], grabCell);
                if (ci == null) {
                  clearHover();
                  return;
                }
                highlightPlacement(ci, state.hand[hi]);
              };

              const onUp = (evUp) => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                if (raf) cancelAnimationFrame(raf);

                const ci = getAdjustedAnchor(evUp.clientX, evUp.clientY, state.hand[hi], grabCell);
                clearHover();
                if (ci != null) Promise.resolve(placePiece(ci, hi)).catch(console.error);

                btn.classList.remove("is-dragging");
                try { ghost.remove(); } catch (e) {}
                try { btn.releasePointerCapture(ev.pointerId); } catch (e) {}
                activeDrag = null;
              };

              activeDrag = { ghost, onMove, onUp, card: btn, pointerId: ev.pointerId, handIndex: hi };
              window.addEventListener("pointermove", onMove, { passive: true });
              window.addEventListener("pointerup", onUp);
            };

            btn.addEventListener("pointerdown", onDown);
            addCleanup(() => btn.removeEventListener("pointerdown", onDown));
            handEl.appendChild(btn);
          });
        }

        function render() {
          cleanupFns.forEach((fn) => {
            try { fn(); } catch (e) {}
          });
          cleanupFns = [];
          updateTopbar();
          renderGrid();
          renderHand();
        }

        function animateRowExplode(hitSet, opts = {}) {
          const chainStep = opts.chainStep || 1;
          const burstScaleClass = chainStep >= 2 ? "nb-burst-strong" : "nb-burst";
          boardWrap.classList.remove("nb-burst", "nb-burst-strong", "nb-screen-pop");
          void boardWrap.offsetWidth;
          boardWrap.classList.add(burstScaleClass, "nb-screen-pop");
          sparkLayer.textContent = "";

          const frag = document.createDocumentFragment();
          const boardRect = boardWrap.getBoundingClientRect();
          const tiles = [];

          hitSet.forEach((i) => {
            const cellEl = wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`);
            const el = cellEl ? cellEl.querySelector(".nb-tile") : null;
            if (el) tiles.push(el);
          });

          const rects = tiles.map((el) => el.getBoundingClientRect());
          const hitArray = Array.from(hitSet);

          hitArray.sort((a, b) => {
            const ar = rc(state, a);
            const br = rc(state, b);
            return ar.r - br.r || ar.c - br.c;
          });

          for (let t = 0; t < tiles.length; t++) {
            const el = tiles[t];
            const r = rects[t];
            const cx = r.left - boardRect.left + r.width / 2;
            const cy = r.top - boardRect.top + r.height / 2;
            const stagger = Math.floor(Math.random() * 10);
            const dx = (Math.random() * 110 - 55).toFixed(0) + "px";
            const dy = (Math.random() * 135 - 95).toFixed(0) + "px";
            const blastRot = `${(Math.random() * 34 - 17).toFixed(1)}deg`;

            const clone = el.cloneNode(true);
            clone.classList.add("nb-explode-clone");
            clone.style.left = `${r.left - boardRect.left}px`;
            clone.style.top = `${r.top - boardRect.top}px`;
            clone.style.width = `${r.width}px`;
            clone.style.height = `${r.height}px`;
            clone.style.setProperty("--dx", dx);
            clone.style.setProperty("--dy", dy);
            clone.style.setProperty("--blast-rot", blastRot);
            clone.style.setProperty("--blast-delay", `${stagger}ms`);
            clone.style.setProperty("--blast-hue", `${Math.floor(Math.random() * 36 - 18)}deg`);
            frag.appendChild(clone);

            el.classList.add("nb-explode-source-hide");

            const sparkCount = 20 + Math.floor(Math.random() * 10) + (chainStep >= 2 ? 4 : 0);
            for (let s = 0; s < sparkCount; s++) {
              const sp = document.createElement("div");
              sp.className = s % 5 === 0 ? "nb-spark nb-spark-star" : "nb-spark";
              sp.style.left = `${cx}px`;
              sp.style.top = `${cy}px`;
              sp.style.setProperty("--blast-delay", `${stagger + Math.random() * 80}ms`);

              const angle = (Math.PI * 2 * s) / sparkCount + Math.random() * 0.42;
              const dist = 48 + Math.random() * 62 + chainStep * 5;
              const sx = Math.cos(angle) * dist;
              const sy = Math.sin(angle) * dist - 8 - Math.random() * 24;

              sp.style.setProperty("--sx", `${sx.toFixed(0)}px`);
              sp.style.setProperty("--sy", `${sy.toFixed(0)}px`);
              sp.style.setProperty("--spark-size", `${5 + Math.random() * 10}px`);
              frag.appendChild(sp);
            }

            for (let p = 0; p < 5; p++) {
              const chunk = document.createElement("div");
              chunk.className = "nb-pop-frag";
              chunk.style.left = `${cx}px`;
              chunk.style.top = `${cy}px`;
              const angle = Math.random() * Math.PI * 2;
              const dist = 24 + Math.random() * 44;
              chunk.style.setProperty("--fx", `${(Math.cos(angle) * dist).toFixed(0)}px`);
              chunk.style.setProperty("--fy", `${(Math.sin(angle) * dist - 6 - Math.random() * 18).toFixed(0)}px`);
              chunk.style.setProperty("--frag-rot", `${(Math.random() * 160 - 80).toFixed(0)}deg`);
              chunk.style.setProperty("--blast-delay", `${stagger + 10 + Math.random() * 70}ms`);
              frag.appendChild(chunk);
            }

            const ring = document.createElement("div");
            ring.className = "nb-flash-ring";
            ring.style.left = `${cx}px`;
            ring.style.top = `${cy}px`;
            ring.style.setProperty("--blast-delay", `${stagger}ms`);
            frag.appendChild(ring);

            const poof = document.createElement("div");
            poof.className = "nb-poof";
            poof.style.left = `${cx}px`;
            poof.style.top = `${cy}px`;
            poof.style.setProperty("--blast-delay", `${stagger + 12}ms`);
            frag.appendChild(poof);
          }

          sparkLayer.appendChild(frag);

          setTimeout(() => {
            sparkLayer.textContent = "";
            boardWrap.classList.remove("nb-burst", "nb-burst-strong", "nb-screen-pop");
          }, ROW_EXPLODE_MS + 120);
        }

        function animateGravityDrop(moved) {
          moved.forEach(({ from, to }) => {
            const fromRC = rc(state, from);
            const toRC = rc(state, to);
            const rowsDropped = Math.max(1, toRC.r - fromRC.r);
            const cellEl = wrap.querySelector(`.nb-cell[data-cell-index="${to}"]`);
            const tile = cellEl ? cellEl.querySelector(".nb-tile.is-filled") : null;
            if (!tile) return;
        
            tile.style.setProperty("--drop-distance", `${Math.min(44, rowsDropped * 16)}px`);
            tile.style.setProperty("--drop-duration", `${220 + rowsDropped * 85}ms`);
        
            tile.classList.remove("nb-gravity-drop");
            void tile.offsetWidth;
            tile.classList.add("nb-gravity-drop");
          });
        }

        function awardForGroups(groupCount) {
          const bonus = groupCount >= 3 ? 2 : groupCount >= 2 ? 1 : 0;
          state.clears += groupCount;
          state.score += 10 * groupCount + 15 * bonus;
        }

        function applyBlastProgress(blasts) {
          state.roundWins += blasts;
          state.difficultyWins += blasts;
          writeNumber(NB_RUN_WINS_KEY, state.roundWins);
          writeNumber(NB_DIFFICULTY_WINS_KEY, state.difficultyWins);
          updateTopbar();

          const fill = top.querySelector(".nb-power-fill");
          if (fill) {
            fill.classList.remove("bump");
            void fill.offsetWidth;
            fill.classList.add("bump");
          }
        }

        function maybeAdvanceDifficulty() {
          const rules = window.NumberBlastLevelPlan?.getNumberBlastRules(state.level) || {};
          const winsToAdvance = Math.max(1, Number(rules.winsToAdvance || 1));
          if (state.difficultyWins < winsToAdvance) return false;
          if (state.level >= LEVEL_MAX) return false;

          state.level += 1;
          state.difficultyWins = 0;
          writeNumber(NB_DIFFICULTY_KEY, state.level);
          writeNumber(NB_DIFFICULTY_WINS_KEY, 0);
          return true;
        }

        async function placePiece(anchorIndex, handIndex) {
          const piece = state.hand[handIndex];
          if (!piece) return false;
          if (!canPlacePiece(state, anchorIndex, piece)) {
            shakeBad();
            return false;
          }

          const covered = getCoveredIndices(state, anchorIndex, piece);
          if (!covered) {
            shakeBad();
            return false;
          }

          for (let k = 0; k < piece.cells.length; k++) {
            const bi = covered[k];
            const pc = piece.cells[k];
            state.board[bi] = { v: pc.v };
          }

          render();

          const blasts = await resolveBoardChains(
            state,
            render,
            animateRowExplode,
            animateGravityDrop,
            showComboText,
            gridEl
          );

          stopActiveDrag();
          clearHover();

          if (blasts > 0) {
            awardForGroups(blasts);
            applyBlastProgress(blasts);
            state.hand[handIndex] = makePiece(state, { forceClearNow: false });
            ensurePlayableHand(state, 18);
            render();

            if (state.roundWins >= RUN_ROUNDS) {
              state.wins = clamp(readWins() + 1, 0, 9999);
              writeWins(state.wins);
              writeNumber(NB_RUN_WINS_KEY, 0);
              finish("win", {
                reason: "run-complete",
                blasts: state.roundWins,
                score: state.score,
                wins: state.wins,
              });
              return true;
            }

            if (maybeAdvanceDifficulty()) {
              setTimeout(() => {
                resetRoundBoard();
                render();
              }, 450);
            }

            return true;
          }

          state.hand[handIndex] = makePiece(state, { forceClearNow: false });
          render();

          if (!anyMovesAvailable(state)) {
            setTimeout(() => {
              finish("lose", {
                reason: "no-moves",
                blasts: state.roundWins,
                score: state.score,
                wins: state.wins,
              });
            }, 250);
          }

          return true;
        }

        render();
      });
    }

    return { start, destroy };
  }

  function getCoveredIndices(state, anchorIndex, piece) {
    if (!state || !piece) return null;
    if (!Number.isFinite(Number(anchorIndex))) return null;

    const N = state.size;
    const a = rc(state, anchorIndex);
    const out = [];

    for (const pc of piece.cells) {
      const r = a.r + pc.y;
      const c = a.c + pc.x;
      if (r < 0 || r >= N || c < 0 || c >= N) return null;
      out.push(idx(state, r, c));
    }

    return out;
  }

  function canPlacePiece(state, anchorIndex, piece) {
    const covered = getCoveredIndices(state, anchorIndex, piece);
    if (!covered) return false;
    for (const i of covered) {
      if (state.board[i] != null) return false;
    }
    return true;
  }

  function anyMovesAvailable(state) {
    if (!state || !Array.isArray(state.hand) || !Array.isArray(state.board)) return false;

    for (let hi = 0; hi < state.hand.length; hi++) {
      const piece = state.hand[hi];
      for (let bi = 0; bi < state.board.length; bi++) {
        if (state.board[bi] != null) continue;
        if (canPlacePiece(state, bi, piece)) return true;
      }
    }

    return false;
  }

  if (window.GameRegistry && typeof window.GameRegistry.register === "function") {
    window.GameRegistry.register("number-blast", createNumberBlastGame);
  } else {
    console.error("[NumberBlast] GameRegistry missing. Did registry.js load first?");
  }
})();
