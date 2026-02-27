// games/hero-evolution/index.js
(function () {
  "use strict";

  const STORAGE_KEY = "PLAYER_PROFILE";

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile || {}));
    } catch (e) {}
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function inferHeroSpriteTo(src) {
    // tries: hero_1.png -> hero_2.png, etc.
    const m = String(src || "").match(/hero_(\d+)\.png(\?.*)?$/i);
    if (!m) return src;
    const cur = Number(m[1] || 1) || 1;
    const next = cur + 1;
    return String(src).replace(/hero_(\d+)\.png(\?.*)?$/i, `hero_${next}.png$2`);
  }

  window.GameRegistry?.register("hero-evolution", function createHeroEvolutionGame(
    { context, config } = {}
  ) {
    const gameRoot = document.getElementById("game-root");
    const cinematic = document.getElementById("cinematic");

    const heroImg = document.getElementById("cinematic-hero");
    const monsterImg = document.getElementById("cinematic-monster");
    const vsImg = document.getElementById("cinematic-vs");

    const heroPanel = document.querySelector(".stat-panel--hero");
    const monsterPanel = document.querySelector(".stat-panel--monster");

    const equationArea = document.querySelector("#game-root .equation-area");
    const handArea = document.querySelector("#game-root .hand-area");

    function setStage(stage) {
      if (!gameRoot) return;
      gameRoot.classList.remove("stage-intro", "stage-game", "stage-result");
      gameRoot.classList.add(`stage-${stage}`);
    }

    function setCinematicEvolutionLayout(on) {
      if (!cinematic) return;
      cinematic.classList.toggle("cinematic--evolution", !!on);

      // Hide battle-only bits
      if (monsterImg) monsterImg.style.display = on ? "none" : "";
      if (vsImg) vsImg.style.display = on ? "none" : "";
      if (monsterPanel) monsterPanel.style.display = on ? "none" : "";

      // Optional: hide hero stats panel so it’s just the sprite
      if (heroPanel) heroPanel.style.display = on ? "none" : "";

      // Hide puzzle UI while evolving
      if (equationArea) equationArea.classList.toggle("is-hidden", !!on);
      if (handArea) handArea.classList.toggle("is-hidden", !!on);
    }

    async function pulse3(imgEl) {
      if (!imgEl) return;

      // 1 pulse = scale up/down
      // 3 pulses total (iterations: 3)
      const anim = imgEl.animate(
        [
          { transform: "scale(1)", filter: "brightness(1)" },
          { transform: "scale(1.08)", filter: "brightness(1.2)" },
          { transform: "scale(1)", filter: "brightness(1)" },
        ],
        {
          duration: 450,
          iterations: 3,
          easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
        }
      );

      try {
        await anim.finished;
      } catch (e) {
        // ignore
      }
    }

    function levelUpHero() {
      const prof = loadProfile();
      const current =
        Number(prof.heroLevel || window.PLAYER_PROFILE?.heroLevel || window.HERO_LEVEL || 1) || 1;
      const next = clamp(current + 1, 1, 10);

      prof.heroLevel = next;
      window.PLAYER_PROFILE = Object.assign({}, window.PLAYER_PROFILE || {}, prof);
      window.HERO_LEVEL = next;

      saveProfile(prof);
      return { from: current, to: next };
    }

    return {
      async start() {
        // Expect main.js already called showGame(); we just set the look.
        setStage("intro");
        setCinematicEvolutionLayout(true);

        // Set hero sprite "from"
        const quests = window.QUESTS || {};
        const qid = config?.questId || window.CURRENT_QUEST_ID || "quest_1";
        const quest = quests[qid] || quests["quest_1"] || {};
        const heroFrom =
          config?.heroSpriteFrom ||
          quest?.heroCardImage ||
          heroImg?.getAttribute("src") ||
          "";

        if (heroImg) heroImg.src = heroFrom;

        // Pulse 3 times…
        await delay(200);
        await pulse3(heroImg);

        // Level up + swap sprite to “to”
        const lv = levelUpHero();

        const heroTo =
          config?.heroSpriteTo ||
          inferHeroSpriteTo(heroFrom);

        if (heroImg && heroTo) heroImg.src = heroTo;

        // Small “settle” beat then pause 2000ms
        await delay(150);
        await delay(2000);

        // Restore layout (so battle UI isn’t permanently hidden)
        setCinematicEvolutionLayout(false);

        return { outcome: "evolved", heroLevelFrom: lv.from, heroLevelTo: lv.to };
      },
    };
  });
})();