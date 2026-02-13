(function () {
  "use strict";

  try {
    const raw = localStorage.getItem("MM_PLAYER_PROFILE");
    if (raw) window.PLAYER_PROFILE = JSON.parse(raw);
  } catch (e) {}
  window.PLAYER_PROFILE = window.PLAYER_PROFILE || {};

  function savePlayerProfile() {
    try {
      localStorage.setItem("MM_PLAYER_PROFILE", JSON.stringify(window.PLAYER_PROFILE || {}));
    } catch (e) {}
  }
  
  function awardWinProgress() {
    window.PLAYER_PROFILE = window.PLAYER_PROFILE || {};
    const cur = Number(window.PLAYER_PROFILE.heroLevel || 1);
    window.PLAYER_PROFILE.heroLevel = cur + 1;
    savePlayerProfile();
  }

  window.HERO_LEVEL = Number(window.PLAYER_PROFILE?.heroLevel || 1);

  // ---------------------------------------------------------------------
  // Set Viewport
  // ---------------------------------------------------------------------

  function setViewportHeight() {
    document.documentElement.style.setProperty(
      "--vh",
      `${window.innerHeight * 0.01}px`
    );
  }

  window.addEventListener("resize", setViewportHeight);
  window.addEventListener("orientationchange", setViewportHeight);
  setViewportHeight();

  // ---------------------------------------------------------------------
  // Simple timing helper (used by map → game handoff)
  // ---------------------------------------------------------------------
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------
  // Set Areas
  // ---------------------------------------------------------------------

  function setEquationAreaMode(mode) {
    const gridArea = document.getElementById("grid-area");
    const combatRow = document.getElementById("combat-row");
    const handArea = document.querySelector(".hand-area");
  
    if (!gridArea || !combatRow || !handArea) return;
  
    if (mode === "equation-cards") {
      gridArea.classList.remove("is-hidden");
      combatRow.classList.add("is-hidden");
      handArea.classList.add("is-hidden");
      return;
    }
  
    // mode === "monster-battle" (default)
    gridArea.classList.add("is-hidden");
    combatRow.classList.remove("is-hidden");
    handArea.classList.remove("is-hidden");
  }
  

  // ---------------------------------------------------------------------
  // Quest state (shared across quest screen / map / battle)
  // ---------------------------------------------------------------------
  let CURRENT_QUEST_ID = window.CURRENT_QUEST_ID || "quest_1";
  window.CURRENT_QUEST_ID = CURRENT_QUEST_ID;

  // ---------------------------------------------------------------------
  // Map grid layout (tight, deterministic)
  // ---------------------------------------------------------------------
  const gameRoot = document.getElementById("game-root");
  // ✅ Ensure a bg overlay exists (used for stage-game dimming)
(function ensureGameOverlay() {
  if (!gameRoot) return;
  if (gameRoot.querySelector(".game-bg-overlay")) return;
  const ov = document.createElement("div");
  ov.className = "game-bg-overlay";
  gameRoot.appendChild(ov);
})();
  const mapScreenEl = document.getElementById("map-screen");
  const mapNodes = document.querySelectorAll(".map-node");

  /* NEW: cache HUD elements inside the map screen */
  const mapHudEl = mapScreenEl
    ? mapScreenEl.querySelector(".map-hud")
    : null;
  const mapHudCardEl = mapHudEl
    ? mapHudEl.querySelector(".map-hud-card")
    : null;

  const TOTAL_NODES = 6;
  let activeNodeIndex = 0; // 0 = bottom node

  // You can keep your existing setStage if it's already defined above;
  // this version matches what you've been using.
  function setStage(stage) {
    // stage: "intro", "game", or "result"
    gameRoot.classList.remove("stage-intro", "stage-game", "stage-result");
    gameRoot.classList.add(`stage-${stage}`);
  }

  function layoutMapNodes() {
    mapNodes.forEach((node) => {
      const idx = Number(node.dataset.nodeIndex);
      const layout = NODE_LAYOUT[idx];
      if (!layout) return;

      const x = GRID.colX[layout.col];
      const y = GRID.rowY[layout.row];

      const offsetX = layout.offsetX ?? 0;
      const offsetY = layout.offsetY ?? 0;

      node.style.left = `calc(${x}% + ${offsetX}px)`;
      node.style.top = `calc(${y}% + ${offsetY}px)`;
    });
  }

  function showMap() {
    if (mapScreenEl) {
      const quests = window.QUESTS || {};
      const quest = quests[CURRENT_QUEST_ID] || quests["quest_1"];
  
      // Force map layer above game layer
      mapScreenEl.style.zIndex = "30";
  
      const url = quest?.mapBackground;
  
      if (url) {
        // Verify the image actually loads (prevents battle bg showing through on 404)
        const img = new Image();
        img.onload = () => {
          mapScreenEl.style.backgroundImage = `url("${url}")`;
        };
        img.onerror = () => {
          console.warn("[Map] mapBackground failed to load:", url);
          // Visible fallback so you don't see battle bg underneath
          mapScreenEl.style.backgroundImage = "none";
          mapScreenEl.style.backgroundColor = "#000";
        };
        img.src = url;
      } else {
        console.warn("[Map] Missing quest.mapBackground for:", CURRENT_QUEST_ID);
        mapScreenEl.style.backgroundImage = "none";
        mapScreenEl.style.backgroundColor = "#000";
      }
  
      mapScreenEl.classList.remove("map-screen--hidden");
    }
  
    if (gameRoot) {
      gameRoot.classList.remove("game--visible");
    }
  
    updateMapHud();
    layoutMapNodes();
    updateMapNodes();
    animateMapNodesIn();
  }

  function showGame() {
    // Hide map
    if (mapScreenEl) {
      mapScreenEl.classList.add("map-screen--hidden");
    }
  
    // Show game root
    if (gameRoot) {
      gameRoot.classList.add("game--visible");
    }
  }  

  function updateMapHud() {
    const heroImg = document.getElementById("map-hero-image");
    const heroName = document.getElementById("map-hero-name");
    const heroLevel = document.getElementById("map-hero-level");
  
    if (!heroImg || !heroName || !heroLevel) return;
  
    // If globals aren't ready, bail out quietly
    if (!window.QUESTS || !window.CURRENT_QUEST_ID || !window.HEROES) {
      return;
    }
  
    const quest =
      window.QUESTS[window.CURRENT_QUEST_ID] || window.QUESTS["quest_1"];
    if (!quest || !quest.heroId) return;
  
    const hero = window.HEROES[quest.heroId];
    if (!hero) return;
  
    heroImg.src = hero.portrait;
    heroName.textContent = hero.displayName;
  
    const level =
      (window.PLAYER_PROFILE && window.PLAYER_PROFILE.heroLevel) ||
      hero.baseLevel;
    heroLevel.textContent = `Level ${level}`;
  }
  

  const GRID = {
    columns: 3,
    rows: 6,

    // Percent-based so it scales with screen size
    colX: [25, 50, 75], // left / center / right
    // tighter spacing, same bottom start
    rowY: [88, 76, 64, 51, 39, 26],
  };

  // Node → grid placement
  // index: { col, row, offsetX?, offsetY? }
  const NODE_LAYOUT = {
    0: { col: 2, row: 0 }, // bottom center on path
    1: { col: 1, row: 1 }, // just left of path
    2: { col: 0, row: 2 }, // back to center (by river)
    3: { col: 1, row: 3 }, // left hillside
    4: { col: 2, row: 4 }, // center valley below castle
    5: { col: 1, row: 5 }, // right under castle
  };

  // Node → type (bottom → top)
  const NODE_TYPES = [
    "battle", // 0 (bottom)
    "battle", // 1
    "chest", // 2
    "battle", // 3
    "battle", // 4
    "boss", // 5 (top / castle)
  ];

  const NODE_SPRITES_FALLBACK = {
    battle: "images/quests/quest_1/node/battle.png",
    chest: "images/quests/quest_1/node/chest.png",
    boss: "images/quests/quest_1/node/boss.png",
    lock: "images/quests/quest_1/node/lock.png",
    check: "images/quests/quest_1/node/check.png",
  };

  function getNodeSpritesForCurrentQuest() {
    const quests = window.QUESTS || {};
    const quest =
      quests[CURRENT_QUEST_ID] ||
      quests["quest_1"];
  
    return (quest && quest.nodeSprites) || NODE_SPRITES_FALLBACK;
  }  

  function updateMapNodes() {
    const sprites = getNodeSpritesForCurrentQuest();

    mapNodes.forEach((node) => {
      const idx = Number(node.dataset.nodeIndex);
      const type = NODE_TYPES[idx] ?? "battle";

      node.classList.remove(
        "map-node--active",
        "map-node--locked",
        "map-node--completed",
        "map-node--bw",
        "map-node--shimmer"
      );

      if (idx < activeNodeIndex) {
        node.classList.add("map-node--completed");
        node.disabled = true;
        node.style.backgroundImage = `url("${sprites.check}")`;
        return;
      }

      if (idx === activeNodeIndex) {
        node.classList.add("map-node--active");
        node.disabled = false;
        node.style.backgroundImage = `url("${sprites[type]}")`;
        return;
      }

      node.disabled = true;

      if (type === "chest" || type === "boss") {
        node.classList.add("map-node--bw");
        node.style.backgroundImage = `url("${sprites[type]}")`;
        return;
      }

      node.classList.add("map-node--locked");
      node.style.backgroundImage = `url("${sprites.lock}")`;
    });
  }

  // Spring nodes in from bottom to top
  function animateMapNodesIn() {
    if (!mapScreenEl) return;

    const INITIAL_PAUSE_MS = 500;
    const STAGGER_MS = 200;
    const NODE_SPRING_MS = 600;
    const SHIMMER_DELAY_MS = 20;

    // Reset previous node animations
    mapNodes.forEach((node) => {
      node.classList.remove("map-node--spawn", "map-node--shimmer");
      node.style.animationDelay = "";
    });

    // Reset HUD state so it can re-animate each time we show the map
    if (mapHudEl) {
      mapHudEl.classList.remove("map-hud--visible");
    }
    if (mapHudCardEl) {
      mapHudCardEl.classList.remove("map-hud--animate");
      // force reflow so the quest-card-post animation can restart
      void mapHudCardEl.offsetWidth;
    }

    // Force reflow to restart node animations
    void mapScreenEl.offsetWidth;

    // Bottom → top cascade
    mapNodes.forEach((node, index) => {
      const delayMs = INITIAL_PAUSE_MS + index * STAGGER_MS;
      node.style.animationDelay = `${delayMs}ms`;
      node.classList.add("map-node--spawn");
    });

    // When the LAST node is fully settled...
    const lastNodeFinishMs =
      INITIAL_PAUSE_MS +
      (mapNodes.length - 1) * STAGGER_MS +
      NODE_SPRING_MS +
      SHIMMER_DELAY_MS;

    // Enable shimmer only after everything is done
    setTimeout(() => {
      const activeNode = document.querySelector(".map-node--active");
      if (activeNode) {
        activeNode.classList.add("map-node--shimmer");
      }
    }, lastNodeFinishMs);

    // HUD: show + animate right after the last node finishes
    const HUD_DELAY_AFTER_NODES_MS = 150; // small beat after nodes
    setTimeout(() => {
      if (!mapHudEl || !mapHudCardEl) return;

      // Make HUD visible on the map
      mapHudEl.classList.add("map-hud--visible");

      // Kick off quest-card-style animation on the card
      mapHudCardEl.classList.add("map-hud--animate");
    }, lastNodeFinishMs + HUD_DELAY_AFTER_NODES_MS);
  }

  async function handleMapNodeClick(idx) {
    if (idx !== activeNodeIndex) return;
  
    await delay(150);
  
    showGame();
    setStage("intro");
  
    await delay(250);
  
    const nodeType = NODE_TYPES[idx] || "battle";
  
    if (typeof window.runGameMode !== "function") {
      console.error("runGameMode is not defined or not loaded");
      return;
    }

    // ✅ Always start the battle wrapper
    setEquationAreaMode("monster-battle");

    window.runGameMode("monster-battle", {
      config: {
        questId: window.CURRENT_QUEST_ID,
        nodeIndex: idx,
        nodeType, // battle | chest | boss
      },
      onComplete(result) {
        if (result === "win") {
          awardWinProgress();           // ✅ level up + save
          advanceToNextNodeIfAvailable();
        }
        showMap();
        setStage("intro");
      },
    });

  }  

  // Attach listeners once DOM is ready
  mapNodes.forEach((node) => {
    const idx = Number(node.dataset.nodeIndex);
    node.addEventListener("click", () => handleMapNodeClick(idx));
  });

  // After a full win, move to the next node (if any)
  function advanceToNextNodeIfAvailable() {
    if (activeNodeIndex < TOTAL_NODES - 1) {
      activeNodeIndex += 1;
    }
  }

  // --- Init ----------------------------------------------------------------
  function init() {
    // No battle init here anymore; battle module will handle its own bootstrap.

    const questScreenEl = document.getElementById("quest-screen");

    function showQuest() {
      if (questScreenEl) {
        questScreenEl.classList.remove("quest-screen--hidden");
      }
    }

    function hideQuest() {
      if (questScreenEl) {
        questScreenEl.classList.add("quest-screen--hidden");
      }
    }

    const questListEl = document.getElementById("quest-list");

    if (questListEl) {
      questListEl.innerHTML = "";

      const quests = window.QUESTS || {};
      Object.values(quests).forEach((quest) => {
        const btn = document.createElement("button");
        btn.className = "quest-card";
        btn.dataset.questId = quest.id;

        btn.innerHTML = `
          <div class="quest-card-inner">
            <div class="quest-card-left">
              <h2 class="quest-card-title">${quest.title}</h2>
              <div class="quest-card-pill">${quest.mathTypeLabel}</div>
            </div>
            <div class="quest-card-right">
              <img
                class="quest-card-hero"
                src="${quest.heroCardImage}"
                alt="${quest.title}"
              />
            </div>
          </div>
        `;

        questListEl.appendChild(btn);
      });
    }

    // --------- Startup flow ---------
    document.querySelectorAll(".quest-card").forEach((card) => {
      card.addEventListener("click", () => {
        const questId = card.dataset.questId || "quest_1";

        // Set current quest (local + global)
        CURRENT_QUEST_ID = questId;
        window.CURRENT_QUEST_ID = questId;

        // Hide quest screen
        hideQuest();

        // Enter quest normally
        showMap();
        setStage("intro");
      });
    });

    // If you ever want to auto-show quest:
    showQuest();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

window.addEventListener("load", () => {
  setTimeout(() => {
    // Call again on load to be extra safe on mobile
    const evt = new Event("resize");
    window.dispatchEvent(evt);
  }, 100);
});

window.addEventListener("load", () => {
  setTimeout(() => {
    window.scrollTo(0, 1);
  }, 50);
});
