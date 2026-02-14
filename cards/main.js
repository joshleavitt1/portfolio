(function () {
  "use strict";

  try {
    const raw = localStorage.getItem("PLAYER_PROFILE");
    if (raw) window.PLAYER_PROFILE = JSON.parse(raw);
  } catch (e) {}
  window.PLAYER_PROFILE = window.PLAYER_PROFILE || {};

  function savePlayerProfile() {
    try {
      localStorage.setItem("PLAYER_PROFILE", JSON.stringify(window.PLAYER_PROFILE || {}));
    } catch (e) {}
  }
  
  function awardWinProgress() {
    window.PLAYER_PROFILE = window.PLAYER_PROFILE || {};
    const cur = Number(window.PLAYER_PROFILE.heroLevel || 1);
    const next = Math.min(cur + 1, 10);
    window.PLAYER_PROFILE.heroLevel = next;
    window.HERO_LEVEL = next; // ✅ keep global in sync
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
  // Orientation / device blocker (site-wide)
  // Shows the "Mobile Portrait Only" overlay everywhere, not just battle.
  // ---------------------------------------------------------------------
  const orientationOverlayEl = document.getElementById("orientation-overlay");

  function lockScreen() {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
  }

  function unlockScreen() {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
  }

  function updateOrientationOverlay() {
    if (!orientationOverlayEl) return;

    const isMobileWidth = window.innerWidth <= 900;
    const isPortrait =
      window.matchMedia("(orientation: portrait)").matches ||
      window.innerHeight > window.innerWidth;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Allowed: touch phone-ish, portrait
    const isAllowed = isMobileWidth && isTouch && isPortrait;

    if (!isAllowed) {
      orientationOverlayEl.classList.add("show");
      orientationOverlayEl.setAttribute("aria-hidden", "false");
      lockScreen();
    } else {
      orientationOverlayEl.classList.remove("show");
      orientationOverlayEl.setAttribute("aria-hidden", "true");
      unlockScreen();
    }
  }

  window.addEventListener("resize", updateOrientationOverlay);
  window.addEventListener("orientationchange", updateOrientationOverlay);
  updateOrientationOverlay();


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

  const TOTAL_NODES = 6;
// DEBUG: allow forcing the active node from URL
const urlNode = Number(new URLSearchParams(window.location.search).get("node"));
let activeNodeIndex = Number.isFinite(urlNode) ? urlNode : 0; // 0 = bottom node

  // You can keep your existing setStage if it's already defined above;
  // this version matches what you've been using.
  function setStage(stage) {
    // stage: "intro", "game", or "result"
    gameRoot.classList.remove("stage-intro", "stage-game", "stage-result");
    gameRoot.classList.add(`stage-${stage}`);
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

  
  // ---------------------------------------------------------------------
  // Map node layout (mobile-first, always centered)
  // ---------------------------------------------------------------------
  // Nodes are indexed bottom (0) → top (TOTAL_NODES-1)
  // We compute positions in PX from the actual container rect so it looks good
  // across all phone sizes/aspect ratios.
  function layoutMapNodes() {
    const container = document.getElementById("map-nodes");
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Match CSS: clamp(72px, 18vw, 96px) but compute here so spacing is correct.
    const nodeSize = Math.max(100, Math.min(140, rect.width * 0.18));
    const half = nodeSize / 2;

    // Even vertical spacing, and center the whole stack within the container.
    const usableH = Math.max(0, rect.height - nodeSize);
    const step = TOTAL_NODES > 1 ? usableH / (TOTAL_NODES - 1) : 0;

    // Zig-zag around the center, but keep the whole group centered horizontally.
    // Boss (top) stays centered.
    const xOffsets = [0.22, 0.0, -0.22, 0.0, 0.22, 0.0];
    const centerX = rect.width / 2;

    mapNodes.forEach((node) => {
      const idx = Number(node.dataset.nodeIndex);

      // y=0 is top. We want idx=0 near bottom, idx increases upward.
      const yFromTop = rect.height - (half + idx * step);
      const xFromLeft = centerX + (xOffsets[idx] || 0) * rect.width;

      node.style.width = `${nodeSize}px`;
      node.style.height = `${nodeSize}px`;
      node.style.left = `${xFromLeft}px`;
      node.style.top = `${yFromTop}px`;
    });
  }

  // Node → type (bottom → top)
  // 1 battle, 2 battle, 3 treasure, 4 battle, 5 battle, 6 boss
  const NODE_TYPES = [
    "battle",   // 0 (node 1)
    "battle",   // 1 (node 2)
    "chest", // 2 (node 3)
    "battle",   // 3 (node 4)
    "battle",   // 4 (node 5)
    "boss",     // 5 (node 6)
  ];


  const NODE_SPRITES_FALLBACK = {
    battle: "images/quests/quest_1/node/battle.png",
    boss: "images/quests/quest_1/node/boss.png",
    lock: "images/quests/quest_1/node/lock.png",
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

      node.classList.remove("map-node--active", "map-node--shimmer");

      // ✅ Only the active node is clickable. Everything else is a FULL-COLOR lock.
      if (idx === activeNodeIndex) {
        node.disabled = false;
        node.classList.add("map-node--active");
        node.style.backgroundImage = `url("${sprites[type]}")`;
      } else {
        node.disabled = true;
        node.style.backgroundImage = `url("${sprites.lock}")`;
      }
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
  }

  async function handleMapNodeClick(idx) {
    if (idx !== activeNodeIndex) return;
  
    await delay(150);
  
    showGame();
    setStage("intro");
  
    await delay(250);
  
    const nodeType = NODE_TYPES[idx] || "battle";
  
    // Battle ordinal = which battle is this among battle nodes only (0..)
    const battleOrdinal =
      NODE_TYPES.slice(0, idx + 1).filter((t) => t === "battle").length - 1;
  
    if (typeof window.runGameMode !== "function") {
      console.error("runGameMode is not defined or not loaded");
      return;
    }
  
// ✅ Chest = hero evolution mini-game
if (nodeType === "chest") {
  window.runGameMode("hero-evolution", {
    config: {
      questId: window.CURRENT_QUEST_ID,
      nodeIndex: idx,
      nodeType,
    },
    onComplete(result) {
      // mark evolved (so battles swap to upgraded hero)
      window.PLAYER_PROFILE = window.PLAYER_PROFILE || {};
      window.PLAYER_PROFILE.heroEvolved = true;

      savePlayerProfile();
      
      // ✅ update current battle globals immediately
      try {
        const cfg = window.getBattleConfigForRun
          ? window.getBattleConfigForRun({ questId: window.CURRENT_QUEST_ID })
          : null;
        if (cfg && cfg.hero) {
          window.BATTLE_STATS = window.BATTLE_STATS || {};
          window.BATTLE_STATS.hero = cfg.hero;
        }
      } catch (e) {}

      advanceToNextNodeIfAvailable();
      showMap();
      setStage("intro");
    },
  });
  return;
}
  
    // ✅ Otherwise: normal monster battle
    setEquationAreaMode("monster-battle");
  
    window.runGameMode("monster-battle", {
      config: {
        questId: window.CURRENT_QUEST_ID,
        nodeIndex: idx,
        nodeType,      // "battle" | "boss"
        battleOrdinal,
      },
      onComplete(result) {
        if (result === "win") {
          awardWinProgress();
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
      card.addEventListener("click", async () => {
        const questId = card.dataset.questId || "quest_1";
    
        window.PLAYER_PROFILE = window.PLAYER_PROFILE || {};
        window.PLAYER_PROFILE.acceptedQuests = window.PLAYER_PROFILE.acceptedQuests || {};
    
        const firstTime = !window.PLAYER_PROFILE.acceptedQuests[questId];
    
        // set quest id globally
        CURRENT_QUEST_ID = questId;
        window.CURRENT_QUEST_ID = questId;
    
        // hide quest screen first (so overlay feels like the next step)
        hideQuest();
    
        // first-time accept message
        if (firstTime && window.POSTMSG && typeof window.POSTMSG.show === "function") {
          await window.POSTMSG.show({ questId, key: "accept" });
    
          window.PLAYER_PROFILE.acceptedQuests[questId] = true;
          savePlayerProfile(); // ✅ use your existing helper
        }
    
        // proceed
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