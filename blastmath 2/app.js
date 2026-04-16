(function () {
  var CONFIG = {
    baseWidth: 390,
    baseHeight: 844,
    boardSize: 6,
    handSize: 3,
    handTileSize: 52,
    handTileGap: 2,
    startingLives: 3,
    storageKey: "blastmath.highscore",
    classicSaveKey: "blastmath.save.classic",
    dailySaveKey: "blastmath.save.daily",

    heartChanceScaleAt2Lives: 2,
    heartChanceScaleAt1Life: 3,

    maxBombTilesOnBoard: 2,
    maxHeartTilesOnBoard: 2,
    maxSkullTilesOnBoard: 2
  };

  var SFX = {
    pickup: new Audio('sounds/pickup.mp3'),
    place: new Audio('sounds/place.mp3'),
    blast: new Audio('sounds/blast.mp3'),
    combo: new Audio('sounds/combo.mp3'),
    lose: new Audio('sounds/lose.mp3'),
    start: new Audio('sounds/start.mp3')
  };

  var SFX_VOLUME = {
    pickup: 0.45,
    place: 0.45,
    blast: 1,
    combo: 1,
    lose: 1,
    start: 1
  };

  var audioCtx = null;
  var SFX_BUFFERS = {
    pickup: null,
    place: null
  };

  Object.values(SFX).forEach(function (sound) {
    sound.preload = 'auto';
    sound.playsInline = true;
    sound.muted = false;
    sound.load();
  });

  function ensureAudioContext() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function(){});
    }

    return audioCtx;
  }

  function loadBuffer(url, done) {
    var ctx = ensureAudioContext();
    if (!ctx) {
      done(null);
      return;
    }

    fetch(url)
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (decoded) { done(decoded); })
      .catch(function () { done(null); });
  }

  function primeResponsiveSfx() {
    if (SFX_BUFFERS.pickup && SFX_BUFFERS.place) return;

    loadBuffer('sounds/pickup.mp3', function (buffer) {
      SFX_BUFFERS.pickup = buffer;
    });

    loadBuffer('sounds/place.mp3', function (buffer) {
      SFX_BUFFERS.place = buffer;
    });
  }

  function playBufferedSfx(name) {
    var ctx = ensureAudioContext();
    var buffer = SFX_BUFFERS[name];

    if (!ctx || !buffer) return false;

    try {
      var source = ctx.createBufferSource();
      var gain = ctx.createGain();

      gain.gain.value = (SFX_VOLUME[name] != null) ? SFX_VOLUME[name] : 1;

      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      return true;
    } catch (e) {
      return false;
    }
  }

  function playSfx(name) {
    if (name === 'pickup' || name === 'place') {
      if (playBufferedSfx(name)) return;
    }

    var sound = SFX[name];
    if (!sound) return;

    try {
      sound.pause();
      sound.currentTime = 0;
      sound.volume = (SFX_VOLUME[name] != null) ? SFX_VOLUME[name] : 1;

      var playPromise = sound.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function(){});
      }
    } catch (e) {}
  }

  var INTRO_QUERY_VALUE = "1";
  var INTRO_MESSAGE_TO_NEXT_STEP_DELAY = 250;
  var CHAIN_NEXT_BLAST_DELAY = 500;
  var INTRO_THUMB_POP_DELAY = 500;
  var INTRO_THUMB_POP_DURATION = 2500;
  var INTRO_BLAST_TO_MESSAGE_DELAY = INTRO_THUMB_POP_DELAY + INTRO_THUMB_POP_DURATION;
  var BLAST_MESSAGE_STEP_DELAY = 420;
  var BLAST_PRIMARY_MESSAGE_DELAY = INTRO_THUMB_POP_DELAY + BLAST_MESSAGE_STEP_DELAY;
  var BLAST_SECONDARY_MESSAGE_DELAY = BLAST_PRIMARY_MESSAGE_DELAY + BLAST_MESSAGE_STEP_DELAY;
  var POINTS_MESSAGE_EXTRA_DELAY = 400;
  var POINTS_MESSAGE_DURATION = 2400;

  var LEVELS = [
    {
      id: 1,
      minScore: 0,
      maxScore: 1000,
      wallDropRate: 4,
      pieceBias: 'easy',
      features: {
        bombs: false,
        skulls: false,
        hearts: false
      }
    },
    {
      id: 2,
      minScore: 1000,
      maxScore: 2000,
      wallDropRate: 4,
      pieceBias: 'double',
      features: {
        bombs: true,
        skulls: false,
        hearts: false
      }
    },
    {
      id: 3,
      minScore: 2000,
      maxScore: 3000,
      wallDropRate: 4,
      pieceBias: 'mixed',
      features: {
        bombs: true,
        skulls: true,
        skullChance: 0.10,
        hearts: true,
        heartChance: 0.05
      }
    },
    {
      id: 4,
      minScore: 3000,
      maxScore: Infinity,
      wallDropRate: 3,
      pieceBias: 'mixed',
      features: {
        bombs: true,
        skulls: true,
        skullChance: 0.10,
        hearts: true,
        heartChance: 0.05
      }
    }
  ];

  var DAILY_PUZZLES = {
    "daily-1": {
      id: "daily-1",
      moves: 12,
      gemCount: 5,
      gemSlots: [
        { x: 1, y: 5 },
        { x: 4, y: 5 },
        { x: 2, y: 4 },
        { x: 0, y: 3 },
        { x: 5, y: 3 },
        { x: 1, y: 2 },
        { x: 4, y: 2 },
        { x: 2, y: 1 }
      ],
      walls: [
        { x: 0, y: 5 },
        { x: 2, y: 5 },
        { x: 3, y: 5 },
        { x: 5, y: 5 },

        { x: 1, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },

        { x: 1, y: 3 },
        { x: 4, y: 3 },

        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },

        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 4, y: 1 },

        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 }
      ],
      hands: [
        [
          [{ x: 0, y: 0, value: 3 }],
          [{ x: 0, y: 0, value: 7 }],
          [{ x: 0, y: 0, value: 4 }, { x: 1, y: 0, value: 6 }]
        ],
        [
          [{ x: 0, y: 0, value: 2 }, { x: 1, y: 0, value: 5 }],
          [{ x: 0, y: 0, value: 8 }],
          [{ x: 0, y: 0, value: 1 }, { x: 0, y: 1, value: 9 }]
        ],
        [
          [{ x: 0, y: 0, value: 4 }],
          [{ x: 0, y: 0, value: 6 }],
          [{ x: 0, y: 0, value: 5 }, { x: 1, y: 0, value: 3 }]
        ],
        [
          [{ x: 0, y: 0, value: 1 }],
          [{ x: 0, y: 0, value: 9 }],
          [{ x: 0, y: 0, value: 2 }, { x: 1, y: 0, value: 8 }]
        ]
      ]
    },

    "daily-2": {
      id: "daily-2",
      moves: 12,
      gemCount: 5,
      gemSlots: [
        { x: 2, y: 5 },
        { x: 5, y: 5 },
        { x: 1, y: 4 },
        { x: 4, y: 4 },
        { x: 0, y: 3 },
        { x: 3, y: 3 },
        { x: 5, y: 2 },
        { x: 1, y: 1 }
      ],
      walls: [
        { x: 0, y: 5 },
        { x: 1, y: 5 },
        { x: 3, y: 5 },

        { x: 2, y: 4 },
        { x: 5, y: 4 },

        { x: 1, y: 3 },
        { x: 2, y: 3 },
        { x: 4, y: 3 },

        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },

        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },

        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 }
      ],
      hands: [
        [
          [{ x: 0, y: 0, value: 1 }],
          [{ x: 0, y: 0, value: 9 }],
          [{ x: 0, y: 0, value: 2 }, { x: 1, y: 0, value: 8 }]
        ],
        [
          [{ x: 0, y: 0, value: 3 }],
          [{ x: 0, y: 0, value: 7 }],
          [{ x: 0, y: 0, value: 5 }, { x: 0, y: 1, value: 5 }]
        ],
        [
          [{ x: 0, y: 0, value: 4 }],
          [{ x: 0, y: 0, value: 6 }],
          [{ x: 0, y: 0, value: 1 }, { x: 1, y: 0, value: 4 }]
        ],
        [
          [{ x: 0, y: 0, value: 2 }],
          [{ x: 0, y: 0, value: 8 }],
          [{ x: 0, y: 0, value: 3 }, { x: 1, y: 0, value: 7 }]
        ]
      ]
    }
  };
  
  function getCurrentLevel(state) {
    var score = state && typeof state.score === 'number' ? state.score : 0;
  
    for (var i = 0; i < LEVELS.length; i++) {
      var level = LEVELS[i];
      if (score >= level.minScore && score < level.maxScore) {
        return level;
      }
    }
  
    return LEVELS[LEVELS.length - 1];
  }

  function isIntroMode() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get("intro") === INTRO_QUERY_VALUE) return true;
      if (params.has("intro-step")) return true;
  
      for (var i = 1; i <= 20; i++) {
        if (params.has("intro-step-" + i)) return true;
      }
  
      return false;
    } catch (e) {
      return false;
    }
  }

  function getIntroStartStep() {
    try {
      var params = new URLSearchParams(window.location.search);
  
      var explicitStep = params.get("intro-step");
      if (explicitStep != null) {
        var parsedExplicit = Number(explicitStep);
        if (INTRO_STEPS[parsedExplicit]) return parsedExplicit;
      }
  
      for (var i = 1; i <= 20; i++) {
        if (params.has("intro-step-" + i)) {
          if (INTRO_STEPS[i]) return i;
        }
      }
  
      return 1;
    } catch (e) {
      return 1;
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
    state.currentLevel = LEVELS[0];
    state.levelId = 1;
    state.level2BombInjected = false;
    seedBoardForCurrentLevel(state);
    state.hand = generateHand(state.board, state.boardSize, state);
    state.animMap = null;
    state.blastIndices = [];
    state.isResolving = false;
    state.boardMessage = "";
    state.moveCount = 0;
    state.handCount = 0;
    state.pendingBombSpawn = false;
    state.wallSpawnsSinceBomb = 0;
    state.pendingComboPoints = 0;
    state.justDealtNewHand = false;

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

  function makeFixedPiece(cells, id) {
    var normalized = (cells || []).map(function (cell) {
      return makeCellAt(cell.x || 0, cell.y || 0, cell.value);
    });

    var width = 1;
    var height = 1;

    normalized.forEach(function (cell) {
      width = Math.max(width, cell.x + 1);
      height = Math.max(height, cell.y + 1);
    });

    return {
      id: id || ("daily-piece-" + Date.now()),
      group: "daily",
      rank: normalized.length,
      width: width,
      height: height,
      cells: normalized
    };
  }

  function buildDailyHandsFromPuzzle(puzzle) {
    return (puzzle.hands || []).map(function (handSet, handIndex) {
      return (handSet || []).map(function (pieceCells, pieceIndex) {
        return makeFixedPiece(pieceCells, puzzle.id + "-h" + handIndex + "-p" + pieceIndex);
      });
    });
  }

  var INTRO_STEPS = {
    1: {
      step: 1,
      title: "Make 10 in a row to blast!",
    
      boardCells: [
        { x: 2, y: 5, value: 1 }
      ],
    
      handValues: [9],
    
      targets: [
        { x: 3, y: 5, direction: "horizontal" }
      ]
    },
  
    2: {
      step: 2,
      title: "Blast up and down too!",
  
      boardCells: [
        { x: 2, y: 5, value: 2 }
      ],
  
      handValues: [8],
  
      targets: [
        { x: 2, y: 4, direction: "vertical" }
      ]
    },
  
    3: {
      step: 3,
      title: "Use more tiles to blast!",
  
      boardCells: [
        { x: 2, y: 5, value: 3 }
      ],
  
      handPieces: [[
        { x: 0, y: 0, value: 2 },
        { x: 1, y: 0, value: 5 }
      ]],
  
      targets: [
        { x: 3, y: 5, direction: "horizontal" },
        { x: 4, y: 5, direction: "horizontal" }
      ]
    },

    4: {
      step: 4,
      title: "Tiles fall down!",
  
      boardCells: [
        { x: 2, y: 5, value: 3 }
      ],
  
      handValues: [7],
  
      targets: [
        { x: 2, y: 0, direction: "vertical" }
      ]
    },

    5: {
      step: 5,
      title: "Chain blasts to combo!",
      introMode: "combo",
    
      boardCells: [
        { x: 2, y: 5, kind: "number", value: 4 },
        { x: 3, y: 5, kind: "number", value: 5 },
        { x: 3, y: 4, kind: "number", value: 6 }
      ],
    
      handValues: [5],
    
      targets: [{ x: 4, y: 5, direction: "horizontal" }]
    },

    6: {
      step: 6,
      title: "Blast through walls!",
      introMode: "neutral",
    
      boardCells: [
        { x: 3, y: 2, kind: "number", value: 8 },
        { x: 3, y: 3, kind: "number", value: 9 },
    
        { x: 2, y: 4, kind: "neutral" },
        { x: 3, y: 4, kind: "neutral" },
    
        { x: 2, y: 5, kind: "neutral" },
        { x: 3, y: 5, kind: "number", value: 2 }
      ],
    
      handValues: [1],
    
      targets: [{ x: 2, y: 3 }]
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

    for (i = 0; i < board.length; i++) {
      if (!board[i]) continue;
    
      var row = Math.floor(i / CONFIG.boardSize);
    
      state.animMap[i] = {
        type: "drop-land",
        distance: (row + 5.5) * 44,
        duration: 420
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
      equationAnchor: null,
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

  var HELPER_SEEN_KEY = "blastmath.helperSeen";

function readHelperSeen() {
  try { return JSON.parse(localStorage.getItem(HELPER_SEEN_KEY) || "{}"); }
  catch (e) { return {}; }
}

function hasSeenHelper(id) {
  var seen = readHelperSeen();
  return seen[id] === 1;
}

function markHelperSeen(id) {
  try {
    var seen = readHelperSeen();
    seen[id] = 1;
    localStorage.setItem(HELPER_SEEN_KEY, JSON.stringify(seen));
  } catch (e) {}
}

  function readHighScore() {
    try { return Number(localStorage.getItem(CONFIG.storageKey) || 0) || 0; }
    catch (e) { return 0; }
  }

  function getSaveKeyForScreen(screen) {
    if (screen === 'daily') return CONFIG.dailySaveKey;
    return CONFIG.classicSaveKey;
  }
  
  function getActiveSaveKey(state) {
    if (state && state.screen === 'daily') return CONFIG.dailySaveKey;
    return CONFIG.classicSaveKey;
  }

  function clonePieceForSave(piece) {
    if (!piece) return null;

    return {
      id: piece.id,
      group: piece.group,
      rank: piece.rank,
      width: piece.width,
      height: piece.height,
      cells: (piece.cells || []).map(function (cell) {
        return {
          x: cell.x,
          y: cell.y,
          value: cell.value,
          tone: cell.tone
        };
      })
    };
  }

  function cloneHandForSave(hand) {
    return (hand || []).map(function (piece) {
      return clonePieceForSave(piece);
    });
  }

  function cloneBoardForSave(board) {
    return (board || []).map(function (cell) {
      if (!cell) return null;
      return Object.assign({}, cell);
    });
  }

  function sanitizeSavedState(saved) {
    if (!saved || typeof saved !== 'object') return null;
    if (!saved.screen) return null;
    if (!Array.isArray(saved.board)) return null;
    if (!Array.isArray(saved.hand)) return null;
    return saved;
  }

  function readSavedGame(screen) {
    try {
      var key = getSaveKeyForScreen(screen);
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return sanitizeSavedState(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }
  
  function clearSavedGame(screen) {
    try {
      localStorage.removeItem(getSaveKeyForScreen(screen));
    } catch (e) {}
  }
  
  function clearAllSavedGames() {
    try {
      localStorage.removeItem(CONFIG.classicSaveKey);
      localStorage.removeItem(CONFIG.dailySaveKey);
    } catch (e) {}
  }
  
  function writeSavedGame(state) {
    try {
      if (!state) return;
  
      if (state.screen === 'home') {
        return;
      }
  
      if (state.intro && state.intro.active) {
        clearSavedGame('game');
        return;
      }
  
      var payload = {
        screen: state.screen,
        highScore: state.highScore,
        score: state.score,
        displayScore: state.displayScore,
        comboStep: state.comboStep,
        lives: state.lives,
        boardSize: state.boardSize,
        moveCount: state.moveCount,
        handCount: state.handCount,
        justDealtNewHand: state.justDealtNewHand,
        levelId: state.levelId,
        currentLevelId: state.currentLevel ? state.currentLevel.id : 1,
        board: cloneBoardForSave(state.board),
        hand: cloneHandForSave(state.hand),
        pendingBombSpawn: state.pendingBombSpawn,
        wallSpawnsSinceBomb: state.wallSpawnsSinceBomb,
        pendingComboPoints: state.pendingComboPoints,
        dailyHands: (state.dailyHands || []).map(function (handSet) {
          return cloneHandForSave(handSet);
        }),
        dailyHandIndex: state.dailyHandIndex || 0,
        dailyMovesBand: state.dailyMovesBand || null,
        daily: state.daily ? {
          active: !!state.daily.active,
          puzzleId: state.daily.puzzleId,
          movesRemaining: state.daily.movesRemaining,
          gemTarget: state.daily.gemTarget,
          gemsRemaining: state.daily.gemsRemaining,
          completed: !!state.daily.completed,
          failed: !!state.daily.failed,
          handIndex: state.daily.handIndex || 0,
          handCount: state.daily.handCount || 0,
          variantSeed: state.daily.variantSeed,
          chosenGems: state.daily.chosenGems || []
        } : null
      };
  
      localStorage.setItem(getActiveSaveKey(state), JSON.stringify(payload));
    } catch (e) {}
  }

  function restoreSavedGame(state, saved) {
    if (!saved) return false;

    state.screen = saved.screen || 'home';
    state.highScore = typeof saved.highScore === 'number' ? saved.highScore : state.highScore;
    state.score = typeof saved.score === 'number' ? saved.score : 0;
    state.displayScore = typeof saved.displayScore === 'number' ? saved.displayScore : state.score;
    state.comboStep = typeof saved.comboStep === 'number' ? saved.comboStep : 0;
    state.lives = typeof saved.lives === 'number' ? saved.lives : CONFIG.startingLives;
    state.boardSize = typeof saved.boardSize === 'number' ? saved.boardSize : CONFIG.boardSize;
    state.moveCount = typeof saved.moveCount === 'number' ? saved.moveCount : 0;
    state.handCount = typeof saved.handCount === 'number' ? saved.handCount : 0;
    state.justDealtNewHand = !!saved.justDealtNewHand;
    state.levelId = typeof saved.levelId === 'number' ? saved.levelId : 1;
    state.currentLevel = LEVELS.filter(function (level) {
      return level.id === (saved.currentLevelId || state.levelId);
    })[0] || LEVELS[0];
    state.board = cloneBoardForSave(saved.board);
    state.hand = cloneHandForSave(saved.hand);
    state.pendingBombSpawn = !!saved.pendingBombSpawn;
    state.wallSpawnsSinceBomb = typeof saved.wallSpawnsSinceBomb === 'number' ? saved.wallSpawnsSinceBomb : 0;
    state.pendingComboPoints = typeof saved.pendingComboPoints === 'number' ? saved.pendingComboPoints : 0;
    state.animMap = null;
    state.blastIndices = [];
    state.isResolving = false;
    state.boardMessage = '';
    state.dailyHands = (saved.dailyHands || []).map(function (handSet) {
      return cloneHandForSave(handSet);
    });
    state.dailyHandIndex = typeof saved.dailyHandIndex === 'number' ? saved.dailyHandIndex : 0;
    state.dailyMovesBand = saved.dailyMovesBand || null;
    state.dailyMovesPulseStarted = false;
    state.dailyJustHitDanger = false;

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

    state.daily = saved.daily ? {
      active: !!saved.daily.active,
      puzzleId: saved.daily.puzzleId,
      movesRemaining: saved.daily.movesRemaining,
      gemTarget: saved.daily.gemTarget,
      gemsRemaining: saved.daily.gemsRemaining,
      completed: !!saved.daily.completed,
      failed: !!saved.daily.failed,
      handIndex: saved.daily.handIndex || 0,
      handCount: saved.daily.handCount || 0,
      variantSeed: saved.daily.variantSeed,
      chosenGems: saved.daily.chosenGems || []
    } : {
      active: false,
      puzzleId: null,
      movesRemaining: 0,
      gemTarget: 0,
      gemsRemaining: 0,
      completed: false,
      failed: false
    };

    return true;
  }

  function getCurrent12HourWindowIndex() {
    if (typeof DAILY_WINDOW_OVERRIDE === 'number') {
      return DAILY_WINDOW_OVERRIDE;
    }

    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
  }

  function getDailyPuzzleIds() {
    return Object.keys(DAILY_PUZZLES);
  }

  function getCurrentDailyPuzzleKey() {
    var ids = getDailyPuzzleIds();
    if (!ids.length) return null;

    var windowIndex = getCurrent12HourWindowIndex();
    return ids[windowIndex % ids.length];
  }

  var DAILY_WINDOW_OVERRIDE = null;
  var DAILY_VARIANT_OVERRIDE = null;

  function getCurrentDailyVariantSeed() {
    if (typeof DAILY_VARIANT_OVERRIDE === 'number') {
      return DAILY_VARIANT_OVERRIDE;
    }

    return getCurrent12HourWindowIndex();
  }

  function makeSeededRng(seed) {
    var value = (seed >>> 0) || 1;

    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function pickGemSlotsForPuzzle(puzzle, seed) {
    var slots = (puzzle.gemSlots || []).slice();
    var gemCount = Math.min(puzzle.gemCount || 5, slots.length);
    var rng = makeSeededRng(seed);
    var chosen = [];

    while (slots.length && chosen.length < gemCount) {
      var index = Math.floor(rng() * slots.length);
      chosen.push(slots.splice(index, 1)[0]);
    }

    return chosen;
  }

  function syncUiScale() {
    var root = document.documentElement;
    var SHELL_PADDING = 24; // 12px * 2 sides
    var usableW = Math.max(320, window.innerWidth - SHELL_PADDING);
    var usableH = Math.max(560, window.innerHeight - SHELL_PADDING);
    var scale = Math.min(usableW / CONFIG.baseWidth, usableH / CONFIG.baseHeight, 1.22);
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
  
  function collectAdjacentBlastBonusIndices(board, size, seedIndices) {
    var seen = new Set();
    var out = [];
  
    seedIndices.forEach(function (seed) {
      var neighbors = getOrthoNeighborIndices(seed, size);
  
      neighbors.forEach(function (neighborIndex) {
        var cell = board[neighborIndex];
        if (!isAdjacentBlastBonusCell(cell)) return;
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
    var normalBlastIndices = [];
    var bombBlastIndices = [];
    var seen = new Set();
    var normalSeen = new Set();
    var bombSeen = new Set();
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

        if (!normalSeen.has(index)) {
          normalSeen.add(index);
          normalBlastIndices.push(index);
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
        blastLabel: '',
        comboLabel: '',
        scoreValue: 0
      };
    }
  
    var neutralBlastIndices = collectAdjacentBlastBonusIndices(board, size, blastIndices);
  
    neutralBlastIndices.forEach(function (neutralIndex) {
      if (!seen.has(neutralIndex)) {
        seen.add(neutralIndex);
        blastIndices.push(neutralIndex);
      }

      if (!normalSeen.has(neutralIndex)) {
        normalSeen.add(neutralIndex);
        normalBlastIndices.push(neutralIndex);
      }
    });

    var triggeredBombIndices = blastIndices.filter(function (index) {
      return isBombCell(board[index]);
    });
    
    triggeredBombIndices.forEach(function (bombIndex) {
      getBombBlastIndices(bombIndex, size).forEach(function (index) {
        if (!board[index]) return;

        if (!seen.has(index)) {
          seen.add(index);
          blastIndices.push(index);
        }

        if (!normalSeen.has(index) && !bombSeen.has(index)) {
          bombSeen.add(index);
          bombBlastIndices.push(index);
        }
      });
    });
  
    var clearedCount = blastIndices.length;
    var scoreValue = 0;
    var blastLabel = '';
    var comboLabel = '';

    if (comboStep >= 2) {
      var comboDisplay = Math.min(comboStep, 4);
      comboLabel = 'Combo ' + comboDisplay + 'x';
      scoreValue = clearedCount * (12 + ((comboStep - 1) * 4));
    } else {
      if (totalGroups <= 1) {
        blastLabel = '';
        scoreValue = clearedCount * 10;
      } else if (totalGroups === 2) {
        blastLabel = 'Blast 2x';
        scoreValue = clearedCount * 16;
      } else if (totalGroups === 3) {
        blastLabel = 'Blast 3x';
        scoreValue = clearedCount * 20;
      } else {
        blastLabel = 'Max Blast';
        scoreValue = clearedCount * 24;
      }
    }
  
    return {
      hasBlast: true,
      blastIndices: blastIndices,
      normalBlastIndices: normalBlastIndices,
      bombBlastIndices: bombBlastIndices,
      neutralBlastIndices: neutralBlastIndices,
      clearedCount: clearedCount,
      horizontalGroups: horizontalGroups,
      verticalGroups: verticalGroups,
      totalGroups: totalGroups,
      comboStep: comboStep,
      blastLabel: blastLabel,
      comboLabel: comboLabel,
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

  function buildSpawnAnimMap(root, state, spawns) {
    var map = {};
    if (!spawns || !spawns.length) return map;
  
    var boardEl = root.querySelector('.bm-board');
    var cellEl = boardEl ? boardEl.querySelector('.bm-cell') : null;
    if (!boardEl || !cellEl) return map;
  
    var cellSize = cellEl.getBoundingClientRect().width;
    var gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    var step = cellSize + gap;
  
    spawns.forEach(function (spawn) {
      if (!spawn) return;
  
      map[spawn.index] = {
        type: 'drop-land',
        distance: (spawn.toRow - spawn.fromRow) * step,
        duration: 360
      };
    });
  
    return map;
  }

  function buildPlacementAnimMap(root, state, moved, placedIndices) {
    var map = {};
    var boardEl = root.querySelector('.bm-board');
    if (!boardEl) return map;
  
    var cellEl = boardEl.querySelector('.bm-cell');
    if (!cellEl) return map;
  
    var cellSize = cellEl.getBoundingClientRect().width;
    var gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    var step = cellSize + gap;
  
    var movedToSet = new Set();
  
    moved.forEach(function (move) {
      var toIndex = (move.toY * state.boardSize) + move.x;
      movedToSet.add(toIndex);
  
      map[toIndex] = {
        type: 'drop-land',
        distance: (move.toY - move.fromY) * step,
        duration: 360
      };
    });
  
    (placedIndices || []).forEach(function (index) {
      if (movedToSet.has(index)) return;
  
      map[index] = {
        type: 'place-pop'
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

  function makeBombCell() {
    return {
      kind: 'bomb',
      tone: 'special'
    };
  }
  
  function makeSkullCell() {
    return {
      kind: 'skull',
      tone: 'special'
    };
  }
  
  function makeHeartCell() {
    return {
      kind: 'heart',
      tone: 'special'
    };
  }

  function makeGemCell() {
    return {
      kind: 'gem',
      tone: 'special'
    };
  }

  function isGemCell(cell) {
    return !!(cell && cell.kind === 'gem');
  }

  function countGemsOnBoard(board) {
    var count = 0;

    for (var i = 0; i < board.length; i++) {
      if (isGemCell(board[i])) count += 1;
    }

    return count;
  }
  
  function isBombCell(cell) {
    return !!(cell && cell.kind === 'bomb');
  }
  
  function isSkullCell(cell) {
    return !!(cell && cell.kind === 'skull');
  }
  
  function isHeartCell(cell) {
    return !!(cell && cell.kind === 'heart');
  }
  
  function isSpecialIconCell(cell) {
    return isBombCell(cell) || isSkullCell(cell) || isHeartCell(cell);
  }
  
  function isNeutralCell(cell) {
    return !!(cell && cell.kind === 'neutral');
  }

  function isAdjacentBlastBonusCell(cell) {
    return isNeutralCell(cell) || isBombCell(cell) || isSkullCell(cell) || isHeartCell(cell) || isGemCell(cell);
  }

  function getEmptyBoardIndices(board) {
    var out = [];
  
    for (var i = 0; i < board.length; i++) {
      if (!board[i]) out.push(i);
    }
  
    return out;
  }

  function countBoardTilesByKind(board, kind) {
    var count = 0;

    for (var i = 0; i < board.length; i++) {
      if (board[i] && board[i].kind === kind) {
        count += 1;
      }
    }

    return count;
  }

  function getDropLandingRow(board, size, column) {
    for (var y = size - 1; y >= 0; y--) {
      var index = (y * size) + column;
      if (!board[index]) return y;
    }
    return -1;
  }
  
  function dropRandomNeutralTile(state) {
    var availableColumns = [];
  
    for (var x = 0; x < state.boardSize; x++) {
      if (getDropLandingRow(state.board, state.boardSize, x) >= 0) {
        availableColumns.push(x);
      }
    }
  
    if (!availableColumns.length) {
      return null;
    }
  
    var column = availableColumns[Math.floor(Math.random() * availableColumns.length)];
    var landingRow = getDropLandingRow(state.board, state.boardSize, column);
    var landingIndex = (landingRow * state.boardSize) + column;
  
    state.board[landingIndex] = makeNeutralCell();
  
    return {
      index: landingIndex,
      fromRow: -1,
      toRow: landingRow,
      column: column
    };
  }
  
  function maybeDropWall(state) {
    if (!state || !state.currentLevel) return false;
    if (!state.currentLevel.wallDropRate) return false;
    if (state.moveCount <= 0) return false;
    if (state.moveCount % state.currentLevel.wallDropRate !== 0) return false;
  
    return dropRandomNeutralTile(state);
  }

  function dropRandomBombTile(state) {
    if (countBoardTilesByKind(state.board, 'bomb') >= CONFIG.maxBombTilesOnBoard) {
      return null;
    }
    var availableColumns = [];
  
    for (var x = 0; x < state.boardSize; x++) {
      if (getDropLandingRow(state.board, state.boardSize, x) >= 0) {
        availableColumns.push(x);
      }
    }
  
    if (!availableColumns.length) {
      return null;
    }
  
    var column = availableColumns[Math.floor(Math.random() * availableColumns.length)];
    var landingRow = getDropLandingRow(state.board, state.boardSize, column);
    var landingIndex = (landingRow * state.boardSize) + column;
  
    state.board[landingIndex] = makeBombCell();
  
    return {
      index: landingIndex,
      fromRow: -1,
      toRow: landingRow,
      column: column
    };
  }

  function dropRandomSpecialTile(state, kind) {
    if (kind === 'heart' && countBoardTilesByKind(state.board, 'heart') >= CONFIG.maxHeartTilesOnBoard) {
      return null;
    }

    if (kind === 'skull' && countBoardTilesByKind(state.board, 'skull') >= CONFIG.maxSkullTilesOnBoard) {
      return null;
    }
    var availableColumns = [];
  
    for (var x = 0; x < state.boardSize; x++) {
      if (getDropLandingRow(state.board, state.boardSize, x) >= 0) {
        availableColumns.push(x);
      }
    }
  
    if (!availableColumns.length) {
      return null;
    }
  
    var column = availableColumns[Math.floor(Math.random() * availableColumns.length)];
    var landingRow = getDropLandingRow(state.board, state.boardSize, column);
    var landingIndex = (landingRow * state.boardSize) + column;
  
    if (kind === 'skull') state.board[landingIndex] = makeSkullCell();
    else if (kind === 'heart') state.board[landingIndex] = makeHeartCell();
    else return null;
  
    return {
      index: landingIndex,
      fromRow: -1,
      toRow: landingRow,
      column: column
    };
  }
  function maybeDropSpecialTile(state) {
    if (!state || !state.currentLevel || !state.currentLevel.features) return false;
  
    var features = state.currentLevel.features;
    if (!features.skulls && !features.hearts) return false;
  
    var levelId = state.currentLevel ? state.currentLevel.id : 1;
  
    // Level 3: only check every OTHER fresh hand
    if (levelId === 3 && state.handCount % 2 !== 0) {
      return false;
    }
  
    // Level 4+: check every fresh hand
    // no extra gate needed here
  
    var skullChance = features.skullChance || 0;
    var baseHeartChance = features.heartChance || 0;
    var heartChance = baseHeartChance;
  
    if (state.lives === 2) {
      heartChance = baseHeartChance * CONFIG.heartChanceScaleAt2Lives;
    } else if (state.lives === 1) {
      heartChance = baseHeartChance * CONFIG.heartChanceScaleAt1Life;
    }
  
    var rolledSkull = !!features.skulls && Math.random() < skullChance;
    var rolledHeart = !!features.hearts && Math.random() < heartChance;
  
    if (!rolledSkull && !rolledHeart) return false;
  
    if (rolledSkull && rolledHeart) {
      if (state.lives >= CONFIG.startingLives) {
        return dropRandomSpecialTile(state, 'skull');
      }
      return dropRandomSpecialTile(state, 'heart');
    }
  
    if (rolledHeart) return dropRandomSpecialTile(state, 'heart');
    return dropRandomSpecialTile(state, 'skull');
  }

  function runPostResolveDrops(root, state) {
    if (!state || (state.intro && state.intro.active)) return;
  
    var spawns = [];
    var wallSpawn = null;
    var specialSpawn = null;
    var canUseBombCycle = !!(state.currentLevel && state.currentLevel.id >= 2);
  
    if (canUseBombCycle && state.pendingBombSpawn) {
      var bombSpawn = dropRandomBombTile(state);
      if (bombSpawn) {
        spawns.push(bombSpawn);
        state.pendingBombSpawn = false;

        openHelperModal(state, {
          id: 'bomb',
          icon: 'bomb',
          title: 'Bomb Tile',
          body: 'Blast next to it to clear its row and column.'
        });
      }
    } else {
      wallSpawn = maybeDropWall(state);
      if (wallSpawn) {
        spawns.push(wallSpawn);
  
        if (canUseBombCycle) {
          state.wallSpawnsSinceBomb = (state.wallSpawnsSinceBomb || 0) + 1;
  
          if (state.wallSpawnsSinceBomb >= 3) {
            state.wallSpawnsSinceBomb = 0;
            state.pendingBombSpawn = true;
          }
        }
      }
  
      if (state.justDealtNewHand) {
        specialSpawn = maybeDropSpecialTile(state);

        if (specialSpawn) {
          spawns.push(specialSpawn);

          var spawnedCell = state.board[specialSpawn.index];

          if (isSkullCell(spawnedCell)) {
            openHelperModal(state, {
              id: 'skull',
              icon: 'skull',
              title: 'Skull Tile',
              body: 'Blast it and lose 1 life.'
            });
          } else if (isHeartCell(spawnedCell)) {
            openHelperModal(state, {
              id: 'heart',
              icon: 'heart',
              title: 'Heart Tile',
              body: 'Blast it and gain 1 life.'
            });
          }
        }

        state.justDealtNewHand = false;
      }
    }
  
    if (!spawns.length) {
      state.comboStep = 0;
      return;
    }

    state.animMap = null;
  
    state.animMap = buildSpawnAnimMap(root, state, spawns);
    renderGame(root, state, render);
  }

  function getBombBlastIndices(index, size) {
    var x = index % size;
    var y = Math.floor(index / size);
    var out = [];
    var seen = new Set();
    var i;
    var idx;
  
    for (i = 0; i < size; i++) {
      idx = (y * size) + i;
      if (!seen.has(idx)) {
        seen.add(idx);
        out.push(idx);
      }
    }
  
    for (i = 0; i < size; i++) {
      idx = (i * size) + x;
      if (!seen.has(idx)) {
        seen.add(idx);
        out.push(idx);
      }
    }
  
    return out;
  }
  
  function applySpecialBlastEffects(state, normalBlastIndices) {
    var skullsCleared = 0;
    var heartsCleared = 0;
  
    (normalBlastIndices || []).forEach(function (index) {
      var cell = state.board[index];
      if (isSkullCell(cell)) skullsCleared += 1;
      if (isHeartCell(cell)) heartsCleared += 1;
    });
  
    var lifeDelta = heartsCleared - skullsCleared;
  
    if (lifeDelta !== 0) {
      state.lives = Math.max(0, Math.min(CONFIG.startingLives, state.lives + lifeDelta));
    }
  
    return {
      skullsCleared: skullsCleared,
      heartsCleared: heartsCleared,
      lifeDelta: lifeDelta
    };
  }
  
  function hasAnyPlayableHand(state) {
    if (!state || !state.hand) return false;
  
    for (var i = 0; i < state.hand.length; i++) {
      var piece = state.hand[i];
      if (!piece) continue;
  
      if (getLegalPlacements(state.board, state.boardSize, piece).length > 0) {
        return true;
      }
    }
  
    return false;
  }
  
  function getAllOccupiedIndices(board) {
    var out = [];
    for (var i = 0; i < board.length; i++) {
      if (board[i]) out.push(i);
    }
    return out;
  }
  
  function seedLevelOneOpeningWalls(state) {
    state.board = createEmptyBoard(state.boardSize);
  
    var preset = [
      { x: 1, y: 4 },
      { x: 1, y: 5 },
      { x: 4, y: 4 },
      { x: 4, y: 5 }
    ];
  
    preset.forEach(function (cell) {
      state.board[(cell.y * state.boardSize) + cell.x] = makeNeutralCell();
    });
  }
  
  function seedBoardForCurrentLevel(state) {
    if (state.currentLevel && state.currentLevel.id === 1) {
      seedLevelOneOpeningWalls(state);
      return;
    }
  
    state.board = createEmptyBoard(state.boardSize);
  
    var wallCount = 6;
    for (var i = 0; i < wallCount; i++) {
      dropRandomNeutralTile(state);
    }
  }

  function buildDailyBoardFromPuzzle(puzzle, chosenGems) {
    var board = createEmptyBoard(CONFIG.boardSize);

    (puzzle.walls || []).forEach(function (cell) {
      board[(cell.y * CONFIG.boardSize) + cell.x] = makeNeutralCell();
    });

    (chosenGems || []).forEach(function (cell) {
      board[(cell.y * CONFIG.boardSize) + cell.x] = makeGemCell();
    });

    return board;
  }

  function isBoardGravityStable(board, size) {
    for (var x = 0; x < size; x++) {
      var foundEmpty = false;

      for (var y = size - 1; y >= 0; y--) {
        var index = (y * size) + x;
        var cell = board[index];

        if (!cell) {
          foundEmpty = true;
        } else if (foundEmpty) {
          return false;
        }
      }
    }

    return true;
  }

  function startDailyGame(state, puzzleId) {
    var resolvedPuzzleId = puzzleId || getCurrentDailyPuzzleKey();
    var puzzle = DAILY_PUZZLES[resolvedPuzzleId];
    if (!puzzle) return;

    var variantSeed = getCurrentDailyVariantSeed();
    var chosenGems = pickGemSlotsForPuzzle(puzzle, variantSeed);

    state.screen = 'daily';
    state.score = 0;
    state.displayScore = 0;
    state.comboStep = 0;
    state.lives = CONFIG.startingLives;
    state.boardSize = CONFIG.boardSize;
    state.currentLevel = LEVELS[0];
    state.levelId = 1;
    state.moveCount = 0;
    state.handCount = 0;
    state.pendingBombSpawn = false;
    state.wallSpawnsSinceBomb = 0;
    state.pendingComboPoints = 0;
    state.justDealtNewHand = false;
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

    state.daily = {
      active: true,
      puzzleId: puzzle.id,
      movesRemaining: puzzle.moves,
      gemTarget: chosenGems.length,
      gemsRemaining: chosenGems.length,
      completed: false,
      failed: false,
      handIndex: 0,
      handCount: puzzle.hands ? puzzle.hands.length : 0,
      variantSeed: variantSeed,
      chosenGems: chosenGems
    };

    state.dailyHands = buildDailyHandsFromPuzzle(puzzle);
    state.dailyHandIndex = 0;
    state.dailyJustHitDanger = false;
    state.dailyMovesBand = null;
    state.dailyMovesPulseStarted = false;

    if (state.dailyMovesHitTimer) {
      window.clearTimeout(state.dailyMovesHitTimer);
      state.dailyMovesHitTimer = null;
    }

    state.board = buildDailyBoardFromPuzzle(puzzle, chosenGems);

    if (!isBoardGravityStable(state.board, state.boardSize)) {
      applyGravity(state.board, state.boardSize);
    }

    state.animMap = null;

    state.hand = state.dailyHands[0]
      ? state.dailyHands[0].slice()
      : [null, null, null];
  }

  function isDailyMode(state) {
    return !!(state && state.daily && state.daily.active);
  }

  function animateLifeDelta(root, delta) {
    if (!delta) return;
  
    var stat = root.querySelector('[data-lives-stat]');
    var icon = root.querySelector('[data-lives-icon]');
    var value = root.querySelector('[data-lives-value]');
  
    if (!stat || !icon || !value) return;
  
    stat.classList.remove('is-life-lost', 'is-life-gained');
    icon.classList.remove('is-life-lost-icon', 'is-life-gained-icon');
    value.classList.remove('is-life-lost-value', 'is-life-gained-value');
  
    stat.removeAttribute('data-life-delta');
  
    void stat.offsetWidth;
  
    if (delta < 0) {
      stat.classList.add('is-life-lost');
      icon.classList.add('is-life-lost-icon');
      value.classList.add('is-life-lost-value');
      stat.setAttribute('data-life-delta', String(delta));
    } else {
      stat.classList.add('is-life-gained');
      icon.classList.add('is-life-gained-icon');
      value.classList.add('is-life-gained-value');
      stat.setAttribute('data-life-delta', '+' + String(delta));
    }
  
    window.setTimeout(function () {
      var liveStat = root.querySelector('[data-lives-stat]');
      var liveIcon = root.querySelector('[data-lives-icon]');
      var liveValue = root.querySelector('[data-lives-value]');
  
      if (liveStat) {
        liveStat.classList.remove('is-life-lost', 'is-life-gained');
        liveStat.removeAttribute('data-life-delta');
      }
      if (liveIcon) liveIcon.classList.remove('is-life-lost-icon', 'is-life-gained-icon');
      if (liveValue) liveValue.classList.remove('is-life-lost-value', 'is-life-gained-value');
    }, 950);
  }

  function animateDailyGemGain(root, delta) {
    if (!delta || delta <= 0) return;

    var stat = root.querySelector('[data-daily-gems-stat]');
    var icon = root.querySelector('[data-daily-gems-icon]');
    var value = root.querySelector('[data-daily-gems-value]');

    if (!stat || !icon || !value) return;

    stat.classList.remove('is-daily-gem-gained');
    icon.classList.remove('is-daily-gem-gained-icon');
    value.classList.remove('is-daily-gem-gained-value');

    stat.removeAttribute('data-daily-gem-delta');

    void stat.offsetWidth;

    stat.classList.add('is-daily-gem-gained');
    icon.classList.add('is-daily-gem-gained-icon');
    value.classList.add('is-daily-gem-gained-value');
    stat.setAttribute('data-daily-gem-delta', '+' + String(delta));

    window.setTimeout(function () {
      var liveStat = root.querySelector('[data-daily-gems-stat]');
      var liveIcon = root.querySelector('[data-daily-gems-icon]');
      var liveValue = root.querySelector('[data-daily-gems-value]');

      if (liveStat) {
        liveStat.classList.remove('is-daily-gem-gained');
        liveStat.removeAttribute('data-daily-gem-delta');
      }
      if (liveIcon) liveIcon.classList.remove('is-daily-gem-gained-icon');
      if (liveValue) liveValue.classList.remove('is-daily-gem-gained-value');
    }, 950);
  }
  
  function resetBoardAfterLifeLoss(state) {
    state.moveCount = 0;
    state.handCount = 0;
    state.justDealtNewHand = false;
    seedBoardForCurrentLevel(state);
    state.hand = generateHand(state.board, state.boardSize, state);
    state.animMap = null;
    state.blastIndices = [];
    state.isResolving = false;
    state.comboStep = 0;
  }

  function setHomeResult(state, result) {
    state.homeResult = result || null;
  }

  function consumeHomeResult(state) {
    var result = state.homeResult;
    state.homeResult = null;
    return result;
  }
  
  function runDeathReset(root, state, render) {
    var blastIndices = getAllOccupiedIndices(state.board);
    var boardCenter = getBoardCenter(root);
  
    if (blastIndices.length) {
      spawnCenterUiBurst(root, 20, 2);
      hideBoardCells(root, blastIndices);
    }
  
    state.board = createEmptyBoard(state.boardSize);
    state.blastIndices = [];
  
    window.setTimeout(function () {
      state.lives = Math.max(0, state.lives - 1);
      if (window.posthog) window.posthog.capture('life_lost', { lives_remaining: state.lives, score: state.score });

      playSfx('lose');
      syncHudUi(root, state);

      if (state.lives <= 0) {
        transitionScreen(root, function () {
          setHomeResult(state, { reason: 'last-heart-loss' });
          resetStandardGameState(state);
          state.screen = 'home';
          render();
        });
        return;
      }
  
      showBoardMessage(root, 'Try Again', boardCenter, 0, 'centered');
      resetBoardAfterLifeLoss(state);
      renderGame(root, state, render);
      animateLifeDelta(root, -1);
    }, 320);
  }
  
  function runGameOverToHome(root, state, render) {
    var blastIndices = getAllOccupiedIndices(state.board);
  
    if (blastIndices.length) {
      spawnCenterUiBurst(root, 20, 2);
      hideBoardCells(root, blastIndices);
    }
  
    state.board = createEmptyBoard(state.boardSize);
    state.blastIndices = [];
  
    window.setTimeout(function () {
      playSfx('lose');
      if (window.posthog) window.posthog.capture('game_over', { score: state.score, high_score: state.highScore, level: state.levelId });
      transitionScreen(root, function () {
        clearSavedGame('game');
        setHomeResult(state, { reason: 'last-heart-loss' });
        resetStandardGameState(state);
        state.screen = 'home';
        render();
      });
    }, 320);
  }

  function checkPostMoveState(root, state, render) {
    if (state.intro && state.intro.active) return;
  
    if (state.lives <= 0) {
      runGameOverToHome(root, state, render);
      return;
    }
  
    if (hasAnyPlayableHand(state)) return;
  
    if (state.lives > 1) {
      runDeathReset(root, state, render);
    } else {
      runGameOverToHome(root, state, render);
    }
  }

  function checkDailyEndState(root, state, render) {
    if (!isDailyMode(state)) return false;
    if (state.intro && state.intro.active) return false;
    if (state.isResolving) return false;

    if (state.daily.gemsRemaining <= 0 && !state.daily.completed) {
      state.daily.completed = true;

      if (window.posthog) {
        window.posthog.capture('daily_completed', {
          puzzle_id: state.daily.puzzleId,
          moves_remaining: state.daily.movesRemaining
        });
      }

      playSfx('start');
      showBoardMessage(root, 'Cleared!', null, 0, 'centered');

      window.setTimeout(function () {
        transitionScreen(root, function () {
          clearSavedGame('daily');
          state.screen = 'home';
          render();
        });
      }, 1400);

      return true;
    }

    var noMovesLeft = state.daily.movesRemaining <= 0;
    var noHandLeft = !state.hand || state.hand.every(function (piece) { return !piece; });

    if ((noMovesLeft || noHandLeft) && state.daily.gemsRemaining > 0 && !state.daily.failed) {
      state.daily.failed = true;

      if (window.posthog) {
        window.posthog.capture('daily_failed', {
          puzzle_id: state.daily.puzzleId,
          gems_remaining: state.daily.gemsRemaining
        });
      }

      playSfx('lose');
      showBoardMessage(root, 'So Close!', null, 0, 'centered');

      window.setTimeout(function () {
        transitionScreen(root, function () {
          clearSavedGame('daily');
          state.screen = 'home';
          render();
        });
      }, 1400);

      return true;
    }

    return false;
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

  function getPlacementCells(board, boardSize, piece, anchorX, anchorY) {
    if (!piece) return null;
  
    var placed = [];
  
    for (var i = 0; i < piece.cells.length; i++) {
      var cell = piece.cells[i];
      var x = anchorX + cell.x;
      var y = anchorY + cell.y;
  
      if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
        return null;
      }
  
      if (board[(y * boardSize) + x]) {
        return null;
      }
  
      placed.push({
        x: x,
        y: y,
        value: cell.value,
        tone: cell.tone
      });
    }
  
    return placed;
  }
  
  function getLegalPlacements(board, boardSize, piece) {
    var legal = [];
    var maxX = boardSize - piece.width;
    var maxY = boardSize - piece.height;
  
    for (var y = 0; y <= maxY; y++) {
      for (var x = 0; x <= maxX; x++) {
        var placed = getPlacementCells(board, boardSize, piece, x, y);
        if (!placed) continue;
  
        legal.push({
          x: x,
          y: y,
          placed: placed
        });
      }
    }
  
    return legal;
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
      }
    ],
  
    complex: [
      {
        id: 'l3',
        rank: 3,
        width: 2,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
      },
      {
        id: 'j3',
        rank: 3,
        width: 2,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
      },
      {
        id: 'l3-tall',
        rank: 3,
        width: 2,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
      },
      {
        id: 'j3-tall',
        rank: 3,
        width: 2,
        height: 2,
        coords: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
      },
      {
        id: 'square4',
        rank: 4,
        width: 2,
        height: 2,
        coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
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

  function pickSlot12Rule(pieceBias) {
    var roll = Math.random() * 100;

    if (pieceBias === 'easy') {
      if (roll < 55) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 88) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
    }
  
    if (pieceBias === 'double') {
      if (roll < 18) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 58) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
      return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
    }
  
    if (pieceBias === 'mixed') {
      if (roll < 20) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 48) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
      if (roll < 90) return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
      return { allowedIds: ['square4'], maxRank: 4 };
    }
  
    if (roll < 42) return { allowedIds: ['single'], maxRank: 1 };
    if (roll < 72) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
    if (roll < 94) return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
    return { allowedIds: ['square4'], maxRank: 4 };
  }

  function pickSlot3Rule(board, pieceBias) {
    var fillRatio = getBoardFillRatio(board);
    var roll = Math.random() * 100;
  
    if (pieceBias === 'easy') {
      if (roll < 36) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 70) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
      return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
    }
  
    if (pieceBias === 'double') {
      if (roll < 16) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 40) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
      if (roll < 90) return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
      return { allowedIds: ['square4'], maxRank: 4 };
    }
  
    if (pieceBias === 'mixed') {
      if (roll < 12) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 34) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
      if (roll < 82) return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
      return { allowedIds: ['square4'], maxRank: 4 };
    }
  
    if (fillRatio >= 0.6) {
      if (roll < 28) return { allowedIds: ['single'], maxRank: 1 };
      if (roll < 56) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
      if (roll < 94) return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
      return { allowedIds: ['square4'], maxRank: 4 };
    }
  
    if (roll < 18) return { allowedIds: ['single'], maxRank: 1 };
    if (roll < 42) return { allowedIds: ['h2', 'v2'], maxRank: 2 };
    if (roll < 88) return { allowedIds: ['l3', 'j3', 'l3-tall', 'j3-tall'], maxRank: 3 };
    return { allowedIds: ['square4'], maxRank: 4 };
  }

  function generateHand(board, boardSize, state) {
    var hand = [];
    var pieceBias = state && state.currentLevel ? state.currentLevel.pieceBias : null;
  
    var slot1 = generatePiece(board, boardSize, pickSlot12Rule(pieceBias));
    var slot2 = generatePiece(board, boardSize, pickSlot12Rule(pieceBias));
    var slot3 = generatePiece(board, boardSize, pickSlot3Rule(board, pieceBias));
  
    hand.push(slot1);
    hand.push(slot2);
    hand.push(slot3);
  
    // Safety: first two slots stay in the easy half of the catalog
    for (var i = 0; i < 2; i++) {
      if (!hand[i]) {
        hand[i] = generatePiece(board, boardSize, {
          allowedIds: ['single', 'h2', 'v2'],
          maxRank: 2
        });
        continue;
      }
  
      if (hand[i].rank > 2) {
        hand[i] = generatePiece(board, boardSize, {
          allowedIds: ['single', 'h2', 'v2'],
          maxRank: 2
        });
      }
    }
  
    // Safety: slot 3 can pull from the full new catalog
    if (!hand[2]) {
      hand[2] = generatePiece(board, boardSize, {
        allowedIds: ['h2', 'v2', 'l3', 'j3', 'l3-tall', 'j3-tall', 'square4'],
        maxRank: 4
      });
    }
  
    var playableCount = hand.filter(function (piece) {
      return piece && getLegalPlacements(board, boardSize, piece).length > 0;
    }).length;
  
    if (playableCount < 2) {
      hand[0] = generatePiece(board, boardSize, {
        allowedIds: ['single', 'h2', 'v2'],
        maxRank: 2
      });
      hand[1] = generatePiece(board, boardSize, {
        allowedIds: ['single', 'h2', 'v2'],
        maxRank: 2
      });
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
        return (
          def.id === 'single' ||
          def.id === 'h2' ||
          def.id === 'v2'
        );
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
      var className = 'bm-mini bm-mini--' + cell.tone;
    
      return '<div class="' + className + '" style="left:' + left + 'px; top:' + top + 'px;"><span class="bm-tile__label">' + cell.value + '</span></div>';
    }).join('');
    return '<div class="bm-piece" data-piece>' +
    '<div class="bm-piece__shape" style="width:' + Math.round(width) + 'px; height:' + Math.round(height) + 'px;">' +
    cells +
    '</div></div>';
  }

  function bindIntroSkip(root, state) {
    if (!(state.intro && state.intro.active)) return;
  
    var skipBtn = root.querySelector('[data-skip-intro]');
    if (!skipBtn) return;
  
    var skipIntro = function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
  
      clearIntroTimers(state);
  
      if (state.boardMessageTimer) {
        window.clearTimeout(state.boardMessageTimer);
        state.boardMessageTimer = null;
      }
  
      var oldMsg = document.body.querySelector('.bm-board-message');
      if (oldMsg) oldMsg.remove();
  
      spawnCenterUiBurst(root, 20, 2);
      if (window.posthog) window.posthog.capture('intro_skipped', { intro_step: state.intro && state.intro.step });
      runIntroExitToFreshBoard(root, state);
    };

    skipBtn.addEventListener('pointerdown', skipIntro);
  }

  function openHelperModal(state, helper) {
    if (!state || !helper || !helper.id) return false;
    if (hasSeenHelper(helper.id)) return false;
    if (state.helperModal) return false;
  
    markHelperSeen(helper.id);
  
    state.helperModal = {
      id: helper.id,
      icon: helper.icon || '',
      title: helper.title || '',
      body: helper.body || ''
    };
  
    return true;
  }
  
  function closeHelperModal(state) {
    if (!state || !state.helperModal) return;
    state.helperModal = null;
  }
  
  function renderHelperModal(state) {
    if (!state || !state.helperModal) return '';
  
    var helper = state.helperModal;
  
    return '' +
      '<div class="bm-helper-modal" data-helper-modal>' +
        '<div class="bm-helper-modal__scrim"></div>' +
        '<div class="bm-helper-modal__card" role="dialog" aria-modal="true" aria-label="' + helper.title + '">' +
          '<button class="bm-helper-modal__close" type="button" aria-label="Close" data-helper-close>' +
            '<img class="bm-helper-modal__close-icon" src="images/hud/close.svg" alt="" />' +
          '</button>' +
          '<div class="bm-helper-modal__body bm-helper-modal__body--daily">' + helper.body + '</div>' +
        '</div>' +
      '</div>';
  }
  
  function bindHelperModal(root, state, render) {
    if (!state || !state.helperModal) return;
  
    var nodes = root.querySelectorAll('[data-helper-dismiss], [data-helper-close]');
    if (!nodes.length) return;
  
    nodes.forEach(function (node) {
      node.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeHelperModal(state);
        render();
      });
    });
  }

  function renderHome(root) {
    root.innerHTML = '' +
      '<section class="bm-screen bm-home">' +
        '<div class="bm-home__center">' +
          '<div class="bm-logo" aria-label="Blast Math logo">' +
            '<img src="images/brand/logo.png" alt="Blast Math" class="bm-logo__img" />' +
          '</div>' +
        '</div>' +
        '<div class="bm-home__actions">' +
          '<button class="bm-btn" type="button" data-play>Play Classic</button>' +
          '<button class="bm-btn bm-btn--daily" type="button" data-daily>Free Daily Blast</button>' +
        '</div>' +
      '</section>';
  }

  function renderGame(root, state, renderApp) {
    var isDaily = isDailyMode(state);
    var isIntro = !!(state.intro && state.intro.active);

    var hudHtml = isIntro
    ? (
      '<div class="bm-hud bm-hud--intro">' +
        '<button class="bm-btn bm-btn--skip" type="button" data-skip-intro>Skip</button>' +
      '</div>'
    )
    : isDaily
    ? (
      '<div class="bm-hud bm-hud--daily-centered">' +
        '<div class="bm-hud-stat bm-hud-stat--daily-score" data-daily-gems-stat>' +
          '<img src="images/hud/gem.svg" class="bm-hud-icon bm-hud-icon--daily" data-daily-gems-icon alt="" />' +
          '<span class="bm-hud-value bm-hud-daily-score-value" data-daily-gems-value>' + (state.daily.gemTarget - state.daily.gemsRemaining) + '</span>' +
        '</div>' +
      '</div>'
    )
    : (
      '<div class="bm-hud">' +
        '<div class="bm-hud-side bm-hud-side--left">' +
          '<div class="bm-hud-stat bm-hud-stat--score">' +
            '<img src="images/hud/crown.svg" class="bm-hud-icon" alt="" />' +
            '<span class="bm-hud-value bm-hud-score-value">' + state.highScore + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="bm-hud-side bm-hud-side--right">' +
          '<div class="bm-hud-stat bm-hud-stat--lives" data-lives-stat>' +
            '<img src="images/hud/heart.svg" class="bm-hud-icon" data-lives-icon alt="" />' +
            '<span class="bm-hud-value bm-hud-lives-value" data-lives-value>' + state.lives + '</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    var scoreHtml = isIntro
      ? (
        '<div class="bm-score bm-score--intro">' +
          '<div class="bm-score__title" data-score-title>' + state.intro.title + '</div>' +
        '</div>'
      )
      : isDaily
      ? (
        '<div class="bm-score bm-score--daily">' +
          '<div class="bm-score__burst bm-score__burst--daily-moves" data-daily-moves-burst></div>' +
          '<div class="bm-score__value bm-score__value--daily bm-daily-moves-value" data-daily-moves-value>' + state.daily.movesRemaining + '</div>' +
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
    renderHelperModal(state) +
  '</section>';

  syncScoreUi(root, state);
  bindIntroSkip(root, state);
  bindHelperModal(root, state, renderApp);
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
        var isQueuedTarget = intro.targetQueue && intro.targetQueue.some(function (target) {
          return target.index === index;
        });
      
        if (isQueuedTarget) {
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

      if (isSpecialIconCell(cell) || isGemCell(cell)) {
        var iconName = isBombCell(cell)
          ? 'bomb'
          : isSkullCell(cell)
            ? 'skull'
            : isHeartCell(cell)
              ? 'heart'
              : 'gem';

        return '<div class="' + cellClass + '" data-cell-index="' + index + '">' +
          '<div class="bm-special-tile' + extraClass + '"' + extraStyle + '>' +
            '<img class="bm-special-tile__icon" src="images/tiles/' + iconName + '.svg" alt="" />' +
          '</div>' +
        '</div>';
      }
  
      return '<div class="' + cellClass + '" data-cell-index="' + index + '">' +
        '<div class="bm-tile bm-tile--' + cell.tone + extraClass + '"' + extraStyle + '><span class="bm-tile__label">' + cell.value + '</span></div>' +
      '</div>';
    }).join('');
  }

  function getBlastAnchor(root, blastIndices) {
    var board = root.querySelector('.bm-board');
    if (!board || !blastIndices || !blastIndices.length) return null;
  
    var minLeft = Infinity;
    var maxRight = -Infinity;
    var minTop = Infinity;
    var maxBottom = -Infinity;
  
    blastIndices.forEach(function (index) {
      var cellEl = board.querySelector('[data-cell-index="' + index + '"]');
      if (!cellEl) return;
  
      var rect = cellEl.getBoundingClientRect();
      minLeft = Math.min(minLeft, rect.left);
      maxRight = Math.max(maxRight, rect.right);
      minTop = Math.min(minTop, rect.top);
      maxBottom = Math.max(maxBottom, rect.bottom);
    });
  
    if (!isFinite(minLeft)) return null;
  
    return {
      left: (minLeft + maxRight) * 0.5,
      top: (minTop + maxBottom) * 0.5
    };
  }

  function getBoardCenter(root) {
    var board = root.querySelector('.bm-board');
    if (!board) return null;
  
    var rect = board.getBoundingClientRect();
  
    return {
      left: rect.left + (rect.width * 0.5),
      top: rect.top + (rect.height * 0.5)
    };
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
    return cellEl.querySelector('.bm-tile, .bm-neutral-block, .bm-special-tile');
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

  function spawnBlastFragments(root, state, blastIndices, comboStep, colorMode, launchMode) {
    comboStep = comboStep || 1;
    colorMode = colorMode || 'board';
    launchMode = launchMode || 'normal';
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
      var boardRect = board.getBoundingClientRect();
  
      var pieces = isNeutralCell(cell) ? 28 : 25;

      if (comboStep >= 2) {
        pieces = Math.max(8, Math.round(pieces * 0.45));
      }
  
      for (var i = 0; i < pieces; i++) {
        var frag = document.createElement('div');
        var fragSize = Math.max(5, size * (0.16 + Math.random() * 0.16));
  
        var startX = rect.left + (size * 0.12) + Math.random() * (size * 0.76);
        var startY = launchMode === 'life-loss'
        ? boardRect.top + (size * 2.0) + Math.random() * (size * 0.10)
        : rect.top + (size * 0.10) + Math.random() * (size * 0.30);
  
          var driftX = launchMode === 'life-loss'
          ? (-size * 1.45) + Math.random() * (size * 2.9)
          : (-size * 1.1) + Math.random() * (size * 2.2);
          var liftY = launchMode === 'life-loss'
          ? (size * 0.34) + Math.random() * (size * 0.36)
          : (size * 0.82) + Math.random() * (size * 1.08);
        var fallY = (size * 1.85) + Math.random() * (size * 2.15);
        var rot = (-38 + Math.random() * 76).toFixed(1);
        var delay = Math.round(Math.random() * 24);
        var duration = 880 + Math.round(Math.random() * 60);
  
        var fragVariant = 1 + Math.floor(Math.random() * 4);
  
        if (colorMode === 'rainbow') {
          var rainbowTones = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];
          var rainbowTone = rainbowTones[Math.floor(Math.random() * rainbowTones.length)];
          frag.className = 'bm-blast-frag bm-blast-frag--' + rainbowTone + ' bm-blast-frag--mix-' + fragVariant;
        } else if (isNeutralCell(cell)) {
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

  function spawnCenterUiBurst(root, count, sizeMult) {
    count = typeof count === 'number' ? count : 20;
    sizeMult = typeof sizeMult === 'number' ? sizeMult : 2;

    var center = getBoardCenter(root);
    if (!center) {
      center = {
        left: window.innerWidth * 0.5,
        top: window.innerHeight * 0.5
      };
    }

    var board = root.querySelector('.bm-board');
    var sampleCell = board ? board.querySelector('.bm-cell') : null;
    var baseSize = sampleCell
      ? sampleCell.getBoundingClientRect().width
      : 48;

    for (var i = 0; i < count; i++) {
      var frag = document.createElement('div');
      var fragSize = Math.max(12, baseSize * (0.18 + Math.random() * 0.14) * sizeMult);

      var angle = Math.random() * Math.PI * 2;
      var distance = (baseSize * 1.4) + Math.random() * (baseSize * 2.4);
      var driftX = Math.cos(angle) * distance;
      var driftY = Math.sin(angle) * distance * 0.92 - (baseSize * 0.45);

      var rot = (-60 + Math.random() * 120).toFixed(1);
      var delay = Math.round(Math.random() * 24);
      var duration = 760 + Math.round(Math.random() * 90);

      var rainbowTones = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];
      var rainbowTone = rainbowTones[Math.floor(Math.random() * rainbowTones.length)];
      var fragVariant = 1 + Math.floor(Math.random() * 4);

      frag.className = 'bm-blast-frag bm-blast-frag--' + rainbowTone + ' bm-ui-burst-frag bm-blast-frag--mix-' + fragVariant;
      frag.style.position = 'fixed';
      frag.style.left = Math.round(center.left) + 'px';
      frag.style.top = Math.round(center.top) + 'px';
      frag.style.width = Math.round(fragSize) + 'px';
      frag.style.height = Math.round(fragSize) + 'px';
      frag.style.zIndex = 10020;
      frag.style.setProperty('--bm-frag-dx', Math.round(driftX) + 'px');
      frag.style.setProperty('--bm-frag-lift', Math.round(baseSize * 0.9) + 'px');
      frag.style.setProperty('--bm-frag-dy', Math.round(driftY) + 'px');
      frag.style.setProperty('--bm-frag-rot', rot + 'deg');
      frag.style.setProperty('--bm-frag-delay', delay + 'ms');
      frag.style.setProperty('--bm-frag-duration', duration + 'ms');

      document.body.appendChild(frag);

      (function (node, ttl) {
        window.setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, ttl);
      })(frag, delay + duration + 120);
    }
  }

  function spawnBlastThumbPops(root, state, blastIndices) {
    var board = root.querySelector('.bm-board');
    if (!board || !blastIndices || !blastIndices.length) return;
  
    blastIndices.forEach(function (index, order) {
      if (state.board[index]) return;
  
      var cellEl = board.querySelector('[data-cell-index="' + index + '"]');
      if (!cellEl) return;
  
      var rect = cellEl.getBoundingClientRect();
  
      var thumb = document.createElement('img');
      thumb.src = 'images/tiles/thumb.svg';
      thumb.alt = '';
      thumb.className = 'bm-blast-thumb-pop bm-blast-thumb-pop--fixed';
      thumb.style.left = Math.round(rect.left + (rect.width / 2)) + 'px';
      thumb.style.top = Math.round(rect.top + (rect.height / 2)) + 'px';
      thumb.style.setProperty('--bm-thumb-delay', (order * 60) + 'ms');
  
      document.body.appendChild(thumb);
  
      window.setTimeout(function () {
        if (thumb.parentNode) thumb.parentNode.removeChild(thumb);
      }, INTRO_THUMB_POP_DURATION + (order * 60) + 80);
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
  
      star.src = 'images/hud/star.svg';
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

  function spawnDailyMovesStars(root, band) {
    var burst = root.querySelector('[data-daily-moves-burst]');
    if (!burst) return;

    burst.innerHTML = '';

    var starCount = band === 'danger' ? 10 : band === 'warning' ? 7 : 5;
    var tonePool = band === 'danger'
      ? ['c5', 'c6']
      : band === 'warning'
        ? ['c3', 'c9']
        : ['c2', 'c8'];

    for (var i = 0; i < starCount; i++) {
      var star = document.createElement('div');
      var size = 10 + Math.round(Math.random() * 10);
      var x = -72 + Math.round(Math.random() * 144);
      var y = -24 + Math.round(Math.random() * 48);
      var rot = -55 + Math.round(Math.random() * 110);
      var delay = Math.round(Math.random() * 60);
      var tone = tonePool[Math.floor(Math.random() * tonePool.length)];

      star.className = 'bm-score-star bm-score-star--moves bm-mini--' + tone;
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

  function clearIntroTimers(state) {
    if (!state || !state.introTimers) return;
  
    state.introTimers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });
  
    state.introTimers = [];
  }

  function queueIntroTimer(state, fn, delay) {
    if (!state.introTimers) state.introTimers = [];
  
    var timerId = window.setTimeout(function () {
      state.introTimers = state.introTimers.filter(function (id) {
        return id !== timerId;
      });
      fn();
    }, delay);
  
    state.introTimers.push(timerId);
    return timerId;
  }

  function runIntroExitToFreshBoard(root, state) {
    clearIntroTimers(state);
  
    var oldMsg = document.body.querySelector('.bm-board-message');
    if (oldMsg) oldMsg.remove();
  
    var blastIndices = getAllOccupiedIndices(state.board);
  
    if (blastIndices.length) {
      spawnCenterUiBurst(root, 20, 2);
      hideBoardCells(root, blastIndices);
    }
  
    state.board = createEmptyBoard(state.boardSize);
    state.blastIndices = [];
    state.isResolving = true;
  
    window.setTimeout(function () {
      markIntroSeen();
      if (window.posthog) window.posthog.capture('intro_completed');
  
      clearSavedGame('game');
      resetStandardGameState(state);
      state.screen = 'home';
  
      transitionScreen(root, function () {
        render();
      });
    }, 320);
  }

  function runBlastPhase(root, state, placedIndices, comboStep, render) {
    var blastResult;
  
    comboStep = comboStep || 1;
  
    blastResult = classifyBlastPhase(state.board, state.boardSize, comboStep);
    state.blastIndices = blastResult.blastIndices;

    if (comboStep === 1) {
      state.pendingComboPoints = 0;
    }
    state.pendingComboPoints += blastResult.scoreValue;
  
    if (!blastResult.hasBlast) {
      state.blastIndices = [];
      renderGame(root, state, render);
      state.isResolving = false;
      state.comboStep = 0;
    
      if (!(state.intro && state.intro.active)) {
        if (isDailyMode(state)) {
          checkDailyEndState(root, state, render);
        } else {
          runPostResolveDrops(root, state);
          checkPostMoveState(root, state, render);
        }
      }
    
      return;
    }
    
    playSfx('blast');
  
    var isIntroBlast = !!(state.intro && state.intro.active);

    renderGame(root, state, render);
    
    var blastAnchor = getBlastAnchor(root, blastResult.blastIndices);
    
    if (isIntroBlast) {
      state.intro.equationAnchor = blastAnchor;
    }
    
    spawnBlastFragments(root, state, blastResult.blastIndices, comboStep);

    var specialEffectResult = applySpecialBlastEffects(state, blastResult.normalBlastIndices);
    var specialLifeMessage = getLifeDeltaMessage(specialEffectResult);
    
    syncHudUi(root, state);

    var dailyGemsCleared = 0;

    if (isDailyMode(state)) {
      blastResult.blastIndices.forEach(function (index) {
        if (isGemCell(state.board[index])) {
          dailyGemsCleared += 1;
        }
      });
    }

    applyBlast(state.board, blastResult.blastIndices);

    if (isDailyMode(state) && dailyGemsCleared > 0) {
      state.daily.gemsRemaining = Math.max(0, state.daily.gemsRemaining - dailyGemsCleared);
    }

    hideBoardCells(root, blastResult.blastIndices);

    if (isDailyMode(state) && dailyGemsCleared > 0) {
      window.setTimeout(function () {
        syncHudUi(root, state);
        animateDailyGemGain(root, dailyGemsCleared);
      }, 120);
    }
    
    if (specialEffectResult.lifeDelta !== 0) {
      window.setTimeout(function () {
        animateLifeDelta(root, specialEffectResult.lifeDelta);
      }, 120);
    }
    
    window.setTimeout(function () {
      spawnBlastThumbPops(root, state, blastResult.blastIndices);
    }, INTRO_THUMB_POP_DELAY);
    
    var pointsMessageDelay = BLAST_PRIMARY_MESSAGE_DELAY;
    
    if (blastResult.blastLabel) {
      window.setTimeout(function () {
        showBoardMessage(root, blastResult.blastLabel, blastAnchor, undefined, undefined, 'blast');
      }, BLAST_PRIMARY_MESSAGE_DELAY);
    
      pointsMessageDelay = BLAST_SECONDARY_MESSAGE_DELAY;
    }
    
    if (specialLifeMessage) {
      var specialLifeDelay = blastResult.blastLabel
        ? BLAST_SECONDARY_MESSAGE_DELAY
        : BLAST_PRIMARY_MESSAGE_DELAY;
    
      window.setTimeout(function () {
        showBoardMessage(
          root,
          specialLifeMessage,
          blastAnchor,
          -82,
          undefined,
          specialEffectResult.lifeDelta < 0 ? 'life-loss' : 'life-gain'
        );
      }, specialLifeDelay);
    
      pointsMessageDelay = Math.max(pointsMessageDelay, specialLifeDelay + BLAST_MESSAGE_STEP_DELAY);
    }
    
    spawnScoreStars(root);
    if (window.posthog) window.posthog.capture('blast_triggered', { tiles_cleared: blastResult.blastIndices.length, score_awarded: blastResult.scoreValue, combo_step: comboStep });
    addScore(root, state, blastResult.scoreValue, true);

    var moved = applyGravity(state.board, state.boardSize);
    
    state.blastIndices = [];
    state.comboStep = comboStep;
  
      animateGravityFall(root, state, moved).then(function () {
        var nextBlastResult = classifyBlastPhase(state.board, state.boardSize, comboStep + 1);
  
        if (nextBlastResult.hasBlast) {
          window.setTimeout(function () {
            runBlastPhase(root, state, [], comboStep + 1, render);
          }, CHAIN_NEXT_BLAST_DELAY);
        } else {
          if (comboStep >= 2) {
            var finalComboLabel = 'Combo ' + Math.min(comboStep, 4) + 'x';
            var finalComboAnchor = blastAnchor;
            var finalComboPoints = state.pendingComboPoints;
            if (window.posthog) window.posthog.capture('combo_achieved', { combo_step: comboStep, total_score_awarded: finalComboPoints });

            window.setTimeout(function () {
              playSfx('combo');
              showBoardMessage(root, finalComboLabel, finalComboAnchor, undefined, undefined, 'combo');
            }, 220);
          
            if (!isIntroBlast && !isDailyMode(state)) {
              window.setTimeout(function () {
                showBoardMessage(
                  root,
                  formatPointsMessage(finalComboPoints),
                  finalComboAnchor,
                  undefined,
                  undefined,
                  'points',
                  POINTS_MESSAGE_DURATION
                );
              }, 220 + BLAST_MESSAGE_STEP_DELAY + POINTS_MESSAGE_EXTRA_DELAY);
            }
          } else {
            var finalSinglePoints = state.pendingComboPoints;
          
            if (!isIntroBlast && !isDailyMode(state)) {
              window.setTimeout(function () {
                showBoardMessage(
                  root,
                  formatPointsMessage(finalSinglePoints),
                  blastAnchor,
                  undefined,
                  undefined,
                  'points',
                  POINTS_MESSAGE_DURATION
                );
              }, pointsMessageDelay + POINTS_MESSAGE_EXTRA_DELAY);
            }
          }
          
          state.pendingComboPoints = 0;
        
          state.isResolving = false;
          state.comboStep = 0;
          
          if (!(state.intro && state.intro.active)) {
            if (isDailyMode(state)) {
              checkDailyEndState(root, state, render);
            } else {
              runPostResolveDrops(root, state);
              checkPostMoveState(root, state, render);
            }
          }
  
          if (state.intro && state.intro.active) {
            var nextStep = state.intro.step + 1;
            var introMessageDelay = INTRO_BLAST_TO_MESSAGE_DELAY;
          
            clearIntroTimers(state);
          
            queueIntroTimer(state, function () {
              renderGame(root, state, render);
            }, introMessageDelay);
          
            if (INTRO_STEPS[nextStep]) {
              queueIntroTimer(state, function () {
                setupIntroStepByNumber(state, nextStep);
                renderGame(root, state, render);
              }, introMessageDelay + INTRO_MESSAGE_TO_NEXT_STEP_DELAY);
            } else {
              queueIntroTimer(state, function () {
                runIntroExitToFreshBoard(root, state);
              }, introMessageDelay + INTRO_MESSAGE_TO_NEXT_STEP_DELAY);
            }
          }
        }
      });
  }

  function enableDrag(root, state, render) {
    var drag = null;
  
    function getBoardMetrics() {
      var board = root.querySelector('.bm-board');
      var cellEl = board ? board.querySelector('.bm-cell') : null;
      if (!board || !cellEl) return null;
  
      var boardRect = board.getBoundingClientRect();
      var cellRect = cellEl.getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(board).gap) || 0;
      var padding = 4;
      var step = cellRect.width + gap;
  
      return {
        board: board,
        boardRect: boardRect,
        cellSize: cellRect.width,
        gap: gap,
        padding: padding,
        step: step,
        innerLeft: boardRect.left + padding,
        innerTop: boardRect.top + padding,
        innerWidth: (step * state.boardSize) - gap,
        innerHeight: (step * state.boardSize) - gap
      };
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
      if (!metrics) return;
  
      var cellSize = metrics.cellSize;
      var gap = metrics.gap;
      var uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1);

      var boardSampleTile = document.querySelector('.bm-board .bm-tile');
      var boardFontSize = boardSampleTile
        ? parseFloat(getComputedStyle(boardSampleTile).fontSize)
        : (32 * uiScale);
  
      var shape = ghost.querySelector('.bm-piece__shape');
      if (!shape) return;
  
      var minis = ghost.querySelectorAll('.bm-mini');
      if (!minis.length) return;
  
      var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1);
      var handCell = CONFIG.handTileSize * scale;
      var handGap = CONFIG.handTileGap * scale;
      var handStep = handCell + handGap;
  
      var maxX = 0;
      var maxY = 0;
  
      minis.forEach(function (mini) {
        var left = parseFloat(mini.style.left) || 0;
        var top = parseFloat(mini.style.top) || 0;
  
        var gridX = Math.floor((left + handStep * 0.5) / handStep);
        var gridY = Math.floor((top + handStep * 0.5) / handStep);
  
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
  
    function setIntroHoverState(isActive) {
      if (!(state.intro && state.intro.active)) return;
  
      state.intro.hoveringValid = !!isActive;
  
      var sourceCell = root.querySelector('[data-cell-index="' + state.intro.sourceIndex + '"]');
      var targetCells = (state.intro.targetQueue || []).map(function (target) {
        return root.querySelector('[data-cell-index="' + target.index + '"]');
      }).filter(Boolean);
      
      root.querySelectorAll('.bm-intro-source-cell').forEach(function (el) {
        el.classList.remove('bm-intro-source-cell');
      });
      
      root.querySelectorAll('.bm-intro-target-cell').forEach(function (el) {
        el.classList.remove('is-hovered');
      });
      
      if (sourceCell) sourceCell.classList.add('bm-intro-source-cell');
      
      if (isActive) {
        targetCells.forEach(function (targetCell) {
          targetCell.classList.add('is-hovered');
        });
      }
    }
  
    function isIntroTargetPlacement(cells) {
      if (!(state.intro && state.intro.active)) return true;
      if (!cells || !cells.length) return false;
  
      if (cells.length === 1) {
        var onlyIndex = cells[0].y * state.boardSize + cells[0].x;
        return onlyIndex === state.intro.allowedTargetIndex;
      }
  
      return cells.every(function (cell) {
        var index = cell.y * state.boardSize + cell.x;
        return state.intro.targetQueue.some(function (target) {
          return target.index === index;
        });
      });
    }
  
    function clearPreview() {
      root.querySelectorAll('.is-preview-tile').forEach(function (el) {
        el.remove();
      });
  
      if (drag) drag.previewCells = null;
      setIntroHoverState(false);
    }
  
    function getAnchorFromPointer(piece, clientX, clientY) {
      var metrics = getBoardMetrics();
      if (!metrics || !piece) return null;
  
      if (
        clientX < metrics.innerLeft ||
        clientY < metrics.innerTop ||
        clientX > metrics.innerLeft + metrics.innerWidth ||
        clientY > metrics.innerTop + metrics.innerHeight
      ) {
        return null;
      }
  
      var localX = clientX - metrics.innerLeft;
      var localY = clientY - metrics.innerTop;
  
      var piecePixelWidth = (piece.width * metrics.cellSize) + ((piece.width - 1) * metrics.gap);
      var piecePixelHeight = (piece.height * metrics.cellSize) + ((piece.height - 1) * metrics.gap);
  
      var left = localX - (piecePixelWidth / 2);
      var top = localY - (piecePixelHeight / 2);
  
      var anchorX = Math.round(left / metrics.step);
      var anchorY = Math.round(top / metrics.step);
  
      anchorX = Math.max(0, Math.min(state.boardSize - piece.width, anchorX));
      anchorY = Math.max(0, Math.min(state.boardSize - piece.height, anchorY));
  
      return { x: anchorX, y: anchorY };
    }

    function getGhostCenter() {
      if (!drag || !drag.ghost) return null;
    
      var ghostRect = drag.ghost.getBoundingClientRect();
    
      return {
        x: ghostRect.left + (ghostRect.width * 0.5),
        y: ghostRect.top + (ghostRect.height * 0.5)
      };
    }
  
    function showPreview(piece, cells) {
      clearPreview();
  
      if (!piece || !cells || !cells.length) return;
      if (!isIntroTargetPlacement(cells)) return;
  
      cells.forEach(function (cell) {
        var index = cell.y * state.boardSize + cell.x;
        var cellEl = root.querySelector('[data-cell-index="' + index + '"]');
        if (!cellEl) return;
      
        var preview;
      
        preview = document.createElement('div');
        preview.className = 'bm-tile bm-tile--' + cell.tone + ' is-preview-tile';
        preview.innerHTML = '<span class="bm-tile__label">' + cell.value + '</span>';
      
        cellEl.appendChild(preview);
      });
  
      drag.previewCells = cells;
      setIntroHoverState(true);
    }
  
    function cleanupDrag() {
      clearPreview();
  
      if (!drag) return;
  
      if (drag.pieceEl) {
        drag.pieceEl.classList.remove('is-held');
      }
  
      if (drag.ghost && drag.ghost.parentNode) {
        drag.ghost.parentNode.removeChild(drag.ghost);
      }
  
      drag = null;
    }
  
    function commitPlacementFromPreview() {
      if (!drag || !drag.previewCells || !drag.previewCells.length) return false;
  
      var placedCells = drag.previewCells;
      var placedIndices = placedCells.map(function (cell) {
        return cell.y * state.boardSize + cell.x;
      });
  
      var placementScore = placedCells.reduce(function (sum, cell) {
        return sum + cell.value;
      }, 0);
  
      var draggedPiece = state.hand[drag.pieceIndex];

      placedCells.forEach(function (cell) {
        state.board[cell.y * state.boardSize + cell.x] = {
          kind: 'number',
          value: cell.value,
          tone: cell.tone
        };
      });
  
      state.hand[drag.pieceIndex] = null;

      if (!(state.intro && state.intro.active)) {
        state.moveCount += 1;

        if (isDailyMode(state) && state.daily.movesRemaining > 0) {
          var previousDailyMoves = state.daily.movesRemaining;
          state.daily.movesRemaining -= 1;

          if (previousDailyMoves > 4 && state.daily.movesRemaining === 4) {
            state.dailyJustHitDanger = true;
          }
        }
      }
  
      if (state.intro && state.intro.active) {
        state.intro.targetCursor += 1;
        state.intro.allowedTargetIndex = null;
        state.intro.hoveringValid = false;
      
        // kill intro placement glow immediately after a correct solve
        state.intro.completed = true;
        state.intro.targetQueue = [];
      }
  
      if (!(state.intro && state.intro.active)) {
        if (state.hand.every(function (piece) { return !piece; })) {
          if (isDailyMode(state)) {
            state.daily.handIndex += 1;

            if (state.dailyHands && state.dailyHands[state.daily.handIndex]) {
              state.hand = state.dailyHands[state.daily.handIndex].slice();
            } else {
              state.hand = [null, null, null];
            }
          } else {
            state.hand = generateHand(state.board, state.boardSize, state);
            state.handCount += 1;
            state.justDealtNewHand = true;
          }
        }
      }
  
      state.isResolving = true;
  
      var moved = applyGravity(state.board, state.boardSize);
      state.animMap = buildPlacementAnimMap(root, state, moved, placedIndices);
      state.blastIndices = [];
  
      if (drag.pieceEl) {
        drag.pieceEl.classList.remove('is-held');
      }
  
      if (drag.ghost && drag.ghost.parentNode) {
        drag.ghost.parentNode.removeChild(drag.ghost);
      }
  
      clearPreview();
      drag = null;
  
      renderGame(root, state, render);
  
      window.setTimeout(function () {
        runBlastPhase(root, state, placedIndices, 1, render);
      }, 280);
  
      window.setTimeout(function () {
        addScore(root, state, placementScore, true);
      }, 280);
  
      return true;
    }
  
    function beginDrag(e) {
      if (state.isResolving) return;
      if (state.helperModal) return;
      if (e.button !== undefined && e.button !== 0) return;
  
      var pieceEl = e.target.closest('[data-piece]');
      if (!pieceEl) return;
  
      var slotEl = pieceEl.closest('[data-hand-slot-index]');
      var pieceIndex = slotEl ? Number(slotEl.getAttribute('data-hand-slot-index')) : -1;
      if (pieceIndex < 0 || !state.hand[pieceIndex]) return;
  
      e.preventDefault();

      playSfx('pickup');
  
      if (pieceEl.setPointerCapture) {
        pieceEl.setPointerCapture(e.pointerId);
      }
  
      document.querySelectorAll('.bm-piece--ghost').forEach(function (el) {
        el.remove();
      });
  
      var ghost = createGhost(pieceEl);
      sizeGhostToBoard(ghost);
  
      var ghostRect = ghost.getBoundingClientRect();
      var uiScale = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale') || 1
      );
      
      drag = {
        pointerId: e.pointerId,
        pieceIndex: pieceIndex,
        pieceEl: pieceEl,
        ghost: ghost,
        ghostHalfW: ghostRect.width * 0.5,
        ghostHalfH: ghostRect.height * 0.5,
        liftY: 96 * uiScale,
        previewCells: null
      };
      
      pieceEl.classList.add('is-held');
      
      ghost.style.left = (e.clientX - drag.ghostHalfW) + 'px';
      ghost.style.top = (e.clientY - drag.ghostHalfH - drag.liftY) + 'px';
    }
  
    function moveDrag(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
  
      e.preventDefault();
  
      var piece = state.hand[drag.pieceIndex];
      if (!piece) {
        cleanupDrag();
        return;
      }
  
      drag.ghost.style.left = (e.clientX - drag.ghostHalfW) + 'px';
      drag.ghost.style.top = (e.clientY - drag.ghostHalfH - drag.liftY) + 'px';
  
      var ghostCenter = getGhostCenter();
      var anchor = ghostCenter
        ? getAnchorFromPointer(piece, ghostCenter.x, ghostCenter.y)
        : null;
      
      if (!anchor) {
        drag.ghost.style.opacity = 1;
        clearPreview();
        return;
      }
  
      var previewCells = getPlacementCells(
        state.board,
        state.boardSize,
        piece,
        anchor.x,
        anchor.y
      );
  
      if (!previewCells || !previewCells.length) {
        drag.ghost.style.opacity = 1;
        clearPreview();
        return;
      }
  
      drag.ghost.style.opacity = 0.14;
      showPreview(piece, previewCells);
    }
  
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;

      e.preventDefault();

      var hadValidPreview = !!(drag.previewCells && drag.previewCells.length);

      if (hadValidPreview) {
        playSfx('place');
      }

      if (commitPlacementFromPreview()) {
        return;
      }

      cleanupDrag();
    }
  
    function cancelDrag(e) {
      if (!drag) return;
      if (e && e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
      cleanupDrag();
    }
  
    root.addEventListener('pointerdown', beginDrag);
    root.addEventListener('pointermove', moveDrag);
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', cancelDrag);
  }

  function getLifeDeltaMessage(effectResult) {
    if (!effectResult) return '';
  
    if (effectResult.lifeDelta < 0) {
      return 'Lose ' + Math.abs(effectResult.lifeDelta) + ' Life';
    }
  
    if (effectResult.lifeDelta > 0) {
      return 'Gain ' + effectResult.lifeDelta + ' Life';
    }
  
    return '';
  }

  function formatPointsMessage(points) {
    return '+' + (points || 0);
  }
  
  function showBoardMessage(root, text, anchor, yOffset, positionVariant, styleVariant, duration) {
    if (!text) return;
  
    var oldMsg = document.body.querySelector('.bm-board-message');
    if (oldMsg) oldMsg.remove();
  
    var msg = document.createElement('div');
    msg.className =
    'bm-board-message' +
    (positionVariant ? ' bm-board-message--' + positionVariant : '') +
    (styleVariant ? ' bm-board-message--style-' + styleVariant : '');
  
    var left = window.innerWidth * 0.5;
    var top = window.innerHeight * 0.5;
    var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bm-ui-scale')) || 1;
    var textLen = String(text).length;
  
    if (anchor) {
      left = anchor.left;
      top = anchor.top + (typeof yOffset === 'number' ? yOffset : (-22 * scale));
    }
  
    var viewW = Math.max(320, Math.round(textLen * 54));
    var x = viewW / 2;
  
    msg.style.left = Math.round(left) + 'px';
    msg.style.top = Math.round(top) + 'px';
  
    msg.innerHTML =
      '<svg class="bm-board-message__svg" viewBox="0 0 ' + viewW + ' 120" aria-hidden="true">' +
        '<text class="bm-board-message__text" x="' + x + '" y="60" text-anchor="middle" dominant-baseline="middle">' +
          text +
        '</text>' +
      '</svg>';
  
    document.body.appendChild(msg);
  
    window.setTimeout(function () {
      if (msg.parentNode) msg.parentNode.removeChild(msg);
    }, duration || 1400);
  }

  function syncHudUi(root, state) {
    var highScoreEl = root.querySelector('.bm-hud-score-value');
    var livesEl = root.querySelector('.bm-hud-lives-value');
    var dailyScoreEl = root.querySelector('.bm-hud-daily-score-value');
    var dailyMovesEl = root.querySelector('[data-daily-moves-value]');
  
    if (highScoreEl) highScoreEl.textContent = state.highScore;
    if (livesEl) livesEl.textContent = state.lives;

    if (dailyScoreEl && state.daily) {
      dailyScoreEl.textContent = Math.max(0, state.daily.gemTarget - state.daily.gemsRemaining);
    }

    if (dailyMovesEl && state.daily) {
      dailyMovesEl.textContent = state.daily.movesRemaining;

      var nextBand = state.daily.movesRemaining > 8
        ? 'safe'
        : state.daily.movesRemaining > 4
          ? 'warning'
          : 'danger';

      if (state.dailyMovesBand !== nextBand) {
        dailyMovesEl.classList.remove('bm-moves--safe', 'bm-moves--warning', 'bm-moves--danger');

        if (nextBand === 'safe') {
          dailyMovesEl.classList.add('bm-moves--safe');
        } else if (nextBand === 'warning') {
          dailyMovesEl.classList.add('bm-moves--warning');
        } else {
          dailyMovesEl.classList.add('bm-moves--danger');
        }

        if (state.dailyMovesPulseStarted) {
          spawnDailyMovesStars(root, nextBand);
        }

        state.dailyMovesBand = nextBand;
      } else if (!state.dailyMovesPulseStarted) {
        if (nextBand === 'safe') {
          dailyMovesEl.classList.add('bm-moves--safe');
        } else if (nextBand === 'warning') {
          dailyMovesEl.classList.add('bm-moves--warning');
        } else {
          dailyMovesEl.classList.add('bm-moves--danger');
        }
      }

      state.dailyMovesPulseStarted = true;

      if (state.dailyJustHitDanger) {
        dailyMovesEl.classList.remove('bm-moves-hit');
        void dailyMovesEl.offsetWidth;
        dailyMovesEl.classList.add('bm-moves-hit');
        state.dailyJustHitDanger = false;

        if (state.dailyMovesHitTimer) {
          window.clearTimeout(state.dailyMovesHitTimer);
        }

        state.dailyMovesHitTimer = window.setTimeout(function () {
          var liveMovesEl = root.querySelector('[data-daily-moves-value]');
          if (liveMovesEl) liveMovesEl.classList.remove('bm-moves-hit');
          state.dailyMovesHitTimer = null;
        }, 320);
      }
    }
  }

  function syncScoreUi(root, state) {
    var scoreEl = root.querySelector('[data-score-value]');
    if (!scoreEl) {
      syncHudUi(root, state);
      return;
    }

    scoreEl.textContent = state.displayScore;

    if (state.displayScore < state.score) {
      scoreEl.classList.add('is-scoring');
    } else {
      scoreEl.classList.remove('is-scoring');
    }

    syncHudUi(root, state);
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
      var prevHighScore = state.highScore;
      state.highScore = state.score;
      writeHighScore(state.highScore);
      if (window.posthog) window.posthog.capture('new_high_score', { score: state.score, previous_high_score: prevHighScore });
    }

    syncLevelProgression(root, state);

    if (skipRender) {
      syncHudUi(root, state);
    } else {
      renderGame(root, state, render);
    }

    animateScoreTo(root, state);
  }

  function syncLevelProgression(root, state) {
    if (!state || (state.intro && state.intro.active)) return;
  
    var previousLevelId = state.levelId;
    var nextLevel = getCurrentLevel(state);
  
    state.currentLevel = nextLevel;
  
    if (previousLevelId === nextLevel.id) return;
  
    state.levelId = nextLevel.id;
  
    if (previousLevelId < 2 && nextLevel.id >= 2) {
      state.pendingBombSpawn = true;
      state.wallSpawnsSinceBomb = 0;
    }
  
    if (window.posthog) window.posthog.capture('level_up', { level: nextLevel.id, score: state.score });
    syncHudUi(root, state);
    showBoardMessage(root, 'Level ' + nextLevel.id, null, 0, 'centered');
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
      pendingComboPoints: 0,
      displayScore: 0,
      scoreAnimFrame: null,
      scoreAnimDoneTimer: null,
      comboStep: 0,
      lives: CONFIG.startingLives,
      boardSize: CONFIG.boardSize,
      moveCount: 0,
      handCount: 0,
      justDealtNewHand: false,
      levelId: 1,
      currentLevel: LEVELS[0],
      hand: generateHand(createEmptyBoard(CONFIG.boardSize), CONFIG.boardSize, null),
      board: createEmptyBoard(CONFIG.boardSize),
      dragBound: false,
      animMap: null,
      blastIndices: [],
      isResolving: false,
      boardMessage: '',
      boardMessageTimer: null,
      introTimers: [],
      homeResult: null,
      helperModal: null,
      dailyHands: [],
      dailyHandIndex: 0,
      dailyMovesHitTimer: null,
      dailyJustHitDanger: false,
      dailyMovesBand: null,
      dailyMovesPulseStarted: false,
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
      },
      daily: {
        active: false,
        puzzleId: null,
        movesRemaining: 0,
        gemTarget: 0,
        gemsRemaining: 0,
        completed: false,
        failed: false
      },
    };

    function render() {
      if (state.screen === 'home') {
        renderHome(root);

        var homeResult = consumeHomeResult(state);
        if (homeResult && homeResult.reason === 'last-heart-loss') {
          var homeEl = root.querySelector('.bm-home');
          if (homeEl) homeEl.classList.add('bm-home--heart-loss');
        }

        var play = root.querySelector('[data-play]');
        if (play) {
          play.addEventListener('click', function () {
            spawnCenterUiBurst(root, 20, 2);

            window.setTimeout(function () {
              transitionScreen(root, function () {
                var savedClassic = readSavedGame('game');

                if (savedClassic) {
                  restoreSavedGame(state, savedClassic);
                  state.screen = 'game';
                  playSfx('start');
                } else if (isIntroMode()) {
                  setupIntroStepByNumber(state, getIntroStartStep());
                  state.screen = 'game';
                } else if (!hasSeenIntro()) {
                  setupIntroStepByNumber(state, 1);
                  state.screen = 'game';
                } else {
                  resetStandardGameState(state);
                  state.screen = 'game';
                  playSfx('start');
                }
                
                render();
              });
            }, 120);
          });
        }

        var daily = root.querySelector('[data-daily]');
        if (daily) {
          daily.addEventListener('click', function () {
            spawnCenterUiBurst(root, 20, 2);

            window.setTimeout(function () {
              transitionScreen(root, function () {
                var savedDaily = readSavedGame('daily');

                if (
                  savedDaily &&
                  savedDaily.daily &&
                  savedDaily.daily.active &&
                  savedDaily.daily.puzzleId === getCurrentDailyPuzzleKey()
                ) {
                  restoreSavedGame(state, savedDaily);
                } else {
                  var dailyKey = getCurrentDailyPuzzleKey();
                  startDailyGame(state, dailyKey);
                }
                
                playSfx('start');
                
                if (window.posthog) {
                  window.posthog.capture('daily_started', { puzzle_id: state.daily.puzzleId });
                }
                
                render();
              });
            }, 120);
          });
        }

      } 
      else {
        renderGame(root, state, render);

        if (!state.dragBound) {
          enableDrag(root, state, render);
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

      writeSavedGame(state);
    }

    window.BM_DEBUG = {

      nextDailyPuzzle: function () {
        var ids = getDailyPuzzleIds();
        if (!ids.length) return;

        var currentId = state.daily && state.daily.puzzleId;
        var currentIndex = ids.indexOf(currentId);

        if (currentIndex < 0) currentIndex = 0;

        var nextIndex = (currentIndex + 1) % ids.length;
        startDailyGame(state, ids[nextIndex]);
        render();
      },

      randomDailyPuzzle: function () {
        var ids = getDailyPuzzleIds();
        if (!ids.length) return;

        var id = ids[Math.floor(Math.random() * ids.length)];
        DAILY_VARIANT_OVERRIDE = Math.floor(Math.random() * 1000000);
        startDailyGame(state, id);
        render();
      },

      setDailyWindow: function (n) {
        DAILY_WINDOW_OVERRIDE = Number(n) || 0;
        console.log('DAILY_WINDOW_OVERRIDE =', DAILY_WINDOW_OVERRIDE);
      },

      clearDailyWindowOverride: function () {
        DAILY_WINDOW_OVERRIDE = null;
        console.log('DAILY_WINDOW_OVERRIDE cleared');
      },

      setDailyVariant: function (n) {
        DAILY_VARIANT_OVERRIDE = Number(n) || 0;
        console.log('DAILY_VARIANT_OVERRIDE =', DAILY_VARIANT_OVERRIDE);
      },

      clearDailyVariantOverride: function () {
        DAILY_VARIANT_OVERRIDE = null;
        console.log('DAILY_VARIANT_OVERRIDE cleared');
      },

      startCurrentWindowDaily: function () {
        startDailyGame(state, getCurrentDailyPuzzleKey());
        render();
      },

      cycleFakeDay: function () {
        var current = typeof DAILY_WINDOW_OVERRIDE === 'number'
          ? DAILY_WINDOW_OVERRIDE
          : getCurrent12HourWindowIndex();

        DAILY_WINDOW_OVERRIDE = current + 1;
        startDailyGame(state, getCurrentDailyPuzzleKey());
        render();
      },

      logDailySetup: function () {
        console.log({
          puzzleId: state.daily && state.daily.puzzleId,
          variantSeed: state.daily && state.daily.variantSeed,
          chosenGems: state.daily && state.daily.chosenGems,
          movesRemaining: state.daily && state.daily.movesRemaining
        });
      },

      getCurrentDailyKey: function () {
        return getCurrentDailyPuzzleKey();
      },

      setDailyPuzzle: function (puzzleId) {
        startDailyGame(state, puzzleId);
        render();
      },

      startDaily: function (puzzleId) {
        startDailyGame(state, puzzleId || getCurrentDailyPuzzleKey());
        render();
      },

      setDailyMoves: function (n) {
        state.daily.active = true;
        state.screen = 'daily';
        state.daily.movesRemaining = Math.max(0, Number(n) || 0);
        render();
      },

      setDailyGems: function (n) {
        state.daily.active = true;
        state.screen = 'daily';
        state.daily.gemsRemaining = Math.max(0, Number(n) || 0);
        render();
      },

      forceDailyWin: function () {
        state.daily.active = true;
        state.screen = 'daily';
        state.daily.gemsRemaining = 0;
        state.daily.completed = false;
        state.daily.failed = false;
        checkDailyEndState(root, state, render);
      },

      forceDailyLoss: function () {
        state.daily.active = true;
        state.screen = 'daily';
        state.daily.movesRemaining = 0;
        state.daily.failed = false;
        state.daily.completed = false;
        checkDailyEndState(root, state, render);
      },

      getState: function () {
        return state;
      },

      render: function () {
        render();
      },

      resetGame: function () {
        resetStandardGameState(state);
        state.screen = 'game';
        render();
      },

      goHome: function () {
        state.screen = 'home';
        render();
      },

      setLives: function (n) {
        state.lives = Math.max(0, Math.min(CONFIG.startingLives, Number(n) || 0));
        render();
      },

      setScore: function (n) {
        state.score = Math.max(0, Number(n) || 0);
        state.displayScore = state.score;
        if (state.score > state.highScore) {
          state.highScore = state.score;
          writeHighScore(state.highScore);
        }
        syncLevelProgression(root, state);
        render();
      },

      setLevel: function (id) {
        var level = null;

        for (var i = 0; i < LEVELS.length; i++) {
          if (LEVELS[i].id === id) {
            level = LEVELS[i];
            break;
          }
        }

        if (!level) return;

        state.screen = 'game';

        state.currentLevel = level;
        state.levelId = level.id;

        if (level.id === 1) {
          state.score = 0;
        } else {
          state.score = level.minScore;
        }
        state.displayScore = state.score;

        state.moveCount = 0;
        state.handCount = 0;
        state.justDealtNewHand = false;
        state.comboStep = 0;
        state.animMap = null;
        state.blastIndices = [];
        state.isResolving = false;
        
        state.pendingBombSpawn = false;
        state.wallSpawnsSinceBomb = 0;

        if (level.id >= 2) {
          state.pendingBombSpawn = true;
        }

        seedBoardForCurrentLevel(state);
        state.hand = generateHand(state.board, state.boardSize, state);

        render();
      },

      clearBoard: function () {
        state.board = createEmptyBoard(state.boardSize);
        state.animMap = null;
        state.blastIndices = [];
        state.isResolving = false;
        render();
      },

      spawnBomb: function () {
        dropRandomBombTile(state);
        render();
      },
      
      setPendingBomb: function () {
        state.pendingBombSpawn = true;
        render();
      },
      
      setWallSpawnCount: function (n) {
        state.wallSpawnsSinceBomb = Math.max(0, Number(n) || 0);
        render();
      },

      spawnSkull: function () {
        dropRandomSpecialTile(state, 'skull');
        render();
      },

      spawnHeart: function () {
        dropRandomSpecialTile(state, 'heart');
        render();
      },

      spawnWall: function () {
        dropRandomNeutralTile(state);
        render();
      },

      forceNoMoves: function () {
        state.hand = [null, null, null];
        checkPostMoveState(root, state, render);
      },

      seedBoard: function (cells) {
        state.board = createEmptyBoard(state.boardSize);

        (cells || []).forEach(function (cell) {
          var index = (cell.y * state.boardSize) + cell.x;

          if (cell.kind === 'neutral') {
            state.board[index] = makeNeutralCell();
          } else if (cell.kind === 'bomb') {
            state.board[index] = makeBombCell();
          } else if (cell.kind === 'skull') {
            state.board[index] = makeSkullCell();
          } else if (cell.kind === 'heart') {
            state.board[index] = makeHeartCell();
          } else {
            state.board[index] = makeCell(cell.value);
          }
        });

        state.animMap = null;
        state.blastIndices = [];
        state.isResolving = false;
        render();
      }
    };

    window.addEventListener('pagehide', function () {
      writeSavedGame(state);
    });
    
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        writeSavedGame(state);
      }
    });

    return { render: render };
  }

  window.addEventListener('DOMContentLoaded', function () {
    syncUiScale();
    window.addEventListener('resize', syncUiScale);
    window.addEventListener('orientationchange', syncUiScale);
  
    // 🔊 unlock audio on first interaction
    document.body.addEventListener('pointerdown', function initAudio() {
      ensureAudioContext();
      primeResponsiveSfx();

      ['pickup', 'place', 'blast', 'lose', 'start'].forEach(function (name) {
        var s = SFX[name];
        if (!s) return;

        try {
          var targetVolume = (SFX_VOLUME[name] != null) ? SFX_VOLUME[name] : 1;

          s.volume = 0.001;
          var p = s.play();

          if (p && typeof p.then === 'function') {
            p.then(function () {
              s.pause();
              s.currentTime = 0;
              s.volume = targetVolume;
            }).catch(function () {
              s.volume = targetVolume;
            });
          } else {
            s.pause();
            s.currentTime = 0;
            s.volume = targetVolume;
          }
        } catch (e) {
          s.volume = (SFX_VOLUME[name] != null) ? SFX_VOLUME[name] : 1;
        }
      });
    }, { once: true });

    var app = createApp();
    app.render();
  });
})();
