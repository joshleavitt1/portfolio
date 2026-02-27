// postmsg.js
(function () {
  "use strict";

  // ------------------------------------------------------------
  // Quest copy bank (easy scaling)
  // ------------------------------------------------------------
  const QUEST_COPY = {
    quest_1: {
      accept: {
        title: "Knight’s Quest",
        sub: "A dragon is causing trouble in the village! The king needs a brave knight to save the day.",
        button: "Accept",
      },
      win: {
        title: "Victory",
        sub: "You defeated the monster! The kingdom is safer because of you. Great job, brave knight.",
        button: "Continue",
      },
      loss: {
        title: "Defeat",
        sub: "That monster was tough! Try again, every knight gets stronger with practice.",
        button: "Try Again",
      },
      boss_win: {
        title: "Victory",
        sub: "You defeated the dragon! The kingdom is safe because of you. You are a true hero!",
        button: "Return Home",
      },
      treasure: {
        title: "Treasure",
        sub: "You crack open the treasure chest and find powerful new weapons and armor. Your knight just leveled up!",
        button: "Grab Treasure",
      },
    },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function primeMapForReturn() {
    const mapScreenEl = document.getElementById("map-screen");
    const gameRoot = document.getElementById("game-root");
    if (!mapScreenEl) return Promise.resolve();
  
    const quests = window.QUESTS || {};
    const currentId = window.CURRENT_QUEST_ID || "quest_1";
    const quest = quests[currentId] || quests["quest_1"];
    const url = quest && quest.mapBackground;
  
    // Map above game
    mapScreenEl.style.zIndex = "30";
  
    // Show map layer immediately (so it exists behind the scroll)
    mapScreenEl.classList.remove("map-screen--hidden");
  
    // HARD hide battle/game immediately (kills bleed)
    if (gameRoot) {
      gameRoot.classList.remove("game--visible");
      gameRoot.classList.add("game-root--hard-hide");
    }
  
    // If no URL, just go black
    if (!url) {
      console.warn("[postmsg] Missing quest.mapBackground for:", currentId);
      mapScreenEl.style.backgroundImage = "none";
      mapScreenEl.style.backgroundColor = "#000";
      return Promise.resolve();
    }
  
    // Wait for background image to load
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        mapScreenEl.style.backgroundImage = `url("${url}")`;
        mapScreenEl.style.backgroundColor = "transparent";
        resolve();
      };
      img.onerror = () => {
        console.warn("[postmsg] mapBackground failed to load:", url);
        mapScreenEl.style.backgroundImage = "none";
        mapScreenEl.style.backgroundColor = "#000";
        resolve();
      };
      img.src = url;
    });
  }

  function show({ questId = "quest_1", key = "win" } = {}) {
    const root = $("postmsg");
    const elTitle = $("postmsg-title");
    const elSub = $("postmsg-sub");
    const elBtn = $("postmsg-btn");
    const elBack = $("postmsg-back");
  
    if (!root || !elTitle || !elSub || !elBtn) {
      console.warn("[postmsg] Missing DOM (#postmsg / title / sub / btn).");
      return Promise.resolve({ action: "missing_dom" });
    }
  
    const pack = QUEST_COPY[questId] || QUEST_COPY.quest_1;
    const copy = pack[key] || pack.win;
  
    elTitle.textContent = copy.title || "";
    elSub.textContent = copy.sub || "";
    elBtn.textContent = copy.button || "Continue";
  
    // ✅ Only show "Back" on initial quest accept
    if (elBack) {
      if (key === "accept") {
        elBack.textContent = "Back";
        elBack.classList.remove("is-hidden");
      } else {
        elBack.classList.add("is-hidden");
      }
    }
  
    // Show the scroll overlay
    root.classList.remove("postmsg--visible");
    root.classList.remove("is-hidden");
    void root.offsetWidth; // force reflow
    requestAnimationFrame(() => {
      root.classList.add("postmsg--visible");
    });
    root.setAttribute("aria-hidden", "false");
    root.style.pointerEvents = "auto";
  
    // ❌ REMOVE the gameRoot opacity kill here
    // We want the current screen (quest / battle / map) to stay visible
    // while the scroll is shown. The caller will switch screens on click.
  
    return new Promise((resolve) => {
      const hideScroll = () => {
        // start fade-out
        root.classList.remove("postmsg--visible");
        root.style.pointerEvents = "none";
      
        const done = (evt) => {
          // only finish when the overlay itself finishes its opacity transition
          if (evt && evt.target !== root) return;
      
          root.removeEventListener("transitionend", done);
          root.classList.add("is-hidden");
          root.setAttribute("aria-hidden", "true");
        };
      
        root.addEventListener("transitionend", done);
      
        // fallback: if transitionend doesn't fire
        setTimeout(() => done(), 350);
      };
  
      // Primary button click (Accept / Continue / Try Again / Return Home)
      const onButtonClick = async () => {
        elBtn.blur();
      
        // ✅ Always prep map + kill battle BEFORE we fade out
        await primeMapForReturn();
      
        // ✅ Fade out the scroll smoothly
        hideScroll();
      
        // ✅ Then tell caller what happened
        resolve({ action: "button", questId, key });
      };
  
      elBtn.addEventListener("click", onButtonClick, { once: true });

      // Optional "Back" text click (only on initial quest accept)
      if (elBack && key === "accept") {
        const onBackClick = () => {
          elBtn.blur();

          // 🛑 Hard-hide any battle/game layer so we DO NOT see the battle BG.
          const gameRoot = document.getElementById("game-root");
          if (gameRoot) {
            gameRoot.classList.remove("game--visible");
            gameRoot.classList.add("game-root--hard-hide");
          }

          // Tell main.js we chose "back"
          resolve({ action: "back", questId, key });

          // Smoothly fade the scroll out
          requestAnimationFrame(hideScroll);
        };

        elBack.addEventListener("click", onBackClick, { once: true });
      }
    });
  }

  // Global API
  window.POSTMSG = { show, COPY: QUEST_COPY };

  // ------------------------------------------------------------
  // Test URL:
  //   ?postmsg=quest_1:accept
  // ------------------------------------------------------------
  function bootTestFromQuery() {
    const raw = new URLSearchParams(window.location.search).get("postmsg");
    if (!raw) return;

    const [questId, key] = raw.split(":");
    show({ questId: questId || "quest_1", key: key || "accept" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootTestFromQuery);
  } else {
    bootTestFromQuery();
  }
})();