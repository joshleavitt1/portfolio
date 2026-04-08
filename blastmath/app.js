(function () {
  var CONFIG = {
    baseWidth: 390,
    baseHeight: 844,
    boardSize: 6,
    handSize: 3,
    handTileSize: 44,
    handTileGap: 4,
    startingLives: 3,
    storageKey: "blastmath.highscore"
  };

  var INTRO_QUERY_VALUE = "1";

  function isIntroMode() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get("intro") === INTRO_QUERY_VALUE;
    } catch (e) {
      return false;
    }
  }

  function resetStandardGameState(state) {
    state.screen = "game";
    state.score = 0;
    state.displayScore = 0;
    state.comboStep = 0;
    state.lives = CONFIG.startingLives;
    state.boardSize = CONFIG.boardSize;
    state.board = createEmptyBoard(CONFIG.boardSize);
    state.hand = generateHand(state.board, state.boardSize);
    state.animMap = null;
    state.blastIndices = [];
    state.isResolving = false;
    state.boardMessage = "";

    state.intro = {
      active: false,
      step: 0,
      title: "",
      sourceIndex: null,
      allowedTargetIndex: null,
      hoveringValid: false,
      completed: false,
      direction: "horizontal",
      targetQueue: [],
      targetCursor: 0
    };
  }

  function makeIntroPiece(valueOrCells, id) {
    var cells = Array.isArray(valueOrCells)
      ? valueOrCells.map(function (cell) {
          return makeCellAt(cell.x || 0, cell.y || 0, cell.value);
        })
      : [makeCellAt(0, 0, valueOrCells)];
  
    var width = 1;
    var height = 1;
  
    cells.forEach(function (cell) {
      width = Math.max(width, cell.x + 1);
      height = Math.max(height, cell.y + 1);
    });
  
    return {
      id: id || ("intro-" + Date.now()),
      group: "intro",
      rank: cells.length,
      width: width,
      height: height,
      cells: cells
    };
  }

  var INTRO_STEPS = {
    1: {
      step: 1,
      title: "Build 10 to Blast",
    
      boardCells: [
        // center piece
        { x: 2, y: 5, value: 1 },
    
        // LEFT cluster
        { x: 0, y: 4, kind: "neutral" },
        { x: 0, y: 5, kind: "neutral" },
        { x: 1, y: 4, kind: "neutral" },
        { x: 1, y: 5, kind: "neutral" },
    
        // RIGHT cluster
        { x: 4, y: 4, kind: "neutral" },
        { x: 4, y: 5, kind: "neutral" },
        { x: 5, y: 4, kind: "neutral" },
        { x: 5, y: 5, kind: "neutral" },
    
        // upper right single (like your screenshot)
        { x: 4, y: 3, kind: "neutral" }
      ],
    
      handValues: [9],
    
      targets: [
        { x: 3, y: 5, direction: "horizontal" }
      ]
    },
  
    2: {
      step: 2,
      title: "Build 10 to Blast",
      boardCells: [
        { x: 2, y: 5, value: 1 },
        { x: 0, y: 4, kind: "neutral" },
        { x: 0, y: 5, kind: "neutral" },
        { x: 1, y: 4, kind: "neutral" },
        { x: 1, y: 5, kind: "neutral" },
        { x: 4, y: 3, kind: "neutral" },
        { x: 4, y: 4, kind: "neutral" },
        { x: 5, y: 4, kind: "neutral" },
        { x: 5, y: 5, kind: "neutral" }
      ],
      handValues: [9],
      targets: [
        { x: 3, y: 5, direction: "horizontal" }
      ]
    },
  
    3: {
      step: 3,
      title: "Build 10 to Blast",
      boardCells: [
        { x: 2, y: 5, value: 2 }
      ],
      handPieces: [
        [
          { x: 0, y: 0, value: 7 },
          { x: 1, y: 0, value: 1 }
        ]
      ],
      targets: [
        { x: 3, y: 5, direction: "horizontal" },
        { x: 4, y: 5, direction: "horizontal" }
      ]
    },
  
    4: {
      step: 4,
      title: "Build 10 to Blast",
      boardCells: [
        { x: 2, y: 5, value: 3 }
      ],
      handPieces: [
        [
          { x: 0, y: 0, value: 4 },
          { x: 0, y: 1, value: 3 }
        ]
      ],
      targets: [
        { x: 2, y: 4, direction: "vertical" },
        { x: 2, y: 3, direction: "vertical" }
      ]
    }
  };

  function setupIntroStepByNumber(state, stepNumber) {
  
    var def = INTRO_STEPS[stepNumber];
    var board = createEmptyBoard(CONFIG.boardSize);
    var i;
    var sourceCell = null;
  
    if (!def) return;

    for (i = 0; i < def.boardCells.length; i++) {
      var bc = def.boardCells[i];
      var index = (bc.y * CONFIG.boardSize) + bc.x;
    
      if (bc.kind === "neutral") {
        board[index] = makeNeutralCell();
      } else {
        board[index] = makeCell(bc.value);
      }
    }

    if (def.targets.length) {
      var anchor = def.targets[0];
      if (anchor.direction === "horizontal") {
        sourceCell = { x: anchor.x - 1, y: anchor.y };
      } else {
        sourceCell = { x: anchor.x, y: anchor.y + 1 };
      }
    }

    var sourceIndex = sourceCell
      ? (sourceCell.y * CONFIG.boardSize) + sourceCell.x
      : null;

    state.screen = "game";
    state.score = 0;
    state.displayScore = 0;
    state.comboStep = 0;
    state.lives = CONFIG.startingLives;
    state.boardSize = CONFIG.boardSize;
    state.board = board;
    state.hand = (def.handPieces || def.handValues || []).map(function (pieceDef, idx) {
      return makeIntroPiece(pieceDef, "intro-" + stepNumber + "-" + idx);
    });
    state.blastIndices = [];
    state.isResolving = false;
    state.boardMessage = "";
    state.animMap = {};

    if (sourceIndex !== null) {
      state.animMap[sourceIndex] = {
        type: "drop-land",
        distance: 260
      };
    }

    state.intro = {
      active: true,
      step: def.step,
      title: def.title,
      sourceIndex: sourceIndex,
      allowedTargetIndex: def.targets.length
        ? ((def.targets[0].y * CONFIG.boardSize) + def.targets[0].x)
        : null,
      hoveringValid: false,
      completed: false,
      direction: def.targets.length ? def.targets[0].direction : "horizontal",
      targetQueue: def.targets.map(function (t) {
        return {
          x: t.x,
          y: t.y,
          index: (t.y * CONFIG.boardSize) + t.x,
          direction: t.direction
        };
      }),
      targetCursor: 0
    };
  }

  function makeCellAt(x, y, value) {
    return {
      x: x,
      y: y,
      value: value,
      tone: toneForValue(value)
    };
  }

  var INTRO_SEEN_KEY = "blastmath.introSeen";

  function hasSeenIntro() {
    try { return localStorage.getItem(INTRO_SEEN_KEY) === "1"; }
    catch (e) { return false; }
  }

  function markIntroSeen() {
    try { localStorage.setItem(INTRO_SEEN_KEY, "1"); }
    catch (e) {}
  }

  function readHighScore() {
    try { return Number(localStorage.getItem(CONFIG.storageKey) || 0) || 0; }
    catch (e) { return 0; }
  }

  function syncUiScale() {
    var root = document.documentElement;
    var SHELL_PADDING = 24; // 12px * 2 sides
    var usableW = Math.max(320, window.innerWidth - SHELL_PADDING);
    var usableH = Math.max(560, window.innerHeight - SHELL_PADDING);
    var scale = Math.min(usableW / CONFIG.baseWidth, usableH / CONFIG.baseHeight, 1);
    root.style.setProperty("--bm-ui-scale", String(scale.toFixed(4)));
  }

  function createEmptyBoard(size) {
    return Array.from({ length: size * size }, function () { return null; });
  }

  function findBlastGroups(board, size) {
    var groups = [];

    // horizontal groups
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var sum = 0;
        var cells = [];

        for (var k = x; k < size; k++) {
          var cell = board[y * size + k];
          if (!cell) break;

          sum += cell.value;
          cells.push(y * size + k);

          if (sum === 10) {
            groups.push({
              axis: 'h',
              indices: cells.slice()
            });
          }

          if (sum >= 10) break;
        }
      }
    }

    // vertical groups
    for (var x = 0; x < size; x++) {
      for (var y = 0; y < size; y++) {
        var sum = 0;
        var cells = [];

        for (var k = y; k < size; k++) {
          var cell = board[k * size + x];
          if (!cell) break;

          sum += cell.value;
          cells.push(k * size + x);

          if (sum === 10) {
            groups.push({
              axis: 'v',
              indices: cells.slice()
            });
          }

          if (sum >= 10) break;
        }
      }
    }

    return groups;
  }

  function getOrthoNeighborIndices(index, size) {
    var x = index % size;
    var y = Math.floor(index / size);
    var out = [];
  
    if (x > 0) out.push(index - 1);
    if (x < size - 1) out.push(index + 1);
    if (y > 0) out.push(index - size);
    if (y < size - 1) out.push(index + size);
  
    return out;
  }
  
  function collectNeutralBlastIndices(board, size, seedIndices) {
    var seen = new Set();
    var out = [];
  
    seedIndices.forEach(function (seed) {
      var neighbors = getOrthoNeighborIndices(seed, size);
  
      neighbors.forEach(function (neighborIndex) {
        var cell = board[neighborIndex];
        if (!isNeutralCell(cell)) return;
        if (seen.has(neighborIndex)) return;
  
        seen.add(neighborIndex);
        out.push(neighborIndex);
      });
    });
  
    return out;
  }

  function classifyBlastPhase(board, size, comboStep) {
    var groups = findBlastGroups(board, size);
    var blastIndices = [];
    var seen = new Set();
    var horizontalGroups = 0;
    var verticalGroups = 0;
    var totalGroups = 0;
    var i, j, index;
  
    for (i = 0; i < groups.length; i++) {
      if (groups[i].axis === 'h') horizontalGroups += 1;
      if (groups[i].axis === 'v') verticalGroups += 1;
  
      for (j = 0; j < groups[i].indices.length; j++) {
        index = groups[i].indices[j];
        if (!seen.has(index)) {
          seen.add(index);
          blastIndices.push(index);
        }
      }
    }
  
    totalGroups = horizontalGroups + verticalGroups;
  
    if (!blastIndices.length) {
      return {
        hasBlast: false,
        blastIndices: [],
        neutralBlastIndices: [],
        clearedCount: 0,
        horizontalGroups: 0,
        verticalGroups: 0,
        totalGroups: 0,
        comboStep: comboStep,
        message: '',
        scoreValue: 0
      };
    }
  
    var neutralBlastIndices = collectNeutralBlastIndices(board, size, blastIndices);
  
    neutralBlastIndices.forEach(function (neutralIndex) {
      if (!seen.has(neutralIndex)) {
        seen.add(neutralIndex);
        blastIndices.push(neutralIndex);
      }
    });
  
    var message = '';
    var clearedCount = blastIndices.length;
    var scoreValue = 0;
    
    if (comboStep >= 2) {
      var comboDisplay = Math.min(comboStep, 4);
      message = 'Combo!\n' + comboDisplay + 'x';
      scoreValue = clearedCount * (12 + ((comboStep - 1) * 4));
    } else {
      if (totalGroups <= 1) {
        message = 'Single\nBlast!';
        scoreValue = clearedCount * 10;
      } else if (totalGroups === 2) {
        message = 'Double\nBlast!';
        scoreValue = clearedCount * 16;
      } else if (totalGroups === 3) {
        message = 'Triple\nBlast!';
        scoreValue = clearedCount * 20;
      } else {
        message = 'Max\nBlast!';
        scoreValue = clearedCount * 24;
      }
    }
  
    return {
      hasBlast: true,
      blastIndices: blastIndices,
      neutralBlastIndices: neutralBlastIndices,
      clearedCount: clearedCount,
      horizontalGroups: horizontalGroups,
      verticalGroups: verticalGroups,
      totalGroups: totalGroups,
      comboStep: comboStep,
      message: message,
      scoreValue: scoreValue
    };
  }
  
  function applyBlast(board, indices) {
    indices.forEach(function (i) {
      board[i] = null;
    });
  }

  function applyGravity(board, size) {
    var moved = [];
    var movedAny = true;
  
    while (movedAny) {
      movedAny = false;
  
      for (var y = size - 2; y >= 0; y--) {
        for (var x = 0; x < size; x++) {
          var fromIndex = (y * size) + x;
          var toIndex = ((y + 1) * size) + x;
  
          if (!board[fromIndex]) continue;
          if (board[toIndex]) continue;
  
          board[toIndex] = board[fromIndex];
          board[fromIndex] = null;
  
          moved.push({
            x: x,
            fromY: y,
            toY: y + 1
          });
  
          movedAny = true;
        }
      }
    }
  
    return collapseGravityMoves(moved);
  }
  
  function collapseGravityMoves(moves) {
    var collapsed = [];
  
    moves.forEach(function (move) {
      var existing = null;
  
      for (var i = 0; i < collapsed.length; i++) {
        if (
          collapsed[i].x === move.x &&
          collapsed[i].toY === move.fromY
        ) {
          existing = collapsed[i];
          break;
        }
      }
  
      if (existing) {
        existing.toY = move.toY;
      } else {
        collapsed.push({
          x: move.x,
          fromY: move.fromY,
          toY: move.toY
        });
      }
    });
  
    return collapsed;
  }
  

  function buildPlacedDropAnimMap(boardSize, boardEl, placedIndices) {
    var map = {};
    if (!boardEl || !placedIndices || !placedIndices.length) return map;
  
    var cellEl = boardEl.querySelector('.bm-cell');
    if (!cellEl) return map;
  
    var cellSize = cellEl.getBoundingClientRect().width;
    var gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    var step = cellSize + gap;
  
    placedIndices.forEach(function (index) {
      map[index] = {
        type: 'drop-land',
        distance: step * 5.5,
        duration: 300
      };
    });
  
    return map;
  }

  function buildGravityAnimMap(root, state, moved, placedIndices) {
    var map = {};
    var boardEl = root.querySelector('.bm-board');
    if (!boardEl) return map;
  
    var cellEl = boardEl.querySelector('.bm-cell');
    if (!cellEl) return map;
  
    var cellSize = cellEl.getBoundingClientRect().width;
    var gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    var step = cellSize + gap;
  
    var placedSet = new Set(placedIndices || []);
  
    moved.forEach(function (move) {
      var toIndex = (move.toY * state.boardSize) + move.x;
  
      map[toIndex] = {
        type: 'drop-land',
        distance: (move.toY + 1.25) * step,
        duration: 360
      };
    });
  
    placedSet.forEach(function (index) {
      if (map[index]) return;
  
      var y = Math.floor(index / state.boardSize);
  
      map[index] = {
        type: 'drop-land',
        distance: (y + 1.25) * step,
        duration: 360
      };
    });
  
    return map;
  }

  function toneForValue(value) {
    return 'c' + Math.max(1, Math.min(9, value));
  }
  
  function makeCell(value) {
    return {
      kind: 'number',
      value: value,
      tone: toneForValue(value)
    };
  }
  
  function makeNeutralCell() {
    return {
      kind: 'neutral',
      tone: 'neutral'
    };
  }
  
  function isNeutralCell(cell) {
    return !!(cell && cell.kind === 'neutral');
  }
  
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomizeShapeValues(shapeDef) {
    return {
      id: shapeDef.id,
      group: shapeDef.group,
      rank: shapeDef.rank,
      width: shapeDef.width,
      height: shapeDef.height,
      cells: shapeDef.coords.map(function (coord) {
        var value = randInt(1, 9);
        return {
          x: coord.x,
          y: coord.y,
          value: value,
          tone: toneForValue(value)
        };
      })
    };
  }

  function getPieceCellAt(piece, x, y) {
    for (var i = 0; i < piece.cells.length; i++) {
      var cell = piece.cells[i];
      if (cell.x === x && cell.y === y) return cell;
    }
    return null;
  }

  function pieceHasSelfBlast(piece) {
    var x, y, k, sum, run, cell;

    // horizontal runs inside piece only
    for (y = 0; y < piece.height; y++) {
      for (x = 0; x < piece.width; x++) {
        sum = 0;
        run = [];

        for (k = x; k < piece.width; k++) {
          cell = getPieceCellAt(piece, k, y);
          if (!cell) break;

          sum += cell.value;
          run.push(cell);

          if (sum === 10 && run.length > 0) return true;
          if (sum >= 10) break;
        }
      }
    }

    // vertical runs inside piece only
    for (x = 0; x < piece.width; x++) {
      for (y = 0; y < piece.height; y++) {
        sum = 0;
        run = [];

        for (k = y; k < piece.height; k++) {
          cell = getPieceCellAt(piece, x, k);
          if (!cell) break;

          sum += cell.value;
          run.push(cell);

          if (sum === 10 && run.length > 0) return true;
          if (sum >= 10) break;
        }
      }
    }

    return false;
  }

  function getLegalPlacements(board, boardSize, piece) {
    var legal = [];

    for (var col = 0; col <= boardSize - piece.width; col++) {
      var landed = getGravityDropForBoard(board, boardSize, piece, col);
      if (landed && landed.length) {
        legal.push({
          col: col,
          landed: landed
        });
      }
    }

    return legal;
  }

  function getGravityDropForBoard(board, boardSize, piece, col) {
    var baseRow;
    var cells = piece.cells;
  
    // horizontal bounds check
    for (var i = 0; i < cells.length; i++) {
      var testX = col + cells[i].x;
      if (testX < 0 || testX >= boardSize) return null;
    }
  
    // start above board and move down until collision
    for (baseRow = -piece.height; baseRow <= boardSize; baseRow++) {
      var collided = false;
  
      for (var j = 0; j < cells.length; j++) {
        var cell = cells[j];
        var x = col + cell.x;
        var y = baseRow + cell.y;
  
        // below board = collision
        if (y >= boardSize) {
          collided = true;
          break;
        }
  
        // ignore cells still above top
        if (y < 0) continue;
  
        // hit occupied board cell = collision
        if (board[(y * boardSize) + x]) {
          collided = true;
          break;
        }
      }
  
      if (collided) {
        var landedBaseRow = baseRow - 1;
        var landed = [];
  
        for (var k = 0; k < cells.length; k++) {
          var landedCell = cells[k];
          var landedX = col + landedCell.x;
          var landedY = landedBaseRow + landedCell.y;
  
          // if any part never fully enters board, invalid
          if (landedY < 0) return null;
  
          landed.push({
            x: landedX,
            y: landedY,
            value: landedCell.value,
            tone: landedCell.tone
          });
        }
  
        return landed;
      }
    }
  
    return null;
  }

  function getBoardFillRatio(board) {
    var filled = 0;
    for (var i = 0; i < board.length; i++) {
      if (board[i]) filled += 1;
    }
    return filled / board.length;
  }

  var PIECE_LIBRARY = {
    simple: [
      {
        id: 'single',
        rank: 1,
        width: 1,
        height: 1,
        coords: [{ x: 0, y: 0 }]
      },
      {
        id: 'h2',
        rank: 2,
        width: 2,
        height: 1,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }]
      },
      {
        id: 'v2',
        rank: 2,
        width: 1,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 0, y: 1 }]
      },
      {
        id: 'h3',
        rank: 3,
        width: 3,
        height: 1,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
      },
      {
        id: 'v3',
        rank: 3,
        width: 1,
        height: 3,
        coords: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]
      }
    ],

    complex: [
      {
        id: 'l3',
        rank: 4,
        width: 2,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
      },
      {
        id: 'j3',
        rank: 4,
        width: 2,
        height: 2,
        coords: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
      },
      {
        id: 'square3',
        rank: 4,
        width: 2,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
      },
      {
        id: 't4',
        rank: 5,
        width: 3,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }]
      },
      {
        id: 'z4',
        rank: 5,
        width: 3,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]
      },
      {
        id: 's4',
        rank: 5,
        width: 3,
        height: 2,
        coords: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
      },
      {
        id: 'plus5',
        rank: 6,
        width: 3,
        height: 3,
        coords: [
          { x: 1, y: 0 },
          { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
          { x: 1, y: 2 }
        ]
      }
    ]
  };

  function getAllShapeDefs() {
    var all = [];

    Object.keys(PIECE_LIBRARY).forEach(function (group) {
      PIECE_LIBRARY[group].forEach(function (shape) {
        if (shape.width > 3 || shape.height > 3) return;

        all.push({
          id: shape.id,
          group: group,
          rank: shape.rank,
          width: shape.width,
          height: shape.height,
          coords: shape.coords
        });
      });
    });

    return all;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function chance(percent) {
    return Math.random() < (percent / 100);
  }

  function pickSlot12Rule() {
    // Mostly singles, sometimes length-2.
    // Never 3-length. Never complex.
    if (chance(35)) {
      return {
        allowedIds: ['h2', 'v2'],
        maxRank: 2
      };
    }

    return {
      allowedIds: ['single'],
      maxRank: 1
    };
  }

  function pickSlot3Rule(board) {
    var fillRatio = getBoardFillRatio(board);

    // crowded board: keep slot 3 friendlier
    if (fillRatio >= 0.6) {
      if (chance(10)) {
        return {
          allowedIds: ['l3', 'j3', 'square3'],
          maxRank: 4
        };
      }

      if (chance(45)) {
        return {
          allowedIds: ['h3', 'v3'],
          maxRank: 3
        };
      }

      return {
        allowedIds: ['h2', 'v2'],
        maxRank: 2
      };
    }

    // normal/open board
    if (chance(8)) {
      return {
        allowedIds: ['l3', 'j3', 'square3', 't4', 'z4', 's4', 'plus5'],
        maxRank: 6
      };
    }

    if (chance(45)) {
      return {
        allowedIds: ['h3', 'v3'],
        maxRank: 3
      };
    }

    return {
      allowedIds: ['h2', 'v2'],
      maxRank: 2
    };
  }

  function generateHand(board, boardSize) {
    var hand = [];
    var slot1 = generatePiece(board, boardSize, pickSlot12Rule());
    var slot2 = generatePiece(board, boardSize, pickSlot12Rule());
    var slot3 = generatePiece(board, boardSize, pickSlot3Rule(board));

    hand.push(slot1);
    hand.push(slot2);
    hand.push(slot3);

    // Safety: ensure first two slots never contain 3-length or complex pieces
    for (var i = 0; i < 2; i++) {
      if (!hand[i]) {
        hand[i] = generatePiece(board, boardSize, { allowedIds: ['single', 'h2', 'v2'], maxRank: 2 });
        continue;
      }

      var cellCount = hand[i].cells.length;
      if (cellCount > 2 || hand[i].rank > 2) {
        hand[i] = generatePiece(board, boardSize, { allowedIds: ['single', 'h2', 'v2'], maxRank: 2 });
      }
    }

    // Safety: slot 3 should usually be 2 or 3, only sometimes complex
    if (!hand[2]) {
      hand[2] = generatePiece(board, boardSize, { allowedIds: ['h2', 'v2', 'h3', 'v3'], maxRank: 3 });
    }

    var playableCount = hand.filter(function (piece) {
      return piece && getLegalPlacements(board, boardSize, piece).length > 0;
    }).length;

    if (playableCount < 2) {
      hand[0] = generatePiece(board, boardSize, { allowedIds: ['single', 'h2', 'v2'], maxRank: 2 });
      hand[1] = generatePiece(board, boardSize, { allowedIds: ['single', 'h2', 'v2'], maxRank: 2 });
    }

    return hand;
  }

  function pieceFitsCatalogRules(piece) {
    if (!piece) return false;
    if (piece.width > 3 || piece.height > 3) return false;
    return true;
  }

  function generatePiece(board, boardSize, rule) {
    rule = rule || {};

    var defs = getAllShapeDefs().filter(function (def) {
      if (def.width > 3 || def.height > 3) return false;

      if (rule.groups && rule.groups.indexOf(def.group) === -1) return false;
      if (rule.maxRank && def.rank > rule.maxRank) return false;
      if (rule.allowedIds && rule.allowedIds.indexOf(def.id) === -1) return false;
      if (rule.maxCells && def.coords.length > rule.maxCells) return false;
      if (rule.minCells && def.coords.length < rule.minCells) return false;

      return true;
    });

    var candidates = [];

    defs.forEach(function (def) {
      for (var tries = 0; tries < 16; tries++) {
        var piece = randomizeShapeValues(def);

        if (!pieceFitsCatalogRules(piece)) continue;

        if (pieceHasSelfBlast(piece)) continue;

        if (board && boardSize) {
          var legalPlacements = getLegalPlacements(board, boardSize, piece);
          if (!legalPlacements.length) continue;
        }

        candidates.push(piece);
      }
    });

    if (!candidates.length) {
      var fallbackDefs = getAllShapeDefs().filter(function (def) {
        return def.id === 'single' || def.id === 'h2' || def.id === 'v2';
      });

      for (var i = 0; i < fallbackDefs.length; i++) {
        for (var n = 0; n < 16; n++) {
          var fallback = randomizeShapeValues(fallbackDefs[i]);

          if (pieceHasSelfBlast(fallback)) continue;
          if (board && boardSize && !getLegalPlacements(board, boardSize, fallback).length) continue;

          return fallback;
        }
      }

      return null;
    }

    return pickRandom(candidates);
  }

  function renderPiece(piece) {
    var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1);
    var cellSize = CONFIG.handTileSize * scale;
    var gap = CONFIG.handTileGap * scale;
    var width = (piece.width * cellSize) + ((piece.width - 1) * gap);
    var height = (piece.height * cellSize) + ((piece.height - 1) * gap);
    var cells = piece.cells.map(function (cell) {
      var left = Math.round(cell.x * (cellSize + gap));
      var top = Math.round(cell.y * (cellSize + gap));
      return '<div class="bm-mini bm-mini--' + cell.tone + '" style="left:' + left + 'px; top:' + top + 'px;"><span class="bm-tile__label">' + cell.value + '</span></div>';
    }).join('');
    return '<div class="bm-piece" data-piece>' +
    '<div class="bm-piece__shape" style="width:' + Math.round(width) + 'px; height:' + Math.round(height) + 'px;">' +
    cells +
    '</div></div>';
  }

  function renderHome(root) {
    root.innerHTML = '' +
      '<section class="bm-screen bm-home">' +
        '<div class="bm-home__center">' +
          '<div class="bm-logo" aria-label="Blast Math logo">' +
            '<img src="images/logo.png" alt="Blast Math" class="bm-logo__img" />' +
          '</div>' +
        '</div>' +
        '<div class="bm-home__actions">' +
          '<button class="bm-btn" type="button" data-play>Play</button>' +
        '</div>' +
      '</section>';
  }

  function renderGame(root, state) {
    var isIntro = !!(state.intro && state.intro.active);

    var hudHtml = isIntro
    ? (
      '<div class="bm-hud bm-hud--intro">' +
        '<button class="bm-btn bm-btn--skip" type="button" data-skip-intro>Skip</button>' +
      '</div>'
    )
    : (
      '<div class="bm-hud">' +
        '<div class="bm-hud-side bm-hud-side--left">' +
          '<div class="bm-hud-stat bm-hud-stat--score">' +
            '<img src="images/crown.svg" class="bm-hud-icon" alt="" />' +
            '<span class="bm-hud-value bm-hud-score-value">' + state.highScore + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="bm-hud-side bm-hud-side--right">' +
          '<div class="bm-hud-stat bm-hud-stat--lives">' +
            '<img src="images/heart.svg" class="bm-hud-icon" alt="" />' +
            '<span class="bm-hud-value bm-hud-lives-value">' + state.lives + '</span>' +
          '</div>' +
          '<button class="bm-hud-settings" type="button" aria-label="Settings">' +
            '<img src="images/gear.svg" class="bm-hud-cog" alt="" />' +
          '</button>' +
        '</div>' +
      '</div>'
    );

    var scoreHtml = isIntro
      ? (
        '<div class="bm-score bm-score--intro">' +
          '<div class="bm-score__title" data-score-title>' + state.intro.title + '</div>' +
        '</div>'
      )
      : (
        '<div class="bm-score">' +
          '<div class="bm-score__burst" data-score-burst></div>' +
          '<div class="bm-score__value" data-score-value>' + state.displayScore + '</div>' +
        '</div>'
      );

      var introPieces = isIntro
      ? state.hand.filter(function (piece) { return !!piece; })
      : [];
    
    var handHtml = isIntro
      ? (
        '<div class="bm-hand bm-hand--intro">' +
          introPieces.map(function (piece, index) {
            return '<div class="bm-hand-slot bm-hand-slot--intro" data-hand-slot-index="' + index + '">' +
              renderPiece(piece) +
            '</div>';
          }).join('') +
        '</div>'
      )
  : (
    '<div class="bm-hand">' + state.hand.map(function (piece, index) {
      return '<div class="bm-hand-slot" data-hand-slot-index="' + index + '">' + (piece ? renderPiece(piece) : '') + '</div>';
    }).join('') + '</div>'
  );

    root.innerHTML = '' +
      '<section class="bm-screen bm-game" data-game>' +
        hudHtml +
        '<div class="bm-spacer" aria-hidden="true"></div>' +
        scoreHtml +
        '<div class="bm-spacer" aria-hidden="true"></div>' +
        '<div class="bm-board-wrap">' +
          '<div class="bm-board">' + renderBoard(state.boardSize, state.board, state.animMap, state.blastIndices, state) + '</div>' +
        '</div>' +
        '<div class="bm-spacer" aria-hidden="true"></div>' +
        handHtml +
      '</section>';

    syncScoreUi(root, state);
    state.animMap = null;
  }

  function renderBoard(boardSize, board, animMap, blastIndices, state) {
    animMap = animMap || {};
    blastIndices = blastIndices || [];
    state = state || {};
  
    var intro = state.intro || {};
    var isIntro = !!intro.active;
  
    return board.map(function (cell, index) {
      var cellClass = 'bm-cell';
      var extraClass = '';
      var extraStyle = '';
  
      if (isIntro && !cell && !intro.completed) {
        var isVisibleIntroTarget = false;
  
        if (intro.targetQueue && intro.targetQueue.length) {
          isVisibleIntroTarget = intro.targetQueue.some(function (target) {
            return target.index === index;
          });
        } else {
          isVisibleIntroTarget = index === intro.allowedTargetIndex;
        }
  
        if (isVisibleIntroTarget) {
          cellClass += ' bm-intro-target-cell';
        }
      }
  
      if (!cell) {
        return '<div class="' + cellClass + '" data-cell-index="' + index + '"></div>';
      }
  
      var anim = animMap[index];
      var isBlasting = blastIndices.indexOf(index) !== -1;
  
      if (anim) {
        if (anim.type === 'place-pop') {
          extraClass = ' bm-place-pop';
        } else if (anim.type === 'drop-land') {
          extraClass = ' bm-drop-land';
          extraStyle =
          ' style="--bm-drop-distance:' + anim.distance + 'px;' +
          '--bm-drop-duration:' + (anim.duration || 320) + 'ms;"';
        } else if (anim.type === 'blast-pop') {
          extraClass = ' bm-blast-pop';
        }
      }
  
      if (isBlasting) {
        extraClass += ' bm-blast-pop';
      }
  
      if (isNeutralCell(cell)) {
        return '<div class="' + cellClass + '" data-cell-index="' + index + '">' +
          '<div class="bm-neutral-block' + extraClass + '"' + extraStyle + '></div>' +
        '</div>';
      }
  
      return '<div class="' + cellClass + '" data-cell-index="' + index + '">' +
        '<div class="bm-tile bm-tile--' + cell.tone + extraClass + '"' + extraStyle + '><span class="bm-tile__label">' + cell.value + '</span></div>' +
      '</div>';
    }).join('');
  }

  function getBoardCellRects(boardEl) {
    var rects = {};
    if (!boardEl) return rects;
  
    var cellEls = boardEl.querySelectorAll('.bm-cell');
    cellEls.forEach(function (cellEl, index) {
      rects[index] = cellEl.getBoundingClientRect();
    });
  
    return rects;
  }
  
  function getCellContentEl(cellEl) {
    if (!cellEl) return null;
    return cellEl.querySelector('.bm-tile, .bm-neutral-block');
  }

  function hideBoardCells(root, indices) {
  var boardEl = root.querySelector('.bm-board');
  if (!boardEl || !indices || !indices.length) return;

  indices.forEach(function (index) {
    var cellEl = boardEl.querySelector('[data-cell-index="' + index + '"]');
    var contentEl = getCellContentEl(cellEl);
    if (contentEl) contentEl.style.visibility = 'hidden';
  });
}
  
  function renderBoardMarkupOnly(root, state) {
    var boardEl = root.querySelector('.bm-board');
    if (!boardEl) return null;
  
    boardEl.innerHTML = renderBoard(
      state.boardSize,
      state.board,
      null,
      state.blastIndices,
      state
    );
  
    return boardEl;
  }
  
  function animateGravityFall(root, state, moved) {
    var boardEl = root.querySelector('.bm-board');
    if (!boardEl || !moved || !moved.length) return Promise.resolve();
  
    var beforeRects = getBoardCellRects(boardEl);
  
    boardEl = renderBoardMarkupOnly(root, state);
    var afterRects = getBoardCellRects(boardEl);
    var cellEls = boardEl.querySelectorAll('.bm-cell');
    var clones = [];
    var duration = 300;
  
    moved.forEach(function (item) {
      var fromIndex = (item.fromY * state.boardSize) + item.x;
      var toIndex = (item.toY * state.boardSize) + item.x;
  
      var fromRect = beforeRects[fromIndex];
      var toRect = afterRects[toIndex];
      if (!fromRect || !toRect) return;
  
      var toCellEl = cellEls[toIndex];
      var toContentEl = getCellContentEl(toCellEl);
      if (!toContentEl) return;
  
      var clone = toContentEl.cloneNode(true);
      clone.classList.remove('bm-drop-land', 'bm-place-pop', 'bm-blast-pop');
      clone.style.position = 'fixed';
      clone.style.left = fromRect.left + 'px';
      clone.style.top = fromRect.top + 'px';
      clone.style.width = fromRect.width + 'px';
      clone.style.height = fromRect.height + 'px';
      clone.style.margin = '0';
      clone.style.zIndex = '30';
      clone.style.pointerEvents = 'none';
      clone.style.willChange = 'transform';
      clone.style.transform = 'translate3d(0,0,0)';
  
      toContentEl.style.visibility = 'hidden';
  
      document.body.appendChild(clone);
      clones.push({ clone: clone, target: toContentEl });
  
      var dx = toRect.left - fromRect.left;
      var dy = toRect.top - fromRect.top;
  
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          clone.style.transition = 'transform ' + duration + 'ms cubic-bezier(.22,.61,.36,1)';
          clone.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
        });
      });
    });
  
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        clones.forEach(function (entry) {
          if (entry.clone && entry.clone.parentNode) {
            entry.clone.parentNode.removeChild(entry.clone);
          }
          if (entry.target) {
            entry.target.style.visibility = '';
          }
        });
        resolve();
      }, duration + 30);
    });
  }

  function spawnBlastFragments(root, state, blastIndices, comboStep) {
    comboStep = comboStep || 1;
    var board = root.querySelector('.bm-board');
    if (!board || !blastIndices || !blastIndices.length) return;
  
    var cellEls = board.querySelectorAll('.bm-cell');
  
    blastIndices.forEach(function (index) {
      var cell = state.board[index];
      if (!cell) return;
  
      var cellEl = cellEls[index];
      if (!cellEl) return;
  
      var rect = cellEl.getBoundingClientRect();
      var size = rect.width;
  
      var pieces = isNeutralCell(cell) ? 28 : 25;

      if (comboStep >= 2) {
        pieces = Math.max(8, Math.round(pieces * 0.45));
      }
  
      for (var i = 0; i < pieces; i++) {
        var frag = document.createElement('div');
        var fragSize = Math.max(5, size * (0.16 + Math.random() * 0.16));
  
        var startX = rect.left + (size * 0.12) + Math.random() * (size * 0.76);
        var startY = rect.top + (size * 0.10) + Math.random() * (size * 0.30);
  
        var driftX = (-size * 1.1) + Math.random() * (size * 2.2);
        var liftY = (size * 0.82) + Math.random() * (size * 1.08);
        var fallY = (size * 1.85) + Math.random() * (size * 2.15);
        var rot = (-38 + Math.random() * 76).toFixed(1);
        var delay = Math.round(Math.random() * 24);
        var duration = 880 + Math.round(Math.random() * 60);
  
        var fragVariant = 1 + Math.floor(Math.random() * 4);
  
        if (isNeutralCell(cell)) {
          frag.className = 'bm-blast-frag bm-blast-frag--neutral bm-blast-frag--neutral-mix-' + fragVariant;
        } else {
          frag.className = 'bm-blast-frag bm-blast-frag--' + cell.tone + ' bm-blast-frag--mix-' + fragVariant;
        }
  
        frag.style.position = 'fixed';
        frag.style.left = Math.round(startX) + 'px';
        frag.style.top = Math.round(startY) + 'px';
        frag.style.width = Math.round(fragSize) + 'px';
        frag.style.height = Math.round(fragSize) + 'px';
        frag.style.zIndex = 9999;
        frag.style.setProperty('--bm-frag-dx', Math.round(driftX) + 'px');
        frag.style.setProperty('--bm-frag-lift', Math.round(liftY) + 'px');
        frag.style.setProperty('--bm-frag-dy', Math.round(fallY) + 'px');
        frag.style.setProperty('--bm-frag-rot', rot + 'deg');
        frag.style.setProperty('--bm-frag-delay', delay + 'ms');
        frag.style.setProperty('--bm-frag-duration', duration + 'ms');
  
        document.body.appendChild(frag);
  
        (function (node) {
          window.setTimeout(function () {
            if (node.parentNode) node.parentNode.removeChild(node);
          }, delay + duration + 80);
        })(frag);
      }
    });
  }

  function spawnScoreStars(root) {
    var burst = root.querySelector('[data-score-burst]');
    if (!burst) return;
  
    burst.innerHTML = '';
  
    var starCount = 12;
  
    for (var i = 0; i < starCount; i++) {
      var star = document.createElement('img');
      var size = 12 + Math.round(Math.random() * 14);
      var x = -78 + Math.round(Math.random() * 156);
      var y = -26 + Math.round(Math.random() * 52);
      var rot = -55 + Math.round(Math.random() * 110);
      var delay = Math.round(Math.random() * 70);
  
      star.src = 'images/star.svg';
      star.className = 'bm-score-star';
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.left = '50%';
      star.style.top = '50%';
      star.style.setProperty('--bm-star-x', x + 'px');
      star.style.setProperty('--bm-star-y', y + 'px');
      star.style.setProperty('--bm-star-rot', rot + 'deg');
      star.style.setProperty('--bm-star-delay', delay + 'ms');
  
      burst.appendChild(star);
    }
  
    burst.classList.remove('is-score-bursting');
    void burst.offsetWidth;
    burst.classList.add('is-score-bursting');
  
    window.setTimeout(function () {
      burst.classList.remove('is-score-bursting');
      burst.innerHTML = '';
    }, 1000);
  }

  function runBlastPhase(root, state, placedIndices, comboStep) {
    var blastResult;
  
    comboStep = comboStep || 1;
  
    blastResult = classifyBlastPhase(state.board, state.boardSize, comboStep);
    state.blastIndices = blastResult.blastIndices;
  
    if (!blastResult.hasBlast) {
      state.blastIndices = [];
      renderGame(root, state);
      state.isResolving = false;
      state.comboStep = 0;
      return;
    }
  
    state.boardMessage = blastResult.message;

    showBoardMessage(root, state);
    
    spawnBlastFragments(root, state, blastResult.blastIndices, comboStep);
    
    applyBlast(state.board, blastResult.blastIndices);
    hideBoardCells(root, blastResult.blastIndices);
    
    spawnScoreStars(root);
    addScore(root, state, blastResult.scoreValue, true);
    
    var moved = applyGravity(state.board, state.boardSize);
    
    state.blastIndices = [];
    state.comboStep = comboStep;
  
      animateGravityFall(root, state, moved).then(function () {
        var nextBlastResult = classifyBlastPhase(state.board, state.boardSize, comboStep + 1);
  
        if (nextBlastResult.hasBlast) {
          runBlastPhase(root, state, [], comboStep + 1);
        } else {
          state.isResolving = false;
          state.comboStep = 0;
  
          if (state.intro && state.intro.active) {
            var nextStep = state.intro.step + 1;
          
            state.intro.completed = true;
            state.intro.hoveringValid = false;
            renderGame(root, state);
          
            if (INTRO_STEPS[nextStep]) {
              window.setTimeout(function () {
                setupIntroStepByNumber(state, nextStep);
                renderGame(root, state);
              }, 2600);
            } else {
              window.setTimeout(function () {
                markIntroSeen();
                resetStandardGameState(state);
                renderGame(root, state);
              }, 2600);
            }
          }
        }
      });
  }

  function enableDrag(root, state) {
    var active = null;
  
    function getBoardRect() {
      var board = root.querySelector('.bm-board');
      return board.getBoundingClientRect();
    }

    function isPointerOverHand(clientX, clientY) {
      var hand = root.querySelector('.bm-hand');
      if (!hand) return false;

      var rect = hand.getBoundingClientRect();

      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    }

    function getBoardMetrics() {
      var board = root.querySelector('.bm-board');
      var cellEl = board ? board.querySelector('.bm-cell') : null;
      var gap = board ? (parseFloat(getComputedStyle(board).gap) || 0) : 0;
      var cellSize = cellEl ? cellEl.getBoundingClientRect().width : getCellSize();
      return { cellSize: cellSize, gap: gap };
    }
  
    function getCellSize() {
      var board = root.querySelector('.bm-board');
      var rect = board.getBoundingClientRect();
      return rect.width / state.boardSize;
    }
  
    function createGhost(el) {
      var ghost = el.cloneNode(true);
      ghost.classList.add('bm-piece--ghost');
      ghost.style.position = 'fixed';
      ghost.style.pointerEvents = 'none';
      ghost.style.zIndex = 9999;
      ghost.style.left = '0px';
      ghost.style.top = '0px';
      ghost.style.visibility = 'visible';
      document.body.appendChild(ghost);
      return ghost;
    }

    function sizeGhostToBoard(ghost) {
      var metrics = getBoardMetrics();
      var cellSize = metrics.cellSize;
      var gap = metrics.gap;
      var uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1);
      var boardFontSize = 24 * uiScale;

      var shape = ghost.querySelector('.bm-piece__shape');
      if (!shape) return;

      var minis = ghost.querySelectorAll('.bm-mini');
      if (!minis.length) return;

      var maxX = 0;
      var maxY = 0;

      minis.forEach(function (mini) {
        var left = parseFloat(mini.style.left) || 0;
        var top = parseFloat(mini.style.top) || 0;

        var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1);
        var handCell = CONFIG.handTileSize * scale;
        var handGap = CONFIG.handTileGap * scale;
        var handStep = handCell + handGap;

        var gridX = Math.round(left / handStep);
        var gridY = Math.round(top / handStep);

        mini.style.width = cellSize + 'px';
        mini.style.height = cellSize + 'px';
        mini.style.left = Math.round(gridX * (cellSize + gap)) + 'px';
        mini.style.top = Math.round(gridY * (cellSize + gap)) + 'px';
        mini.style.fontSize = boardFontSize + 'px';
        mini.style.lineHeight = cellSize + 'px';
        mini.style.textShadow = '0 2px 2px rgba(0,0,0,0.5)';

        maxX = Math.max(maxX, gridX);
        maxY = Math.max(maxY, gridY);
      });

      shape.style.width = Math.round((maxX + 1) * cellSize + maxX * gap) + 'px';
      shape.style.height = Math.round((maxY + 1) * cellSize + maxY * gap) + 'px';
    }
  
    function getPointer(e) {
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
      if (e.touches && e.touches.length) return e.touches[0];
      return e;
    }

    function getGhostLift() {
      return 0;
    }
  
    function onStart(e) {
      if (state.isResolving) return;
      var pieceEl = e.target.closest('[data-piece]');
      if (!pieceEl) return;
  
      e.preventDefault();
  
      var p = getPointer(e);
  
      var slotEl = pieceEl.closest('[data-hand-slot-index]');
      var index = slotEl ? Number(slotEl.getAttribute('data-hand-slot-index')) : -1;
      if (index < 0 || !state.hand[index]) return;
      
      document.querySelectorAll('.bm-piece--ghost').forEach(function (el) {
        el.remove();
      });

      active = {
        el: pieceEl,
        ghost: createGhost(pieceEl),
        offsetX: 0,
        offsetY: 0,
        pieceIndex: index,
        piece: state.hand[index]
      };

      var rect = pieceEl.getBoundingClientRect();

      active.offsetX = p.clientX - rect.left;
      active.offsetY = p.clientY - rect.top;
      
      active.ghost.style.left = rect.left + 'px';
      active.ghost.style.top = rect.top + 'px';
      
      sizeGhostToBoard(active.ghost);
      
      active.ghost.style.left = (p.clientX - active.offsetX) + 'px';
      active.ghost.style.top = (p.clientY - active.offsetY) + 'px';
  
      pieceEl.classList.add('is-held');
    }
  
    function getDropPosition(clientX, clientY) {
      var board = root.querySelector('.bm-board');
      var boardRect = board.getBoundingClientRect();
      var firstCell = board.querySelector('.bm-cell');
      if (!firstCell) return { x: -1, y: -1 };
    
      var cellRect = firstCell.getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(board).gap) || 0;
      var step = cellRect.width + gap;
    
      var localX = clientX - boardRect.left - 4;
      var localY = clientY - boardRect.top - 4;
    
      var x = Math.floor(localX / step);
      var y = Math.floor(localY / step);
    
      return { x: x, y: y };
    }
  
    function getGravityDrop(piece, col) {
      return getGravityDropForBoard(state.board, state.boardSize, piece, col);
    }
  
    function showPreview(piece, col) {
      clearPreview();
    
      var landed = getGravityDrop(piece, col);
      if (!landed) {
        return;
      }
    
      if (!isIntroTargetPlacement(landed)) {
        return;
      }
    
      landed.forEach(function (cell) {
        var index = cell.y * state.boardSize + cell.x;
        var cellEl = root.querySelector('[data-cell-index="' + index + '"]');
        if (!cellEl) return;
    
        var preview = document.createElement('div');
        preview.className = 'bm-tile bm-tile--' + cell.tone + ' is-preview-tile';
        preview.innerHTML = '<span class="bm-tile__label">' + cell.value + '</span>';
    
        cellEl.appendChild(preview);
      });
    
      active.preview = landed;
      setIntroHoverState(true);
    }

    function setIntroHoverState(isActive) {
      if (!(state.intro && state.intro.active)) return;

      state.intro.hoveringValid = !!isActive;

      var sourceCell = root.querySelector('[data-cell-index="' + state.intro.sourceIndex + '"]');
      var targetCell = root.querySelector('[data-cell-index="' + state.intro.allowedTargetIndex + '"]');

      var sourceTile = sourceCell ? sourceCell.querySelector('.bm-tile') : null;
      var previewTile = targetCell ? targetCell.querySelector('.is-preview-tile') : null;

      if (sourceTile) {
        sourceTile.classList.toggle('bm-intro-pair-glow', !!isActive);
        sourceTile.classList.toggle('bm-intro-pair-pulse', !!isActive);
      }

      if (targetCell) {
        targetCell.classList.toggle('bm-intro-link-active', !!isActive);
        targetCell.classList.toggle('bm-intro-link--horizontal', !!isActive && state.intro.direction === 'horizontal');
        targetCell.classList.toggle('bm-intro-link--vertical', !!isActive && state.intro.direction === 'vertical');
      }

      if (previewTile) {
        previewTile.classList.toggle('bm-intro-pair-glow', !!isActive);
        previewTile.classList.toggle('bm-intro-pair-pulse', !!isActive);
      }
    }

    function isIntroTargetPlacement(landed) {
      if (!(state.intro && state.intro.active)) return true;
      if (!landed || landed.length !== 1) return false;

      var introIndex = landed[0].y * state.boardSize + landed[0].x;
      return introIndex === state.intro.allowedTargetIndex;
    }
  
    function clearPreview() {
      root.querySelectorAll('.is-preview-tile').forEach(function (el) {
        el.remove();
      });
    
      if (active) {
        active.preview = null;
      }
    
      setIntroHoverState(false);
    }
  
    function onMove(e) {
      if (!active) return;
    
      var p = getPointer(e);
      var overHand = isPointerOverHand(p.clientX, p.clientY);

      active.ghost.style.visibility = 'visible';
      active.ghost.style.left = (p.clientX - active.offsetX) + 'px';
      active.ghost.style.top = (p.clientY - active.offsetY) + 'px';
    
      // keep floating dragged piece visible at all times
      active.ghost.style.opacity = 1;
      active.ghost.style.transform = '';
    
      // optional hand hover polish
      var handEl = root.querySelector('.bm-hand');
      if (handEl) {
        handEl.classList.toggle('is-hover', overHand);
      }
    
      // when back over hand, remove only the board preview
      if (overHand) {
        clearPreview();
        return;
      }
    
      var pos = getDropPosition(p.clientX, p.clientY);
      var piece = active.piece;
    
      if (pos.x >= 0 && pos.x < state.boardSize) {
        showPreview(piece, pos.x);
      } else {
        clearPreview();
      }
    }
  
    function commitPlacement() {
      if (!active.preview) return false;
    
      var landed = active.preview;
      var placedIndices = landed.map(function (cell) {
        return cell.y * state.boardSize + cell.x;
      });

      var placementScore = landed.reduce(function (sum, cell) {
        return sum + cell.value;
      }, 0);
    
      landed.forEach(function (cell) {
        state.board[cell.y * state.boardSize + cell.x] = {
          value: cell.value,
          tone: cell.tone
        };
      });

      state.hand[active.pieceIndex] = null;

      if (state.intro && state.intro.active) {
        state.intro.targetCursor += 1;

        if (state.intro.targetQueue[state.intro.targetCursor]) {
          var nextTarget = state.intro.targetQueue[state.intro.targetCursor];
          state.intro.allowedTargetIndex = nextTarget.index;
          state.intro.direction = nextTarget.direction;
          state.intro.sourceIndex = placedIndices[0];
        }
      }

      if (!(state.intro && state.intro.active)) {
        if (state.hand.every(function (piece) { return !piece; })) {
          state.hand = generateHand(state.board, state.boardSize);
        }
      }

      state.isResolving = true;

      var placementMoved = applyGravity(state.board, state.boardSize);

      state.animMap = buildGravityAnimMap(
        root,
        state,
        placementMoved,
        placedIndices
      );

      state.blastIndices = [];

      active.el.classList.remove('is-held');

      if (active.ghost && active.ghost.parentNode) {
        active.ghost.parentNode.removeChild(active.ghost);
      }

      clearPreview();

      renderGame(root, state);

      window.setTimeout(function () {
        runBlastPhase(root, state, placedIndices, 1);
      }, 280);

      window.setTimeout(function () {
        addScore(root, state, placementScore, true);
      }, 280);
    
      return true;
    }
  
    function onEnd(e) {
      if (!active) return;
    
      var p = getPointer(e);
      var releasedOverHand = isPointerOverHand(p.clientX, p.clientY);
      var placed = false;
    
      if (!releasedOverHand && active.preview) {
        placed = commitPlacement();
      } else {
        active.el.classList.remove('is-held');
    
        if (active.ghost && active.ghost.parentNode) {
          active.ghost.parentNode.removeChild(active.ghost);
        }
    
        clearPreview();
      }
    
      var handEl = root.querySelector('.bm-hand');
      if (handEl) {
        handEl.classList.remove('is-hover');
      }
    
      active = null;
    
      if (placed && !state.isResolving) {
        renderGame(root, state);
      }
    }
  
    root.addEventListener('mousedown', onStart);
    root.addEventListener('touchstart', onStart, { passive: false });
  
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
  
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  }

  function showBoardMessage(root, state) {
    if (!state.boardMessage) return;
  
    var oldMsg = document.body.querySelector('.bm-board-message');
    if (oldMsg) oldMsg.remove();
  
    var msg = document.createElement('div');
    msg.className = 'bm-board-message';
  
    if (state.boardMessage.indexOf('Combo!') === 0) {
      msg.classList.add('bm-msg--combo');
    }
  
    var lines = String(state.boardMessage).split('\n');
  
    msg.innerHTML = lines.map(function (line, index) {
      var isTop = index === 0;
      var sizeClass = isTop ? 'bm-board-message__svg--top' : 'bm-board-message__svg--bottom';
      var viewW = isTop ? 760 : 920;
      var x = viewW / 2;
    
      return [
        '<svg class="bm-board-message__svg ' + sizeClass + '" viewBox="0 0 ' + viewW + ' 220" aria-hidden="true">',
          '<text class="bm-board-message__text" x="' + x + '" y="108" text-anchor="middle" dominant-baseline="middle">',
            line,
          '</text>',
        '</svg>'
      ].join('');
    }).join('');
  
    document.body.appendChild(msg);
  
    if (state.boardMessageTimer) {
      window.clearTimeout(state.boardMessageTimer);
    }
  
    state.boardMessageTimer = window.setTimeout(function () {
      if (msg.parentNode) msg.parentNode.removeChild(msg);
      state.boardMessage = '';
      state.boardMessageTimer = null;
    }, 2400);
  }

  function syncHudUi(root, state) {
    var highScoreEl = root.querySelector('.bm-hud-score-value');
    var livesEl = root.querySelector('.bm-hud-lives-value');
  
    if (highScoreEl) highScoreEl.textContent = state.highScore;
    if (livesEl) livesEl.textContent = state.lives;
  }

  function syncScoreUi(root, state) {
    var scoreEl = root.querySelector('[data-score-value]');
    if (!scoreEl) return;

    scoreEl.textContent = state.displayScore;

    if (state.displayScore < state.score) {
      scoreEl.classList.add('is-scoring');
    } else {
      scoreEl.classList.remove('is-scoring');
    }
  }

  function finishScorePulse(root, state) {
    var scoreEl = root.querySelector('[data-score-value]');
    if (!scoreEl) return;

    scoreEl.classList.remove('is-scoring');
    scoreEl.classList.remove('is-score-hit');

    // restart final pop cleanly
    void scoreEl.offsetWidth;
    scoreEl.classList.add('is-score-hit');

    if (state.scoreAnimDoneTimer) {
      window.clearTimeout(state.scoreAnimDoneTimer);
    }

    state.scoreAnimDoneTimer = window.setTimeout(function () {
      var liveEl = root.querySelector('[data-score-value]');
      if (liveEl) liveEl.classList.remove('is-score-hit');
      state.scoreAnimDoneTimer = null;
    }, 220);
  }

  function animateScoreTo(root, state) {
    if (state.scoreAnimFrame) return;

    function tick() {
      var remaining = state.score - state.displayScore;

      if (remaining <= 0) {
        state.scoreAnimFrame = null;
        syncScoreUi(root, state);
        finishScorePulse(root, state);
        return;
      }

      var step = 1;

      if (remaining > 80) step = 6;
      else if (remaining > 40) step = 4;
      else if (remaining > 15) step = 2;

      state.displayScore = Math.min(state.score, state.displayScore + step);
      syncScoreUi(root, state);
      state.scoreAnimFrame = window.setTimeout(tick, 45);
    }

    tick();
  }

  function writeHighScore(value) {
    try { localStorage.setItem(CONFIG.storageKey, String(value)); }
    catch (e) {}
  }
  
  function addScore(root, state, amount, skipRender) {
    if (!amount) return;

    state.score += amount;

    if (state.score > state.highScore) {
      state.highScore = state.score;
      writeHighScore(state.highScore);
    }

    if (skipRender) {
      syncHudUi(root, state);
    } else {
      renderGame(root, state);
    }

    animateScoreTo(root, state);
  }

  function transitionScreen(root, drawNext) {
    var current = root.querySelector('.bm-screen');

    if (!current) {
      drawNext();
      var nextNow = root.querySelector('.bm-screen');
      if (nextNow) {
        nextNow.classList.add('is-screen-hidden');
        requestAnimationFrame(function () {
          nextNow.classList.remove('is-screen-hidden');
        });
      }
      return;
    }

    current.classList.add('is-screen-hidden');

    window.setTimeout(function () {
      drawNext();

      var next = root.querySelector('.bm-screen');
      if (!next) return;

      next.classList.add('is-screen-hidden');

      requestAnimationFrame(function () {
        next.classList.remove('is-screen-hidden');
      });
    }, 220);
  }

  function createApp() {
    var mount = document.getElementById('app');
    if (!mount) throw new Error('Missing #app');
    mount.innerHTML = '<div class="bm-stage" data-stage></div>';
    var root = mount.querySelector('[data-stage]');
    var state = {
      screen: 'home',
      highScore: readHighScore(),
      score: 0,
      displayScore: 0,
      scoreAnimFrame: null,
      scoreAnimDoneTimer: null,
      comboStep: 0,
      lives: CONFIG.startingLives,
      boardSize: CONFIG.boardSize,
      hand: generateHand(createEmptyBoard(CONFIG.boardSize), CONFIG.boardSize),
      board: createEmptyBoard(CONFIG.boardSize),
      dragBound: false,
      animMap: null,
      blastIndices: [],
      isResolving: false,
      boardMessage: '',
      boardMessageTimer: null,
      intro: {
        active: false,
        step: 0,
        title: "",
        sourceIndex: null,
        allowedTargetIndex: null,
        hoveringValid: false,
        completed: false,
        direction: "horizontal",
        targetQueue: [],
        targetCursor: 0
      }
    };

    function render() {
      if (state.screen === 'home') {
        renderHome(root);
        var play = root.querySelector('[data-play]');
        if (play) {
          play.addEventListener('click', function () {
            transitionScreen(root, function () {
              if (isIntroMode()) {
                setupIntroStepByNumber(state, 1);
              } else if (!hasSeenIntro()) {
                setupIntroStepByNumber(state, 1);
              } else {
                resetStandardGameState(state);
              }
          
              state.screen = 'game';
              render();
            });
          });
        }
      } else {
        renderGame(root, state);

        if (state.intro && state.intro.active) {
          var skipBtn = root.querySelector('[data-skip-intro]');
          if (skipBtn) {
            var skipIntro = function (e) {
              if (e) {
                e.preventDefault();
                e.stopPropagation();
              }
        
              if (state.boardMessageTimer) {
                window.clearTimeout(state.boardMessageTimer);
                state.boardMessageTimer = null;
              }
        
              var oldMsg = document.body.querySelector('.bm-board-message');
              if (oldMsg) oldMsg.remove();

              markIntroSeen
              /*markIntroSeen();*/
              resetStandardGameState(state);
              render();
            };
        
            skipBtn.onclick = skipIntro;
            skipBtn.ontouchend = skipIntro;
            skipBtn.onmousedown = function (e) {
              e.preventDefault();
              e.stopPropagation();
            };
          }
        }

        if (!state.dragBound) {
          enableDrag(root, state);
          state.dragBound = true;
        }
        
        var game = root.querySelector('[data-game]');
        if (game) {
          game.addEventListener('dblclick', function () {
            transitionScreen(root, function () {
              state.screen = 'home';
              render();
            });
          });
        }
      }
    }

    return { render: render };
  }

  window.addEventListener('DOMContentLoaded', function () {
    syncUiScale();
    window.addEventListener('resize', syncUiScale);
    window.addEventListener('orientationchange', syncUiScale);
    var app = createApp();
    app.render();
  });
})();
