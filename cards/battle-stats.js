// battle-stats.js
// Simple global config for hero & monster battle stats.

window.BATTLE_STATS = {
  hero: {
    id: "hero",
    level: 1,
    name: "Knight",
    spriteImage: "images/hero/level_1/level_1_sprite.png",
    attackImage: "images/hero/level_1/level_1_attack.png",
    damage: 6,
    maxHealth: 6,
  },

  // Default monster (used if we don't have a pool for the hero level)
  monster: {
    id: "monster_skeleton",
    level: 1,
    name: "Skeleton",
    spriteImage: "images/monster/level_1/skeleton/level_1_sprite.png",
    attackImage: "images/hero/level_1/level_1_attack.png",
    damage: 6,
    maxHealth: 6,
  },
};

// Pool of monsters by hero level.
// While hero.level === 1, we'll randomly pick from this array without repeats.
window.MONSTER_POOLS = {
  1: [
    {
      id: "monster_spider",
      level: 1,
      name: "Spider",
      spriteImage: "images/monster/level_1/spider/level_1_sprite.png",
      attackImage: "images/hero/level_1/level_1_attack.png",
      damage: 6,
      maxHealth: 6,
    },
    {
      id: "monster_wolf",
      level: 1,
      name: "Wolf",
      spriteImage: "images/monster/level_1/wolf/level_1_sprite.png",
      attackImage: "images/hero/level_1/level_1_attack.png",
      damage: 6,
      maxHealth: 6,
    },
    {
      id: "monster_skeleton",
      level: 1,
      name: "Skeleton",
      spriteImage: "images/monster/level_1/skeleton/level_1_sprite.png",
      attackImage: "images/hero/level_1/level_1_attack.png",
      damage: 6,
      maxHealth: 6,
    },
    {
      id: "monster_goblin",
      level: 1,
      name: "Goblin",
      spriteImage: "images/monster/level_1/goblin/level_1_sprite.png",
      attackImage: "images/hero/level_1/level_1_attack.png",
      damage: 6,
      maxHealth: 6,
    },
  ],
};
