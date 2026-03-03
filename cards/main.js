(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Player Profile bootstrap
  // ---------------------------------------------------------------------
  function loadPlayerProfile() {
    try {
      const raw = localStorage.getItem("PLAYER_PROFILE");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function savePlayerProfile() {
    try {
      localStorage.setItem("PLAYER_PROFILE", JSON.stringify(window.PLAYER_PROFILE || {}));
    } catch (e) {}
  }

  window.PLAYER_PROFILE = loadPlayerProfile();
  window.PLAYER_PROFILE.questProgress ||= {};
  window.PLAYER_PROFILE.acceptedQuests ||= {};
  window.PLAYER_PROFILE.trackProgress ||= {};

  // ---------------------------------------------------------------------
  // Quest progress helpers
  // ---------------------------------------------------------------------
  function getQuestProgress(questId) {
    return window.PLAYER_PROFILE.questProgress[questId] || {};
  }

  function getActiveNodeIndexForQuest(questId) {
    const n = Number(getQuestProgress(questId).activeNodeIndex);
    return Number.isFinite(n) ? n : 0;
  }

  function setActiveNodeIndexForQuest(questId, idx) {
    window.PLAYER_PROFILE.questProgress[questId] = {
      ...window.PLAYER_PROFILE.questProgress[questId],
      activeNodeIndex: idx,
    };
    savePlayerProfile();
  }

    // ---------------------------------------------------------------------
  // Subject track helpers (Addition, Subtraction, etc.)
  // ---------------------------------------------------------------------
  function getTrackProgress(subjectKey) {
    const all = window.PLAYER_PROFILE.trackProgress || {};
    const raw = all[subjectKey] || {};
    const idx = Number(raw.currentQuestIndex);
    const currentQuestIndex = Number.isFinite(idx) ? Math.max(0, idx) : 0;
    return { currentQuestIndex };
  }

  function setTrackCurrentQuest(subjectKey, questIndex) {
    window.PLAYER_PROFILE.trackProgress =
      window.PLAYER_PROFILE.trackProgress || {};
    window.PLAYER_PROFILE.trackProgress[subjectKey] = {
      ...(window.PLAYER_PROFILE.trackProgress[subjectKey] || {}),
      currentQuestIndex: questIndex,
    };
    savePlayerProfile();
  }

  function getCurrentQuestIdForSubject(subjectKey) {
    const tracks = window.SUBJECT_TRACKS || {};
    const questsMap = window.QUESTS || {};
    const track = tracks[subjectKey];
    if (!track) return "quest_1";

    const questIds = track.quests || [];
    if (!questIds.length) return "quest_1";

    const { currentQuestIndex } = getTrackProgress(subjectKey);
    const clampedIndex = Math.max(
      0,
      Math.min(currentQuestIndex, questIds.length - 1)
    );
    const questId = questIds[clampedIndex];
    return questsMap[questId] ? questId : "quest_1";
  }

    // ---------------------------------------------------------------------
  // Quest completion → advance subject track (used on boss win)
  // ---------------------------------------------------------------------
  function handleQuestCompleted(questId) {
    const quests = window.QUESTS || {};
    const tracks = window.SUBJECT_TRACKS || {};
    const quest = quests[questId];
    if (!quest) return;

    const subjectKey = quest.subjectKey || quest.mathTypeKey;
    const track = tracks[subjectKey];
    if (!track) return;

    const questIds = track.quests || [];
    const currentIndex = questIds.indexOf(questId);
    if (currentIndex === -1) return;

    const nextIndex = Math.min(currentIndex + 1, questIds.length - 1);

    // Mark this quest as fully complete on the map
    setActiveNodeIndexForQuest(questId, TOTAL_NODES);

    // Advance the subject's current quest index
    setTrackCurrentQuest(subjectKey, nextIndex);
  }

  // ---------------------------------------------------------------------
  // Legacy hero-level progress (kept for now; DifficultyService owns real difficulty)
  // ---------------------------------------------------------------------
  function awardWinProgress() {
    const cur = Number(window.PLAYER_PROFILE.heroLevel || 1);
    const next = Math.min(cur + 1, 10);
    window.PLAYER_PROFILE.heroLevel = next;
    window.HERO_LEVEL = next;
    savePlayerProfile();
  }

  window.HERO_LEVEL = Number(window.PLAYER_PROFILE.heroLevel || 1) || 1;

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
  // Equation / game-area mode
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
  window.CURRENT_QUEST_ID ||= "quest_1";
  let CURRENT_QUEST_ID = window.CURRENT_QUEST_ID;

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

  // ---------------------------------------------------------------------
  // Debug & active node bootstrap
  // ---------------------------------------------------------------------

  // DEBUG: allow forcing the active node from URL
  const urlNode = Number(new URLSearchParams(window.location.search).get("node"));

  // Default from saved progress (per quest)
  let activeNodeIndex = getActiveNodeIndexForQuest(CURRENT_QUEST_ID);

  // DEBUG URL override still wins if present
  if (Number.isFinite(urlNode)) activeNodeIndex = urlNode;

  // --- DEV HELPER: inspect / override active node from console ---
  window.__debugNodes = {
    get active() {
      return activeNodeIndex;
    },
    set active(v) {
      activeNodeIndex = Math.max(0, Math.min(Number(v) || 0, TOTAL_NODES));
      updateMapNodes();
    },
  };

  window.__debugCompleteNodes = function (questId, count) {
    questId ||= window.CURRENT_QUEST_ID || "quest_1";
    const clamped = Math.max(0, Math.min(Number(count) || 0, TOTAL_NODES));
    setActiveNodeIndexForQuest(questId, clamped);
    console.log("[DEBUG] Set completed nodes for", questId, "to", clamped);
    location.reload();
  };

  // ---------------------------------------------------------------------
  // Stage helpers
  // ---------------------------------------------------------------------
  function setStage(stage) {
    // stage: "intro", "game", or "result"
    if (!gameRoot) return;
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
      // ✅ remove the hard-hide class before showing battle/game again
      gameRoot.classList.remove("game-root--hard-hide");
      gameRoot.classList.add("game--visible");
    }
  }

  // ---------------------------------------------------------------------
  // Map node layout (mobile-first, always centered)
  // ---------------------------------------------------------------------
  // Nodes are indexed bottom (0) → top (TOTAL_NODES-1)
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
    "battle", // 0 (node 1)
    "battle", // 1 (node 2)
    "chest",  // 2 (node 3)
    "battle", // 3 (node 4)
    "battle", // 4 (node 5)
    "boss",   // 5 (node 6)
  ];

  const NODE_SPRITES_FALLBACK = {
    battle: "images/quests/quest_1/node/battle.png",
    boss: "images/quests/quest_1/node/boss.png",
    lock: "images/quests/quest_1/node/lock.png",
  };

  function getNodeSpritesForCurrentQuest() {
    const quests = window.QUESTS || {};
    const quest = quests[CURRENT_QUEST_ID] || quests["quest_1"];
    return (quest && quest.nodeSprites) || NODE_SPRITES_FALLBACK;
  }

  function updateMapNodes() {
    const sprites = getNodeSpritesForCurrentQuest();

    mapNodes.forEach((node) => {
      const idx = Number(node.dataset.nodeIndex);
      const type = NODE_TYPES[idx] ?? "battle";

      node.classList.remove("map-node--active", "map-node--shimmer");

      // ✅ COMPLETED NODES (show check)
      if (idx < activeNodeIndex) {
        node.disabled = true;
        node.style.backgroundImage = `url("${sprites.check}")`;
        return;
      }

      // ✅ CURRENT ACTIVE NODE
      if (idx === activeNodeIndex) {
        node.disabled = false;
        node.classList.add("map-node--active");
        node.style.backgroundImage = `url("${sprites[type]}")`;
        return;
      }

      // 🔒 FUTURE LOCKED NODES
      node.disabled = true;
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

  // ---------------------------------------------------------------------
  // Map node click → battle / chest
  // ---------------------------------------------------------------------
  async function handleMapNodeClick(idx) {
    console.log(
      "[Map] click idx=%d, active=%d, type=%s",
      idx,
      activeNodeIndex,
      NODE_TYPES[idx]
    );

    if (idx !== activeNodeIndex) return;

    const nodeType = NODE_TYPES[idx] || "battle";

    // ---------- CHEST / TREASURE FLOW ----------
    if (nodeType === "chest") {
      console.log("[Map] chest flow start");

      // 1) Immediately move to the game stage so there is NO map flash
      showGame();
      setStage("intro");

      // (optional – evolution will hide puzzle UI anyway, but this keeps it consistent)
      setEquationAreaMode("monster-battle");

      // 2) Show treasure scroll over the GAME stage (not the map)
      if (window.POSTMSG && typeof window.POSTMSG.show === "function") {
        try {
          console.log("[Map] showing treasure scroll…");
          await window.POSTMSG.show({
            questId: window.CURRENT_QUEST_ID || "quest_1",
            key: "treasure",
          });
          console.log("[Map] treasure scroll resolved");
        } catch (err) {
          console.error("[Map] treasure scroll error, skipping:", err);
        }
      } else {
        console.warn("[Map] POSTMSG.show missing, skipping treasure scroll");
      }

      // 3) Tiny beat so stage classes settle, then launch hero-evolution
      await delay(150);

      if (typeof window.runGameMode !== "function") {
        console.error("runGameMode is not defined or not loaded");
        return;
      }

      console.log("[Map] launching hero-evolution game mode…");
      window.runGameMode("hero-evolution", {
        config: {
          questId: window.CURRENT_QUEST_ID,
          nodeIndex: idx,
          nodeType, // "chest"
        },
        onComplete(result) {
          console.log("[Map] hero-evolution complete:", result);

          // Mark that the hero has evolved (for any UI that cares)
          window.PLAYER_PROFILE.heroEvolved = true;
          savePlayerProfile();

          // Pull fresh hero stats so future battles use the upgraded hero art + stats
          try {
            const cfg = window.getBattleConfigForRun
              ? window.getBattleConfigForRun({ questId: window.CURRENT_QUEST_ID })
              : null;
            if (cfg && cfg.hero) {
              window.BATTLE_STATS = window.BATTLE_STATS || {};
              window.BATTLE_STATS.hero = cfg.hero;
            }
          } catch (e) {
            console.warn("[Map] failed to refresh hero stats after evolution", e);
          }

          // Mark treasure node complete → unlock next node
          advanceToNextNodeIfAvailable();

          // Back to map; treasure node will now show as completed/checked
          showMap();
          setStage("intro");
        },
      });

      return; // ✅ done with chest path
    }

    // ---------- NORMAL BATTLE / BOSS FLOW ----------
    await delay(150);

    showGame();
    setStage("intro");

    await delay(250);

    const battleOrdinal =
      NODE_TYPES.slice(0, idx + 1).filter((t) => t === "battle").length - 1;

    if (typeof window.runGameMode !== "function") {
      console.error("runGameMode is not defined or not loaded");
      return;
    }

    // ✅ Monster battle (regular node or boss)
    setEquationAreaMode("monster-battle");

    window.runGameMode("monster-battle", {
      config: {
        questId: window.CURRENT_QUEST_ID,
        nodeIndex: idx,
        nodeType, // "battle" | "boss"
        battleOrdinal,
      },
      onComplete(result) {
        const outcome = (result && result.outcome) || result;
        const questId = window.CURRENT_QUEST_ID || "quest_1";

        if (outcome === "win") {
          awardWinProgress();

          if (nodeType === "boss") {
            // Quest finished → mark complete + advance track
            handleQuestCompleted(questId);

            // After boss win, we ultimately want to land on the quest/home screen.
            // We still let the existing post-battle scroll logic run;
            // when the player gets back home and showQuest() is called,
            // the Addition card will now show Quest 2.
          } else {
            // Regular battle: just move to next node
            advanceToNextNodeIfAvailable();
          }
        }

        // For now, battle exit still goes back to the map
        showMap();
        setStage("intro");
      },
    });
  }

  // Attach listeners once DOM is ready (map nodes)
  mapNodes.forEach((node) => {
    const idx = Number(node.dataset.nodeIndex);
    node.addEventListener("click", () => handleMapNodeClick(idx));
  });

  // After a full win, move to the next node (if any)
  function advanceToNextNodeIfAvailable() {
    if (activeNodeIndex < TOTAL_NODES - 1) {
      activeNodeIndex += 1;
      // ✅ persist per-quest so checkmarks survive refresh
      setActiveNodeIndexForQuest(window.CURRENT_QUEST_ID || "quest_1", activeNodeIndex);
    }
  }

  // ---------------------------------------------------------------------
  // Init: quest screen, cards, and startup flow
  // ---------------------------------------------------------------------
  function init() {
    const questScreenEl = document.getElementById("quest-screen");

    function showQuest() {
      if (questScreenEl) {
        // Rebuild cards in case track progress changed
        if (typeof buildQuestCards === "function") {
          buildQuestCards();
        }
        questScreenEl.classList.remove("quest-screen--hidden");
      }
    }

    function hideQuest() {
      if (questScreenEl) {
        questScreenEl.classList.add("quest-screen--hidden");
      }
    }

    const questListEl = document.getElementById("quest-list");

    // Build one card per subject track (Addition, Subtraction)
    function buildQuestCards() {
      if (!questListEl) return;

      questListEl.innerHTML = "";

      const tracks = window.SUBJECT_TRACKS || {};
      const quests = window.QUESTS || {};

      Object.values(tracks).forEach((track) => {
        const subjectKey = track.id || track.mathTypeKey;
        const questId = getCurrentQuestIdForSubject(subjectKey);
        const quest = quests[questId];
        if (!quest) return;

        const btn = document.createElement("button");
        btn.className = "quest-card";
        btn.dataset.questId = questId;
        btn.dataset.subjectKey = subjectKey;

        // Progress for THIS quest
        const totalNodes = TOTAL_NODES;
        const activeIndex = getActiveNodeIndexForQuest(questId);
        const completedNodes = Math.max(0, Math.min(activeIndex, totalNodes));
        const hasProgress = completedNodes > 0;

        const progressRatio =
          totalNodes > 0 ? completedNodes / totalNodes : 0;
        const progressPercent = Math.round(progressRatio * 100);

        const questNumber = quest.questNumber || 1;
        const cardTitle = track.cardTitle || quest.mathTypeLabel || "Quest";

        btn.innerHTML = `
          <div class="quest-card-inner" data-quest-state="${
            hasProgress ? "in-progress" : "new"
          }">
            <div class="quest-card-left">
              <div class="quest-card-pill">${cardTitle}</div>
              <h2 class="quest-card-title">Quest ${questNumber}</h2>
              <div class="quest-card-footer">
                <div class="quest-card-cta ${
                  hasProgress ? "quest-card-cta--hidden" : ""
                }">
                  Play Now
                </div>
                <div
                  class="quest-card-progress ${
                    hasProgress ? "" : "quest-card-progress--hidden"
                  }"
                  aria-hidden="${hasProgress ? "false" : "true"}"
                >
                  <div
                    class="quest-card-progress-track"
                    role="progressbar"
                    aria-label="Quest progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow="${progressPercent}"
                  >
                    <div
                      class="quest-card-progress-fill"
                      style="width: ${progressPercent}%;"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- RIGHT: hero column, matches old CSS -->
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

    // Initial card build
    buildQuestCards();

        // Initial card build
        buildQuestCards();

        // --------- Quest card click → first-time scroll → map ---------
        if (questListEl) {
          questListEl.addEventListener("click", async (event) => {
            const card = event.target.closest(".quest-card");
            if (!card) return;
    
            const questId = card.dataset.questId || "quest_1";
            const firstTime = !window.PLAYER_PROFILE.acceptedQuests[questId];
    
            // set quest id globally
            CURRENT_QUEST_ID = questId;
            window.CURRENT_QUEST_ID = questId;
            activeNodeIndex = getActiveNodeIndexForQuest(questId);
    
            // hide quest screen
            hideQuest();
    
            // 🌟 FIRST-TIME QUEST MESSAGE (scroll BEFORE map)
            if (firstTime && window.POSTMSG && typeof window.POSTMSG.show === "function") {
              const result = await window.POSTMSG.show({ questId, key: "accept" });
    
              if (result?.action === "back") {
                // User chose Back → return to landing (quest screen)
                showQuest();
    
                // 🕒 After the scroll has faded out, reset the hard-hide so future flows work.
                setTimeout(() => {
                  const gr = document.getElementById("game-root");
                  if (gr) {
                    gr.classList.remove("game-root--hard-hide");
                  }
                }, 600);
    
                return; // 🚨 STOP here — do NOT show map
              }
    
              // Otherwise they clicked Accept
              window.PLAYER_PROFILE.acceptedQuests[questId] = true;
              savePlayerProfile();
            }
    
            // then show map
            showMap();
            setStage("intro");
          });
        }
    
        // Always land on quest/home screen on load
        showQuest();

    // Always land on quest/home screen on load
    showQuest();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

// ---------------------------------------------------------------------
// Global load tweaks (mobile safe)
// ---------------------------------------------------------------------
window.addEventListener("load", () => {
  setTimeout(() => {
    // Trigger a resize to help any layout that depends on viewport
    window.dispatchEvent(new Event("resize"));
    // Small scroll to hide URL bar on mobile
    window.scrollTo(0, 1);
  }, 100);
});