// games/number-blast/index.js
(function () {
  "use strict";

  // ============================================================
  // Number Blast (Make 10) — Block Blast inspired
  // - 5x5 board (empty start)
  // - Drag/drop PIECES (shapes with numbers)
  // - Clear any contiguous horizontal/vertical GROUP that sums to 10
  // - Each cleared GROUP = +1 charge (combo bonus)
  // - Charge hits 5 => WIN (hero attack)
  // - No legal placements => LOSE (enemy attack)
  //
  // Secret sauce baked in:
  // - Hand curation: reroll hand until at least 1 clear is possible soon
  // - Completion bias: piece numbers biased toward complements on board
  // ============================================================

  const SIZE = 5;
  const HAND_SIZE = 3;

  const TARGET_SUM = 10;
  const ATTACK_CHARGE_TO_WIN = 5;

  // Keep it kid-friendly: smaller numbers early
  const LEVEL_MAX = 10;

  // Visual themes
  const COLOR_KEYS = ["c1", "c2", "c3", "c4", "c5"];

  function idx(r, c) { return r * SIZE + c; }
  function rc(i) { return { r: Math.floor(i / SIZE), c: i % SIZE }; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ============================================================
  // Shapes (Block Blast style; no rotations yet)
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
    // Very friendly early. Big pieces later.
    if (shapeId === "s1") return level <= 2 ? 14 : 8;
    if (shapeId === "h2" || shapeId === "v2") return level <= 4 ? 10 : 8;
    if (shapeId === "h3" || shapeId === "v3") return level <= 6 ? 6 : 8;
    if (shapeId.startsWith("l3")) return level <= 6 ? 4 : 7;
    if (shapeId === "sq4") return level <= 7 ? 3 : 5;
    if (shapeId === "h4" || shapeId === "v4") return level <= 7 ? 1 : 3;
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
  // Secret sauce #1: “Completion bias” number generator
  // ============================================================

  function levelNumberMax(level) {
    if (level <= 3) return 5;
    if (level <= 7) return 7;
    return 9;
  }

  function boardNeeds(state) {
    // Look for contiguous runs in rows/cols that are < 10 and have an open end.
    // Add (10 - sum) as a “needed” number.
    const needs = [];

    // helper: scan a 1D line of length SIZE
    function scanLine(getCell) {
      for (let start = 0; start < SIZE; start++) {
        // if start is empty, skip
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

        // run is [start..end-1] (because end stops on empty) OR it stopped by sum>=10
        const runEnd = (end < SIZE && !getCell(end)) ? (end - 1) : end;
        const runSum = sum;

        // Only care if we stopped on empty (open end) and sum < 10
        // (meaning a number could extend it to 10)
        const nextIndex = runEnd + 1;
        if (runSum > 0 && runSum < TARGET_SUM && nextIndex < SIZE && !getCell(nextIndex)) {
          needs.push(TARGET_SUM - runSum);
        }

        // Also check open start (empty just before run)
        const prevIndex = start - 1;
        if (runSum > 0 && runSum < TARGET_SUM && prevIndex >= 0 && !getCell(prevIndex)) {
          needs.push(TARGET_SUM - runSum);
        }
      }
    }

    // rows
    for (let r = 0; r < SIZE; r++) {
      scanLine((c) => state.board[idx(r, c)]);
    }
    // cols
    for (let c = 0; c < SIZE; c++) {
      scanLine((r) => state.board[idx(r, c)]);
    }

    return needs;
  }

  function randTileValue(state) {
    const max = levelNumberMax(state.level);

    // Base pool 1..max (lightly weighted toward mid numbers)
    const pool = [];
    for (let i = 1; i <= max; i++) pool.push(i);
    const mids = [3, 4, 5, 6, 7].filter((n) => n >= 1 && n <= max);
    pool.push(...mids, ...mids);

    // Completion bias: add complements found on board
    const needs = boardNeeds(state).filter((n) => n >= 1 && n <= max);
    if (needs.length) pool.push(...needs, ...needs, ...needs); // strong bias

    return pick(pool);
  }

  function pieceHasAutoTen(piece) {
    // Build quick lookup: "x,y" -> value
    const map = new Map();
    for (const c of piece.cells) map.set(`${c.x},${c.y}`, c.v);
  
    // collect unique xs and ys present
    const xs = new Set(piece.cells.map((c) => c.x));
    const ys = new Set(piece.cells.map((c) => c.y));
  
    // Check contiguous runs in each row (fixed y)
    for (const y of ys) {
      const rowCells = piece.cells
        .filter((c) => c.y === y)
        .sort((a, b) => a.x - b.x);
  
      for (let i = 0; i < rowCells.length; i++) {
        let sum = 0;
        let prevX = rowCells[i].x - 1;
  
        for (let j = i; j < rowCells.length; j++) {
          const x = rowCells[j].x;
          if (x !== prevX + 1) break; // must stay contiguous
          sum += rowCells[j].v;
          if (sum === TARGET_SUM) return true;
          if (sum > TARGET_SUM) break;
          prevX = x;
        }
      }
    }
  
    // Check contiguous runs in each column (fixed x)
    for (const x of xs) {
      const colCells = piece.cells
        .filter((c) => c.x === x)
        .sort((a, b) => a.y - b.y);
  
      for (let i = 0; i < colCells.length; i++) {
        let sum = 0;
        let prevY = colCells[i].y - 1;
  
        for (let j = i; j < colCells.length; j++) {
          const y = colCells[j].y;
          if (y !== prevY + 1) break; // must stay contiguous
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
  
    // Try a few times to avoid "auto-10" pieces
    for (let attempt = 0; attempt < 30; attempt++) {
      const pieceCells = norm.map((p) => ({
        x: p.x,
        y: p.y,
        v: randTileValue(state),
      }));
  
      const piece = {
        id: `${shape.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        shapeId: shape.id,
        color,
        cells: pieceCells,
      };
  
      if (!pieceHasAutoTen(piece)) return piece;
    }
  
    // Fallback: if we somehow keep hitting auto-10, just return last one
    return {
      id: `${shape.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      shapeId: shape.id,
      color,
      cells: norm.map((p) => ({ x: p.x, y: p.y, v: randTileValue(state) })),
    };
  }

  function generateHand(state, handSize = HAND_SIZE, maxLargePieces = 1) {
    const hand = [];
    let largeCount = 0;
  
    for (let i = 0; i < handSize; i++) {
      let piece = null;
  
      // Try a few times to satisfy the constraint
      for (let tries = 0; tries < 40; tries++) {
        const candidate = makePiece(state);
        const b = pieceBounds(candidate);
        const isLarge = b.w >= 3 || b.h >= 3; // any 3-wide or 3-tall piece
  
        // If we've already used our "large piece" slot, reject large candidates
        if (isLarge && largeCount >= maxLargePieces) continue;
  
        piece = candidate;
        if (isLarge) largeCount++;
        break;
      }
  
      // Fallback (should be rare): if we couldn't find a valid candidate, force a small one
      if (!piece) {
        piece = makePiece(state);
        // If fallback is large but we already hit the cap, keep trying a bit more
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
  // Game state
  // ============================================================

  function makeGameState(level) {
    const st = {
      level: clamp(Number(level || 1) || 1, 1, LEVEL_MAX),
      board: Array(SIZE * SIZE).fill(null), // {v,color}
      hand: [],
      charge: 0,
      clears: 0,
      score: 0,
    };
    st.hand = [];

    let usedLargePiece = false;
    
    for (let i = 0; i < HAND_SIZE; i++) {
      let piece;
    
      for (let tries = 0; tries < 20; tries++) {
        piece = makePiece(st);
    
        const b = pieceBounds(piece);
        const isLarge = b.w >= 3 || b.h >= 3;
    
        if (isLarge && usedLargePiece) continue;
    
        if (isLarge) usedLargePiece = true;
    
        break;
      }
    
      st.hand.push(piece);
    }
    return st;
  }

  function pieceBounds(piece) {
    let maxX = 0, maxY = 0;
    for (const p of piece.cells) { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    return { w: maxX + 1, h: maxY + 1 };
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
  // NEW CLEAR RULE: contiguous groups sum to 10 (rows+cols)
  // Returns { groups:[{indices: number[]}], indicesToClear:Set<number> }
  // ============================================================

  function findGroupsToClear(board) {
    const groups = [];
    const hit = new Set();

    // Scan a 1D line, mapping line index -> board index
    function scanLine(mapIndex) {
      for (let start = 0; start < SIZE; start++) {
        let sum = 0;
        const indices = [];

        for (let end = start; end < SIZE; end++) {
          const bi = mapIndex(end);
          const cell = board[bi];
          if (!cell) break; // contiguous only

          sum += cell.v;
          indices.push(bi);

          if (sum === TARGET_SUM) {
            groups.push({ indices: indices.slice() });
            indices.forEach((x) => hit.add(x));
            break; // only take the first group from this start
          }
          if (sum > TARGET_SUM) break;
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
    if (!hitSet || hitSet.size === 0) return 0;
    hitSet.forEach((i) => { state.board[i] = null; });
    return hitSet.size;
  }

  // ============================================================
  // Secret sauce #2: Hand curation (avoid bricky hands)
  // Ensure there exists at least one move that can clear a group
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
    // If there are literally no placements, don't loop forever
    if (!anyMovesAvailable(state)) return false;

    for (let t = 0; t < tries; t++) {
      if (hasClearMove(state)) return true;
      state.hand = generateHand(state);
    }
    return hasClearMove(state);
  }

  // ============================================================
  // UI + game runner (built on your existing framework)
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
    let hoverPreview = new Map(); // cellIndex -> previousText

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

        // Build Block Blast style scaffold
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

        // State
        const state = makeGameState(level);

        // Make sure first hand is not dead-feeling
        ensurePlayableHand(state, 24);

        function restartClass(el, className) {
          el.classList.remove(className);
          void el.offsetWidth;
          el.classList.add(className);
        }

        function getGhostCenterAnchor(ghostEl, piece) {
          const r = ghostEl.getBoundingClientRect();
        
          // Use ghost CENTER for much earlier, more stable feel
          const centerX = r.left + r.width / 2;
          const centerY = r.top + r.height / 2;
        
          // Project Y upward so board “catches” earlier (Block Blast-ish)
          const projectedY = centerY - Math.min(window.innerHeight * 0.15, 180);
        
          return cellIndexFromPointer(centerX, projectedY);
        }

        function shakeBad() { restartClass(mount, "eq-bad"); restartClass(mount, "eq-shake"); }

        // "Magnet" hit-testing (Block Blast-ish): snaps to the nearest grid cell
        // even when the pointer is slightly below/around the board.
        function cellIndexFromPointer(x, y) {
          const rect = gridEl.getBoundingClientRect();
        
          const cellPx =
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-cell")) || 62;
          const gapPx =
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-gap")) || 8;
        
          const step = cellPx + gapPx;
        
          // ✅ Big “magnet band” BELOW the board so highlight starts much earlier on mobile
          // Tune these two numbers if you want even earlier:
          const extraY = Math.max(step * 1.0, Math.min(window.innerHeight * 0.45, 360)); // up to ~45% of screen, capped
          const extraX = step * 0.75; // optional: helps catch from the sides too
        
          // If you're within the magnet band below the board,
          // project the pointer Y to just inside the board so it highlights immediately.
          let yy = y;
          if (y > rect.bottom && y <= rect.bottom + extraY) {
            yy = rect.bottom - 1; // ✅ “stick” to bottom row while finger is below board
          }
        
          // Expand hit bounds (mostly Y, a bit of X)
          const withinX = x >= rect.left - extraX && x <= rect.right + extraX;
          const withinY = yy >= rect.top && yy <= rect.bottom + extraY;
        
          if (!withinX || !withinY) return null;
        
          // Clamp coordinates into board space
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
          // restore any previewed numbers
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
          if (!ok) return; // keep your "no red outline" behavior
        
          // Put preview numbers into the board cells
          for (let k = 0; k < covered.length; k++) {
            const i = covered[k];
            const el = cellElFromIndex(i);
            if (!el) continue;
        
            el.classList.add("drop-hover");
        
            // Only preview into EMPTY cells (filled cells already have real numbers)
            if (!state.board[i]) {
              if (!hoverPreview.has(i)) hoverPreview.set(i, el.textContent || "");
              el.textContent = String(piece.cells[k].v);
              el.setAttribute("data-preview", "1");
            }
          }
        }

        function updateTopbar() {
          const pips = Array.from({ length: ATTACK_CHARGE_TO_WIN }, (_, i) => {
            const on = i < state.charge;
            return `<span class="nb-pip ${on ? "is-on" : ""}"></span>`;
          }).join("");
        
          top.innerHTML = `
            <div class="nb-top-center">
              <div class="nb-score" aria-label="Score">${state.score}</div>
              <div class="nb-pips" aria-label="Charge">${pips}</div>
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
        
            // Shape container
            const shapeEl = document.createElement("div");
            shapeEl.className = "nb-piece-shape";
            btn.appendChild(shapeEl);
        
            // Hug the real piece bounds (no uniform square card)
            requestAnimationFrame(() => {
              const handSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nb-hand-size")) || 150;
              const MAX_DIM = 3;   // keep mini-block sizing consistent
              const pad = 10;
              const gap = 6;

              const cell = Math.floor((handSize - pad * 2 - gap * (MAX_DIM - 1)) / MAX_DIM);
              const b = pieceBounds(piece);
              const shapeW = b.w * cell + (b.w - 1) * gap;
              const shapeH = b.h * cell + (b.h - 1) * gap;

              // ✅ the button hugs the shape exactly (plus padding)
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

              // ✅ highlight immediately on touch (even before moving)
const firstCi = getGhostCenterAnchor(ghost, state.hand[hi]);
highlightPlacement(firstCi, state.hand[hi]);
        
              const moveGhost = (x, y) => {
                ghost.style.transform = `translate(${x - grabOffsetX}px, ${y - grabOffsetY}px) scale(1.06)`;
              };
        
              try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
        
              const onMove = (e) => {
                moveGhost(e.clientX, e.clientY);
        
                const ci = getGhostCenterAnchor(ghost, state.hand[hi]);
                if (ci == null) { clearHover(); return; }
                highlightPlacement(ci, state.hand[hi]);
              };
        
              const onUp = (e) => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
        
                const ci = getGhostCenterAnchor(ghost, state.hand[hi]);
                clearHover();

                if (ci != null) placePiece(ci, hi);
        
                btn.classList.remove("is-dragging");
                ghost.remove();
                try { btn.releasePointerCapture(ev.pointerId); } catch (err) {}
        
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

          cleanupFns.forEach(fn => {
            try { fn(); } catch(e){}
          });
        
          cleanupFns = [];
        
          updateTopbar();
          renderGrid();
          renderHand();
        }

        function animateWinExplode() {
          // add class to scope animations
          wrap.classList.add("nb-win-explode");
        
          // set per-tile scatter vectors
          const cells = wrap.querySelectorAll(".nb-cell.filled");
          cells.forEach((el) => {
            // random-ish blast directions
            const dx = (Math.random() * 220 - 110).toFixed(0) + "px";
            const dy = (Math.random() * 260 - 180).toFixed(0) + "px"; // bias upward a bit
            el.style.setProperty("--dx", dx);
            el.style.setProperty("--dy", dy);
          });
        
          // cleanup after animation
          setTimeout(() => {
            wrap.classList.remove("nb-win-explode");
            cells.forEach((el) => {
              el.style.removeProperty("--dx");
              el.style.removeProperty("--dy");
            });
          }, 600);
        }

        function animateClear(hitSet) {
          // Quick pop on cleared cells
          hitSet.forEach((i) => {
            const el = wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`);
            if (el) el.classList.add("nb-clearing");
          });
          setTimeout(() => {
            hitSet.forEach((i) => {
              const el = wrap.querySelector(`.nb-cell[data-cell-index="${i}"]`);
              if (el) el.classList.remove("nb-clearing");
            });
          }, 220);
        }

        function awardForGroups(groupCount) {
          // 1 group = +1 charge
          // combo bonus: +1 extra for 2+, +2 extra for 3+
          const bonus = groupCount >= 3 ? 2 : (groupCount >= 2 ? 1 : 0);

          state.clears += groupCount;
          state.charge += (groupCount + bonus);

          // Score like Block Blast: reward combos more
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

          // Replace used piece
          state.hand[handIndex] = makePiece(state);

          // Clear groups (can chain once for satisfaction)
          let totalGroups = 0;
          for (let chain = 0; chain < 2; chain++) {
            const { groups, hit } = findGroupsToClear(state.board);
            if (!groups.length) break;

            totalGroups += groups.length;
            animateClear(hit);
            clearHitCells(state, hit);
          }

          if (totalGroups) awardForGroups(totalGroups);

          // Secret sauce: make sure next hand isn’t dead
          ensurePlayableHand(state, 18);

          render();

          // Win = attack charged
          if (state.charge >= ATTACK_CHARGE_TO_WIN) {
            stopActiveDrag();
            clearHover();
            animateWinExplode();
          
            // give the explode time to play
            setTimeout(() => {
              finish("win", {
                reason: "attack-charged",
                clears: state.clears,
                score: state.score,
                attacks: 1,
                charge: state.charge,
              });
            }, 520);
          
            return true;
          }

          // Lose = no moves
          if (!anyMovesAvailable(state)) {
            setTimeout(() => {
              finish("lose", {
                reason: "no-moves",
                clears: state.clears,
                score: state.score,
                attacks: 0,
                charge: state.charge,
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

  // Register
  if (window.GameRegistry && typeof window.GameRegistry.register === "function") {
    window.GameRegistry.register("number-blast", createNumberBlastGame);
  } else {
    console.error("[NumberBlast] GameRegistry missing. Did registry.js load first?");
  }
})();