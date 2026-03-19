// games/number-blast/index.js
(function () {
  "use strict";

  const DEFAULT_SIZE = 5;
  const HAND_SIZE = 3;
  const LEVEL_MAX = 20;
  const ROW_EXPLODE_MS = 420;
  const STARTING_LIVES = 3;

  const END_SEQUENCE_SLOWDOWN = 1.45;

  function endMs(ms) {
    return Math.round(ms * END_SEQUENCE_SLOWDOWN);
  }
  
  let shouldAnimateBoardSpawn = false;

  const WINS_KEY = "NB_GAME_WINS";

  const SOUND_PATH = "sounds";

  function createAudioSystem() {
    const files = {
      pickup: "pickup.mp3",
      place: "place.mp3",
    };
    
    const masterVolume = {
      pickup: 0.5,
      place: 0.7,
    };

    const pools = {};
    let unlocked = false;
    let muted = false;

    Object.keys(files).forEach((key) => {
      pools[key] = Array.from({ length: key === "pickup" ? 8 : 4 }, () => {
        const a = new Audio(`${SOUND_PATH}/${files[key]}`);
        a.preload = "auto";
        a.playsInline = true;
        a.load();
        return a;
      });
    });

    function unlock() {
      if (unlocked) return;
      unlocked = true;

      Object.values(pools).forEach((list) => {
        list.forEach((a) => {
          try {
            a.muted = true;
            const p = a.play();
            if (p && typeof p.then === "function") {
              p.then(() => {
                a.pause();
                a.currentTime = 0;
                a.muted = false;
              }).catch(() => {});
            }
          } catch (e) {}
        });
      });
    }

    function pickFromPool(key) {
      const list = pools[key];
      if (!list || !list.length) return null;

      let chosen = list.find((a) => a.paused || a.ended);
      if (!chosen) chosen = list[0];
      return chosen;
    }

    function play(key, opts = {}) {
      if (muted) return;
    
      const a = pickFromPool(key);
      if (!a) {
        console.warn("[SFX] Missing sound key:", key);
        return;
      }
    
      const volume = Math.max(0, Math.min(1, (masterVolume[key] ?? 1) * (opts.volume ?? 1)));
      const rate = Math.max(0.75, Math.min(1.35, opts.rate ?? 1));
      const from = Math.max(0, opts.from ?? 0);
    
      try {
        a.pause();
        a.currentTime = from;
        a.playbackRate = rate;
        a.volume = volume;
    
        console.log("[SFX] play:", key, "time:", performance.now().toFixed(1));
    
        const p = a.play();
        if (p && typeof p.catch === "function") {
          p.catch((err) => {
            console.warn("[SFX] play failed:", key, err);
          });
        }
      } catch (e) {
        console.warn("[SFX] exception:", key, e);
      }
    }

    function randomize(base = 1, spread = 0.05) {
      return base + (Math.random() * 2 - 1) * spread;
    }
    
    return {
      unlock,
      play,
      randomize,
      setMuted(next) {
        muted = !!next;
      },
    };
  }

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
    { id: "smartL", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
    { id: "sq4", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  ];

  function syncViewportScale() {
    const root = document.documentElement;

    const baseW = 390;
    const baseH = 844;
    const outerPad = 48; // 24px left + 24px right / top + bottom

    const usableW = Math.max(320, window.innerWidth - outerPad);
    const usableH = Math.max(560, window.innerHeight - outerPad);

    const scaleFromWidth = usableW / baseW;
    const scaleFromHeight = usableH / baseH;

    const scale = Math.max(1, Math.min(scaleFromWidth, scaleFromHeight, 1.6));

    root.style.setProperty("--nb-ui-scale", scale.toFixed(4));
  }

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
    const v = clamp(Number(value) || 1, 1, 9);
    return `nb-c${v}`;
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

  function scoreShapeFit(state, normCells) {
    let validPlacements = 0;
  
    for (let bi = 0; bi < state.board.length; bi++) {
      if (canPlacePiece(state, bi, { cells: normCells })) {
        validPlacements++;
      }
    }
  
    return validPlacements;
  }
  
  function pickBestLShapeForBoard(state) {
    const lShapes = SHAPES.filter((s) => /^l3[abcd]$/.test(s.id));
  
    let bestShape = lShapes[0];
    let bestScore = -1;
  
    for (const shape of lShapes) {
      const norm = normalizePieceCells(shape.cells);
      const score = scoreShapeFit(state, norm);
  
      if (score > bestScore) {
        bestScore = score;
        bestShape = shape;
      }
    }
  
    return bestShape;
  }

  function makePiece(state, opts = {}) {
    if (opts.forceClearNow) {
      const forced = findGuaranteedClearPiece(state);
      if (forced) return forced;
    }
  
    let shape = weightedPickShape(state.level, state.rules);
  
    if (shape.id === "smartL") {
      shape = pickBestLShapeForBoard(state);
    }
  
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
    const targetHandSize = 3;
    const hand = [];
    let largeCount = 0;
  
    for (let i = 0; i < targetHandSize; i++) {
      let piece = null;
  
      for (let tries = 0; tries < 80; tries++) {
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
        piece = {
          id: `fallback_s1_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          shapeId: "s1",
          cells: [{ x: 0, y: 0, v: randTileValue(state) }],
        };
      }
  
      hand.push(piece);
    }
  
    return hand;
  }  
  
  function hasLevelWin(state) {
    return state.levelScore >= state.levelGoal;
  }
  
  function getLevelProgressPct(state) {
    const goal = Math.max(1, Number(state.levelGoal) || 1);
    return Math.max(0, Math.min(100, (state.levelScore / goal) * 100));
  }
  
  function makeGameState(level) {
    const savedDifficulty = clamp(Number(level) || 1, 1, LEVEL_MAX);
    const difficultyRules = window.NumberBlastLevelPlan?.getNumberBlastRules(savedDifficulty) || null;
    const difficultySize = difficultyRules?.boardSize ?? DEFAULT_SIZE;
  
    const st = {
      level: savedDifficulty,
      lives: STARTING_LIVES,
      forcedSolveCounter: 0,
      size: difficultySize,
      board: Array(difficultySize * difficultySize).fill(null),
      hand: [],
      clears: 0,
  
      totalScore: 0,
      levelScore: 0,
      levelBlasts: 0,
      levelStartedAt: Date.now(),
  
      wins: readWins(),
      numberMin: difficultyRules?.numberMin ?? 1,
      numberMax: difficultyRules?.numberMax ?? levelNumberMax(savedDifficulty),
      targetSum: difficultyRules?.target ?? 10,
      levelGoal: difficultyRules?.pointsGoal ?? 120,
      rules: difficultyRules || {},
    };
  
    const handSize = difficultyRules?.handSize ?? HAND_SIZE;
    const maxLargePieces = difficultyRules?.maxLargePieces ?? 1;
    st.hand = generateHand(st, handSize, maxLargePieces);
    return st;
  }

  function fillBoardFully(state) {
    state.board = Array.from({ length: state.size * state.size }, () => ({
      v: randTileValue(state),
    }));
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

  function isInteriorCell(state, r, c) {
    return r > 0 && c > 0 && r < state.size - 1 && c < state.size - 1;
  }

  function hasFilledCrossNeighbors(state, r, c) {
    if (!isInteriorCell(state, r, c)) return false;
    return !!(
      state.board[idx(state, r - 1, c)] &&
      state.board[idx(state, r + 1, c)] &&
      state.board[idx(state, r, c - 1)] &&
      state.board[idx(state, r, c + 1)]
    );
  }

  function getSurroundedEmptyIndices(state) {
    const out = [];

    for (let r = 1; r < state.size - 1; r++) {
      for (let c = 1; c < state.size - 1; c++) {
        const i = idx(state, r, c);
        if (state.board[i] != null) continue;
        if (hasFilledCrossNeighbors(state, r, c)) out.push(i);
      }
    }

    return out;
  }

  function pickRandomSupportedExplosionIndices(state, count = 3) {
    const candidates = [];

    for (let r = 1; r < state.size - 1; r++) {
      for (let c = 1; c < state.size - 1; c++) {
        const i = idx(state, r, c);
        if (!state.board[i]) continue;
        if (!hasFilledCrossNeighbors(state, r, c)) continue;
        candidates.push(i);
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    return candidates.slice(0, count);
  }

  function boardHasAutoClear(state) {
    const result = findGroupsToClear(state, state.board);
    return result.groups.length > 0;
  }

  function boardHasAutoClearSim(board, size, target) {
    const testState = {
      board,
      size,
      targetSum: target
    };
  
    const groups = findGroupsToClear(testState);
  
    return groups && groups.length > 0;
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
        while (
          start < indices.length &&
          (!board[indices[start]] || isSkullCell(board[indices[start]]))
        ) {
          start++;
        }
    
        if (start >= indices.length) break;
    
        let end = start;
        while (
          end < indices.length &&
          board[indices[end]] &&
          !isSkullCell(board[indices[end]])
        ) {
          end++;
        }
    
        for (let i = start; i < end; i++) {
          let sum = 0;
    
          for (let j = i; j < end; j++) {
            const cell = board[indices[j]];
            if (!cell || isSkullCell(cell)) break;
    
            sum += cell.v;
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

  function delay(ms) {
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

  function isSkullCell(cell) {
    return !!(cell && cell.kind === "skull");
  }
  
  function findSkullIndex(state) {
    for (let i = 0; i < state.board.length; i++) {
      if (isSkullCell(state.board[i])) return i;
    }
    return -1;
  }
  
  function getOrthogonalNeighbors(state, index) {
    const { r, c } = rc(state, index);
    const out = [];
  
    if (r > 0) out.push(idx(state, r - 1, c));
    if (r < state.size - 1) out.push(idx(state, r + 1, c));
    if (c > 0) out.push(idx(state, r, c - 1));
    if (c < state.size - 1) out.push(idx(state, r, c + 1));
  
    return out;
  }
  
  function pickRandomTopSpawnColumn(state) {
    const cols = [];
    for (let c = 0; c < state.size; c++) {
      if (!state.board[idx(state, 0, c)]) cols.push(c);
    }
    if (!cols.length) return null;
    return cols[Math.floor(Math.random() * cols.length)];
  }
  
  function spawnSkullAtTop(state) {
    if (findSkullIndex(state) !== -1) return null;
  
    const col = pickRandomTopSpawnColumn(state);
    if (col == null) return null;
  
    const startIndex = idx(state, 0, col);
    state.board[startIndex] = { kind: "skull" };
  
    const moved = applyGravity(state);
    const finalIndex = findSkullIndex(state);
  
    return {
      startIndex,
      finalIndex,
      moved,
    };
  }
  
  function collectSkullsHitByBlast(state, hitSet) {
    const skullIndex = findSkullIndex(state);
    if (skullIndex === -1) return [];
  
    const neighbors = getOrthogonalNeighbors(state, skullIndex);
    const touched = neighbors.some((i) => hitSet.has(i));
  
    return touched ? [skullIndex] : [];
  }
  
  function damageLifeFromSkull(state) {
    state.lives = Math.max(0, state.lives - 1);
    return state.lives;
  }

  function pickOpeningHoleIndices(state, count = 5) {
    const candidates = [];
  
    for (let r = 1; r < state.size - 1; r++) {
      for (let c = 1; c < state.size - 1; c++) {
        const i = idx(state, r, c);
        if (!state.board[i]) continue;
        candidates.push(i);
      }
    }
  
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
  
    return candidates.slice(0, count);
  }

  async function resolveBoardChains(
    state,
    render,
    animateBlast,
    animateGravity,
    showComboText,
    gridEl,
    finish,
    sfx,
    onGameOver
  ) {  
    let totalBlasts = 0;
    let chainStep = 0;

    while (true) {
      const { groups, hit } = findGroupsToClear(state, state.board);
      const skullHits = collectSkullsHitByBlast(state, hit);
      skullHits.forEach((i) => {
        hit.add(i);
      });
      if (!groups.length) break;

      chainStep += 1;
      totalBlasts += groups.length;
      animateBlast(hit, { chainStep, groupCount: groups.length });
      await wait(ROW_EXPLODE_MS + 80);

      clearHitCells(state, hit);
      if (skullHits.length) {
        damageLifeFromSkull(state);
      
        if (state.lives <= 0) {
          render();
        
          if (typeof onGameOver === "function") {
            await onGameOver({
              reason: "out-of-lives",
              score: state.totalScore,
              wins: state.wins,
            });
          } else {
            finish("lose", {
              reason: "out-of-lives",
              score: state.totalScore,
              wins: state.wins,
            });
          }
        
          return totalBlasts;
        }
      }
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
    if (findSkullIndex(state) === -1 && state.lives > 0) {
      const skullSpawn = spawnSkullAtTop(state);
      render();
    
      if (skullSpawn && skullSpawn.moved && skullSpawn.moved.length) {
        animateGravity(skullSpawn.moved, { chainStep: 0 });
        await wait(460);
        render();
      }
    }

    return totalBlasts;
  }

  function wouldClearAfterPlacement(state, anchor, piece) {
    const covered = getSettledCoveredIndices(state, anchor, piece);
    if (!covered) return false;
  
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
        const covered = getSettledCoveredIndices(state, bi, { cells: norm });
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
    if (hasClearMove(state)) return true;
  
    const originalHand = state.hand.slice();
  
    for (let t = 0; t < tries; t++) {
      const candidateHand = generateHand(state);
      const prevHand = state.hand;
      state.hand = candidateHand;
  
      if (hasClearMove(state)) {
        return true;
      }
  
      state.hand = prevHand;
    }
  
    state.hand = originalHand;
    return false;
  }

  function clearMount(mount) {
    mount.innerHTML = "";
    mount.classList.remove("eq-bad", "eq-shake");
  }

  function createNumberBlastGame({ config = {}, context } = {}) {
    const level = Number(config.level || 1);

    let mount =
      config.mount ||
      config.host ||
      document.getElementById("game-mount") ||
      document.body;

    let cleanupFns = [];
    let activeDrag = null;
    let hoverPreview = new Map();
    let handLocked = true;
let introPopPlayed = false;

    function addCleanup(fn) {
      cleanupFns.push(fn);
    }

    function stopActiveDrag() {
      if (!activeDrag) return;
      const { ghost, onMove, onUp, card, pointerId } = activeDrag;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
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

          queueMicrotask(() => resolve({ outcome, ...extra }));

          setTimeout(() => {
            destroy();
          }, 350);
        }

        clearMount(mount);

        syncViewportScale();

        const onResize = () => {
          syncViewportScale();
          if (wrap && wrap.isConnected) {
            render(true);
          }
        };

        window.addEventListener("resize", onResize);
        addCleanup(() => window.removeEventListener("resize", onResize));

        const wrap = document.createElement("div");
        wrap.className = "nb-wrap";
        mount.appendChild(wrap);

        const top = document.createElement("div");
        top.className = "nb-topbar";
        wrap.appendChild(top);

        const scoreBlock = document.createElement("div");
        scoreBlock.className = "nb-top-score-block";
        wrap.appendChild(scoreBlock);

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

        const sfx = createAudioSystem();
        
        let lastProgressPct = 0;

        wrap.style.setProperty("--nb-goal-hit-ms", `${endMs(520)}ms`);
        wrap.style.setProperty("--nb-confetti-ms", `${endMs(1500)}ms`);
        wrap.style.setProperty("--nb-win-reveal-ms", `${endMs(520)}ms`);
        wrap.style.setProperty("--nb-win-check-ms", `${endMs(440)}ms`);
        wrap.style.setProperty("--nb-win-number-pop-ms", `${endMs(460)}ms`);
        wrap.style.setProperty("--nb-win-glow-ms", `${endMs(720)}ms`);

        function resetRoundBoard() {
          const latestRules = window.NumberBlastLevelPlan?.getNumberBlastRules(state.level) || {};
          state.rules = latestRules;
          state.size = latestRules.boardSize ?? DEFAULT_SIZE;
          state.numberMin = latestRules.numberMin ?? 1;
          state.numberMax = latestRules.numberMax ?? 9;
          state.targetSum = latestRules.target ?? 10;
          state.levelGoal = latestRules.pointsGoal ?? 120;

          fillBoardFully(state);
        
          while (boardHasAutoClear(state)) {
            fillBoardFully(state);
          }
        
          const handSize = latestRules.handSize ?? HAND_SIZE;
          const maxLargePieces = latestRules.maxLargePieces ?? 1;
          state.hand = generateHand(state, handSize, maxLargePieces);
          ensurePlayableHand(state, 24);
        
          shouldAnimateBoardSpawn = false;
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

        function formatElapsed(ms) {
          const totalSeconds = Math.max(0, Math.floor(ms / 1000));
          const mins = Math.floor(totalSeconds / 60);
          const secs = totalSeconds % 60;
          return `${mins}:${String(secs).padStart(2, "0")}`;
        }

        function lockGameInput(isLocked) {
          wrap.style.pointerEvents = isLocked ? "none" : "";
        }

        function spawnWinConfetti(count = 26) {
          const progressFill = scoreBlock.querySelector(".nb-level-progress-fill");
          const progressTrack = scoreBlock.querySelector(".nb-level-progress");
          const originEl = progressFill || progressTrack || scoreBlock;

          if (!originEl) return;

          const hostRect = sparkLayer.getBoundingClientRect();
          const originRect = originEl.getBoundingClientRect();
          const originCenterX = originRect.left - hostRect.left + originRect.width / 2;
          const originCenterY = originRect.top - hostRect.top + originRect.height / 2;

          const frag = document.createDocumentFragment();

          for (let i = 0; i < count; i++) {
            const piece = document.createElement("div");
            piece.className = "nb-win-confetti";

            const spreadX = Math.random() * 140 - 70;
            const spreadY = Math.random() * 18 - 9;

            piece.style.left = `${originCenterX + spreadX}px`;
            piece.style.top = `${originCenterY + spreadY}px`;
            piece.style.setProperty("--confetti-x", `${(Math.random() * 220 - 110).toFixed(0)}px`);
            piece.style.setProperty("--confetti-y", `${(90 + Math.random() * 140).toFixed(0)}px`);
            piece.style.setProperty("--confetti-rot", `${(Math.random() * 360 - 180).toFixed(0)}deg`);
            piece.style.setProperty("--confetti-delay", `${Math.random() * endMs(160)}ms`);
            piece.style.setProperty("--confetti-size", `${8 + Math.random() * 14}px`);

            frag.appendChild(piece);
          }

          sparkLayer.appendChild(frag);

          setTimeout(() => {
            sparkLayer.querySelectorAll(".nb-win-confetti").forEach((el) => el.remove());
          }, endMs(1700));
        }

        function pulseProgressGoalHit() {
          return new Promise((resolve) => {
            const fill = scoreBlock.querySelector(".nb-level-progress-fill");
            if (!fill) {
              resolve();
              return;
            }

            fill.classList.remove("nb-level-goal-hit");
            void fill.offsetWidth;
            fill.classList.add("nb-level-goal-hit");

            setTimeout(resolve, endMs(520));
          });
        }

        async function explodeBoardForWinSequence() {
          const filled = [];
          for (let i = 0; i < state.board.length; i++) {
            if (state.board[i]) filled.push(i);
          }

          if (!filled.length) return;

          for (let i = filled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [filled[i], filled[j]] = [filled[j], filled[i]];
          }

          const waveCount = Math.min(5, Math.max(3, Math.ceil(filled.length / 6)));
          const perWave = Math.ceil(filled.length / waveCount);

          for (let w = 0; w < waveCount; w++) {
            const slice = filled.slice(w * perWave, (w + 1) * perWave);
            if (!slice.length) continue;

            const hit = new Set(slice);
            animateRowExplode(hit, { chainStep: 1, groupCount: slice.length });

            await wait(180);

            hit.forEach((i) => {
              state.board[i] = null;
            });

            gridEl.querySelectorAll(".nb-tile.nb-explode-source-hide").forEach((el) => {
              el.classList.remove("nb-explode-source-hide");
            });

            renderGrid(true);
            await wait(180);
          }
        }

        function playBoardToWinTransition() {
          return new Promise((resolve) => {
            wrap.classList.remove("nb-win-transition");
            wrap.style.setProperty("--nb-win-glow-ms", `${endMs(720)}ms`);
            void wrap.offsetWidth;
            wrap.classList.add("nb-win-transition");

            setTimeout(() => {
              wrap.classList.remove("nb-win-transition");
              resolve();
            }, endMs(720));
          });
        }

        function showEndScreen({
          mode = "win",
          staged = false,
          onResolved = null,
        } = {}) {
          if (finished) return;
          finished = true;

          const isWin = mode === "win";
          const nextLevel = Math.min(state.level + 1, LEVEL_MAX);
          const isLastLevel = state.level >= LEVEL_MAX;
          const highScore = readNumber("NB_HIGH_SCORE", 0);

          if (isWin) {
            writeWins(state.wins + 1);
          } else {
          }

          wrap.innerHTML = `
            <div class="nb-win-screen ${staged ? "is-staged" : ""}">
              <div class="nb-win-main">
                <div class="nb-win-level-badge-wrap ${staged ? "is-hidden" : ""}" aria-hidden="true">
                  <div class="nb-win-level-badge">
                    <span class="nb-win-level-number">${state.level}</span>
                    <img class="nb-win-level-check" src="images/check.svg" alt="" />
                  </div>
                </div>

                <div class="nb-win-title ${staged ? "is-hidden" : ""}">
                  ${isWin ? "Level<br />Complete" : "Game<br />Over"}
                </div>

                                <div class="nb-win-stats">
                  ${
                    isWin
                      ? `
                    <div class="nb-win-stat-card ${staged ? "is-hidden" : ""}">
                      <div class="nb-win-stat-head">Speed</div>
                      <div class="nb-win-stat-body">
                        <img class="nb-win-stat-icon" src="images/speed.svg" alt="" />
                        <div class="nb-win-stat-value">${formatWinTime(state.elapsedMs)}</div>
                      </div>
                    </div>

                    <div class="nb-win-stat-card ${staged ? "is-hidden" : ""}">
                      <div class="nb-win-stat-head">Blasts</div>
                      <div class="nb-win-stat-body">
                        <img class="nb-win-stat-icon" src="images/blast.svg" alt="" />
                        <div class="nb-win-stat-value">${state.blastsThisLevel || 0}</div>
                      </div>
                    </div>
                  `
                      : `
                    <div class="nb-win-stat-card ${staged ? "is-hidden" : ""}">
                      <div class="nb-win-stat-head">Score</div>
                      <div class="nb-win-stat-body nb-win-stat-body--solo">
                        <div class="nb-win-stat-value">${state.totalScore}</div>
                      </div>
                    </div>

                    <div class="nb-win-stat-card ${staged ? "is-hidden" : ""}">
                      <div class="nb-win-stat-head">Top Score</div>
                      <div class="nb-win-stat-body nb-win-stat-body--solo">
                        <div class="nb-win-stat-value">${highScore}</div>
                      </div>
                    </div>
                  `
                  }
                </div>

              <button type="button" class="nb-win-next ${staged ? "is-hidden" : ""}">
                ${isWin ? (isLastLevel ? "Play Again" : "Next Level") : "Play Again"}
              </button>
            </div>
          `;

          const nextBtn = wrap.querySelector(".nb-win-next");
          if (nextBtn) {
            nextBtn.addEventListener("click", async () => {
              clearMount(mount);
              const nextGame = window.createNumberBlastGame({
                config: {
                  mount,
                  level: isWin ? (isLastLevel ? 1 : nextLevel) : 1,
                },
              });
              await nextGame.start();
            });
          }

          if (typeof onResolved === "function") {
            queueMicrotask(() =>
              onResolved({
                outcome: mode,
                score: state.totalScore,
                level: state.level,
                nextLevel: isWin ? (isLastLevel ? 1 : nextLevel) : 1,
              })
            );
          }
        }

        async function runWinScreenReveal() {
          const badgeWrap = wrap.querySelector(".nb-win-level-badge-wrap");
          const title = wrap.querySelector(".nb-win-title");
          const cards = Array.from(wrap.querySelectorAll(".nb-win-stat-card"));
          const button = wrap.querySelector(".nb-win-next");

          if (badgeWrap) {
            badgeWrap.classList.remove("is-hidden");
            badgeWrap.classList.add("nb-win-reveal-in");
          }
          await wait(endMs(260));

          if (title) {
            title.classList.remove("is-hidden");
            title.classList.add("nb-win-reveal-in");
          }
          await wait(endMs(260));

          for (const card of cards) {
            card.classList.remove("is-hidden");
            card.classList.add("nb-win-reveal-in");
            await wait(endMs(200));
          }

          if (button) {
            button.classList.remove("is-hidden");
            button.classList.add("nb-win-reveal-in");
          }
        }

        async function animateLevelBadgeToCheck() {
          const badge = wrap.querySelector(".nb-win-level-badge");
          const number = wrap.querySelector(".nb-win-level-number");
          const check = wrap.querySelector(".nb-win-level-check");

          if (!badge || !number || !check) return;

          await wait(endMs(560));

          badge.classList.add("is-completing");
          number.classList.add("nb-win-level-number-popout");

          await wait(endMs(460));

          number.classList.add("is-hidden");
          check.classList.add("is-visible", "nb-win-check-popin");
        }

        async function runLevelCompleteSequence() {
          lockGameInput(true);

          await pulseProgressGoalHit();
          spawnWinConfetti(30);
          await wait(endMs(360));

          await explodeBoardForWinSequence();
          await wait(endMs(120));

          await playBoardToWinTransition();

          showEndScreen({
            mode: "win",
            staged: true,
            onResolved: (payload) => resolve(payload),
          });

          await wait(endMs(140));
          await runWinScreenReveal();
          await animateLevelBadgeToCheck();

          lockGameInput(false);
        }

        async function runGameOverSequence(extra = {}) {
          lockGameInput(true);

          await wait(endMs(120));
          await playBoardToWinTransition();

          showEndScreen({
            mode: "lose",
            staged: true,
            onResolved: (payload) => resolve(payload),
          });

          await wait(endMs(140));
          await runWinScreenReveal();

          lockGameInput(false);
        }
      

        window.nbDebug = {
          addScore(amount = 50) {
            state.levelScore += amount;
            state.totalScore += amount;
            updateTopbar();
        
            lastProgressPct = getLevelProgressPct(state);
        
            console.log("Added:", amount);
            console.log("Level:", state.levelScore, "/", state.levelGoal);
          },
        
          setLevelScore(value = 0) {
            state.levelScore = Math.max(0, value);
            updateTopbar();
        
            console.log("LevelScore set to:", state.levelScore, "/", state.levelGoal);
          },
        
          setProgress(value = 0) {
            state.levelScore = Math.max(0, Math.min(value, state.levelGoal));
            updateTopbar();
        
            console.log("Progress set to:", state.levelScore, "/", state.levelGoal);
          },
        
          addProgress(amount = 10) {
            state.levelScore = Math.min(state.levelGoal, state.levelScore + amount);
            state.totalScore += amount;
            updateTopbar();
        
            console.log("Progress:", state.levelScore, "/", state.levelGoal);
          },
        
          setLives(value = 1) {
            state.lives = Math.max(0, Number(value) || 0);
            updateTopbar();
        
            console.log("Lives set to:", state.lives);
          },
        
          winLevel() {
            state.levelScore = state.levelGoal;
            updateTopbar();
            showEndScreen({ mode: "win" });
          },
        
          loseLevel() {
            showEndScreen({ mode: "lose" });
          },
        
          resetLevelProgress() {
            state.levelScore = 0;
            state.levelBlasts = 0;
            state.levelStartedAt = Date.now();
            updateTopbar();
        
            console.log("Level progress reset");
          },
        
          getState() {
            console.log({
              level: state.level,
              levelScore: state.levelScore,
              levelGoal: state.levelGoal,
              totalScore: state.totalScore,
              levelBlasts: state.levelBlasts,
              lives: state.lives
            });
          }
        };

        async function explodeOpeningHoles(count = 5) {
          const picks = pickOpeningHoleIndices(state, count);
          if (!picks.length) return 0;

          const hit = new Set(picks);
          animateRowExplode(hit, { chainStep: 1, groupCount: hit.size });
          await wait(ROW_EXPLODE_MS + 80);

          clearHitCells(state, hit);

          gridEl.querySelectorAll(".nb-tile.nb-explode-source-hide").forEach((el) => {
            el.classList.remove("nb-explode-source-hide");
          });

          renderGrid(true);
          await wait(120);

          const moved = applyGravity(state);
          renderGrid(true);

          if (moved.length) {
            animateGravityDrop(moved);
            await wait(460);
          }

          const blasts = await resolveBoardChains(
            state,
            render,
            animateRowExplode,
            animateGravityDrop,
            showComboText,
            gridEl,
            finish,
            sfx,
            runGameOverSequence
          );

          if (blasts > 0) {
            awardForGroups(blasts);
            updateTopbar();
            popBigScore();
            burstScoreStars(blasts);
          }

          return hit.size + blasts;
        }

        async function explodeRandomSupportedBlocks(count = 3) {
          const picks = pickRandomSupportedExplosionIndices(state, count);
          if (!picks.length) return 0;
        
          const hit = new Set(picks);
          animateRowExplode(hit, { chainStep: 1, groupCount: hit.size });
          await wait(ROW_EXPLODE_MS + 80);
        
          clearHitCells(state, hit);
        
          gridEl.querySelectorAll(".nb-tile.nb-explode-source-hide").forEach((el) => {
            el.classList.remove("nb-explode-source-hide");
          });
        
          renderGrid(true);
          await wait(120);
        
          const moved = applyGravity(state);
          renderGrid(true);
        
          if (moved.length) {
            animateGravityDrop(moved);
            await wait(460);
          }
        
          const blasts = await resolveBoardChains(
            state,
            render,
            animateRowExplode,
            animateGravityDrop,
            showComboText,
            gridEl,
            finish,
            sfx,
            runGameOverSequence
          );
        
          if (blasts > 0) {
            awardForGroups(blasts);
            updateTopbar();
            popBigScore();
            burstScoreStars(blasts);
          }
        
          return hit.size;
        }

        async function ensureThreeSupportedEmptySquares() {
          return 0;
        }

        function getPointerAnchor(clientX, clientY) {
          const biasY = Math.min(window.innerHeight * 0.04, 28);
          return cellIndexFromPointer(clientX, clientY - biasY);
        }

        function getAdjustedAnchor(clientX, clientY, piece, grabCell, hoverBiasY = 0, ghostEl = null) {
          const hoverIndex = cellIndexFromPointer(clientX, clientY - hoverBiasY, 10);

          if (hoverIndex == null || !piece) return hoverIndex;

          const hoverRC = rc(state, hoverIndex);

          if (!ghostEl) {
            if (!grabCell) return hoverIndex;

            const fallbackAnchorR = hoverRC.r - grabCell.y;
            const fallbackAnchorC = hoverRC.c - grabCell.x;

            if (
              fallbackAnchorR < 0 ||
              fallbackAnchorC < 0 ||
              fallbackAnchorR >= state.size ||
              fallbackAnchorC >= state.size
            ) {
              return null;
            }

            return idx(state, fallbackAnchorR, fallbackAnchorC);
          }

          const ghostRect = ghostEl.getBoundingClientRect();
          const sampleCell = gridEl ? gridEl.querySelector(".nb-cell") : null;
          const cellPx = sampleCell
            ? sampleCell.getBoundingClientRect().width
            : 62;
          const gapPx = gridEl
            ? parseFloat(getComputedStyle(gridEl).gap) || 14
            : 14;

          let bestAnchor = null;
          let bestScore = Infinity;

          piece.cells.forEach((pc, pieceCellIndex) => {
            const anchorR = hoverRC.r - pc.y;
            const anchorC = hoverRC.c - pc.x;

            if (
              anchorR < 0 ||
              anchorC < 0 ||
              anchorR >= state.size ||
              anchorC >= state.size
            ) {
              return;
            }

            const centerX = ghostRect.left + pc.x * (cellPx + gapPx) + cellPx / 2;
            const centerY = ghostRect.top + pc.y * (cellPx + gapPx) + cellPx / 2;
            const dx = clientX - centerX;
            const dy = (clientY - hoverBiasY) - centerY;
            const dist = Math.hypot(dx, dy);

            const grabBonus = grabCell && grabCell.x === pc.x && grabCell.y === pc.y ? -0.75 : 0;
            const indexBias = pieceCellIndex * 0.01;
            const score = dist + grabBonus + indexBias;

            if (score < bestScore) {
              bestScore = score;
              bestAnchor = idx(state, anchorR, anchorC);
            }
          });

          if (bestAnchor != null) return bestAnchor;

          if (!grabCell) return hoverIndex;

          const fallbackAnchorR = hoverRC.r - grabCell.y;
          const fallbackAnchorC = hoverRC.c - grabCell.x;

          if (
            fallbackAnchorR < 0 ||
            fallbackAnchorC < 0 ||
            fallbackAnchorR >= state.size ||
            fallbackAnchorC >= state.size
          ) {
            return null;
          }

          return idx(state, fallbackAnchorR, fallbackAnchorC);
        }

        function cellIndexFromPointer(x, y, pad = 10) {
          const cells = Array.from(gridEl.querySelectorAll(".nb-cell"));
          if (!cells.length) return null;

          for (const cellEl of cells) {
            const rect = cellEl.getBoundingClientRect();
            if (
              x >= rect.left - pad &&
              x <= rect.right + pad &&
              y >= rect.top - pad &&
              y <= rect.bottom + pad
            ) {
              return Number(cellEl.dataset.cellIndex);
            }
          }

          return null;
        }

        function cellElFromIndex(i) {
          return wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`) || null;
        }

        function getGhostLockedPosition(anchorIndex, piece, grabCell, ghostEl) {
          if (anchorIndex == null || !piece || !grabCell || !ghostEl) return null;

          const anchorCellEl = cellElFromIndex(anchorIndex);
          if (!anchorCellEl) return null;

          const anchorRect = anchorCellEl.getBoundingClientRect();
          const ghostRect = ghostEl.getBoundingClientRect();

          const sampleCell = gridEl ? gridEl.querySelector(".nb-cell") : null;
          const cellPx = sampleCell
            ? sampleCell.getBoundingClientRect().width
            : 62;

          const gapPx = gridEl
            ? parseFloat(getComputedStyle(gridEl).gap) || 14
            : 14;

          const lockX = anchorRect.left - grabCell.x * (cellPx + gapPx);
          const lockY = anchorRect.top - grabCell.y * (cellPx + gapPx);

          return {
            x: lockX,
            y: lockY,
          };
        }

        function clearHover() {
          if (hoverPreview && hoverPreview.size) {
            hoverPreview.forEach((prev, i) => {
              const el = cellElFromIndex(i);
              if (!el) return;
              const tile = el.querySelector(".nb-tile");
              if (!tile) return;
        
              tile.className = prev.className || "nb-tile";
              tile.textContent = prev.text || "";
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
        
          const covered = getSettledCoveredIndices(state, anchorIndex, piece);
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
              if (!hoverPreview.has(i)) {
                hoverPreview.set(i, {
                  text: tile.textContent || "",
                  className: tile.className || "nb-tile"
                });
              }
        
              tile.className = `nb-tile is-filled ${getNumberColorClass(piece.cells[k].v)}`;
              tile.textContent = String(piece.cells[k].v);
              tile.setAttribute("data-preview", "1");
            }
          }
        }

        function updateTopbar() {
          const highScore = readNumber("NB_HIGH_SCORE", 0);
          const progressPct = getLevelProgressPct(state);
        
          if (!top.querySelector(".nb-hud")) {
            top.innerHTML = `
              <div class="nb-hud">
                <div class="nb-hud-row">
                  <div class="nb-hud-box nb-hud-box--score" aria-label="High score">
                    <span class="nb-hud-box-icon nb-hud-box-icon--crown"></span>
                    <span class="nb-hud-box-value nb-hud-box-value--score">0</span>
                  </div>
          
                  <div class="nb-hud-box nb-hud-box--lives" aria-label="Lives">
                    <span class="nb-hud-box-icon nb-hud-box-icon--heart"></span>
                    <span class="nb-hud-box-value nb-hud-box-value--lives">0</span>
                  </div>
                </div>
              </div>
            `;
          }
          
          if (!scoreBlock.querySelector(".nb-big-score-wrap")) {
            scoreBlock.innerHTML = `
              <div class="nb-big-score-wrap">
                <div class="nb-big-score" aria-label="Current points">0</div>
          
                <div class="nb-level-progress" aria-label="Level progress">
                  <div class="nb-level-progress-fill"></div>
                </div>
              </div>
            `;
          }
        
          const scoreValue = top.querySelector(".nb-hud-box-value--score");
          const livesValue = top.querySelector(".nb-hud-box-value--lives");
          const bigScore = scoreBlock.querySelector(".nb-big-score");
          const progressFill = scoreBlock.querySelector(".nb-level-progress-fill");
        
          if (scoreValue) scoreValue.textContent = String(highScore);
          if (livesValue) livesValue.textContent = String(state.lives);
          if (bigScore) bigScore.textContent = String(state.totalScore);
        
          if (progressFill) {
            progressFill.style.width = `${progressPct}%`;
          }

          if (progressPct > lastProgressPct + 0.01) {
          }
          lastProgressPct = progressPct;

          if (progressFill) {
            progressFill.classList.remove("nb-fill-hit");
            void progressFill.offsetWidth;
            progressFill.classList.add("nb-fill-hit");
          }
        }
                  
        function renderGrid(showFilled = true) {
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
        
              if (cell && showFilled) {
                if (isSkullCell(cell)) {
                  tile.classList.add("is-filled", "nb-skull-tile");
              
                  const skullIcon = document.createElement("img");
                  skullIcon.className = "nb-skull-icon";
                  skullIcon.src = "images/skull.svg";
                  skullIcon.alt = "";
                  tile.appendChild(skullIcon);
                } else {
                  tile.classList.add("is-filled", getNumberColorClass(cell.v));
                  tile.textContent = String(cell.v);
                }
              
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

        function unlockAudioOnce() {
          sfx.unlock();
          window.removeEventListener("pointerdown", unlockAudioOnce, true);
        }
        
        window.addEventListener("pointerdown", unlockAudioOnce, true);
        addCleanup(() => {
          window.removeEventListener("pointerdown", unlockAudioOnce, true);
        });

        function buildHandPiece(piece, hi, shouldPop = false) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "nb-piece";
          btn.dataset.handIndex = String(hi);
        
          const shapeEl = document.createElement("div");
          shapeEl.className = "nb-piece-shape";
          btn.appendChild(shapeEl);
        
          const handSize = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--nb-hand-size")
          ) || 150;
          
          const MAX_DIM = 3;
          const pad = 0;
          const scale =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-ui-scale")) || 1;
        const gap = Math.round(6 * scale);
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
          
          if (shouldPop) {
            btn.classList.remove("nb-piece-pop");
            void btn.offsetWidth;
            btn.classList.add("nb-piece-pop");
          }
        
          const onDown = (ev) => {
            if (finished || handLocked) return;
            ev.preventDefault();
          
            sfx.play("pickup", {
              volume: 1,
              rate: 1,
              from: 0,
            });
          
            stopActiveDrag();
            btn.classList.add("is-dragging");
          
            const originalPiece = state.hand[hi];

            const ghostNudgeY = 100;
        
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
        
            const ghost = btn.cloneNode(true);
            ghost.classList.add("drag-ghost");
            ghost.classList.remove("is-dragging");
            ghost.style.position = "fixed";
            ghost.style.left = `${rect.left}px`;
            ghost.style.top = `${rect.top}px`;
            ghost.style.pointerEvents = "none";
            ghost.style.zIndex = "9999";
            ghost.style.willChange = "transform";
            ghost.style.margin = "0";
            
            const sampleCell = gridEl ? gridEl.querySelector(".nb-cell") : null;
            const cellPx = sampleCell
              ? sampleCell.getBoundingClientRect().width
              : 62;
            
            const gapPx = gridEl
              ? parseFloat(getComputedStyle(gridEl).gap) || 14
              : 14;
            
            const b = pieceBounds(originalPiece);
            const ghostW = b.w * cellPx + (b.w - 1) * gapPx;
            const ghostH = b.h * cellPx + (b.h - 1) * gapPx;
            
            ghost.style.width = `${ghostW}px`;
            ghost.style.height = `${ghostH}px`;
            
            const ghostShape = ghost.querySelector(".nb-piece-shape");
            if (ghostShape) {
              ghostShape.style.width = `${ghostW}px`;
              ghostShape.style.height = `${ghostH}px`;
            
              ghost.querySelectorAll(".nb-mini").forEach((mini) => {
                const px = Number(mini.dataset.px || 0);
                const py = Number(mini.dataset.py || 0);
                mini.style.width = `${cellPx}px`;
                mini.style.height = `${cellPx}px`;
                mini.style.left = `${px * (cellPx + gapPx)}px`;
                mini.style.top = `${py * (cellPx + gapPx)}px`;
              });
            }

            ghost.style.pointerEvents = "none";
            ghost.style.zIndex = "9999";
            ghost.style.willChange = "transform";
            ghost.style.margin = "0";
            document.body.appendChild(ghost);
        
            function moveGhost(x, y) {
              const targetX = x - grabOffsetX - rect.left;
              const targetY = y - grabOffsetY - ghostNudgeY - rect.top;
              ghost.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
            }
            
            moveGhost(ev.clientX, ev.clientY);
            
            highlightPlacement(
              getAdjustedAnchor(ev.clientX, ev.clientY, originalPiece, grabCell, ghostNudgeY, ghost),
              originalPiece
            );

            try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
        
            const onMove = (e) => {
              moveGhost(e.clientX, e.clientY);
              const ci = getAdjustedAnchor(e.clientX, e.clientY, originalPiece, grabCell, ghostNudgeY, ghost);
              if (ci == null) {
                clearHover();
                return;
              }
              highlightPlacement(ci, originalPiece);
            };
        
            const onUp = (evUp) => {
              document.removeEventListener("pointermove", onMove);
              document.removeEventListener("pointerup", onUp);
              document.removeEventListener("pointercancel", onUp);
            
              const currentGhost = ghost;
              const currentBtn = btn;
              activeDrag = null;
            
              const ci = getAdjustedAnchor(
                evUp.clientX,
                evUp.clientY,
                originalPiece,
                grabCell,
                ghostNudgeY,
                currentGhost
              );
              const canUse =
                ci != null &&
                originalPiece &&
                canPlacePiece(state, ci, originalPiece);
            
              clearHover();
            
              if (canUse) {
                Promise.resolve(placePiece(ci, hi, originalPiece)).catch((err) => {
                  currentBtn.classList.remove("is-dragging");
                  console.error(err);
                });
              }                else {
                currentBtn.classList.remove("is-dragging");
              }
            
              currentGhost.style.transition = "transform 110ms cubic-bezier(.22,1,.36,1), opacity 110ms ease";
              currentGhost.style.opacity = "0";
              currentGhost.style.transform += " scale(0.94)";
              setTimeout(() => {
                try { currentGhost.remove(); } catch (e) {}
              }, 110);
            
              try { currentBtn.releasePointerCapture(ev.pointerId); } catch (e) {}
            };
        
            activeDrag = { ghost, onMove, onUp, card: btn, pointerId: ev.pointerId, handIndex: hi };
            document.addEventListener("pointermove", onMove, { passive: true });
            document.addEventListener("pointerup", onUp);
            document.addEventListener("pointercancel", onUp);
          };
        
          btn.addEventListener("pointerdown", onDown);
          addCleanup(() => btn.removeEventListener("pointerdown", onDown));
        
          return btn;
        }

        function renderHand(opts = {}) {
          const animateIndices = new Set(Array.isArray(opts.animateIndices) ? opts.animateIndices : []);
          const revealAll = !!opts.revealAll;
        
          handEl.innerHTML = "";
          handEl.classList.remove("nb-ready");
        
          state.hand.forEach((piece, hi) => {
            const btn = buildHandPiece(piece, hi, animateIndices.has(hi));
            handEl.appendChild(btn);
          });
        
          if (revealAll) {
            requestAnimationFrame(() => {
              handEl.classList.add("nb-ready");
            });
          } else {
            handEl.classList.add("nb-ready");
          }
        }

        function render(showFilled = true, handOpts = {}) {
          cleanupFns.forEach((fn) => {
            try { fn(); } catch (e) {}
          });
          cleanupFns = [];
          updateTopbar();
          renderGrid(showFilled);
          renderHand(handOpts);
        }

        async function runIntroSequence() {
          handLocked = true;
          const STEP = 180;
          const START_DELAY = 90;
        
          const hudRow = top.querySelector(".nb-hud-row");
          const bigScore = scoreBlock.querySelector(".nb-big-score");
          
          top.classList.remove("nb-reveal");
          scoreBlock.classList.remove("nb-reveal");
          boardWrap.classList.remove("nb-reveal");
          handRail.classList.remove("nb-reveal");
          
          if (hudRow) hudRow.classList.remove("nb-reveal");
          if (bigScore) bigScore.classList.remove("nb-reveal", "nb-score-pop");
          handEl.classList.remove("nb-reveal", "nb-ready");
          gridEl.classList.remove("nb-tiles-reveal");
        
          await delay(START_DELAY);
        
          /* 1. top bar */
          top.classList.add("nb-reveal");
          if (hudRow) hudRow.classList.add("nb-reveal");

          await delay(STEP);

          /* 2. score block */
          scoreBlock.classList.add("nb-reveal");
          if (bigScore) {
            bigScore.classList.add("nb-reveal");
            void bigScore.offsetWidth;
            bigScore.classList.add("nb-score-pop");
          }
        
          await delay(STEP);
        
          /* 3. board shell */
          boardWrap.classList.add("nb-reveal");
          if (!introPopPlayed) {
            introPopPlayed = true;
          }

          await delay(STEP);
          /* 4. hand space */
          handRail.classList.add("nb-reveal");
        
          await delay(STEP);
        
          /* 5. board tiles */
          shouldAnimateBoardSpawn = true;
          renderGrid(true);
        
          await delay(STEP);
        
          /* 6. hand tiles */
          handEl.classList.add("nb-reveal");
          renderHand();

          /* allow board to settle */
          await delay(650);

          /* board pulse + opening blast happen together */
          gridEl.classList.remove("nb-pulse");
          void gridEl.offsetWidth;
          gridEl.classList.add("nb-pulse");

          await explodeOpeningHoles(5);

          gridEl.classList.remove("nb-pulse");
          ensurePlayableHand(state, 24);
          render(true);
          
          await delay(220);
          
          const skullSpawn = spawnSkullAtTop(state);
          render(true);
          
          if (skullSpawn && skullSpawn.moved && skullSpawn.moved.length) {
            animateGravityDrop(skullSpawn.moved);
            await wait(460);
          }
          
          render(true);
          handLocked = false;
        }

        function animateRowExplode(hitSet, opts = {}) {
          const chainStep = opts.chainStep || 1;
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

        function popBigScore() {
          const bigScore = scoreBlock.querySelector(".nb-big-score");
          if (!bigScore) return;
        
          bigScore.classList.remove("nb-score-pop");
          void bigScore.offsetWidth;
          bigScore.classList.add("nb-score-pop");
        }

        function burstScoreStars(blasts = 1) {
          const bigScore = scoreBlock.querySelector(".nb-big-score");
          if (!bigScore) return;
        
          let starsHost = scoreBlock.querySelector(".nb-score-stars");
          if (!starsHost) {
            starsHost = document.createElement("div");
            starsHost.className = "nb-score-stars";
            scoreBlock.appendChild(starsHost);
          }
        
          starsHost.innerHTML = "";
        
          const frag = document.createDocumentFragment();
          const scoreBlockRect = scoreBlock.getBoundingClientRect();
          const scoreRect = bigScore.getBoundingClientRect();

          const originX = scoreRect.left - scoreBlockRect.left + scoreRect.width / 2;
          const originY = scoreRect.top - scoreBlockRect.top + scoreRect.height / 2;

          const starCount = Math.min(18, 6 + blasts * 4);

          for (let i = 0; i < starCount; i++) {
            const star = document.createElement("div");
            star.className = "nb-score-star";
            star.style.left = `${originX}px`;
            star.style.top = `${originY}px`;

            const angle = Math.random() * Math.PI * 2;
            const dist = 72 + Math.random() * 72 + blasts * 14;
            const sx = Math.cos(angle) * dist;
            const sy = Math.sin(angle) * dist - 8 - Math.random() * 18;

            star.style.setProperty("--ssx", `${sx.toFixed(0)}px`);
            star.style.setProperty("--ssy", `${sy.toFixed(0)}px`);
            star.style.setProperty("--ss-rot", `${(Math.random() * 220 - 110).toFixed(0)}deg`);
            star.style.setProperty("--ss-delay", `${Math.random() * 80}ms`);
            star.style.setProperty("--ss-size", `${8 + Math.random() * 24}px`);

            frag.appendChild(star);
          }

          starsHost.appendChild(frag);

          setTimeout(() => {
            starsHost.innerHTML = "";
          }, 1450);
        }
        

        function awardForGroups(groupCount) {
          const bonus = groupCount >= 3 ? 2 : groupCount >= 2 ? 1 : 0;
          const gained = 10 * groupCount + 15 * bonus;
        
          state.clears += groupCount;
          state.levelBlasts += groupCount;
          state.levelScore += gained;
          state.totalScore += gained;
        
          const best = readNumber("NB_HIGH_SCORE", 0);
          if (state.totalScore > best) {
            writeNumber("NB_HIGH_SCORE", state.totalScore);
          }
        }

        async function animatePlacedPieceGravity(piece, rawPlaced, settledPlaced) {
          if (!piece || !rawPlaced || !settledPlaced || rawPlaced.length !== settledPlaced.length) {
            return;
          }

          const boardRect = boardWrap.getBoundingClientRect();
          const frag = document.createDocumentFragment();
          const clones = [];

          for (let k = 0; k < piece.cells.length; k++) {
            const fromIndex = rawPlaced[k];
            const toIndex = settledPlaced[k];
            if (fromIndex == null || toIndex == null) continue;

            const fromCell = cellElFromIndex(fromIndex);
            const toCell = cellElFromIndex(toIndex);
            if (!fromCell || !toCell) continue;

            const fromTile = fromCell.querySelector(".nb-tile");
            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();

            const dx = toRect.left - fromRect.left;
            const dy = toRect.top - fromRect.top;
            const rowsDropped = Math.max(0, rc(state, toIndex).r - rc(state, fromIndex).r);

            const clone = document.createElement("div");
            clone.className = `nb-tile is-filled ${getNumberColorClass(piece.cells[k].v)} nb-placed-fall-clone`;
            clone.textContent = String(piece.cells[k].v);
            clone.style.left = `${fromRect.left - boardRect.left}px`;
            clone.style.top = `${fromRect.top - boardRect.top}px`;
            clone.style.width = `${fromRect.width}px`;
            clone.style.height = `${fromRect.height}px`;
            clone.style.setProperty("--fall-x", `${dx}px`);
            clone.style.setProperty("--fall-y", `${dy}px`);
            clone.style.setProperty("--fall-duration", `${520 + rowsDropped * 160}ms`);

            frag.appendChild(clone);
            clones.push(clone);
          }

          sparkLayer.appendChild(frag);

          await new Promise((resolve) => requestAnimationFrame(resolve));

          clones.forEach((clone) => {
            clone.classList.add("is-animating");
          });

          const maxRows = Math.max(
            1,
            ...rawPlaced.map((fromIndex, k) => {
              const toIndex = settledPlaced[k];
              return Math.max(0, rc(state, toIndex).r - rc(state, fromIndex).r);
            })
          );

          await wait(520 + maxRows * 160 + 140);

          clones.forEach((clone) => {
            try { clone.remove(); } catch (e) {}
          });
        }

        async function placePiece(anchorIndex, handIndex, pieceOverride) {
          const piece = pieceOverride || state.hand[handIndex];
          if (!piece) return false;
        
          if (!canPlacePiece(state, anchorIndex, piece)) {
            shakeBad();
            return false;
          }
        
          const covered = getSettledCoveredIndices(state, anchorIndex, piece);
          if (!covered) {
            shakeBad();
            return false;
          }

          sfx.play("place", {
            volume: 1,
            rate: 1,
            from: 0,
          });
        
          const rawPlaced = getCoveredIndices(state, anchorIndex, piece);
          const settledPlaced = getSettledCoveredIndices(state, anchorIndex, piece);
        
          if (!rawPlaced || !settledPlaced) {
            shakeBad();
            return false;
          }
        
          const hasGravityDrop = settledPlaced.some((toIndex, k) => toIndex !== rawPlaced[k]);
        
          for (let k = 0; k < piece.cells.length; k++) {
            const bi = settledPlaced[k];
            const pc = piece.cells[k];
            state.board[bi] = { v: pc.v };
          }
        
          updateTopbar();
          renderGrid(true);
        
          if (hasGravityDrop) {
            const moved = settledPlaced.map((to, k) => ({
              from: rawPlaced[k],
              to,
            }));
        
            animateGravityDrop(moved);
            await wait(460);
          } else {
            settledPlaced.forEach((toIndex, k) => {
              const cellEl = wrap.querySelector(`.nb-cell[data-cell-index="${toIndex}"]`);
              const tileEl = cellEl ? cellEl.querySelector(".nb-tile") : null;
              if (!tileEl) return;
        
              tileEl.classList.remove("nb-place-settle");
              tileEl.style.setProperty("--place-delay", `${k * 24}ms`);
              void tileEl.offsetWidth;
              tileEl.classList.add("nb-place-settle");
            });
        
            await wait(220);
          }
        
          clearHover();

          // replace the used hand piece immediately, before any blast chain starts
          state.hand[handIndex] = makePiece(state, { forceClearNow: false });
          
          if (!hasClearMove(state)) {
            const forced = findGuaranteedClearPiece(state);
            if (forced) {
              state.hand[handIndex] = forced;
            }
          }
          
          render(true, { animateIndices: [handIndex] });

          const blasts = await resolveBoardChains(
            state,
            render,
            animateRowExplode,
            animateGravityDrop,
            showComboText,
            gridEl,
            finish,
            sfx,
            runGameOverSequence
          );

          if (blasts > 0) {
            awardForGroups(blasts);
            updateTopbar();
            popBigScore();
            burstScoreStars(blasts);
          }

          if (hasLevelWin(state)) {
            await runLevelCompleteSequence();
            return true;
          }

          await ensureThreeSupportedEmptySquares();
        
          if (!anyMovesAvailable(state)) {
            await ensureThreeSupportedEmptySquares();
            state.hand[handIndex] = makePiece(state, { forceClearNow: false });
            ensurePlayableHand(state, 24);
            render(true, { animateIndices: [handIndex] });
          }
        
          if (!anyMovesAvailable(state)) {
            await wait(250);
            await runGameOverSequence({
              reason: "no-moves",
              score: state.totalScore,
              wins: state.wins,
            });
          }
        
          return true;
        }

        render(false);
        runIntroSequence();
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

  function getSettledCoveredIndices(state, anchorIndex, piece) {
    if (!state || !piece) return null;
    if (!Number.isFinite(Number(anchorIndex))) return null;
  
    const a = rc(state, anchorIndex);
    const base = [];
  
    for (const pc of piece.cells) {
      const r = a.r + pc.y;
      const c = a.c + pc.x;
      if (r < 0 || r >= state.size || c < 0 || c >= state.size) return null;
      base.push({ r, c, v: pc.v, x: pc.x, y: pc.y });
    }
  
    const occupied = new Set();
    const settled = [];
  
    base.sort((p1, p2) => p2.r - p1.r || p1.c - p2.c);
  
    for (const cell of base) {
      let targetR = cell.r;
  
      while (targetR + 1 < state.size) {
        const belowIndex = idx(state, targetR + 1, cell.c);
        const belowKey = `${targetR + 1},${cell.c}`;
  
        if (state.board[belowIndex] != null) break;
        if (occupied.has(belowKey)) break;
  
        targetR += 1;
      }
  
      const finalKey = `${targetR},${cell.c}`;
      if (occupied.has(finalKey)) return null;
      if (state.board[idx(state, targetR, cell.c)] != null) return null;
  
      occupied.add(finalKey);
      settled.push({
        r: targetR,
        c: cell.c,
        v: cell.v,
        x: cell.x,
        y: cell.y,
      });
    }
  
    return piece.cells.map((pc) => {
      const match = settled.find((s) => s.x === pc.x && s.y === pc.y);
      return match ? idx(state, match.r, match.c) : null;
    });
  }

  function canPlacePiece(state, anchorIndex, piece) {
    const settled = getSettledCoveredIndices(state, anchorIndex, piece);
    return !!(settled && settled.length);
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

  window.createNumberBlastGame = createNumberBlastGame;
})();
