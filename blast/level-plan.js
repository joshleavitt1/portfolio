(function () {
  "use strict";

  const PLAN = {
    level: 1,
    boardSize: 5,
    handSize: 3,
    maxLargePieces: 1,
    numberMin: 1,
    numberMax: 9,
    target: 10,
    allowShapes: ["s1", "h2", "v2", "smartL"]
  };

  function getNumberBlastRules() {
    return PLAN;
  }

  window.NumberBlastLevelPlan = { getNumberBlastRules };
})();