// difficulty-service.js
// Shared "what level is the player at" service.
// Mini-games are dumb: they just consume this.

(function () {
  "use strict";

  // 🔹 RIGHT NOW: we just mirror HERO_LEVEL 1–10-ish.
  // Later, you can swap this for per-quest, per-mode progression.
// difficulty-service.js
(function () {
  "use strict";

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // 🔹 RIGHT NOW: mirror heroLevel 1–10-ish (profile first).
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
    const questDef = (window.QUESTS && window.QUESTS[questId]) || {};

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

  // Mini-games can call this after a round
  function reportMiniGameResult(miniGameId, outcome) {
    // outcome: "win" | "lose" | { score, ... }
    // For now, we do nothing. Later, you can:
    // - bump hero level
    // - track XP
    // - write to Supabase
    // Keeping the surface now lets you grow later.
    console.log("[DifficultyService] result", { miniGameId, outcome });
  }

  window.DifficultyService = {
    getPlayerLevel,
    getQuestContext,
    reportMiniGameResult,
  };
})();
