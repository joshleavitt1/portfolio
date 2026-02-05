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
      // 1 + _ = 2  (cards: 1)
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
        cards: ["1"],
      },
      // _ + _ = 2 (cards: 1,1,+)
      {
        id: "d1_two_ones_make_2",
        difficulty: 1,
        slots: 5,
        fixedSlots: {
          3: "=",
          4: "2",
        },
        cards: ["1", "1", "+"],
      },
      // 2 + _ = 4 (cards: 2)
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
        cards: ["2"],
      },
    ],

    2: [
      // _ + 2 = 4  (cards: 2, +)
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
        cards: ["2"],
      },
      // 3 + _ = 5 (cards: 2)
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
        cards: ["2"],
      },
      // _ + _ = 5  (cards: 2,3,+)
      {
        id: "d2_two_numbers_make_5",
        difficulty: 2,
        slots: 5,
        fixedSlots: {
          3: "=",
          4: "5",
        },
        cards: ["2", "3", "+"],
      },
    ],

    3: [
      // 4 - _ = 2  (cards: 2)
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
        cards: ["2"],
      },
      // _ - 1 = 2  (cards: 3, -, 1)
      {
        id: "d3_blank_minus_1_eq_2",
        difficulty: 3,
        slots: 5,
        fixedSlots: {
          2: "1",
          3: "=",
          4: "2",
        },
        cards: ["3", "-"],
      },
    ],

    // -------------------------------------------------------------------
    // Difficulty 4–6: 5 or 6 slots, mostly single-digit, some double-digit
    //  “double digit results means 6 cards: 9 + 9 = 1 8”
    // -------------------------------------------------------------------
    4: [
      // _ + _ = 1 2  (6 slots, cards: 5,7,+)
      // pattern: _ + _ = 1 2
      {
        id: "d4_two_numbers_make_12",
        difficulty: 4,
        slots: 6,
        fixedSlots: {
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["5", "7", "+"], // 5 + 7 = 12
      },
      // 9 + 3 = 1 2 (2 blanks on left, 6 slots)
      {
        id: "d4_nine_plus_three_eq_12",
        difficulty: 4,
        slots: 6,
        fixedSlots: {
          2: "+",
          4: "=",
          5: "2",
        },
        // 9 _ 3  = 1 2 -> kids place "9" at slot0, "1" at slot3
        // but better: 9 + 3 = 1 2 -> blanks at slots 0 & 3
        // Let's make it: _ + 3 = 1 2 (cards: 9,1,+)
        fixedSlots: {
          2: "3",
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["9", "+"],
      },
    ],

    5: [
      // 9 + _ = 1 2 (cards: 3)
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
        cards: ["3"],
      },
      // _ + 8 = 1 5 (cards: 7, +)
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
        cards: ["7", "+"], // 7 + 8 = 15
      },
    ],

    6: [
      // _ - 3 = 1 2   (cards: 1,5,-)
      {
        id: "d6_blank_minus_3_eq_12",
        difficulty: 6,
        slots: 6,
        fixedSlots: {
          2: "3",
          3: "=",
          4: "1",
          5: "2",
        },
        cards: ["1", "5", "-"], // 15 - 3 = 12
      },
      // 1 8 - _ = 9   (slots: 6, cards: 9, -)
      // pattern: 1 8 - _ = 9
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
        cards: ["9"],
      },
    ],

    // -------------------------------------------------------------------
    // Difficulty 7–10: 7 or 8 slots, multi-digit forms
    // e.g. 1 0 + 8 = 1 8  (7 slots)
    //      1 0 + 1 0 = 2 0 (8 slots)
    // -------------------------------------------------------------------
    7: [
      // 1 0 + _ = 1 8  (7 slots, cards: 8)
      // slots: 0 1 2 3 4 5 6
      //        1 0 + _ = 1 8
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
        cards: ["8"], // 10 + 8 = 18
      },
      // _ _ + 8 = 1 8  (7 slots, cards: 1,0,+)
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
        cards: ["1", "0", "+"], // 1 0 + 8 = 1 8
      },
    ],

    8: [
      // 1 0 + 1 0 = 2 0 (8 slots, cards: 2)
      // slots: 0 1 2 3 4 5 6 7
      //        1 0 + 1 0 = 2 0
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
        cards: ["2"],
      },
      // 2 3 + _ _ = 4 5 (8 slots, cards: 2,2,+)
      // 2 3 + 2 2 = 4 5
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
        cards: ["2", "2"],
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
    return 1; // default easiest; later we’ll map from grade
  }

  const state = {
    currentDifficulty: getInitialDifficulty(),
    nextIndexByDifficulty: {},  // { difficulty: nextIndex in shuffled order array }
    orderByDifficulty: {},      // { difficulty: [shuffled indices into PUZZLE_BANK[d]] }
    lastPuzzleId: null,         // remember last-served puzzle to avoid repeats
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

  function pickNextPuzzleForDifficulty(difficulty) {
    const d = clampDifficulty(difficulty);
    const bank = PUZZLE_BANK[d];
    if (!bank || bank.length === 0) return null;

    const order = ensureOrderForDifficulty(d);
    if (!order || order.length === 0) return null;

    let idx = state.nextIndexByDifficulty[d] ?? 0;
    let chosenPuzzle = null;

    // Try up to bank.length times to find a puzzle
    // whose id != lastPuzzleId (so we don't repeat)
    for (let attempts = 0; attempts < bank.length; attempts++) {
      const puzzleIndex = order[idx];
      const candidate = bank[puzzleIndex];

      if (!candidate) {
        idx = (idx + 1) % order.length;
        continue;
      }

      if (candidate.id !== state.lastPuzzleId) {
        chosenPuzzle = candidate;
        // Advance pointer for next time
        state.nextIndexByDifficulty[d] = (idx + 1) % order.length;
        break;
      }

      idx = (idx + 1) % order.length;
    }

    // Edge case: only one puzzle in this difficulty,
    // or for some reason we couldn't find a different one.
    if (!chosenPuzzle) {
      const fallbackIndex = order[state.nextIndexByDifficulty[d] ?? 0] ?? order[0];
      chosenPuzzle = bank[fallbackIndex];
      state.nextIndexByDifficulty[d] =
        ((state.nextIndexByDifficulty[d] ?? 0) + 1) % order.length;
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
    const d =
      typeof difficultyOverride === "number"
        ? clampDifficulty(difficultyOverride)
        : state.currentDifficulty;

    return pickNextPuzzleForDifficulty(d);
  }

  // Optional stub for future adaptive difficulty (streak-based, etc.)
  function reportResult(outcome) {
    // outcome: "win" | "lose"
    // For now, this is a no-op; later we can nudge difficulty up/down.
  }

  window.DifficultyEngine = {
    getInitialDifficulty,
    getCurrentDifficulty,
    setCurrentDifficulty,
    getNextPuzzle,
    reportResult,
  };
})();
