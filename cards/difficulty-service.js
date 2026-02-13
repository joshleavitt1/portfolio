// difficulty-service.js
// Shared "what level is the player at" service.

(function () {
  "use strict";

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getPlayerLevel() {
    const fromProfile =
      Number(window.PLAYER_PROFILE && window.PLAYER_PROFILE.heroLevel);

    const fromHeroLevelGlobal =
      Number(window.HERO_LEVEL);

    const level =
      (Number.isFinite(fromProfile) && fromProfile > 0 ? fromProfile : null) ??
      (Number.isFinite(fromHeroLevelGlobal) && fromHeroLevelGlobal > 0 ? fromHeroLevelGlobal : null) ??
      1;

    return clamp(level, 1, 10);
  }

  function getQuestContext() {
    const questId = window.CURRENT_QUEST_ID || "quest_1";
    const questDef =
      (window.QUESTS && window.QUESTS[questId]) || {};

    return {
      questId,
      mathTypeKey: questDef.mathTypeKey || "addition",
      playerLevel: getPlayerLevel(),
    };
  }

  function reportMiniGameResult(miniGameId, outcome) {
    console.log("[DifficultyService] result", { miniGameId, outcome });
  }

  window.DifficultyService = {
    getPlayerLevel,
    getQuestContext,
    reportMiniGameResult,
  };
})();