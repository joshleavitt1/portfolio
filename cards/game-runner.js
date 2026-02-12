// game-runner.js
(function () {
  "use strict";

  function loadPlayerProfile() {
    try {
      const raw = localStorage.getItem("MM_PLAYER_PROFILE");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }
  
  function savePlayerProfile(profile) {
    try {
      localStorage.setItem("MM_PLAYER_PROFILE", JSON.stringify(profile || {}));
    } catch (e) {}
  }
  
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  
  function applyEquationCardsLevelProgress(result) {
    // result: { outcome: "win"|"lose", mistakes: number, ... }
    const prof = loadPlayerProfile();
    const current = Number(prof.heroLevel || window.PLAYER_PROFILE?.heroLevel || 1) || 1;
  
    let next = current;
  
    if (result && result.outcome === "win") {
      next = current + 1;
    } else if (result && result.outcome === "lose") {
      // your lose condition IS "2 mistakes" from equation-cards
      next = current - 1;
    }
  
    next = clamp(next, 1, 10);
  
    prof.heroLevel = next;
    window.PLAYER_PROFILE = Object.assign({}, window.PLAYER_PROFILE || {}, prof);
  
    savePlayerProfile(prof);
  }

  function normalizeRunConfig(questContext, config) {
    // Merge: caller config wins, but questContext fills gaps
    const cfg = Object.assign({}, questContext || {}, config || {});

    // ---- Normalize quest id ----
    if (cfg.questId == null && cfg.quest && cfg.quest.id != null) {
      cfg.questId = cfg.quest.id;
    }
    if (!cfg.quest) cfg.quest = {};
    if (cfg.quest.id == null && cfg.questId != null) {
      cfg.quest.id = cfg.questId;
    }

    // ---- Normalize level ----
    // allow any of: playerLevel, level, player.level
    const inferredLevel =
      cfg.playerLevel ??
      cfg.level ??
      (cfg.player && cfg.player.level) ??
      1;

    cfg.playerLevel = inferredLevel;
    cfg.level = inferredLevel;

    if (!cfg.player) cfg.player = {};
    if (cfg.player.level == null) cfg.player.level = inferredLevel;

    return cfg;
  }

  async function runGameMode(gameId, { config = {}, onComplete } = {}) {
    const gameFactory = window.GameRegistry?.get(gameId);

    if (!gameFactory) {
      console.error("[GameRunner] Game not found:", gameId);
      return;
    }

    const questContext = window.DifficultyService?.getQuestContext?.() || {};

    // ✅ NEW: normalized config that all games can rely on
    const normalizedConfig = normalizeRunConfig(questContext, config);

    console.log("[GameRunner] Starting:", gameId, normalizedConfig);

    try {
      const gameInstance = gameFactory({
        context: questContext,
        config: normalizedConfig,
      });

      const result = await gameInstance.start();

      // ✅ Persist hero level based on equation-cards result
if (gameId === "equation-cards" && result && (result.outcome === "win" || result.outcome === "lose")) {
  applyEquationCardsLevelProgress(result);
}

      if (window.DifficultyService?.reportMiniGameResult) {
        window.DifficultyService.reportMiniGameResult(gameId, result);
      }

      if (typeof onComplete === "function") {
        onComplete(result);
      }
    } catch (err) {
      console.error("[GameRunner] Game crashed:", err);
    }
  }

  window.runGameMode = runGameMode;
})();
