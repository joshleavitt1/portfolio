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
    },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function show({ questId = "quest_1", key = "win" } = {}) {
    const root = $("postmsg");
    const elTitle = $("postmsg-title");
    const elSub = $("postmsg-sub");
    const elBtn = $("postmsg-btn");

    if (!root || !elTitle || !elSub || !elBtn) {
      console.warn("[postmsg] Missing DOM (#postmsg / title / sub / btn).");
      return Promise.resolve({ action: "missing_dom" });
    }

    const pack = QUEST_COPY[questId] || QUEST_COPY.quest_1;
    const copy = pack[key] || pack.win;

    elTitle.textContent = copy.title || "";
    elSub.textContent = copy.sub || "";
    elBtn.textContent = copy.button || "Continue";

    root.classList.remove("is-hidden");
    root.setAttribute("aria-hidden", "false");
    root.style.pointerEvents = "auto";

    return new Promise((resolve) => {
      const onClick = () => {
        root.classList.add("is-hidden");
        root.setAttribute("aria-hidden", "true");
        root.style.pointerEvents = "none";
        resolve({ action: "button", questId, key });
      };
      elBtn.addEventListener("click", onClick, { once: true });
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