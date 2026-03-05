(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Heroes (quest-map / card portraits)
  // ---------------------------------------------------------------------
  const HEROES = {
    knight: {
      id: "knight",
      displayName: "Knight",
      class: "melee",

      // ✅ moved out of /images/quests/quest_1 → /images/quests/addition/quest_1
      portrait: "images/quests/addition/quest_1/hero/hero_1.png",
      sprite: "images/quests/addition/quest_1/hero/hero_1.png",

      baseLevel: 1,
      description: "A brave knight who loves big numbers.",
    },

    // later: archer, mage, etc.
  };

  // ---------------------------------------------------------------------
  // Quests
  // ---------------------------------------------------------------------
  const QUESTS = {
    // Addition – Quest 1
    quest_1: {
      id: "quest_1",
      subjectKey: "addition",
      questNumber: 1,
      title: "Knight’s Quest – Addition 1",
      mathTypeLabel: "Addition",
      mathTypeKey: "addition",
      heroId: "knight",

      heroCardImage: "images/quests/addition/quest_1/hero/hero_1.png",
      mapBackground: "images/quests/addition/quest_1/bg/map.png",

      nodeSprites: {
        battle: "images/quests/addition/quest_1/node/battle.png",
        chest:  "images/quests/addition/quest_1/node/chest.png",
        boss:   "images/quests/addition/quest_1/node/boss.png",
        lock:   "images/quests/addition/quest_1/node/lock.png",
        check:  "images/quests/addition/quest_1/node/check.png",
      },

      recommendedLevel: 1,
      rewardsSummary: "Earn 3 gems and unlock the castle roof.",
    },

    // Addition – Quest 2
    quest_2: {
      id: "quest_2",
      subjectKey: "addition",
      questNumber: 2,
      title: "Knight’s Quest – Addition 2",
      mathTypeLabel: "Addition",
      mathTypeKey: "addition",
      heroId: "knight",

      heroCardImage: "images/quests/addition/quest_2/hero/hero_1.png",
      mapBackground: "images/quests/addition/quest_2/bg/map.png",

      nodeSprites: {
        battle: "images/quests/addition/quest_2/node/battle.png",
        chest:  "images/quests/addition/quest_2/node/chest.png",
        boss:   "images/quests/addition/quest_2/node/boss.png",
        lock:   "images/quests/addition/quest_2/node/lock.png",
        check:  "images/quests/addition/quest_2/node/check.png",
      },

      recommendedLevel: 3,
      rewardsSummary: "Face tougher monsters and prove your addition skills.",
    },

    // Subtraction – Quest 1
    quest_3: {
      id: "quest_3",
      subjectKey: "subtraction",
      questNumber: 1,
      title: "Knight’s Quest – Subtraction 1",
      mathTypeLabel: "Subtraction",
      mathTypeKey: "subtraction",
      heroId: "knight",

      heroCardImage: "images/quests/subtraction/quest_1/hero/hero_1.png",
      mapBackground: "images/quests/subtraction/quest_1/bg/map.png",

      nodeSprites: {
        battle: "images/quests/subtraction/quest_1/node/battle.png",
        chest:  "images/quests/subtraction/quest_1/node/chest.png",
        boss:   "images/quests/subtraction/quest_1/node/boss.png",
        lock:   "images/quests/subtraction/quest_1/node/lock.png",
        check:  "images/quests/subtraction/quest_1/node/check.png",
      },

      recommendedLevel: 1,
      rewardsSummary: "Start your journey into subtraction battles.",
    },
  };

  // ---------------------------------------------------------------------
  // Subject-level tracks (what each home card represents)
  // ---------------------------------------------------------------------
  const SUBJECT_TRACKS = {
    addition: {
      id: "addition",
      cardTitle: "Addition",
      mathTypeKey: "addition",
      quests: ["quest_1", "quest_2"],
    },
    subtraction: {
      id: "subtraction",
      cardTitle: "Subtraction",
      mathTypeKey: "subtraction",
      quests: ["quest_3"],
    },
  };

  window.HEROES = HEROES;
  window.QUESTS = QUESTS;
  window.SUBJECT_TRACKS = SUBJECT_TRACKS;
})();