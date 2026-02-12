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
    quest_1: {
      id: "quest_1",
      title: "Knight's Quest",
      mathTypeLabel: "Addition",
      mathTypeKey: "addition",

      heroId: "knight",

      // UI + world
      heroCardImage: "images/quests/quest_1/hero/hero_1.png",
      mapBackground: "images/quests/quest_1/bg/map.png",

      nodeSprites: {
        battle: "images/quests/quest_1/node/battle.png",
        chest: "images/quests/quest_1/node/chest.png",
        boss: "images/quests/quest_1/node/boss.png",
        lock: "images/quests/quest_1/node/lock.png",
        check: "images/quests/quest_1/node/check.png",
      },

      // optional meta for HUD / future
      recommendedLevel: 1,
      rewardsSummary: "Earn 3 gems and unlock the castle roof.",
    },
  };

  window.HEROES = HEROES;
  window.QUESTS = QUESTS;
})();
