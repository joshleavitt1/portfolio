// games/number-blast/index.js
(function () {
  "use strict";

  // ============================================================
  // Number Blast (Make 10) — Block Blast inspired
  // - 5x5 board (empty start)
  // - Drag/drop PIECES (shapes with numbers)
  // - Clear any contiguous HORIZONTAL or VERTICAL group that sums to 10
  // - Each cleared GROUP = +1 charge (combo bonus)
  // - Charge hits 5 => WIN
  // - No legal placements => LOSE
  //
  // Secret sauce:
  // - Hand curation: reroll hand until at least 1 clear is possible soon
  // - Completion bias: numbers biased toward complements on board
  // - Hand constraint: prevent 3,2,2 width (and tall equivalent)
  // ============================================================

  const SIZE = 5;
  const HAND_SIZE = 3;

  const TARGET_SUM = 10;
  const ATTACK_CHARGE_TO_WIN = 5;

  const LEVEL_MAX = 10;
  const COLOR_KEYS = ["c1", "c2", "c3", "c4", "c5"];

  const ROW_EXPLODE_MS = 650; // must match CSS explode duration

  // Track “game wins” for the pip-check display
  const WINS_KEY = "NB_GAME_WINS";
  const WINS_TO_SHOW = 5;

  function idx(r, c) { return r * SIZE + c; }
  function rc(i) { return { r: Math.floor(i / SIZE), c: i % SIZE }; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function readWins() {
    try { return Math.max(0, Number(localStorage.getItem(WINS_KEY) || 0) || 0); } catch (e) {}
    return 0;
  }
  function writeWins(n) {
    try { localStorage.setItem(WINS_KEY, String(Math.max(0, n | 0))); } catch (e) {}
  }

  // ============================================================
  // Shapes (no rotations)
  // ============================================================

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

  function shapeWeight(shapeId, level) {
    if (shapeId === "s1") return level <= 2 ? 14 : 8;
    if (shapeId === "h2" || shapeId === "v2") return level <= 4 ? 10 : 8;
    if (shapeId === "h3" || shapeId === "v3") return level <= 6 ? 6 : 8;
    if (shapeId.startsWith("l3")) return level <= 6 ? 4 : 7;
    if (shapeId === "sq4") return level <= 7 ? 3 : 5;
    return 1;
  }

  function weightedPickShape(level) {
    const bag = [];
    for (const s of SHAPES) {
      const w = shapeWeight(s.id, level);
      for (let i = 0; i < w; i++) bag.push(s);
    }
    return pick(bag);
  }

  function normalizePieceCells(cells) {
    let minX = Infinity, minY = Infinity;
    for (const p of cells) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }
    return cells.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }));
  }

  // ============================================================
  // Completion bias numbers
  // ============================================================

  function levelNumberMax(level) {
    if (level <= 3) return 5;
    if (level <= 7) return 7;
    return 9;
  }

  function boardNeeds(state) {
    const needs = [];

    function scanLine(getCell) {
      for (let start = 0; start < SIZE; start++) {
        const first = getCell(start);
        if (!first) continue;

        let sum = 0;
        let end = start;

        while (end < SIZE) {
          const cell = getCell(end);
          if (!cell) break;
          sum += cell.v;
          if (sum >= TARGET_SUM) break;
          end++;
        }

        const runEnd = (end < SIZE && !getCell(end)) ? (end - 1) : end;
        const runSum = sum;

        const nextIndex = runEnd + 1;
        if (runSum > 0 && runSum < TARGET_SUM && nextIndex < SIZE && !getCell(nextIndex)) {
          needs.push(TARGET_SUM - runSum);
        }

        const prevIndex = start - 1;
        if (runSum > 0 && runSum < TARGET_SUM && prevIndex >= 0 && !getCell(prevIndex)) {
          needs.push(TARGET_SUM - runSum);
        }
      }
    }

    for (let r = 0; r < SIZE; r++) scanLine((c) => state.board[idx(r, c)]);
    for (let c = 0; c < SIZE; c++) scanLine((r) => state.board[idx(r, c)]);

    return needs;
  }

  function randTileValue(state) {
    const max = levelNumberMax(state.level);

    const pool = [];
    for (let i = 1; i <= max; i++) pool.push(i);

    const mids = [3, 4, 5, 6, 7].filter((n) => n >= 1 && n <= max);
    pool.push(...mids, ...mids);

    const needs = boardNeeds(state).filter((n) => n >= 1 && n <= max);
    if (needs.length) pool.push(...needs, ...needs, ...needs);

    return pick(pool);
  }

  function pieceHasAutoTen(piece) {
    const xs = new Set(piece.cells.map((c) => c.x));
    const ys = new Set(piece.cells.map((c) => c.y));

    for (const y of ys) {
      const rowCells = piece.cells.filter((c) => c.y === y).sort((a, b) => a.x - b.x);
      for (let i = 0; i < rowCells.length; i++) {
        let sum = 0;
        let prevX = rowCells[i].x - 1;
        for (let j = i; j < rowCells.length; j++) {
          const x = rowCells[j].x;
          if (x !== prevX + 1) break;
          sum += rowCells[j].v;
          if (sum === TARGET_SUM) return true;
          if (sum > TARGET_SUM) break;
          prevX = x;
        }
      }
    }

    for (const x of xs) {
      const colCells = piece.cells.filter((c) => c.x === x).sort((a, b) => a.y - b.y);
      for (let i = 0; i < colCells.length; i++) {
        let sum = 0;
        let prevY = colCells[i].y - 1;
        for (let j = i; j < colCells.length; j++) {
          const y = colCells[j].y;
          if (y !== prevY + 1) break;
          sum += colCells[j].v;
          if (sum === TARGET_SUM) return true;
          if (sum > TARGET_SUM) break;
          prevY = y;
        }
      }
    }

    return false;
  }

  // ============================================================
  // Piece creation
  // ============================================================

  function makePiece(state) {
    const shape = weightedPickShape(state.level);
    const color = pick(COLOR_KEYS);
    const norm = normalizePieceCells(shape.cells);

    for (let attempt = 0; attempt < 30; attempt++) {
      const pieceCells = norm.map((p) => ({ x: p.x, y: p.y, v: randTileValue(state) }));
      const piece = {
        id: `${shape.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        shapeId: shape.id,
        color,
        cells: pieceCells,
      };
      if (!pieceHasAutoTen(piece)) return piece;
    }

    return {
      id: `${shape.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      shapeId: shape.id,
      color,
      cells: norm.map((p) => ({ x: p.x, y: p.y, v: randTileValue(state) })),
    };
  }

  function pieceBounds(piece) {
    let maxX = 0, maxY = 0;
    for (const p of piece.cells) { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    return { w: maxX + 1, h: maxY + 1 };
  }

  function handAllowedWithCandidate(hand, candidate) {
    const cB = pieceBounds(candidate);

    const hasW3 = hand.some(p => pieceBounds(p).w >= 3) || cB.w >= 3;
    const hasH3 = hand.some(p => pieceBounds(p).h >= 3) || cB.h >= 3;

    // Prevent 3,2,2 width permutations
    if (hasW3) {
      const all = hand.slice(); all.push(candidate);
      const w2plusCount = all.filter(p => pieceBounds(p).w >= 2).length;
      if (w2plusCount > 1) return false;
    }

    // Prevent tall equivalent
    if (hasH3) {
      const all = hand.slice(); all.push(candidate);
      const h2plusCount = all.filter(p => pieceBounds(p).h >= 2).length;
      if (h2plusCount > 1) return false;
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
          if (!(isLarge && largeCount >= maxLargePieces)) break;
          piece = makePiece(state);
        }
        const b2 = pieceBounds(piece);
        if (b2.w >= 3 || b2.h >= 3) largeCount++;
      }

      hand.push(piece);
    }

    return hand;
  }

  // ============================================================
  // State
  // ============================================================

  function makeGameState(level) {
    const st = {
      level: clamp(Number(level || 1) || 1, 1, LEVEL_MAX),
      board: Array(SIZE * SIZE).fill(null),
      hand: [],
      charge: 0,
      clears: 0,
      score: 0,
      wins: readWins(), // persistent across runs
    };

    st.hand = generateHand(st, HAND_SIZE, 1);
    return st;
  }

  function getCoveredIndices(anchorIndex, piece) {
    const { r: ar, c: ac } = rc(anchorIndex);
    const out = [];
    for (const cell of piece.cells) {
      const rr = ar + cell.y;
      const cc = ac + cell.x;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return null;
      out.push(idx(rr, cc));
    }
    return out;
  }

  function canPlacePiece(state, anchorIndex, piece) {
    const covered = getCoveredIndices(anchorIndex, piece);
    if (!covered) return false;
    for (const i of covered) if (state.board[i] != null) return false;
    return true;
  }

  function anyMovesAvailable(state) {
    for (let hi = 0; hi < state.hand.length; hi++) {
      const piece = state.hand[hi];
      for (let bi = 0; bi < state.board.length; bi++) {
        if (state.board[bi] != null) continue;
        if (canPlacePiece(state, bi, piece)) return true;
      }
    }
    return false;
  }

  // ============================================================
  // ✅ CLEAR RULE (CORRECT):
  // Clear any contiguous horizontal OR vertical group that sums to 10.
  // Groups can be any length and can be sub-segments within a longer run.
  // Returns { groups:[{indices:number[]}], hit:Set<number> }
  // ============================================================

  function findGroupsToClear(board) {
    const groups = [];
    const hit = new Set();

    function scanLine(getIndexAtPos) {
      for (let start = 0; start < SIZE; start++) {
        let sum = 0;
        const indices = [];

        let prevFilled = true;
        for (let end = start; end < SIZE; end++) {
          const bi = getIndexAtPos(end);
          const cell = board[bi];

          if (!cell) { prevFilled = false; break; }
          if (!prevFilled) break;

          sum += cell.v;
          indices.push(bi);

          if (sum === TARGET_SUM) {
            groups.push({ indices: indices.slice() });
            indices.forEach(i => hit.add(i));
            break; // stop extending this start; contiguous group found
          }

          if (sum > TARGET_SUM) break; // too large; try next start
        }
      }
    }

    // rows
    for (let r = 0; r < SIZE; r++) {
      scanLine((c) => idx(r, c));
    }

    // cols
    for (let c = 0; c < SIZE; c++) {
      scanLine((r) => idx(r, c));
    }

    return { groups, hit };
  }

  function clearHitCells(state, hitSet) {
    hitSet.forEach((i) => { state.board[i] = null; });
  }

  // ============================================================
  // Hand curation
  // ============================================================

  function wouldClearAfterPlacement(state, anchor, piece) {
    if (!canPlacePiece(state, anchor, piece)) return false;

    const covered = getCoveredIndices(anchor, piece);
    const shadow = state.board.slice();

    for (let k = 0; k < covered.length; k++) {
      shadow[covered[k]] = { v: piece.cells[k].v, color: piece.color };
    }

    const { groups } = findGroupsToClear(shadow);
    return groups.length > 0;
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

  // ============================================================
  // UI + runner
  // ============================================================

  function clearMount(mount) {
    mount.innerHTML = "";
    mount.classList.remove("eq-bad", "eq-shake");
  }

  function createNumberBlastGame({ config = {}, context } = {}) {
    const startLevelRaw =
      config.level ??
      config.playerLevel ??
      context?.playerLevel ??
      context?.level ??
      1;

    const level = clamp(Number(startLevelRaw) || 1, 1, LEVEL_MAX);

    let mount =
      config.mount ||
      config.host ||
      document.getElementById("game-mount") ||
      document.body;

    let cleanupFns = [];
    let activeDrag = null;
    let hoverPreview = new Map();

    function addCleanup(fn) { cleanupFns.push(fn); }

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
      try { cleanupFns.forEach((fn) => { try { fn(); } catch (e) {} }); } catch (e) {}
      cleanupFns = [];
      if (mount) {
        mount.innerHTML = "";
        mount.classList.remove("eq-bad", "eq-shake");
      }
    }

    async function start() {
      return new Promise((resolve) => {
        if (!mount) { resolve({ outcome: "lose" }); return; }

        let finished = false;

        function finish(outcome, extra = {}) {
          if (finished) return;
          finished = true;

          const root = mount.closest("#game-root") || document.getElementById("game-root");
          if (root) { root.classList.add("eq-exiting"); void root.offsetHeight; }

          queueMicrotask(() => resolve({ outcome, ...extra }));

          const cleanup = () => {
            destroy();
            if (root) root.classList.remove("eq-exiting");
          };

          setTimeout(cleanup, 350);
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
        ensurePlayableHand(state, 24);

        function restartClass(el, className) {
          el.classList.remove(className);
          void el.offsetWidth;
          el.classList.add(className);
        }
        function shakeBad() { restartClass(mount, "eq-bad"); restartClass(mount, "eq-shake"); }

        function getGhostCenterAnchor(ghostEl) {
          const r = ghostEl.getBoundingClientRect();
          const centerX = r.left + r.width / 2;
          const centerY = r.top + r.height / 2;
          const projectedY = centerY - Math.min(window.innerHeight * 0.15, 180);
          return cellIndexFromPointer(centerX, projectedY);
        }

        function cellIndexFromPointer(x, y) {
          const rect = gridEl.getBoundingClientRect();

          const cellPx =
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-cell")) || 62;
          const gapPx =
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-gap")) || 8;

          const step = cellPx + gapPx;

          const extraY = Math.max(step * 1.0, Math.min(window.innerHeight * 0.45, 360));
          const extraX = step * 0.75;

          let yy = y;
          if (y > rect.bottom && y <= rect.bottom + extraY) yy = rect.bottom - 1;

          const withinX = x >= rect.left - extraX && x <= rect.right + extraX;
          const withinY = yy >= rect.top && yy <= rect.bottom + extraY;
          if (!withinX || !withinY) return null;

          const cx = Math.min(Math.max(x, rect.left), rect.right - 1);
          const cy = Math.min(Math.max(yy, rect.top), rect.bottom - 1);

          const col = Math.floor((cx - rect.left) / step);
          const row = Math.floor((cy - rect.top) / step);

          if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
          return row * SIZE + col;
        }

        function cellElFromIndex(i) {
          return wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`) || null;
        }

        function clearHover() {
          if (hoverPreview && hoverPreview.size) {
            hoverPreview.forEach((prev, i) => {
              const el = cellElFromIndex(i);
              if (!el) return;
              el.textContent = prev;
              el.removeAttribute("data-preview");
            });
            hoverPreview.clear();
          }

          wrap.querySelectorAll(".nb-cell.drop-hover, .nb-cell.drop-bad")
            .forEach((el) => el.classList.remove("drop-hover", "drop-bad"));
        }

        function highlightPlacement(anchorIndex, piece) {
          clearHover();
          if (anchorIndex == null || !piece) return;

          const covered = getCoveredIndices(anchorIndex, piece);
          if (!covered) return;

          const ok = canPlacePiece(state, anchorIndex, piece);
          if (!ok) return;

          for (let k = 0; k < covered.length; k++) {
            const i = covered[k];
            const el = cellElFromIndex(i);
            if (!el) continue;

            el.classList.add("drop-hover");

            if (!state.board[i]) {
              if (!hoverPreview.has(i)) hoverPreview.set(i, el.textContent || "");
              el.textContent = String(piece.cells[k].v);
              el.setAttribute("data-preview", "1");
            }
          }
        }

        function updateTopbar() {
          // show “5 game wins” as check pips, otherwise show charge pips
          const wins = clamp(state.wins, 0, WINS_TO_SHOW);

          const pipHtml = Array.from({ length: WINS_TO_SHOW }, (_, i) => {
            const isCheck = i < wins;
            return `<span class="nb-pip ${isCheck ? "is-on is-check" : ""}">${isCheck ? "✓" : ""}</span>`;
          }).join("");

          top.innerHTML = `
            <div class="nb-top-center">
              <div class="nb-pips" aria-label="Wins">${pipHtml}</div>
            </div>
          `;
        }

        function renderGrid() {
          gridEl.innerHTML = "";
          for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
              const i = idx(r, c);
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "nb-cell";
              btn.dataset.cellIndex = String(i);

              const cell = state.board[i];
              if (cell) {
                btn.classList.add("filled", `nb-${cell.color}`);
                btn.textContent = String(cell.v);
              } else {
                btn.textContent = "";
              }

              gridEl.appendChild(btn);
            }
          }
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
              const handSize =
                parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-hand-size")) || 150;

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
                d.className = `nb-mini nb-${piece.color}`;
                d.textContent = String(pc.v);

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

              const ghost = btn.cloneNode(true);
              ghost.classList.add("drag-ghost");
              ghost.classList.remove("is-dragging");

              ghost.style.position = "fixed";
              ghost.style.left = "0px";
              ghost.style.top = "0px";
              ghost.style.width = rect.width + "px";
              ghost.style.height = rect.height + "px";
              ghost.style.pointerEvents = "none";
              ghost.style.zIndex = "9999";
              ghost.style.willChange = "transform";
              ghost.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.06)`;

              document.body.appendChild(ghost);

              const firstCi = getGhostCenterAnchor(ghost);
              highlightPlacement(firstCi, state.hand[hi]);

              const moveGhost = (x, y) => {
                ghost.style.transform = `translate(${x - grabOffsetX}px, ${y - grabOffsetY}px) scale(1.06)`;
              };

              try { btn.setPointerCapture(ev.pointerId); } catch (e) {}

              const onMove = (e) => {
                moveGhost(e.clientX, e.clientY);
                const ci = getGhostCenterAnchor(ghost);
                if (ci == null) { clearHover(); return; }
                highlightPlacement(ci, state.hand[hi]);
              };

              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);

                const ci = getGhostCenterAnchor(ghost);
                clearHover();
                if (ci != null) placePiece(ci, hi);

                btn.classList.remove("is-dragging");
                ghost.remove();
                try { btn.releasePointerCapture(ev.pointerId); } catch (e) {}

                activeDrag = null;
              };

              activeDrag = { ghost, onMove, onUp, card: btn, pointerId: ev.pointerId, handIndex: hi };

              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            };

            btn.addEventListener("pointerdown", onDown);
            addCleanup(() => btn.removeEventListener("pointerdown", onDown));

            handEl.appendChild(btn);
          });
        }

        function render() {
          cleanupFns.forEach(fn => { try { fn(); } catch (e) {} });
          cleanupFns = [];
          updateTopbar();
          renderGrid();
          renderHand();
        }

        function animateWinExplode() {
          wrap.classList.add("nb-win-explode");

          const cells = wrap.querySelectorAll(".nb-cell.filled");
          cells.forEach((el) => {
            const dx = (Math.random() * 260 - 130).toFixed(0) + "px";
            const dy = (Math.random() * 320 - 220).toFixed(0) + "px";
            el.style.setProperty("--dx", dx);
            el.style.setProperty("--dy", dy);
          });

          setTimeout(() => {
            wrap.classList.remove("nb-win-explode");
            cells.forEach((el) => {
              el.style.removeProperty("--dx");
              el.style.removeProperty("--dy");
            });
          }, ROW_EXPLODE_MS);
        }

        function animateRowExplode(hitSet) {
          boardWrap.classList.remove("nb-burst");
          void boardWrap.offsetWidth;
          boardWrap.classList.add("nb-burst");

          hitSet.forEach((i) => {
            const el = wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`);
            if (!el) return;

            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;

            const dx = (Math.random() * 180 - 90).toFixed(0) + "px";
            const dy = (Math.random() * 220 - 170).toFixed(0) + "px";
            el.style.setProperty("--dx", dx);
            el.style.setProperty("--dy", dy);
            el.classList.add("nb-exploding");

            const n = 12 + Math.floor(Math.random() * 6);
            for (let s = 0; s < n; s++) {
              const sp = document.createElement("div");
              sp.className = "nb-spark";
              sp.style.left = `${cx}px`;
              sp.style.top = `${cy}px`;

              const sx = (Math.random() * 280 - 140).toFixed(0) + "px";
              const sy = (Math.random() * 320 - 220).toFixed(0) + "px";
              sp.style.setProperty("--sx", sx);
              sp.style.setProperty("--sy", sy);

              document.body.appendChild(sp);
              setTimeout(() => sp.remove(), ROW_EXPLODE_MS + 150);
            }
          });

          setTimeout(() => {
            hitSet.forEach((i) => {
              const el = wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`);
              if (!el) return;
              el.classList.remove("nb-exploding");
              el.style.removeProperty("--dx");
              el.style.removeProperty("--dy");
            });
          }, ROW_EXPLODE_MS);
        }

        function awardForGroups(groupCount) {
          const bonus = groupCount >= 3 ? 2 : (groupCount >= 2 ? 1 : 0);
          state.clears += groupCount;
          state.charge += (groupCount + bonus);
          state.score += 10 * groupCount + 15 * bonus;
        }

        function placePiece(anchorIndex, handIndex) {
          const piece = state.hand[handIndex];
          if (!piece) return false;
          if (!canPlacePiece(state, anchorIndex, piece)) return false;

          const covered = getCoveredIndices(anchorIndex, piece);
          if (!covered) return false;

          for (let k = 0; k < piece.cells.length; k++) {
            const bi = covered[k];
            const pc = piece.cells[k];
            state.board[bi] = { v: pc.v, color: piece.color };
          }

          state.hand[handIndex] = makePiece(state);

          // ✅ horizontal OR vertical groups that sum to 10
          const { groups, hit } = findGroupsToClear(state.board);
          const groupCount = groups.length;

          if (groupCount > 0) {
            animateRowExplode(hit);
            awardForGroups(groupCount);

            setTimeout(() => {
              // ✅ THIS is what prevents “blocked tiles after explosion”
              clearHitCells(state, hit);

              ensurePlayableHand(state, 18);
              render();

              if (state.charge >= ATTACK_CHARGE_TO_WIN) {
                stopActiveDrag();
                clearHover();
                animateWinExplode();

                // persist 5-wins pip checks
                state.wins = clamp(readWins() + 1, 0, 9999);
                writeWins(state.wins);

                setTimeout(() => {
                  finish("win", {
                    reason: "attack-charged",
                    clears: state.clears,
                    score: state.score,
                    attacks: 1,
                    charge: state.charge,
                    wins: state.wins,
                  });
                }, 520);
                return;
              }

              if (!anyMovesAvailable(state)) {
                setTimeout(() => {
                  finish("lose", {
                    reason: "no-moves",
                    clears: state.clears,
                    score: state.score,
                    attacks: 0,
                    charge: state.charge,
                    wins: state.wins,
                  });
                }, 250);
              }
            }, ROW_EXPLODE_MS);

            return true;
          }

          ensurePlayableHand(state, 18);
          render();

          if (state.charge >= ATTACK_CHARGE_TO_WIN) {
            stopActiveDrag();
            clearHover();
            animateWinExplode();

            state.wins = clamp(readWins() + 1, 0, 9999);
            writeWins(state.wins);

            setTimeout(() => {
              finish("win", {
                reason: "attack-charged",
                clears: state.clears,
                score: state.score,
                attacks: 1,
                charge: state.charge,
                wins: state.wins,
              });
            }, 520);

            return true;
          }

          if (!anyMovesAvailable(state)) {
            setTimeout(() => {
              finish("lose", {
                reason: "no-moves",
                clears: state.clears,
                score: state.score,
                attacks: 0,
                charge: state.charge,
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

  if (window.GameRegistry && typeof window.GameRegistry.register === "function") {
    window.GameRegistry.register("number-blast", createNumberBlastGame);
  } else {
    console.error("[NumberBlast] GameRegistry missing. Did registry.js load first?");
  }
})();