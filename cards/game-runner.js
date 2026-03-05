// game-runner.js
(function () {
  "use strict";

  function loadPlayerProfile() {
    try {
      const raw = localStorage.getItem("PLAYER_PROFILE");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }
  
  function savePlayerProfile(profile) {
    try {
      localStorage.setItem("PLAYER_PROFILE", JSON.stringify(profile || {}));
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

    // ------------------------------------------------------------
  // URL Test Harness
  // Usage:
  //   index.html?game=number-blast
  //   index.html?game=number-blast&level=5
  //   index.html?game=monster-battle&questId=quest_1&nodeIndex=0
  // ------------------------------------------------------------
  async function bootGameFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("game");
    if (!gameId) return;

    // Hide the normal app layers for clean testing
    const questScreen = document.getElementById("quest-screen");
    const mapScreen = document.getElementById("map-screen");
    const gameRoot = document.getElementById("game-root");
    const mount = document.getElementById("game-mount");

    if (questScreen) questScreen.classList.add("quest-screen--hidden");
    if (mapScreen) mapScreen.classList.add("map-screen--hidden");

    if (gameRoot) {
      gameRoot.classList.remove("game-root--hard-hide");
      gameRoot.classList.add("game--visible");
      gameRoot.classList.remove("stage-intro", "stage-result");
      gameRoot.classList.add("stage-game");
    }

    if (mount) mount.classList.remove("is-hidden");

    // Read basic config from URL (extend anytime)
    const level = Number(params.get("level") || 1) || 1;
    const questId = params.get("questId") || (window.CURRENT_QUEST_ID || "quest_1");
    const nodeIndex = Number(params.get("nodeIndex") || 0) || 0;
    const nodeType = params.get("nodeType") || "battle";

    const configFromUrl = {
      level,
      playerLevel: level,
      questId,
      nodeIndex,
      nodeType,
    };

    // If game isn't registered yet, try to lazy-load it from /games/<id>/
    async function ensureGameRegistered(id) {
      const existing = window.GameRegistry?.get?.(id);
      if (existing) return true;

      // 1) CSS (optional; safe if missing)
      const cssHref = `games/${id}/styles.css`;
      if (!document.querySelector(`link[data-game-css="${id}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssHref;
        link.setAttribute("data-game-css", id);
        document.head.appendChild(link);
      }

      // 2) JS
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `games/${id}/index.js`;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load games/${id}/index.js`));
        document.body.appendChild(script);
      });

      return !!window.GameRegistry?.get?.(id);
    }

    try {
      const ok = await ensureGameRegistered(gameId);
      if (!ok) {
        console.error("[GameRunner] URL boot: game did not register:", gameId);
        return;
      }

      // Run it
      window.runGameMode(gameId, {
        config: configFromUrl,
        onComplete(res) {
          console.log("[URL Test] Result:", res);
          // keep the result visible in console (no auto-nav)
        },
      });
    } catch (err) {
      console.error("[GameRunner] URL boot failed:", err);
    }
  }

  // Boot after DOM is ready (safe either way)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGameFromQuery);
  } else {
    bootGameFromQuery();
  }

  window.runGameMode = runGameMode;
})();
