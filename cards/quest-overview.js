// quest-overview.js
(function () {
  "use strict";

  const HEROES = {
    knight: {
      id: "knight",
      displayName: "Knight",
      class: "melee",
      portrait: "images/quests/quest_1/hero/hero_1.png",
      sprite: "images/quests/quest_1/hero/hero_1.png",

      // default meta, not raw battle math
      baseLevel: 1,
      description: "A brave knight who loves big numbers.",
    },

    // later: archer, mage, etc.
  };

  const QUESTS = {
    // Addition – Quest 1 (existing)
    quest_1: {
      id: "quest_1",
      subjectKey: "addition",           // NEW
      questNumber: 1,
      title: "Knight’s Quest – Addition 1",
      mathTypeLabel: "Addition",        // used on the pill
      mathTypeKey: "addition",          // used by DifficultyService
      heroId: "knight",

      // For now this still points at quest_1 art
      heroCardImage: "images/quests/quest_1/hero/hero_1.png",
      mapBackground: "images/quests/quest_1/bg/map.png",

      nodeSprites: {
        battle: "images/quests/quest_1/node/battle.png",
        chest:  "images/quests/quest_1/node/chest.png",
        boss:   "images/quests/quest_1/node/boss.png",
        lock:   "images/quests/quest_1/node/lock.png",
        check:  "images/quests/quest_1/node/check.png",
      },

      recommendedLevel: 1,
      rewardsSummary: "Earn 3 gems and unlock the castle roof.",
    },

    // Addition – Quest 2 (new, same art for now)
    quest_2: {
      id: "quest_2",
      subjectKey: "addition",
      questNumber: 2,
      title: "Knight’s Quest – Addition 2",
      mathTypeLabel: "Addition",
      mathTypeKey: "addition",
      heroId: "knight",

      // For now, reuse Quest 1 art (you can swap to images/quests/addition/quest_2/... later)
      heroCardImage: "images/quests/quest_1/hero/hero_1.png",
      mapBackground: "images/quests/quest_1/bg/map.png",

      nodeSprites: {
        battle: "images/quests/quest_1/node/battle.png",
        chest:  "images/quests/quest_1/node/chest.png",
        boss:   "images/quests/quest_1/node/boss.png",
        lock:   "images/quests/quest_1/node/lock.png",
        check:  "images/quests/quest_1/node/check.png",
      },

      recommendedLevel: 3,
      rewardsSummary: "Face tougher monsters and prove your addition skills.",
    },

    // Subtraction – Quest 1 (new, same art for now)
    quest_3: {
      id: "quest_3",
      subjectKey: "subtraction",
      questNumber: 1,
      title: "Knight’s Quest – Subtraction 1",
      mathTypeLabel: "Subtraction",
      mathTypeKey: "subtraction",
      heroId: "knight",

      // For now, reuse Quest 1 art (later: images/quests/subtraction/quest_1/...)
      heroCardImage: "images/quests/quest_1/hero/hero_1.png",
      mapBackground: "images/quests/quest_1/bg/map.png",

      nodeSprites: {
        battle: "images/quests/quest_1/node/battle.png",
        chest:  "images/quests/quest_1/node/chest.png",
        boss:   "images/quests/quest_1/node/boss.png",
        lock:   "images/quests/quest_1/node/lock.png",
        check:  "images/quests/quest_1/node/check.png",
      },

      recommendedLevel: 1,
      rewardsSummary: "Start your journey into subtraction battles.",
    },
  };

  // NEW: subject-level tracks (what each card represents)
  const SUBJECT_TRACKS = {
    addition: {
      id: "addition",
      cardTitle: "Addition",
      mathTypeKey: "addition",
      quests: ["quest_1", "quest_2"],   // Quest 1 → Quest 2
    },
    subtraction: {
      id: "subtraction",
      cardTitle: "Subtraction",
      mathTypeKey: "subtraction",
      quests: ["quest_3"],             // Only Quest 1 for now
    },
  };

  window.HEROES = HEROES;
  window.QUESTS = QUESTS;
  window.SUBJECT_TRACKS = SUBJECT_TRACKS;   // NEW export
})();
