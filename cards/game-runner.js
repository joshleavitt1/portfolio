// game-runner.js
(function () {
  "use strict";

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
