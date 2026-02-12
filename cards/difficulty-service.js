// difficulty-service.js
// Shared "what level is the player at" service.
// Mini-games are dumb: they just consume this.

(function () {
  "use strict";

  // 🔹 RIGHT NOW: we just mirror HERO_LEVEL 1–10-ish.
  // Later, you can swap this for per-quest, per-mode progression.
  function getPlayerLevel() {
    // Uses your existing HERO_LEVEL from battle-stats / main.js
    const levelFromHero = window.HERO_LEVEL || 1;
    return Math.max(1, Math.min(10, levelFromHero)); // clamp to 1–10
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
