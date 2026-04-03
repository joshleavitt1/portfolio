(function () {
  var CONFIG = {
    baseWidth: 390,
    baseHeight: 844,
    boardSize: 6,
    handSize: 4,
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
    { width: 1, height: 1, cells: [makeCellAt(0, 0, 1)] },
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

  function generatePiece() {
    var shapes = [
      { width: 1, height: 1, coords: [{ x: 0, y: 0 }] },
      { width: 1, height: 2, coords: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
      { width: 2, height: 1, coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }
    ];
  
    var shape = shapes[Math.floor(Math.random() * shapes.length)];
  
    return {
      width: shape.width,
      height: shape.height,
      cells: shape.coords.map(function (coord) {
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

  function renderPiece(piece) {
    var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1);
    var cellSize = 36 * scale;
    var gap = 2 * scale;
    var width = (piece.width * cellSize) + ((piece.width - 1) * gap);
    var height = (piece.height * cellSize) + ((piece.height - 1) * gap);
    var cells = piece.cells.map(function (cell) {
      var left = Math.round(cell.x * (cellSize + gap));
      var top = Math.round(cell.y * (cellSize + gap));
      return '<div class="bm-mini bm-mini--' + cell.tone + '" style="left:' + left + 'px; top:' + top + 'px;">' + cell.value + '</div>';
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
        '<div class="bm-score"><div class="bm-score__value">' + state.score + '</div></div>' +
        '<div class="bm-board-wrap"><div class="bm-board">' + renderBoard(state.boardSize, state.board, state.animMap, state.blastIndices) + '</div></div>' +
        '<div class="bm-hand">' + state.hand.map(function (piece) { return '<div class="bm-hand-slot">' + renderPiece(piece) + '</div>'; }).join('') + '</div>' +
      '</section>';
  
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
        '<div class="bm-tile bm-tile--' + cell.tone + extraClass + '"' + extraStyle + '>' + cell.value + '</div>' +
      '</div>';
    }).join('');
  }

  function runBlastPhase(root, state, placedIndices, comboStep) {
    var boardEl = root.querySelector('.bm-board');
    comboStep = comboStep || 1;
  
    state.animMap = buildAnimMap(
      state.board,
      state.boardSize,
      boardEl,
      placedIndices || [],
      []
    );
  
    state.blastIndices = findBlasts(state.board, state.boardSize);
  
    renderGame(root, state);
  
    if (!state.blastIndices.length) {
      state.isResolving = false;
      state.comboStep = 0;
      return;
    }
  
    requestAnimationFrame(function () {
      window.setTimeout(function () {
        applyBlast(state.board, state.blastIndices);
        var clearedCount = state.blastIndices.length;
        var blastValue = comboStep === 1 ? 10 : 15;
        addScore(state, clearedCount * blastValue * comboStep);
  
        var moved = applyGravity(state.board, state.boardSize);
  
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
  
        var nextBlasts = findBlasts(state.board, state.boardSize);
  
        if (nextBlasts.length) {
          window.setTimeout(function () {
            runBlastPhase(root, state, [], comboStep + 1);
          }, 450);
        } else {
          state.isResolving = false;
          state.comboStep = 0;
        }
      }, 300);
    });
  }

  function enableDrag(root, state) {
    var active = null;
  
    function getBoardRect() {
      var board = root.querySelector('.bm-board');
      return board.getBoundingClientRect();
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
      document.body.appendChild(ghost);
      return ghost;
    }
  
    function getPointer(e) {
      if (e.touches) return e.touches[0];
      return e;
    }
  
    function onStart(e) {
      if (state.isResolving) return;
      var pieceEl = e.target.closest('[data-piece]');
      if (!pieceEl) return;
  
      e.preventDefault();
  
      var p = getPointer(e);
  
      var pieces = Array.from(root.querySelectorAll('[data-piece]'));
      var index = pieces.indexOf(pieceEl);
      
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
  
      pieceEl.style.opacity = 0.3;
    }
  
    function getDropPosition(clientX, clientY) {
      var boardRect = getBoardRect();
      var cellSize = getCellSize();
  
      var x = Math.floor((clientX - boardRect.left) / cellSize);
      var y = Math.floor((clientY - boardRect.top) / cellSize);
  
      return { x: x, y: y };
    }
  
    function getGravityDrop(piece, col) {
      var landed = [];
      var occupied = state.board.slice();
    
      var cells = piece.cells.slice().sort(function (a, b) {
        return b.y - a.y;
      });
    
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var x = col + cell.x;
    
        if (x < 0 || x >= state.boardSize) return null;
    
        var finalY = null;
    
        for (var y = state.boardSize - 1; y >= 0; y--) {
          var index = y * state.boardSize + x;
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
        occupied[finalY * state.boardSize + x] = placedCell;
      }
    
      return landed;
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
        preview.textContent = cell.value;
    
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
  
      active.ghost.style.left = (p.clientX - active.offsetX) + 'px';
      active.ghost.style.top = (p.clientY - active.offsetY) + 'px';
  
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
    
      landed.forEach(function (cell) {
        state.board[cell.y * state.boardSize + cell.x] = {
          value: cell.value,
          tone: cell.tone
        };
      });
    
      state.hand[active.pieceIndex] = generatePiece();
    
      state.isResolving = true;
      runBlastPhase(root, state, placedIndices);
    
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

  function writeHighScore(value) {
    try { localStorage.setItem(CONFIG.storageKey, String(value)); }
    catch (e) {}
  }
  
  function addScore(state, amount) {
    state.score += amount;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      writeHighScore(state.highScore);
    }
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
      comboStep: 0,
      lives: CONFIG.startingLives,
      boardSize: CONFIG.boardSize,
      hand: HOME_HAND.map(function (p) {
        return JSON.parse(JSON.stringify(p));
      }),
      board: createEmptyBoard(CONFIG.boardSize),
      dragBound: false,
      animMap: null,
      blastIndices: [],
      isResolving: false
    };

    function render() {
      if (state.screen === 'home') {
        renderHome(root);
        var play = root.querySelector('[data-play]');
        if (play) {
          play.addEventListener('click', function () {
            state.screen = 'game';
            render();
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
            state.screen = 'home';
            render();
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
