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
    const m = String(src || "").match(/hero_(\d+)\.png(\?.*)?$/i);
    if (!m) return src;
    const cur = Number(m[1] || 1) || 1;
    const next = cur + 1;
    return String(src).replace(/hero_(\d+)\.png(\?.*)?$/i, `hero_${next}.png$2`);
  }

  window.GameRegistry?.register("hero-evolution", function createHeroEvolutionGame(
    { context, config } = {}
  ) {
    const gameRoot  = document.getElementById("game-root");
    const cinematic = document.getElementById("cinematic");

    const heroImg    = document.getElementById("cinematic-hero");
    const monsterImg = document.getElementById("cinematic-monster");
    const vsImg      = document.getElementById("cinematic-vs");

    const heroPanel    = document.querySelector(".stat-panel--hero");
    const monsterPanel = document.querySelector(".stat-panel--monster");

    const equationArea = document.querySelector("#game-root .equation-area");
    const handArea     = document.querySelector("#game-root .hand-area");

    const heroChar   = document.querySelector(".cinematic-character--hero");
    const BASE_SCALE = 1.15; // evolution hero is a bit larger

    function setStage(stage) {
      if (!gameRoot) return;
      gameRoot.classList.remove("stage-intro", "stage-game", "stage-result");
      gameRoot.classList.add(`stage-${stage}`);
    }

    function setCinematicEvolutionLayout(on) {
      if (!cinematic) return;
      const isOn = !!on;

      cinematic.classList.toggle("cinematic--evolution", isOn);

      if (monsterImg)   monsterImg.style.display   = isOn ? "none" : "";
      if (vsImg)        vsImg.style.display        = isOn ? "none" : "";
      if (monsterPanel) monsterPanel.style.display = isOn ? "none" : "";
      if (heroPanel)    heroPanel.style.display    = isOn ? "none" : "";

      if (equationArea) equationArea.classList.toggle("is-hidden", isOn);
      if (handArea)     handArea.classList.toggle("is-hidden", isOn);

      // ❌ no shadow toggle here anymore – handled in start()
    }

        // -------------------------------------------------------------------
    // 3 identical pulses (grow then shrink) using Web Animations
    // -------------------------------------------------------------------
    async function pulse3(imgEl) {
      if (!imgEl) return;

      const duration  = 1600;  // one pulse
      const iterations = 3;
      const SCALE_BASE = BASE_SCALE;
      const SCALE_UP   = BASE_SCALE * 1.2;
      const easing     = "cubic-bezier(0.25, 0.9, 0.25, 1)";

      // Make sure we start clean
      imgEl.style.transform = `scale(${SCALE_BASE})`;
      imgEl.style.filter    = "brightness(1)";

      const anim = imgEl.animate(
        [
          {
            offset: 0,
            transform: `scale(${SCALE_BASE})`,
            filter: "brightness(1)",
          },
          {
            offset: 0.5,
            transform: `scale(${SCALE_UP})`,
            filter: "brightness(1.25)",
          },
          {
            offset: 1,
            transform: `scale(${SCALE_BASE})`,
            filter: "brightness(1)",
          },
        ],
        {
          duration,
          iterations,
          easing,
          fill: "none",
        }
      );

      try {
        await anim.finished;
      } catch (e) {}

      // Hard reset so flash starts from base
      imgEl.style.transform = `scale(${SCALE_BASE})`;
      imgEl.style.filter    = "brightness(1)";
    }

    // -------------------------------------------------------------------
    // Progression: level up + mark evolved so battle uses hero_2
    // -------------------------------------------------------------------
    function levelUpHero() {
      const prof = loadProfile();
      const current =
        Number(
          prof.heroLevel ||
            window.PLAYER_PROFILE?.heroLevel ||
            window.HERO_LEVEL ||
            1
        ) || 1;

      const next = Math.max(1, Math.min(current + 1, 10));

      // bump level + mark evolved once we leave level 1
      prof.heroLevel  = next;
      if (next > 1) {
        prof.heroEvolved = true;
      }

      const merged = Object.assign({}, window.PLAYER_PROFILE || {}, prof);

      window.PLAYER_PROFILE = merged;
      window.HERO_LEVEL     = next;

      saveProfile(merged);

      return { from: current, to: next };
    }

    return {
      async start() {
        // Default in case something throws
        let levelDelta = {
          from: Number(window.HERO_LEVEL || 1) || 1,
          to:   Number(window.HERO_LEVEL || 1) || 1,
        };

        try {
          // ------------------------------------------------------------
          // 0) Setup evolution stage
          // ------------------------------------------------------------
          setStage("intro");

              // ✅ ADD THIS BLOCK HERE
          if (gameRoot) {
            gameRoot.style.setProperty(
              "--battle-bg-image",
              'url("../../images/games/monster-battle/quest_1/bg/bg_battle.png")'
            );
          }

          setCinematicEvolutionLayout(true);

          const quests = window.QUESTS || {};
          const qid    = config?.questId || window.CURRENT_QUEST_ID || "quest_1";
          const quest  = quests[qid] || quests["quest_1"] || {};

          // ------------------------------------------------------------
          // 1) Old form (before evolution)
          // ------------------------------------------------------------
          const heroFrom =
            config?.heroSpriteFrom ||
            quest?.heroCardImage ||
            heroImg?.getAttribute("src") ||
            "";

            if (heroImg && heroFrom) {
              heroImg.src           = heroFrom;
              heroImg.style.opacity = "0";
              heroImg.style.transform = `scale(${BASE_SCALE})`;
            }
  
            // Turn ON the ground shadow and let its CSS transition fade in
            if (heroChar) {
              heroChar.classList.add("cinematic-character--shadow-visible");
            }
  
            // 2) Fade hero in (match fade-out feel)
            let introAnim = null;
            if (heroImg) {
              // Start in the "pre-fade-out" state (slightly smaller & darker)
              heroImg.style.opacity = "0";
              heroImg.style.transform = `scale(${BASE_SCALE * 0.95})`;
              heroImg.style.filter = "brightness(0.8)";

              introAnim = heroImg.animate(
                [
                  {
                    opacity: 0,
                    transform: `scale(${BASE_SCALE * 0.95})`,
                    filter: "brightness(0.8)",
                  },
                  {
                    opacity: 1,
                    transform: `scale(${BASE_SCALE})`,
                    filter: "brightness(1)",
                  },
                ],
                {
                  duration: 450,          // 🔁 match fade-out duration
                  easing: "ease-out",     // 🔁 match fade-out easing
                  fill: "forwards",
                }
              );
            }

          try {
            if (introAnim) await introAnim.finished;
          } catch (e) {}

          await delay(150);

          // ------------------------------------------------------------
          // 2) Three uniform pulses (OLD sprite)
          // ------------------------------------------------------------
          if (heroImg) {
            await pulse3(heroImg);
          }

          // ------------------------------------------------------------
          // 3) Level up hero + figure out new sprite
          // ------------------------------------------------------------
          levelDelta = levelUpHero();

          const heroTo =
            config?.heroSpriteTo ||
            inferHeroSpriteTo(heroFrom);

          // ------------------------------------------------------------
          // 4) Flash reveal of NEW sprite
          // ------------------------------------------------------------
          if (heroImg && heroTo) {
            heroImg.style.opacity   = "0";
            heroImg.style.transform = `scale(${BASE_SCALE})`;
            heroImg.src             = heroTo;

            const flashAnim = heroImg.animate(
              [
                {
                  opacity: 0,
                  transform: `scale(${BASE_SCALE * 0.9})`,
                  filter:
                    "brightness(1)",
                },
                {
                  opacity: 1,
                  transform: `scale(${BASE_SCALE * 1.3})`,
                  filter:
                  "brightness(1.25)",
                },
                {
                  opacity: 1,
                  transform: `scale(${BASE_SCALE})`,
                  filter:
                  "brightness(1)",
                },
              ],
              {
                duration: 650,
                easing: "cubic-bezier(0.25, 1, 0.3, 1)",
                fill: "forwards",
              }
            );

            try {
              await flashAnim.finished;
            } catch (e) {}
          }

          // Let kids admire the new form
          await delay(3200);

        // ------------------------------------------------------------
        // 5) Fade hero out (shadow fades with it)
        // ------------------------------------------------------------
        if (heroChar) {
          // This kicks the 200ms CSS opacity transition on the shadow
          heroChar.classList.remove("cinematic-character--shadow-visible");
        }

        let fadeAnim = null;
        if (heroImg) {
          fadeAnim = heroImg.animate(
            [
              {
                opacity: 1,
                transform: `scale(${BASE_SCALE})`,
                filter:
                  "brightness(1)",
              },
              {
                opacity: 0,
                transform: `scale(${BASE_SCALE * 0.95})`,
                filter:
                "brightness(0.8)",
              },
            ],
            {
              duration: 450,
              easing: "ease-out",
              fill: "forwards",
            }
          );
        }

          try {
            if (fadeAnim) await fadeAnim.finished;
          } catch (e) {}
        } finally {
          // ------------------------------------------------------------
          // 6) Restore layout & clean styles so NEXT BATTLE works
          // ------------------------------------------------------------

          // 6a) Kill ANY Web Animations on the hero image.
          //     This removes the evolution fade-out "fill: forwards"
          //     that was pinning opacity at 0.
          if (heroImg && typeof heroImg.getAnimations === "function") {
            try {
              heroImg.getAnimations().forEach((anim) => {
                try {
                  anim.cancel();
                } catch (e) {
                  // swallow, just being defensive
                }
              });
            } catch (e) {
              // older browsers might not support getAnimations; ignore
            }
          }

          // make absolutely sure the shadow is invisible before we snap
          if (heroChar) {
            heroChar.classList.remove("cinematic-character--shadow-visible");
          }

          // Put the layout back into normal battle mode
          setCinematicEvolutionLayout(false);

          // Reset hero inline styles so battle can fully control it
          if (heroImg) {
            heroImg.style.opacity   = "";
            heroImg.style.transform = "";
            heroImg.style.filter    = "";
            heroImg.style.display   = "";
          }
        }

        return {
          outcome: "evolved",
          heroLevelFrom: levelDelta.from,
          heroLevelTo: levelDelta.to,
        };
      },
    };
  });
})();