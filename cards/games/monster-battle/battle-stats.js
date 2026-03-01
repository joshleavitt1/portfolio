(function () {
  "use strict";

  // Quest-level battle config for the monster-battle game
  window.QUEST_BATTLE_STATS = {
    1: {
      questId: "quest_1",
      name: "Quest 1",

      hero: {
        id: "hero_knight_q1",
        questLevel: 1,
        name: "Knight",
        spriteImage: "images/games/monster-battle/quest_1/hero/hero_1.png",
        attackImage: "images/games/monster-battle/quest_1/hero/attack_1.png",
        damage: 1,
        health: 1,
      },

      heroUpgraded: {
        id: "hero_knight_q1_upgraded",
        questLevel: 1,
        name: "Knight",
        spriteImage: "images/games/monster-battle/quest_1/hero/hero_2.png",
        attackImage: "images/games/monster-battle/quest_1/hero/attack_2.png",
        damage: 2,
        health: 1,
      },

      monsters: [
        {
          id: "monster_1",
          questLevel: 1,
          name: "Wolf",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_1.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_1.png",
          damage: 1,
          health: 1,
        },
        {
          id: "monster_2",
          questLevel: 1,
          name: "Skeleton",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_2.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_2.png",
          damage: 1,
          health: 1,
        },
        {
          id: "monster_3",
          questLevel: 1,
          name: "Spider",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_3.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_3.png",
          damage: 1,
          health: 1,
        },
        {
          id: "monster_4",
          questLevel: 1,
          name: "Goblin",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_4.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_4.png",
          damage: 1,
          health: 1,
        },
      ],

      boss: {
        id: "monster_boss_dragon_q1",
        questLevel: 1,
        name: "Black Dragon",
        spriteImage: "images/games/monster-battle/quest_1/monster/monster_boss.png",
        attackImage: "images/games/monster-battle/quest_1/monster/attack_boss.png",
        damage: 1,
        health: 1,
      },

      art: {
        battleVsImage: "images/global/battle_vs.png",
        backgrounds: {
          battleCycle: [
          "images/games/monster-battle/quest_1/bg/bg_battle.png"
          ],
          boss: "images/games/monster-battle/quest_1/bg/bg_boss.png",
        },
      },
    },
  };

  function getQuestConfigByQuestId(questId) {
    const entries = Object.keys(window.QUEST_BATTLE_STATS || {}).map((k) => window.QUEST_BATTLE_STATS[k]);
    return entries.find((q) => q && q.questId === questId) || null;
  }

  function chooseHero(cfg) {
    if (!cfg) return null;

    const prof = window.PLAYER_PROFILE || {};
    const profileLevel = Number(prof.heroLevel || 1) || 1;
    const globalLevel  = Number(window.HERO_LEVEL || cfg.hero?.level || 1) || 1;

    const evolvedFlag   = !!prof.heroEvolved;
    const evolvedByLevel = profileLevel > 1 || globalLevel > 1;

    const evolved = evolvedFlag || evolvedByLevel;

    return evolved && cfg.heroUpgraded ? cfg.heroUpgraded : cfg.hero;
  }

  function randomFrom(arr) {
    if (!arr || !arr.length) return null;
    return arr[(Math.random() * arr.length) | 0];
  }

  // ✅ Foundation API: the battle mode can call this using the runner config
  window.getBattleConfigForRun = function (runConfig) {
    const questId = runConfig && runConfig.questId;
  
    const questCfg =
      getQuestConfigByQuestId(questId) || window.QUEST_BATTLE_STATS[1] || null;
    if (!questCfg) return null;
  
    const hero = chooseHero(questCfg);
  
    // ✅ keep old code synced
    window.BATTLE_STATS = window.BATTLE_STATS || {};
    window.BATTLE_STATS.hero = hero;
  
    const monsterPool = questCfg.monsters || [];
    const boss = questCfg.boss || null;
    const art = questCfg.art || null;
  
    return { questCfg, hero, monsterPool, boss, art };
  };

  // ------------------------------------------------------------------
  // Back-compat globals (so existing monster-battle code keeps working)
  // ------------------------------------------------------------------
  // Pick a default quest config:
  // - Prefer CURRENT_QUEST_ID if something already set it
  // - Otherwise fall back to QUEST_BATTLE_STATS[1] (quest_1)
  const defaultQuest =
    getQuestConfigByQuestId(window.CURRENT_QUEST_ID || "quest_1") ||
    window.QUEST_BATTLE_STATS[1] ||
    null;

  // Use the same logic everywhere
  const defaultHero = defaultQuest ? chooseHero(defaultQuest) : null;

  // Legacy BATTLE_STATS object for older code paths
  window.BATTLE_STATS = {
    hero: defaultHero || null,
    monster:
      defaultQuest &&
      defaultQuest.monsters &&
      defaultQuest.monsters.length
        ? defaultQuest.monsters[0]
        : null,
  };

  // Legacy MONSTER_POOLS (keyed by questId)
  window.MONSTER_POOLS = window.MONSTER_POOLS || {};
  if (defaultQuest) {
    window.MONSTER_POOLS[defaultQuest.questId] = defaultQuest.monsters || [];
  }

  // Legacy helpers that older code calls directly
  window.getBossStatsForCurrentQuest = function () {
    return defaultQuest ? defaultQuest.boss : null;
  };

  window.getQuestArtForCurrentQuest = function () {
    return defaultQuest ? defaultQuest.art : null;
  };
})();
