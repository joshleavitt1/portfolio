(function () {
  "use strict";

  const PLAN = [
    {
      level: 1,
      boardSize: 4,
      target: 10,
      handSize: 1,
      maxLargePieces: 0,
      numberMin: 1,
      numberMax: 9,
      winsToAdvance: 1,
      allowShapes: ["s1"],
      boardPreset: [
        { r: 0, c: 0, v: 5 }
      ],
      presetHand: [
        { shapeId: "s1", values: [5] }
      ]
    },
    {
      level: 2,
      boardSize: 4,
      target: 10,
      handSize: 1,
      maxLargePieces: 0,
      numberMin: 1,
      numberMax: 9,
      winsToAdvance: 1,
      allowShapes: ["s1"],
      boardPreset: [
        { r: 0, c: 1, v: 4 },
        { r: 1, c: 1, v: 2 }
      ],
      presetHand: [
        { shapeId: "s1", values: [4] }
      ]
    },
    {
      level: 3,
      boardSize: 4,
      target: 10,
      handSize: 1,
      maxLargePieces: 0,
      numberMin: 1,
      numberMax: 9,
      winsToAdvance: 1,
      allowShapes: ["s1"],
      boardPreset: [
        { r: 1, c: 1, v: 7 },
        { r: 2, c: 1, v: 6 },
        { r: 3, c: 2, v: 3 }
      ],
      presetHand: [
        { shapeId: "s1", values: [4] }
      ]
    },
    {
      level: 4,
      boardSize: 4,
      target: 10,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      winsToAdvance: 20,
      allowShapes: ["s1", "h2", "v2"],
      boardPreset: [
        { r: 1, c: 0, v: 2 },
        { r: 1, c: 1, v: 3 },
        { r: 1, c: 2, v: 4 },
        { r: 2, c: 0, v: 1 },
        { r: 2, c: 1, v: 2 },
        { r: 2, c: 2, v: 3 },
        { r: 2, c: 3, v: 4 },
        { r: 3, c: 0, v: 2 },
        { r: 3, c: 1, v: 4 },
        { r: 3, c: 2, v: 1 },
        { r: 3, c: 3, v: 3 }
      ],
      presetHand: [
        { shapeId: "s1", values: [1] },
        { shapeId: "s1", values: [6] },
        { shapeId: "s1", values: [5] }
      ]
    },
    {
      level: 5,
      boardSize: 4,
      target: 10,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      winsToAdvance: 1,
      allowShapes: ["s1", "h2", "v2"],
      boardPreset: [
        { r: 0, c: 2, v: 3 },
        { r: 1, c: 0, v: 2 },
        { r: 1, c: 1, v: 4 },
        { r: 1, c: 2, v: 1 },
        { r: 2, c: 0, v: 3 },
        { r: 2, c: 1, v: 2 },
        { r: 2, c: 2, v: 4 },
        { r: 2, c: 3, v: 1 },
        { r: 3, c: 0, v: 2 },
        { r: 3, c: 1, v: 3 },
        { r: 3, c: 2, v: 1 }
      ],
      presetHand: [
        { shapeId: "s1", values: [3] },
        { shapeId: "s1", values: [5] },
        { shapeId: "s1", values: [7] }
      ]
    }
  ];

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function getNumberBlastRules(level) {
    const lvl = clamp(Number(level) || 1, 1, PLAN.length);
    return PLAN.find((p) => p.level === lvl) || PLAN[0];
  }

  window.NumberBlastLevelPlan = { getNumberBlastRules };
})();
