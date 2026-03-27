(function () {
  "use strict";

  const STORAGE_KEY = "BLIDGE_ADVENTURE_STATE_V1";

  const CHARACTERS = {
    knight: {
      id: "knight",
      className: "Knight",
      levelLabel: "Level 1",
      sprite: "images/adventure/hero/knight.png",
      idleSprite: "images/adventure/hero/knight.png",
      maxHearts: 3,
      currentHearts: 3,
    },
  };
  
  const NODE_TYPES = {
    battle: {
      icon: "images/adventure/map/sword.svg",
      label: "Battle",
      colorClass: "nb-map-node--battle",
    },
    heal: {
      icon: "images/adventure/map/heart.svg",
      label: "Heal",
      colorClass: "nb-map-node--heal",
    },
    reward: {
      icon: "images/adventure/map/star.svg",
      label: "Treasure",
      colorClass: "nb-map-node--reward",
    },
    boss: {
      icon: "images/adventure/map/castle.svg",
      label: "Boss",
      colorClass: "nb-map-node--boss",
    },
  };

  const LEVELS = {
    1: {
      id: 1,
      name: "Level 1",
      title: "Knight",
      characterId: "knight",
      mapId: "level_1",
      completeTitle: "Level Complete",
    },
  };

  const MONSTER_POOLS = {
    1: {
      regular: [
        {
          name: "Skeleton",
          sprite: "images/adventure/monster/level_1/monster_1.png",
        },
        {
          name: "Monster 2",
          sprite: "images/adventure/monster/level_1/monster_2.png",
        },
        {
          name: "Monster 3",
          sprite: "images/adventure/monster/level_1/monster_3.png",
        },
        {
          name: "Monster 4",
          sprite: "images/adventure/monster/level_1/monster_4.png",
        },
        {
          name: "Monster 5",
          sprite: "images/adventure/monster/level_1/monster_5.png",
        },
      ],
      boss: {
        name: "Boss",
        sprite: "images/adventure/monster/level_1/boss_1.png",
      },
    },
  };

  const BATTLE_REWARD_ICONS = {
    attack: "images/adventure/win/sword.svg",
    heal: "images/adventure/win/heart.svg",
    armor: "images/adventure/win/shield.svg",
    combo: "images/adventure/win/combo.svg",
    mystery: "images/adventure/win/mystery.svg",
  };

  const NB_BATTLE_REWARDS = [
    {
      id: "attack",
      title: "Attack Boost",
      label: "Attack",
      icon: BATTLE_REWARD_ICONS.attack,
      colorClass: "is-attack",
      apply(state, characterId) {
        const character = state.characterProgress[characterId];
        character.attack = (character.attack || 1) + 1;
      },
      getDisplay(beforeCharacter, afterCharacter) {
        return {
          mode: "value",
          label: "Attack",
          from: beforeCharacter.attack || 1,
          to: afterCharacter.attack || 1,
        };
      },
    },
    {
      id: "heal",
      title: "Healing Boost",
      label: "Health",
      icon: BATTLE_REWARD_ICONS.heal,
      colorClass: "is-heal",
      apply(state, characterId) {
        const character = state.characterProgress[characterId];
        const max = character.maxHearts || 3;
        const curr = character.currentHearts || 0;
        
        character.currentHearts = Math.min(max, curr + 1);
      },
      getDisplay(beforeCharacter, afterCharacter) {
        return {
          mode: "bar",
          label: "Health",
          from: beforeCharacter.currentHearts || 0,
          to: afterCharacter.currentHearts || 0,
          max: afterCharacter.maxHearts || 3,
        };
      }
    },
    {
      id: "armor",
      title: "Armor Boost",
      label: "Armor",
      icon: BATTLE_REWARD_ICONS.armor,
      colorClass: "is-armor",
      apply(state, characterId) {
        const character = state.characterProgress[characterId];
        character.armor = (character.armor || 1) + 1;
      },
      getDisplay(beforeCharacter, afterCharacter) {
        return {
          mode: "value",
          label: "Armor",
          from: beforeCharacter.armor || 1,
          to: afterCharacter.armor || 1,
        };
      },
    },
    {
      id: "combo",
      title: "Combo Boost",
      label: "Combo",
      icon: BATTLE_REWARD_ICONS.combo,
      colorClass: "is-combo",
      apply(state, characterId) {
        const character = state.characterProgress[characterId];
        character.combo = (character.combo || 1) + 1;
      },
      getDisplay(beforeCharacter, afterCharacter) {
        return {
          mode: "value",
          label: "Combo",
          from: beforeCharacter.combo || 1,
          to: afterCharacter.combo || 1,
        };
      },
    },
  ];

  const MAPS = {
    level_1: {
      id: "level_1",
      levelId: 1,
      name: "Level 1",
      nodes: [
        {
          id: "l1_battle_1",
          type: "battle",
          lane: "center",
          row: 0,
          next: "l1_battle_2",
          battle: {
            nodeTitle: "Battle 1",
            boardSize: 5,
            handSize: 3,
            maxLargePieces: 1,
            numberMin: 1,
            numberMax: 9,
            target: 10,
            pointsGoal: 150,
            allowShapes: ["s1", "h2", "v2", "smartL"],
            enemyName: getRegularMonster(1, 0)?.name || "Monster 1",
            enemySprite: getRegularMonster(1, 0)?.sprite || "images/adventure/monster/level_1/monster_1.png",
            heroName: "Knight",
            heroSprite: "images/adventure/hero/knight.png",
          },
        },
        {
          id: "l1_battle_2",
          type: "battle",
          lane: "left",
          row: 1,
          next: "l1_heal_1",
          battle: {
            nodeTitle: "Battle 2",
            boardSize: 5,
            handSize: 3,
            maxLargePieces: 1,
            numberMin: 1,
            numberMax: 9,
            target: 10,
            pointsGoal: 165,
            allowShapes: ["s1", "h2", "v2", "smartL"],
            enemyName: getRegularMonster(1, 1)?.name || "Monster 2",
            enemySprite: getRegularMonster(1, 1)?.sprite || "images/adventure/monster/level_1/monster_2.png",
            heroName: "Knight",
            heroSprite: "images/adventure/hero/knight.png",
          },
        },
        {
          id: "l1_heal_1",
          type: "heal",
          lane: "center",
          row: 2,
          next: "l1_battle_3",
          reward: {
            kind: "full_heal",
            title: "Hearts Refilled",
            body: "All hearts restored",
          },
        },
        {
          id: "l1_battle_3",
          type: "battle",
          lane: "right",
          row: 3,
          next: "l1_reward_1",
          battle: {
            nodeTitle: "Battle 3",
            boardSize: 5,
            handSize: 3,
            maxLargePieces: 1,
            numberMin: 1,
            numberMax: 9,
            target: 10,
            pointsGoal: 180,
            allowShapes: ["s1", "h2", "v2", "smartL"],
            enemyName: getRegularMonster(1, 2)?.name || "Monster 3",
            enemySprite: getRegularMonster(1, 2)?.sprite || "images/adventure/monster/level_1/monster_3.png",
            heroName: "Knight",
            heroSprite: "images/adventure/hero/knight.png",
          },
        },
        {
          id: "l1_reward_1",
          type: "reward",
          lane: "center",
          row: 4,
          next: "l1_battle_4",
          reward: {
            kind: "coins",
            amount: 100,
            title: "Treasure Found",
            body: "+100 Coins",
          },
        },
        {
          id: "l1_battle_4",
          type: "battle",
          lane: "left",
          row: 5,
          next: "l1_heal_2",
          battle: {
            nodeTitle: "Battle 4",
            boardSize: 5,
            handSize: 3,
            maxLargePieces: 1,
            numberMin: 1,
            numberMax: 9,
            target: 10,
            pointsGoal: 195,
            allowShapes: ["s1", "h2", "v2", "smartL"],
            enemyName: getRegularMonster(1, 3)?.name || "Monster 4",
            enemySprite: getRegularMonster(1, 3)?.sprite || "images/adventure/monster/level_1/monster_4.png",
            heroName: "Knight",
            heroSprite: "images/adventure/hero/knight.png",
          },
        },
        {
          id: "l1_heal_2",
          type: "heal",
          lane: "center",
          row: 6,
          next: "l1_boss_1",
          reward: {
            kind: "full_heal",
            title: "Hearts Refilled",
            body: "All hearts restored",
          },
        },
        {
          id: "l1_boss_1",
          type: "boss",
          lane: "right",
          row: 7,
          next: null,
          battle: {
            nodeTitle: "Boss Battle",
            boardSize: 5,
            handSize: 3,
            maxLargePieces: 1,
            numberMin: 1,
            numberMax: 9,
            target: 10,
            pointsGoal: 220,
            allowShapes: ["s1", "h2", "v2", "smartL"],
            enemyName: getBossMonster(1)?.name || "Boss",
            enemySprite: getBossMonster(1)?.sprite || "images/adventure/monster/level_1/boss_1.png",
            heroName: "Knight",
            heroSprite: "images/adventure/hero/knight.png",
          },
        },
      ],
    },
  };

  function getMonsterPool(levelId) {
    return MONSTER_POOLS[levelId] || null;
  }

  function getRegularMonster(levelId, index) {
    const pool = getMonsterPool(levelId);
    return pool?.regular?.[index] || null;
  }

  function getBossMonster(levelId) {
    const pool = getMonsterPool(levelId);
    return pool?.boss || null;
  }

  function createDefaultState() {
    return {
      selectedCharacterId: "knight",
      currentLevelId: 1,
      currentMapId: "level_1",
      currentNodeId: "l1_battle_1",
      lastCompletedNodeId: null,
      completedNodeIds: [],
      claimedRewardNodeIds: [],
      inventory: {
        coins: 0,
      },
      characterProgress: {
        knight: {
          level: 1,
          currentHearts: 3,
          maxHearts: 3,
          attack: 1,
          armor: 1,
          combo: 1,
        },
      },
      levelStatus: {
        1: {
          complete: false,
        },
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      return mergeState(createDefaultState(), parsed);
    } catch (err) {
      return createDefaultState();
    }
  }

  function mergeState(base, incoming) {
    const next = structuredClone(base);
    if (!incoming || typeof incoming !== "object") return next;

    next.lastCompletedNodeId =
  typeof incoming.lastCompletedNodeId === "string" || incoming.lastCompletedNodeId === null
    ? incoming.lastCompletedNodeId
    : next.lastCompletedNodeId;

    next.selectedCharacterId = incoming.selectedCharacterId || next.selectedCharacterId;
    next.currentLevelId = Number(incoming.currentLevelId || next.currentLevelId);
    next.currentMapId = incoming.currentMapId || next.currentMapId;
    next.currentNodeId = incoming.currentNodeId || next.currentNodeId;
    next.completedNodeIds = Array.isArray(incoming.completedNodeIds) ? [...incoming.completedNodeIds] : [];
    next.claimedRewardNodeIds = Array.isArray(incoming.claimedRewardNodeIds) ? [...incoming.claimedRewardNodeIds] : [];
    next.inventory = {
      ...next.inventory,
      ...(incoming.inventory || {}),
    };
    next.characterProgress = {
      ...next.characterProgress,
      ...(incoming.characterProgress || {}),
    };
    Object.keys(next.characterProgress).forEach((characterId) => {
      const character = next.characterProgress[characterId] || {};

      character.level = Number.isFinite(character.level) ? character.level : 1;
      character.maxHearts = Number.isFinite(character.maxHearts) ? character.maxHearts : 3;
      character.currentHearts = Number.isFinite(character.currentHearts)
        ? character.currentHearts
        : character.maxHearts;

      character.currentHearts = Math.max(
        0,
        Math.min(character.currentHearts, character.maxHearts)
      );

      character.attack = Number.isFinite(character.attack) ? character.attack : 1;
      character.armor = Number.isFinite(character.armor) ? character.armor : 1;
      character.combo = Number.isFinite(character.combo) ? character.combo : 1;

      next.characterProgress[characterId] = character;
    });
    next.levelStatus = {
      ...next.levelStatus,
      ...(incoming.levelStatus || {}),
    };
    return next;
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {}
    return state;
  }

  function resetState() {
    const fresh = createDefaultState();
    saveState(fresh);
    return fresh;
  }

  function getCharacter(state) {
    const characterId = state?.selectedCharacterId || "knight";
    const base = CHARACTERS[characterId] || CHARACTERS.knight;
    const progress = state?.characterProgress?.[characterId] || {};
    return {
      ...base,
      ...progress,
      levelLabel: `Level ${progress.level || 1}`,
    };
  }

  function getLevel(levelId) {
    return LEVELS[levelId] || null;
  }

  function getMap(mapId) {
    return MAPS[mapId] || null;
  }

  function getCurrentLevel(state) {
    return getLevel(state?.currentLevelId || 1);
  }

  function getCurrentMap(state) {
    return getMap(state?.currentMapId || "level_1");
  }

  function getNodeById(map, nodeId) {
    return map?.nodes?.find((node) => node.id === nodeId) || null;
  }

  function isNodeCompleted(state, nodeId) {
    return !!state?.completedNodeIds?.includes(nodeId);
  }

  function isNodeClaimed(state, nodeId) {
    return !!state?.claimedRewardNodeIds?.includes(nodeId);
  }

  function getNextNodeId(map, nodeId) {
    const node = getNodeById(map, nodeId);
    return node?.next || null;
  }

  function getRenderableNodes(state) {
    const map = getCurrentMap(state);
    if (!map) return [];

    return map.nodes.map((node, index) => {
      const typeMeta = NODE_TYPES[node.type] || NODE_TYPES.battle;
      const completed = isNodeCompleted(state, node.id);
      const current = state.currentNodeId === node.id;
      const unlocked = completed || current;

      return {
        ...node,
        index,
        completed,
        current,
        unlocked,
        icon: typeMeta.icon,
        label: typeMeta.label,
        colorClass: typeMeta.colorClass,
      };
    });
  }

  function markNodeComplete(state, nodeId) {
    if (!state.completedNodeIds.includes(nodeId)) {
      state.completedNodeIds.push(nodeId);
    }
    return state;
  }

  function markNodeClaimed(state, nodeId) {
    if (!state.claimedRewardNodeIds.includes(nodeId)) {
      state.claimedRewardNodeIds.push(nodeId);
    }
    return state;
  }

  function moveToNextNode(state, nodeId) {
    const map = getCurrentMap(state);
    const nextNodeId = getNextNodeId(map, nodeId);
    if (nextNodeId) {
      state.currentNodeId = nextNodeId;
    }
    return state;
  }

  function getCharacterProgress(state, characterId = null) {
    const resolvedCharacterId = characterId || state.selectedCharacterId || "knight";

    if (!state.characterProgress[resolvedCharacterId]) {
      state.characterProgress[resolvedCharacterId] = {
        level: 1,
        currentHearts: 3,
        maxHearts: 3,
        attack: 1,
        armor: 1,
        combo: 1,
      };
    }

    return state.characterProgress[resolvedCharacterId];
  }

  function syncCharacterHearts(state, nextHearts, characterId = null) {
    const character = getCharacterProgress(state, characterId);
    const maxHearts = Number.isFinite(character.maxHearts) ? character.maxHearts : 3;
    const resolvedHearts = Number.isFinite(Number(nextHearts))
      ? Number(nextHearts)
      : character.currentHearts;

    character.currentHearts = Math.max(
      0,
      Math.min(resolvedHearts, maxHearts)
    );

    return state;
  }

  function rollBattleReward() {
    const index = Math.floor(Math.random() * NB_BATTLE_REWARDS.length);
    return NB_BATTLE_REWARDS[index];
  }

  function applyBattleReward(state, rewardId) {
    const characterId = state.selectedCharacterId || "knight";
    const reward =
      NB_BATTLE_REWARDS.find((entry) => entry.id === rewardId) || NB_BATTLE_REWARDS[0];

    const beforeCharacter = structuredClone(getCharacterProgress(state, characterId));

    reward.apply(state, characterId);

    const afterCharacter = structuredClone(getCharacterProgress(state, characterId));

    return {
      reward: {
        id: reward.id,
        title: reward.title,
        label: reward.label,
        icon: reward.icon,
        colorClass: reward.colorClass,
      },
      display: reward.getDisplay(beforeCharacter, afterCharacter),
    };
  }

  function applyNodeEffect(state, node) {
    const characterId = state.selectedCharacterId || "knight";
    const character = state.characterProgress[characterId] || state.characterProgress.knight;

    if (node.type === "heal") {
      character.currentHearts = character.maxHearts;
      markNodeClaimed(state, node.id);
    }

    if (node.type === "reward") {
      if (!isNodeClaimed(state, node.id)) {
        if (node.reward?.kind === "coins") {
          state.inventory.coins += Number(node.reward.amount || 0);
        }
        markNodeClaimed(state, node.id);
      }
    }

    if (node.type === "boss") {
      if (!state.levelStatus[state.currentLevelId]) {
        state.levelStatus[state.currentLevelId] = { complete: false };
      }
      state.levelStatus[state.currentLevelId].complete = true;
    }

    return state;
  }

  function resolveNode(state, nodeId, outcome = "win") {
    const map = getCurrentMap(state);
    const node = getNodeById(map, nodeId);
    if (!node) return state;

    if (outcome === "win" || node.type === "heal" || node.type === "reward") {
      markNodeComplete(state, nodeId);
      applyNodeEffect(state, node);
      moveToNextNode(state, nodeId);
    }

    saveState(state);
    return state;
  }

  function getCurrentNode(state) {
    return getNodeById(getCurrentMap(state), state.currentNodeId);
  }

  window.BlastAdventureData = {
    STORAGE_KEY,
    CHARACTERS,
    LEVELS,
    MAPS,
    NODE_TYPES,
    createDefaultState,
    loadState,
    saveState,
    resetState,
    getCharacter,
    getLevel,
    getMap,
    getCurrentLevel,
    getCurrentMap,
    getCurrentNode,
    getNodeById,
    getRenderableNodes,
    isNodeCompleted,
    resolveNode,
    BATTLE_REWARD_ICONS,
    NB_BATTLE_REWARDS,
    getCharacterProgress,
    syncCharacterHearts,
    rollBattleReward,
    applyBattleReward,
    MONSTER_POOLS,
    getMonsterPool,
    getRegularMonster,
    getBossMonster,
  };
})();
