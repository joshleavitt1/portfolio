// difficulty-engine.js
// Central place to define math puzzles & difficulty 1–10.
// Each puzzle is:
// {
//   id: string,
//   difficulty: 1-10,
//   slots: 5|6|7|8,
//   fixedSlots: { [slotIndex: number]: string },
//   cards: string[] // movable tokens in the hand
// }

function getInitialDifficulty() {
  const saved = Number(localStorage.getItem("mm_difficulty"));
  if (!Number.isNaN(saved)) return clampDifficulty(saved);
  return 2;
}

function setCurrentDifficulty(newDifficulty) {
  state.currentDifficulty = clampDifficulty(newDifficulty);
  localStorage.setItem("mm_difficulty", state.currentDifficulty);
}

(function () {
  /**
   * Hard-coded puzzle bank for now.
   * We can always expand this later or add generators.
   *
   * Rules:
   * - 1 char per slot (digits/operators)
   * - numbers are built by adjacent digit cards
   * - all resulting values < 99
   */

  const PUZZLE_BANK = {
    // -------------------------------------------------------------------
    // Difficulty 1–3: 5 slots, single-digit, heavy scaffolding
    // -------------------------------------------------------------------
    1: [
      // 1 + _ = 2  (cards: 1, 3 → 3 is a decoy)
      // pattern: single missing addend, extra digit in hand
      {
        id: "d1_1_plus_blank_eq_2",
        difficulty: 1,
        slots: 5,
        fixedSlots: {
          0: "1",
          1: "+",
          3: "=",
          4: "2",
        },
        cards: ["1", "3"],
      },

      // _ + _ = 2 (cards: 1,1,3,+ → 3 is a decoy)
      // pattern: both addends missing
      {
        id: "d1_two_ones_make_2",
        difficulty: 1,
        slots: 5,
        fixedSlots: {
          3: "=",
          4: "2",
        },
        cards: ["1", "1", "3", "+"],
      },

      // 2 + _ = 4 (cards: 2,1 → 1 is a decoy)
      // pattern: single missing addend
      {
        id: "d1_2_plus_blank_eq_4",
        difficulty: 1,
        slots: 5,
        fixedSlots: {
          0: "2",
          1: "+",
          3: "=",
          4: "4",
        },
        cards: ["2", "1"],
      },

      // _ + 1 = 3 (cards: 2,4 → 4 is a decoy)
      // pattern: missing left addend
      {
        id: "d1_blank_plus_1_eq_3",
        difficulty: 1,
        slots: 5,
        fixedSlots: {
          1: "+",
          2: "1",
          3: "=",
          4: "3",
        },
        cards: ["2", "4"],
      },
    ],

    2: [
      // _ + 2 = 4  (cards: 2,1 → 1 is a decoy)
      // pattern: missing left addend
      {
        id: "d2_blank_plus_2_eq_4",
        difficulty: 2,
        slots: 5,
        fixedSlots: {
          1: "+",
          2: "2",
          3: "=",
          4: "4",
        },
        cards: ["2", "1"],
      },

      // 3 + _ = 5 (cards: 2,1 → 1 is a decoy)
      // pattern: missing right addend
      {
        id: "d2_3_plus_blank_eq_5",
        difficulty: 2,
        slots: 5,
        fixedSlots: {
          0: "3",
          1: "+",
          3: "=",
          4: "5",
        },
        cards: ["2", "1"],
      },

      // _ + _ = 5  (cards: 2,3,1,+ → 1 is a decoy)
      // pattern: both addends missing
      {
        id: "d2_two_numbers_make_5",
        difficulty: 2,
        slots: 5,
        fixedSlots: {
          3: "=",
          4: "5",
        },
        cards: ["2", "3", "1", "+"], // 2 + 3 = 5
      },

      // _ - 1 = 2  (cards: 3,4 → 4 is a decoy)
      // pattern: subtraction, missing left minuend
      {
        id: "d2_blank_minus_1_eq_2",
        difficulty: 2,
        slots: 5,
        fixedSlots: {
          1: "-",
          2: "1",
          3: "=",
          4: "2",
        },
        cards: ["3", "4"], // 3 - 1 = 2
      },
    ],

    3: [
      // 4 - _ = 2  (cards: 2,1 → 1 is a decoy)
      // pattern: subtraction, missing subtrahend
      {
        id: "d3_4_minus_blank_eq_2",
        difficulty: 3,
        slots: 5,
        fixedSlots: {
          0: "4",
          1: "-",
          3: "=",
          4: "2",
        },
        cards: ["2", "1"],
      },

      // _ - 1 = 2  (cards: 3,4 → 4 is a decoy)
      // pattern: subtraction, missing left side (mirrors above difficulty)
      {
        id: "d3_blank_minus_1_eq_2",
        difficulty: 3,
        slots: 5,
        fixedSlots: {
          1: "-",
          2: "1",
          3: "=",
          4: "2",
        },
        cards: ["3", "4"],
      },

      // _ + 1 = 4  (cards: 3,2 → 2 is a decoy)
      // pattern: addition, missing left side
      {
        id: "d3_blank_plus_1_eq_4",
        difficulty: 3,
        slots: 5,
        fixedSlots: {
          1: "+",
          2: "1",
          3: "=",
          4: "4",
        },
        cards: ["3", "2"], // 3 + 1 = 4
      },

      // 5 - _ = 3 (cards: 2,4 → 4 is a decoy)
      // pattern: subtraction with different numbers
      {
        id: "d3_5_minus_blank_eq_3",
        difficulty: 3,
        slots: 5,
        fixedSlots: {
          0: "5",
          1: "-",
          3: "=",
          4: "3",
        },
        cards: ["2", "4"], // 5 - 2 = 3
      },
    ],

    // -------------------------------------------------------------------
    // Difficulty 4–6: 5 or 6 slots, mostly single-digit, some double-digit
    // “double digit results means 6 cards: 9 + 9 = 1 8”
    // -------------------------------------------------------------------
    4: [
      // _ + _ = 1 2  (6 slots, cards: 5,7,2,+ → 2 is a decoy)
      // pattern: both addends missing, multi-digit result
      {
        id: "d4_two_numbers_make_12",
        difficulty: 4,
        slots: 6,
        fixedSlots: {
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["5", "7", "2", "+"], // 5 + 7 = 12
      },

      // 9 + 3 = 1 2 (6 slots, blanks on left, extra digit in hand)
      // pattern: fill both left-side number & operator
      {
        id: "d4_nine_plus_three_eq_12",
        difficulty: 4,
        slots: 6,
        fixedSlots: {
          2: "3",
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["9", "+", "4"], // 4 is decoy
      },

      // 1 0 - _ = 6  (6 slots, cards: 4,3 → 3 is a decoy)
      // pattern: multi-digit minuend
      {
        id: "d4_10_minus_blank_eq_6",
        difficulty: 4,
        slots: 6,
        fixedSlots: {
          0: "1",
          1: "0",
          2: "-",
          4: "=",
          5: "6",
        },
        cards: ["4", "3"], // 10 - 4 = 6
      },
    ],

    5: [
      // 9 + _ = 1 2 (cards: 3,4 → 4 is a decoy)
      // pattern: single missing addend, multi-digit result
      {
        id: "d5_9_plus_blank_eq_12",
        difficulty: 5,
        slots: 6,
        fixedSlots: {
          0: "9",
          1: "+",
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["3", "4"], // 9 + 3 = 12
      },

      // _ + 8 = 1 5 (cards: 7,1,+ → 1 is decoy)
      // pattern: missing left addend
      {
        id: "d5_blank_plus_8_eq_15",
        difficulty: 5,
        slots: 6,
        fixedSlots: {
          2: "8",
          3: "=",
          4: "1",
          5: "5",
        },
        cards: ["7", "1", "+"], // 7 + 8 = 15
      },

      // _ + 6 = 1 2  (cards: 6,4 → 4 is decoy)
      // pattern: different multi-digit make-12 shape
      {
        id: "d5_blank_plus_6_eq_12",
        difficulty: 5,
        slots: 6,
        fixedSlots: {
          1: "+",
          2: "6",
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["6", "4"], // 6 + 6 = 12
      },
    ],

    6: [
      // _ _ - 3 = 1 2   (slots: 7, cards: 1,5,4 → 4 is a decoy)
      // pattern: multi-digit minuend assembled from cards (15 - 3 = 12)
      {
        id: "d6_blank_minus_3_eq_12",
        difficulty: 6,
        slots: 7,
        fixedSlots: {
          2: "-",
          3: "3",
          4: "=",
          5: "1",
          6: "2",
        },
        cards: ["1", "5", "4"], // 1 and 5 build 15; 4 is a decoy
      },
    
      // (keep the rest of the difficulty 6 puzzles as-is)    

      // 1 8 - _ = 9   (slots: 6, cards: 9,4,- → 4 is decoy)
      {
        id: "d6_18_minus_blank_eq_9",
        difficulty: 6,
        slots: 6,
        fixedSlots: {
          0: "1",
          1: "8",
          2: "-",
          4: "=",
          5: "9",
        },
        cards: ["9", "4"], // 18 - 9 = 9
      },

      // _ _ - 4 = 1 1 (slots: 6, cards: 1,5,2)
      // pattern: both digits of minuend missing
      {
        id: "d6_two_digit_minus_4_eq_11",
        difficulty: 6,
        slots: 6,
        fixedSlots: {
          2: "-",
          3: "4",
          4: "=",
          5: "1",
        },
        cards: ["1", "5", "2"], // 15 - 4 = 11; "2" decoy
      },
    ],

    // -------------------------------------------------------------------
    // Difficulty 7–10: 7 or 8 slots, multi-digit forms
    // e.g. 1 0 + 8 = 1 8  (7 slots)
    //      1 0 + 1 0 = 2 0 (8 slots)
    // -------------------------------------------------------------------
    7: [
      // 1 0 + _ = 1 8  (7 slots, cards: 8,2 → 2 is decoy)
      {
        id: "d7_10_plus_blank_eq_18",
        difficulty: 7,
        slots: 7,
        fixedSlots: {
          0: "1",
          1: "0",
          2: "+",
          4: "=",
          5: "1",
          6: "8",
        },
        cards: ["8", "2"], // 10 + 8 = 18
      },

      // _ _ + 8 = 1 8  (7 slots, cards: 1,0,3,+ → 3 is decoy)
      // 1 0 + 8 = 1 8
      {
        id: "d7_two_blanks_then_8_eq_18",
        difficulty: 7,
        slots: 7,
        fixedSlots: {
          3: "8",
          4: "=",
          5: "1",
          6: "8",
        },
        cards: ["1", "0", "3", "+"],
      },

      // 2 0 - _ = 1 3 (7 slots, cards: 7,4)
      // pattern: multi-digit subtraction, missing right number
      {
        id: "d7_20_minus_blank_eq_13",
        difficulty: 7,
        slots: 7,
        fixedSlots: {
          0: "2",
          1: "0",
          2: "-",
          4: "=",
          5: "1",
          6: "3",
        },
        cards: ["7", "4"], // 20 - 7 = 13
      },
    ],

    8: [
      // 1 0 + 1 0 = 2 0 (8 slots, cards: 2,1 → 1 is decoy)
      {
        id: "d8_10_plus_10_eq_20",
        difficulty: 8,
        slots: 8,
        fixedSlots: {
          0: "1",
          1: "0",
          2: "+",
          3: "1",
          4: "0",
          5: "=",
          7: "0",
        },
        cards: ["2", "1"], // 2 is used as "2" in 20
      },

      // 2 3 + _ _ = 4 5 (8 slots, cards: 2,2,1)
      // 2 3 + 2 2 = 4 5; 1 is decoy
      {
        id: "d8_23_plus_22_eq_45",
        difficulty: 8,
        slots: 8,
        fixedSlots: {
          0: "2",
          1: "3",
          2: "+",
          5: "=",
          6: "4",
          7: "5",
        },
        cards: ["2", "2", "1"],
      },

      // _ _ + 1 5 = 3 0 (8 slots, cards: 1,5,4)
      // 1 5 + 1 5 = 3 0; 4 is decoy
      {
        id: "d8_two_digit_plus_15_eq_30",
        difficulty: 8,
        slots: 8,
        fixedSlots: {
          2: "+",
          3: "1",
          4: "5",
          5: "=",
          6: "3",
          7: "0",
        },
        cards: ["1", "5", "4"],
      },
    ],

    // For now, 9 and 10 just reuse 8's bank.
    9: [],
    10: [],
  };

  // Alias 9 & 10 to difficulty 8 for now:
  PUZZLE_BANK[9] = PUZZLE_BANK[8];
  PUZZLE_BANK[10] = PUZZLE_BANK[8];

  

  function clampDifficulty(d) {
    if (d < 1) return 1;
    if (d > 10) return 10;
    return d;
  }

  function getInitialDifficulty() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = Number(params.get("difficulty"));
    if (!Number.isNaN(fromUrl)) {
      return clampDifficulty(fromUrl);
    }
    // 🔧 Default start is now difficulty 2 (old level 2)
    return 2;
  }

  const state = {
    currentDifficulty: getInitialDifficulty(),
    nextIndexByDifficulty: {}, // { difficulty: nextIndex in shuffled order array }
    orderByDifficulty: {},     // { difficulty: [shuffled indices into PUZZLE_BANK[d]] }
    lastPuzzleId: null,        // remember last-served puzzle to avoid repeats
    winStreak: 0,              // track consecutive wins
  };

  function shuffleArray(array) {
    // Fisher–Yates
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function ensureOrderForDifficulty(d) {
    const bank = PUZZLE_BANK[d];
    if (!bank || bank.length === 0) return null;

    const existingOrder = state.orderByDifficulty[d];

    // If no order yet, or bank size changed, build a new shuffled order
    if (
      !existingOrder ||
      !Array.isArray(existingOrder) ||
      existingOrder.length !== bank.length
    ) {
      const indices = bank.map((_, idx) => idx);
      state.orderByDifficulty[d] = shuffleArray(indices);
      state.nextIndexByDifficulty[d] = 0;
    }

    return state.orderByDifficulty[d];
  }

  // Count how many of the hand cards are single-digit integers (0–9).
  // This lets us enforce "bare minimum = 2 integer cards missing".
  function countIntegerCards(cards) {
    if (!Array.isArray(cards)) return 0;
    return cards.reduce((count, token) => {
      return count + (/^\d$/.test(token) ? 1 : 0);
    }, 0);
  }

  const MIN_INTEGER_CARDS = 2;

  function difficultyHasEnoughIntegerPuzzles(d) {
    const bank = PUZZLE_BANK[d];
    if (!bank || bank.length === 0) return false;
    return bank.some((p) => countIntegerCards(p.cards) >= MIN_INTEGER_CARDS);
  }

  function findNearestDifficultyWithEnoughIntegerPuzzles(d) {
    const clamped = clampDifficulty(d);

    // If this difficulty already has at least one valid puzzle, use it.
    if (difficultyHasEnoughIntegerPuzzles(clamped)) {
      return clamped;
    }

    // Otherwise, search outward for the nearest difficulty that does.
    for (let step = 1; step <= 9; step++) {
      const down = clamped - step;
      const up = clamped + step;

      if (down >= 1 && difficultyHasEnoughIntegerPuzzles(down)) {
        return down;
      }
      if (up <= 10 && difficultyHasEnoughIntegerPuzzles(up)) {
        return up;
      }
    }

    // Absolute fallback: just use the clamped difficulty as-is
    return clamped;
  }


  function pickNextPuzzleForDifficulty(difficulty) {
    const d = clampDifficulty(difficulty);
    const bank = PUZZLE_BANK[d];
    if (!bank || bank.length === 0) return null;

    const order = ensureOrderForDifficulty(d);
    if (!order || order.length === 0) return null;

    let idx = state.nextIndexByDifficulty[d] ?? 0;
    let chosenPuzzle = null;

    // First pass: avoid repeating last puzzle AND enforce the 2-integer rule
    for (let attempts = 0; attempts < bank.length; attempts++) {
      const puzzleIndex = order[idx];
      const candidate = bank[puzzleIndex];

      if (!candidate) {
        idx = (idx + 1) % order.length;
        continue;
      }

      const integerCount = countIntegerCards(candidate.cards);

      if (
        candidate.id !== state.lastPuzzleId &&
        integerCount >= MIN_INTEGER_CARDS
      ) {
        chosenPuzzle = candidate;
        // Advance pointer for next time
        state.nextIndexByDifficulty[d] = (idx + 1) % order.length;
        break;
      }

      idx = (idx + 1) % order.length;
    }

    // Second pass: ignore lastPuzzleId, but STILL require ≥2 integer cards
    if (!chosenPuzzle) {
      for (let i = 0; i < order.length; i++) {
        const puzzleIndex = order[i];
        const candidate = bank[puzzleIndex];
        if (!candidate) continue;

        const integerCount = countIntegerCards(candidate.cards);
        if (integerCount >= MIN_INTEGER_CARDS) {
          chosenPuzzle = candidate;
          state.nextIndexByDifficulty[d] = (i + 1) % order.length;
          break;
        }
      }
    }

    // If we still couldn't find one, let the caller decide how to fall back.
    if (!chosenPuzzle) {
      return null;
    }

    // If we just wrapped around the shuffled list, reshuffle for variety
    if (state.nextIndexByDifficulty[d] === 0 && bank.length > 1) {
      const newOrder = shuffleArray(bank.map((_, i) => i));
      state.orderByDifficulty[d] = newOrder;
    }

    state.lastPuzzleId = chosenPuzzle.id;
    return chosenPuzzle;
  }


  function setCurrentDifficulty(newDifficulty) {
    state.currentDifficulty = clampDifficulty(newDifficulty);
  }

  function getCurrentDifficulty() {
    return state.currentDifficulty;
  }

  function getNextPuzzle(difficultyOverride) {
    const requested =
      typeof difficultyOverride === "number"
        ? clampDifficulty(difficultyOverride)
        : state.currentDifficulty;

    // Keep internal difficulty in sync with the override
    state.currentDifficulty = requested;

    // Snap to the nearest difficulty that actually has
    // puzzles with at least two integer cards.
    const effectiveDifficulty =
      findNearestDifficultyWithEnoughIntegerPuzzles(requested);

    let puzzle = pickNextPuzzleForDifficulty(effectiveDifficulty);

    // Final safety net: if something went wrong (e.g. bank mutated),
    // serve a simple built-in puzzle that still obeys the 2-integer rule.
    if (!puzzle) {
      puzzle = {
        id: "fallback_two_integer_1_plus_1_eq_2",
        difficulty: effectiveDifficulty,
        slots: 5,
        fixedSlots: {
          1: "+",
          3: "=",
          4: "2",
        },
        cards: ["1", "1"], // 🔒 two integers in hand
      };
    }

    return puzzle;
  }

  // Adaptive difficulty: +1 difficulty after each consecutive win.
  function reportResult(outcome) {
    if (outcome === "win") {
      state.winStreak = (state.winStreak || 0) + 1;

      // For now: simply climb by +1 each win, clamped 1–10.
      state.currentDifficulty = clampDifficulty(state.currentDifficulty + 1);
    } else if (outcome === "lose") {
      // Reset streak; keep difficulty where it is for now.
      state.winStreak = 0;
    }
  }

  window.DifficultyEngine = {
    getInitialDifficulty,
    getCurrentDifficulty,
    setCurrentDifficulty,
    getNextPuzzle,
    reportResult,
  };
})();
