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
        health: 6,
      },

      heroUpgraded: {
        id: "hero_knight_q1_upgraded",
        questLevel: 1,
        name: "Knight",
        spriteImage: "images/games/monster-battle/quest_1/hero/hero_2.png",
        attackImage: "images/games/monster-battle/quest_1/hero/attack_2.png",
        damage: 2,
        health: 6,
      },

      monsters: [
        {
          id: "monster_1",
          questLevel: 1,
          name: "Wolf",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_1.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_1.png",
          damage: 1,
          health: 6,
        },
        {
          id: "monster_2",
          questLevel: 1,
          name: "Skeleton",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_2.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_2.png",
          damage: 1,
          health: 6,
        },
        {
          id: "monster_3",
          questLevel: 1,
          name: "Spider",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_3.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_3.png",
          damage: 1,
          health: 6,
        },
        {
          id: "monster_4",
          questLevel: 1,
          name: "Goblin",
          spriteImage: "images/games/monster-battle/quest_1/monster/monster_4.png",
          attackImage: "images/games/monster-battle/quest_1/monster/attack_4.png",
          damage: 1,
          health: 6,
        },
      ],

      boss: {
        id: "monster_boss_dragon_q1",
        questLevel: 1,
        name: "Black Dragon",
        spriteImage: "images/games/monster-battle/quest_1/monster/monster_boss.png",
        attackImage: "images/games/monster-battle/quest_1/monster/attack_boss.png",
        damage: 2,
        health: 6,
      },

      art: {
        battleVsImage: "images/global/battle_vs.png",
        backgrounds: {
          battleCycle: [
            "images/games/monster-battle/quest_1/bg/bg_1.png",
            "images/games/monster-battle/quest_1/bg/bg_2.png",
            "images/games/monster-battle/quest_1/bg/bg_3.png",
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

  function chooseHero(cfg, playerLevel) {
    // simple rule: upgraded hero if playerLevel >= 2 (tweak later)
    if (cfg && cfg.heroUpgraded && Number(playerLevel || 1) >= 2) return cfg.heroUpgraded;
    return cfg ? cfg.hero : null;
  }

  function randomFrom(arr) {
    if (!arr || !arr.length) return null;
    return arr[(Math.random() * arr.length) | 0];
  }

  // ✅ Foundation API: the battle mode can call this using the runner config
  window.getBattleConfigForRun = function (runConfig) {
    const questId = runConfig && runConfig.questId;
    const playerLevel = runConfig && runConfig.playerLevel;

    const questCfg = getQuestConfigByQuestId(questId) || window.QUEST_BATTLE_STATS[1] || null;
    if (!questCfg) return null;

    const hero = chooseHero(questCfg, playerLevel);
    const monsterPool = questCfg.monsters || [];
    const boss = questCfg.boss || null;
    const art = questCfg.art || null;

    return { questCfg, hero, monsterPool, boss, art };
  };

  // ------------------------------------------------------------------
  // Back-compat globals (so existing monster-battle code keeps working)
  // ------------------------------------------------------------------
  // Default to quest_1 until monster-battle passes a runConfig and overwrites.
  const defaultQuest = getQuestConfigByQuestId("quest_1") || window.QUEST_BATTLE_STATS[1] || null;

  window.BATTLE_STATS = {
    hero: defaultQuest ? defaultQuest.hero : null,
    monster: defaultQuest && defaultQuest.monsters && defaultQuest.monsters.length
      ? defaultQuest.monsters[0]
      : null,
  };

  window.MONSTER_POOLS = window.MONSTER_POOLS || {};
  if (defaultQuest) {
    window.MONSTER_POOLS[defaultQuest.questId] = defaultQuest.monsters || [];
  }

  window.getBossStatsForCurrentQuest = function () {
    return defaultQuest ? defaultQuest.boss : null;
  };

  window.getQuestArtForCurrentQuest = function () {
    return defaultQuest ? defaultQuest.art : null;
  };
})();
