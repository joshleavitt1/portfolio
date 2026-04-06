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

  function makeCellAt(x, y, value) {
    return {
      x: x,
      y: y,
      value: value,
      tone: toneForValue(value)
    };
  }

  var HOME_HAND = [
    { width: 1, height: 1, cells: [makeCellAt(0, 0, 2)] },
    { width: 1, height: 2, cells: [makeCellAt(0, 0, 1), makeCellAt(0, 1, 2)] },
    { width: 2, height: 1, cells: [makeCellAt(0, 0, 2), makeCellAt(1, 0, 1)] }
  ];

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

  function findBlasts(board, size) {
    var toClear = new Set();
  
    // horizontal
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
            cells.forEach(i => toClear.add(i));
          }
  
          if (sum >= 10) break;
        }
      }
    }
  
    // vertical
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
            cells.forEach(i => toClear.add(i));
          }
  
          if (sum >= 10) break;
        }
      }
    }
  
    return Array.from(toClear);
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
        clearedCount: 0,
        horizontalGroups: 0,
        verticalGroups: 0,
        totalGroups: 0,
        comboStep: comboStep,
        message: '',
        scoreValue: 0
      };
    }

    var message = '';
    var clearedCount = blastIndices.length;
    var scoreValue = 0;

    if (comboStep >= 2) {
      message = 'Combo x' + comboStep;
      scoreValue = clearedCount * (12 + ((comboStep - 1) * 4));
    } else {
      if (totalGroups <= 1) message = 'Blast';
      else if (totalGroups === 2) message = 'Double Blast';
      else if (totalGroups === 3) message = 'Triple Blast';
      else message = 'Max Blast';

      if (totalGroups <= 1) scoreValue = clearedCount * 10;
      else if (totalGroups === 2) scoreValue = clearedCount * 16;
      else if (totalGroups === 3) scoreValue = clearedCount * 20;
      else scoreValue = clearedCount * 24;
    }

    return {
      hasBlast: true,
      blastIndices: blastIndices,
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
  
    for (var x = 0; x < size; x++) {
      var writeY = size - 1;
  
      for (var y = size - 1; y >= 0; y--) {
        var index = y * size + x;
        var cell = board[index];
  
        if (!cell) continue;
  
        if (y !== writeY) {
          board[writeY * size + x] = cell;
          board[index] = null;
  
          moved.push({
            x: x,
            fromY: y,
            toY: writeY
          });
        }
  
        writeY -= 1;
      }
  
      while (writeY >= 0) {
        board[writeY * size + x] = null;
        writeY -= 1;
      }
    }
  
    return moved;
  }

  function buildAnimMap(board, boardSize, boardEl, placedIndices, moved) {
    var map = {};
    if (!boardEl) return map;
  
    var cellEl = boardEl.querySelector('.bm-cell');
    if (!cellEl) return map;
  
    var cellSize = cellEl.getBoundingClientRect().width;
    var gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    var step = cellSize + gap;
  
    (placedIndices || []).forEach(function (index) {
      map[index] = { type: 'place-pop' };
    });
  
    (moved || []).forEach(function (item) {
      var toIndex = item.toY * boardSize + item.x;
      map[toIndex] = {
        type: 'drop-land',
        distance: Math.max(10, (item.fromY - item.toY) * step)
      };
    });
  
    return map;
  }

  function resolveBoard(board, boardSize, boardEl, directPlaced) {
    var allMoved = [];
    var blastIndices = [];
  
    var movedA = applyGravity(board, boardSize);
    allMoved = allMoved.concat(movedA);
  
    var movedToIndexA = new Set(
      movedA.map(function (item) {
        return item.toY * boardSize + item.x;
      })
    );
  
    var actualDirectPlaced = (directPlaced || []).filter(function (index) {
      return !movedToIndexA.has(index);
    });
  
    while (true) {
      var blasts = findBlasts(board, boardSize);
      if (!blasts.length) break;
  
      blasts.forEach(function (index) {
        if (blastIndices.indexOf(index) === -1) blastIndices.push(index);
      });
  
      applyBlast(board, blasts);
  
      var moved = applyGravity(board, boardSize);
      allMoved = allMoved.concat(moved);
    }
  
    return {
      animMap: buildAnimMap(board, boardSize, boardEl, actualDirectPlaced, allMoved),
      blastIndices: blastIndices
    };
  }

  function toneForValue(value) {
    return 'c' + Math.max(1, Math.min(9, value));
  }
  
  function makeCell(value) {
    return {
      value: value,
      tone: toneForValue(value)
    };
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
    var landed = [];
    var occupied = board.slice();

    var cells = piece.cells.slice().sort(function (a, b) {
      return b.y - a.y;
    });

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var x = col + cell.x;

      if (x < 0 || x >= boardSize) return null;

      var finalY = null;

      for (var y = boardSize - 1; y >= 0; y--) {
        var index = y * boardSize + x;
        if (occupied[index]) continue;

        finalY = y;
        break;
      }

      if (finalY === null) return null;

      var placedCell = {
        x: x,
        y: finalY,
        value: cell.value,
        tone: cell.tone
      };

      landed.push(placedCell);
      occupied[finalY * boardSize + x] = placedCell;
    }

    return landed;
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
    root.innerHTML = '' +
      '<section class="bm-screen bm-game" data-game>' +
        '<div class="bm-hud">' +
          '<div class="bm-hud-box bm-hud-score">' +
            '<img src="images/crown.svg" class="bm-hud-icon" />' +
            '<span>' + state.highScore + '</span>' +
          '</div>' +
          '<div class="bm-hud-box bm-hud-lives">' +
            '<img src="images/heart.svg" class="bm-hud-icon" />' +
            '<span>' + state.lives + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="bm-spacer" aria-hidden="true"></div>' +
        '<div class="bm-score"><div class="bm-score__value" data-score-value>' + state.displayScore + '</div></div>' +
        '<div class="bm-spacer" aria-hidden="true"></div>' +
        '<div class="bm-board-wrap">' +
          '<div class="bm-board">' + renderBoard(state.boardSize, state.board, state.animMap, state.blastIndices) + '</div>' +
        '</div>' +
        '<div class="bm-spacer" aria-hidden="true"></div>' +
        '<div class="bm-hand">' + state.hand.map(function (piece, index) {
          return '<div class="bm-hand-slot" data-hand-slot-index="' + index + '">' + (piece ? renderPiece(piece) : '') + '</div>';
        }).join('') + '</div>' +
      '</section>';
  
    syncScoreUi(root, state);
    state.animMap = null;
  }

  function renderBoard(boardSize, board, animMap, blastIndices) {
    animMap = animMap || {};
    blastIndices = blastIndices || [];
  
    return board.map(function (cell, index) {
      if (!cell) return '<div class="bm-cell"></div>';
  
      var anim = animMap[index];
      var isBlasting = blastIndices.indexOf(index) !== -1;
      var extraClass = '';
      var extraStyle = '';
  
      if (anim) {
        if (anim.type === 'place-pop') {
          extraClass = ' bm-place-pop';
        } else if (anim.type === 'drop-land') {
          extraClass = ' bm-drop-land';
          extraStyle = ' style="--bm-drop-distance:' + anim.distance + 'px;"';
        } else if (anim.type === 'blast-pop') {
          extraClass = ' bm-blast-pop';
        }
      }

      if (isBlasting) {
        extraClass += ' bm-blast-pop';
      }
  
      return '<div class="bm-cell">' +
      '<div class="bm-tile bm-tile--' + cell.tone + extraClass + '"' + extraStyle + '><span class="bm-tile__label">' + cell.value + '</span></div>' +
    '</div>';
    }).join('');
  }

  function spawnBlastFragments(root, state, blastIndices) {
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

      var pieces = 25;
      for (var i = 0; i < pieces; i++) {
        var frag = document.createElement('div');
        var fragSize = Math.max(4, size * (0.125 + Math.random() * 0.13));

        var startX = rect.left + (size * 0.12) + Math.random() * (size * 0.76);
        var startY = rect.top + (size * 0.10) + Math.random() * (size * 0.30);

        var driftX = (-size * 1.1) + Math.random() * (size * 2.2);
        var liftY = (size * 0.82) + Math.random() * (size * 1.08);
        var fallY = (size * 1.85) + Math.random() * (size * 2.15);
        var rot = (-38 + Math.random() * 76).toFixed(1);
        var delay = Math.round(Math.random() * 70);
        var duration = 520 + Math.round(Math.random() * 160);

        var fragVariant = 1 + Math.floor(Math.random() * 4);
        frag.className = 'bm-blast-frag bm-blast-frag--' + cell.tone + ' bm-blast-frag--mix-' + fragVariant;
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

  function triggerBlastShake(root) {
    var wrap = root.querySelector('.bm-board-wrap');
    if (!wrap) return;

    wrap.classList.remove('is-blast-shaking');
    void wrap.offsetWidth;
    wrap.classList.add('is-blast-shaking');

    window.setTimeout(function () {
      var liveWrap = root.querySelector('.bm-board-wrap');
      if (liveWrap) liveWrap.classList.remove('is-blast-shaking');
    }, 190);
  }

  function runBlastPhase(root, state, placedIndices, comboStep) {
    var boardEl = root.querySelector('.bm-board');
    var blastResult;

    comboStep = comboStep || 1;

    state.animMap = buildAnimMap(
      state.board,
      state.boardSize,
      boardEl,
      placedIndices || [],
      []
    );

    blastResult = classifyBlastPhase(state.board, state.boardSize, comboStep);
    state.blastIndices = blastResult.blastIndices;

    if (!blastResult.hasBlast) {
      renderGame(root, state);
      state.isResolving = false;
      state.comboStep = 0;
      return;
    }
    
    state.boardMessage = blastResult.message;
    renderGame(root, state);

    requestAnimationFrame(function () {
      showBoardMessage(root, state);
      triggerBlastShake(root);
      spawnBlastFragments(root, state, blastResult.blastIndices);
      applyBlast(state.board, blastResult.blastIndices);

      var moved = applyGravity(state.board, state.boardSize);

      addScore(root, state, blastResult.scoreValue, true);

      state.animMap = buildAnimMap(
        state.board,
        state.boardSize,
        root.querySelector('.bm-board'),
        [],
        moved
      );

      state.blastIndices = [];
      state.comboStep = comboStep;

      renderGame(root, state);

      var nextBlastResult = classifyBlastPhase(state.board, state.boardSize, comboStep + 1);

      if (nextBlastResult.hasBlast) {
        window.setTimeout(function () {
          runBlastPhase(root, state, [], comboStep + 1);
        }, 650);
      } else {
        state.isResolving = false;
        state.comboStep = 0;
      }
    });
  }

  function enableDrag(root, state) {
    var active = null;
  
    function getBoardRect() {
      var board = root.querySelector('.bm-board');
      return board.getBoundingClientRect();
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
      ghost.style.visibility = 'hidden';
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
      if (e.touches) return e.touches[0];
      return e;
    }

    function getGhostLift() {
      return 80;
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
      
      active = {
        el: pieceEl,
        ghost: createGhost(pieceEl),
        offsetX: 0,
        offsetY: 0,
        pieceIndex: index,
        piece: state.hand[index]
      };

      sizeGhostToBoard(active.ghost);
  
      var rect = pieceEl.getBoundingClientRect();
      var ghostShape = active.ghost.querySelector('.bm-piece__shape');
      var ghostRect = ghostShape.getBoundingClientRect();

      var grabRatioX = rect.width ? ((p.clientX - rect.left) / rect.width) : 0.5;
      var grabRatioY = rect.height ? ((p.clientY - rect.top) / rect.height) : 0.5;

      active.offsetX = ghostRect.width * grabRatioX;
      active.offsetY = ghostRect.height * grabRatioY;

      var ghostLiftY = getGhostLift();
      active.ghost.style.left = (p.clientX - active.offsetX) + 'px';
      active.ghost.style.top = (p.clientY - active.offsetY - ghostLiftY) + 'px';
      active.ghost.style.visibility = 'visible';
  
      pieceEl.style.opacity = 0;
    }
  
    function getDropPosition(clientX, clientY) {
      var boardRect = getBoardRect();
      var cellSize = getCellSize();
  
      var x = Math.floor((clientX - boardRect.left) / cellSize);
      var y = Math.floor((clientY - boardRect.top) / cellSize);
  
      return { x: x, y: y };
    }
  
    function getGravityDrop(piece, col) {
      return getGravityDropForBoard(state.board, state.boardSize, piece, col);
    }
  
    function showPreview(piece, col) {
      clearPreview();
    
      var landed = getGravityDrop(piece, col);
      if (!landed) return;
    
      landed.forEach(function (cell) {
        var index = cell.y * state.boardSize + cell.x;
        var cellEl = root.querySelectorAll('.bm-cell')[index];
        if (!cellEl) return;
    
        var preview = document.createElement('div');
        preview.className = 'bm-tile bm-tile--' + cell.tone + ' is-preview-tile';
        preview.innerHTML = '<span class="bm-tile__label">' + cell.value + '</span>';
    
        cellEl.appendChild(preview);
      });
    
      active.preview = landed;
    }
  
    function clearPreview() {
      root.querySelectorAll('.is-preview-tile').forEach(function (el) {
        el.remove();
      });
    }
  
    function onMove(e) {
      if (!active) return;
  
      var p = getPointer(e);
  
      var ghostLiftY = getGhostLift();
      active.ghost.style.left = (p.clientX - active.offsetX) + 'px';
      active.ghost.style.top = (p.clientY - active.offsetY - ghostLiftY) + 'px';
  
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
      if (state.hand.every(function (piece) { return !piece; })) {
        state.hand = generateHand(state.board, state.boardSize);
      }

      state.isResolving = true;

      state.animMap = buildAnimMap(
        state.board,
        state.boardSize,
        root.querySelector('.bm-board'),
        placedIndices,
        []
      );
      state.blastIndices = [];
      renderGame(root, state);

      window.setTimeout(function () {
        runBlastPhase(root, state, [], 1);
      }, 240);
      
      window.setTimeout(function () {
        addScore(root, state, placementScore, true);
      }, 240);
    
      return true;
    }
  
    function onEnd() {
      if (!active) return;
  
      var placed = commitPlacement();
  
      active.el.style.opacity = 1;
      active.ghost.remove();
      clearPreview();
  
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

  function getBoardMessageAssetPath(message) {
    if (!message) return '';
  
    if (message === 'Blast') return 'images/blast_1.svg';
    if (message === 'Double Blast') return 'images/blast_2.svg';
    if (message === 'Triple Blast') return 'images/blast_3.svg';
    if (message === 'Max Blast') return 'images/blast_4.svg';
  
    if (message.indexOf('Combo x') === 0) {
      var comboStep = parseInt(message.replace('Combo x', ''), 10) || 2;
      var comboIndex = Math.max(1, comboStep - 1);
      return 'images/combo_' + comboIndex + '.svg';
    }
  
    return 'images/blast_1.svg';
  }

  function showBoardMessage(root, state) {
    if (!state.boardMessage) return;
  
    var src = getBoardMessageAssetPath(state.boardMessage);
    if (!src) return;
  
    var oldMsg = document.body.querySelector('.bm-board-message');
    if (oldMsg) oldMsg.remove();
  
    var msg = document.createElement('div');
    msg.className = 'bm-board-message';
    msg.innerHTML = '<img src="' + src + '" class="bm-board-message__img" />';
  
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
    var highScoreEl = root.querySelector('.bm-hud-score span');
    var livesEl = root.querySelector('.bm-hud-lives span');

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
      boardMessageTimer: null
    };

    function render() {
      if (state.screen === 'home') {
        renderHome(root);
        var play = root.querySelector('[data-play]');
        if (play) {
          play.addEventListener('click', function () {
            transitionScreen(root, function () {
              state.screen = 'game';
              render();
            });
          });
        }
      } else {
        renderGame(root, state);

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
