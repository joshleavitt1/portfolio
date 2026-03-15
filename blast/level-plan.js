(function () {
  "use strict";

  const PLAN = [
    {
      level: 1,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      allowShapes: ["s1", "h2", "v2"],
      boardPreset: [
        { r: 1, c: 2, v: 3 },
        { r: 2, c: 1, v: 2 },
        { r: 2, c: 2, v: 4 },
        { r: 2, c: 3, v: 1 },
        { r: 3, c: 1, v: 3 },
        { r: 3, c: 2, v: 2 },
        { r: 3, c: 3, v: 4 }
      ],
      presetHand: [
        { shapeId: "s1", values: [1] },
        { shapeId: "s1", values: [6] },
        { shapeId: "s1", values: [5] }
      ]
    },
    {
      level: 2,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      allowShapes: ["s1", "h2", "v2"],
      boardPreset: [
        { r: 1, c: 2, v: 3 },
        { r: 2, c: 1, v: 2 },
        { r: 2, c: 2, v: 4 },
        { r: 2, c: 3, v: 1 },
        { r: 3, c: 1, v: 3 },
        { r: 3, c: 2, v: 2 },
        { r: 3, c: 3, v: 4 }
      ],
      presetHand: [
        { shapeId: "s1", values: [1] },
        { shapeId: "s1", values: [6] },
        { shapeId: "s1", values: [5] }
      ]
    },
    {
      level: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      allowShapes: ["s1", "h2", "v2"],
      boardPreset: [
        { r: 1, c: 2, v: 3 },
        { r: 2, c: 1, v: 2 },
        { r: 2, c: 2, v: 4 },
        { r: 2, c: 3, v: 1 },
        { r: 3, c: 1, v: 3 },
        { r: 3, c: 2, v: 2 },
        { r: 3, c: 3, v: 4 }
      ],
      presetHand: [
        { shapeId: "s1", values: [1] },
        { shapeId: "s1", values: [6] },
        { shapeId: "s1", values: [5] }
      ]
    },
    {
      level: 4,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      allowShapes: ["s1", "h2", "v2"],
      boardPreset: [
        { r: 1, c: 2, v: 3 },
        { r: 2, c: 1, v: 2 },
        { r: 2, c: 2, v: 4 },
        { r: 2, c: 3, v: 1 },
        { r: 3, c: 1, v: 3 },
        { r: 3, c: 2, v: 2 },
        { r: 3, c: 3, v: 4 }
      ],
      presetHand: [
        { shapeId: "s1", values: [1] },
        { shapeId: "s1", values: [6] },
        { shapeId: "s1", values: [5] }
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
