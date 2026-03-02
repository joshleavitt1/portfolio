// difficulty-service.js
// Per-track difficulty service (addition, subtraction, multiplication, division)

(function () {
  "use strict";

  const TRACK_KEYS = ["addition", "subtraction", "multiplication", "division"];

  // ------------------------------------------------------------
  // Profile load/save
  // ------------------------------------------------------------
  function loadProfile() {
    try {
      const raw = localStorage.getItem("PLAYER_PROFILE");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem("PLAYER_PROFILE", JSON.stringify(profile || {}));
    } catch (e) {}
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // ------------------------------------------------------------
  // Ensure categoryLevels exists
  // ------------------------------------------------------------
  function ensureCategoryLevels(profile) {
    if (!profile.categoryLevels) {
      // Seed from old heroLevel if present
      let fallback =
        Number(profile.heroLevel) ||
        Number(window.HERO_LEVEL) ||
        1;

      if (!Number.isFinite(fallback)) fallback = 1;
      fallback = clamp(fallback, 1, 10);

      profile.categoryLevels = {
        addition: fallback,
        subtraction: 1,
        multiplication: 1,
        division: 1,
      };
    } else {
      TRACK_KEYS.forEach((key) => {
        if (!Number.isFinite(Number(profile.categoryLevels[key]))) {
          profile.categoryLevels[key] = 1;
        }
      });
    }
  }

  // ------------------------------------------------------------
  // Get / Set per-track level
  // ------------------------------------------------------------
  function getCategoryLevel(mathTypeKey) {
    const profile = loadProfile();
    ensureCategoryLevels(profile);

    const key = TRACK_KEYS.includes(mathTypeKey)
      ? mathTypeKey
      : "addition";

    const raw = Number(profile.categoryLevels[key]);
    const lvl = Number.isFinite(raw) ? raw : 1;

    return clamp(lvl, 1, 10);
  }

  function setCategoryLevel(mathTypeKey, newLevel) {
    const profile = loadProfile();
    ensureCategoryLevels(profile);

    const key = TRACK_KEYS.includes(mathTypeKey)
      ? mathTypeKey
      : "addition";

    profile.categoryLevels[key] = clamp(Number(newLevel) || 1, 1, 10);

    saveProfile(profile);
  }

  // ------------------------------------------------------------
  // Quest context
  // ------------------------------------------------------------
  function getQuestContext() {
    const quests = window.QUESTS || {};

    let questId = window.CURRENT_QUEST_ID;
    if (!questId) {
      const keys = Object.keys(quests);
      questId = keys.length ? keys[0] : "quest_1";
    }

    const questDef = quests[questId] || {};
    const mathTypeKey = questDef.mathTypeKey || "addition";

    const playerLevel = getCategoryLevel(mathTypeKey);

    return {
      questId,
      mathTypeKey,
      playerLevel,
    };
  }

  // ------------------------------------------------------------
  // Report mini-game results
  // ------------------------------------------------------------
  function reportMiniGameResult(miniGameId, outcome) {
    const raw =
      typeof outcome === "string"
        ? outcome
        : outcome && outcome.outcome;

    const normalized =
      raw === "win" || raw === "loss" ? raw : null;

    if (!normalized) return;

    // Cinematic layers DO NOT affect difficulty
    if (miniGameId === "monster-battle" ||
        miniGameId === "hero-evolution") {
      return;
    }

    const ctx = getQuestContext();
    const mathTypeKey = ctx.mathTypeKey || "addition";

    const current = getCategoryLevel(mathTypeKey);

    let next = current;
    if (normalized === "win") {
      next = clamp(current + 1, 1, 10);
    } else if (normalized === "loss") {
      next = clamp(current - 1, 1, 10);
    }

    if (next !== current) {
      setCategoryLevel(mathTypeKey, next);
    }
  }

  // ------------------------------------------------------------
  // Backwards-compatible helper
  // ------------------------------------------------------------
  function getPlayerLevel(mathTypeKey) {
    if (!mathTypeKey) {
      const ctx = getQuestContext();
      mathTypeKey = ctx.mathTypeKey;
    }
    return getCategoryLevel(mathTypeKey || "addition");
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.DifficultyService = {
    getPlayerLevel,
    getQuestContext,
    reportMiniGameResult,
    getCategoryLevel,
    setCategoryLevel,
  };
})();