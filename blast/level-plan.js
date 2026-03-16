(function () {
  "use strict";

  const LEVELS = {
    1: {
      level: 1,
      boardSize: 5,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      target: 10,
      pointsGoal: 120,
      allowShapes: ["s1", "h2", "v2", "smartL"]
    },
    2: {
      level: 2,
      boardSize: 5,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      target: 10,
      pointsGoal: 220,
      allowShapes: ["s1", "h2", "v2", "smartL"]
    },
    3: {
      level: 3,
      boardSize: 5,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      target: 10,
      pointsGoal: 360,
      allowShapes: ["s1", "h2", "v2", "smartL"]
    },
    4: {
      level: 4,
      boardSize: 5,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      target: 10,
      pointsGoal: 540,
      allowShapes: ["s1", "h2", "v2", "smartL"]
    },
    5: {
      level: 5,
      boardSize: 6,
      handSize: 3,
      maxLargePieces: 1,
      numberMin: 1,
      numberMax: 9,
      target: 10,
      pointsGoal: 760,
      allowShapes: ["s1", "h2", "v2", "smartL"]
    }
  };

  function getNumberBlastRules(level = 1) {
    const safeLevel = Math.max(1, Number(level) || 1);
    return LEVELS[safeLevel] || LEVELS[5];
  }

  window.NumberBlastLevelPlan = { getNumberBlastRules };
})();