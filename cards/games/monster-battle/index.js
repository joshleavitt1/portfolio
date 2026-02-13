// games/monster-battle/index.js
(function () {
  "use strict";

  // ---------------------------------------------------------------------
// New Result Screen (replaces old modal)
// Uses #battle-result markup from index.html
// ---------------------------------------------------------------------
function showBattleResult({ win, monsterName } = {}) {
  const root = document.getElementById("battle-result");
  if (!root) return;

  const titleEl = root.querySelector(".battle-result__title");
  const subEl = root.querySelector(".battle-result__sub");
  const pillEl = root.querySelector(".battle-result__pill");
  const btnEl = root.querySelector(".battle-result__btn");

  // ✅ Never crash if markup changes
  if (pillEl) pillEl.textContent = "Quest Update";

  if (titleEl) titleEl.textContent = win ? "Victory!" : "Defeat…";

  if (subEl) {
    subEl.textContent = win
      ? `You defeated ${monsterName || "the monster"}. Return home to continue your journey.`
      : `The ${monsterName || "monster"} got the better of you. Head back and try again!`;
  }

  if (btnEl) btnEl.textContent = "Back to Map";

  root.classList.remove("is-hidden");
  root.setAttribute("aria-hidden", "false");
}

function hideBattleResult() {
  const el = document.getElementById("battle-result");
  if (!el) return;

  // If you have a fade-out class, add it here; otherwise just hide.
  // el.classList.add("is-fading"); // optional

  setTimeout(() => {
    el.classList.add("is-hidden");
    el.setAttribute("aria-hidden", "true");
    // el.classList.remove("is-fading"); // optional
  }, 0);
}

function setText(sel, value, scope = document) {
  const el = scope.querySelector(sel);
  if (!el) return; // don't crash if DOM differs between modes
  el.textContent = value;
}

  // ---------------------------------------------------------------------------
  // Battle stats & quest art (from battle-stats.js / QUESTS globals)
  // ---------------------------------------------------------------------------
  const SAFE_DEFAULT_STATS = {
    hero: {
      name: "Knight",
      level: 1,
      health: 40,
      damage: 8,
      spriteImage: "images/games/monster-battle/quest_1/hero/hero_1.png",
      attackImage: "images/games/monster-battle/quest_1/hero/attack_1.png",
    },
    monster: {
      name: "Goblin",
      health: 30,
      damage: 6,
      spriteImage: "images/games/monster-battle/quest_1/monster/monster_1.png",
      attackImage: "images/games/monster-battle/quest_1/monster/attack_1.png",
    },
  };

  function getBattleConfig(runConfig) {
    // 1) Preferred: new quest-driven foundation if available
    if (typeof window.getBattleConfigForRun === "function") {
      const cfg = window.getBattleConfigForRun(runConfig || {});
      if (cfg) {
        const hero = cfg.hero || SAFE_DEFAULT_STATS.hero;
        const pool = Array.isArray(cfg.monsterPool) ? cfg.monsterPool : [];
        const defaultMonster = pool[0] || SAFE_DEFAULT_STATS.monster;
  
        // Build a pool map keyed by level (keeps your existing logic working)
        const levelKey = hero.level ?? runConfig?.playerLevel ?? runConfig?.level ?? 1;
        const pools = {};
        pools[levelKey] = pool.length ? pool : [defaultMonster];
  
        return {
          HERO_BASE: hero,
          DEFAULT_MONSTER: defaultMonster,
          MONSTER_POOLS: pools,
          ART: cfg.art || null,
          BOSS: cfg.boss || null,
          QUEST: cfg.questCfg || null,
        };
      }
    }
  
    // 2) Legacy: battle-stats.js globals
    if (window.BATTLE_STATS && window.BATTLE_STATS.hero) {
      const hero = window.BATTLE_STATS.hero || SAFE_DEFAULT_STATS.hero;
  
      // Try to find a usable monster pool from legacy globals
      let pool = [];
      if (window.MONSTER_POOLS) {
        // prefer hero level bucket, else 1, else first available bucket
        const levelKey = hero.level ?? 1;
        pool =
          window.MONSTER_POOLS[levelKey] ||
          window.MONSTER_POOLS[1] ||
          window.MONSTER_POOLS[Object.keys(window.MONSTER_POOLS)[0]] ||
          [];
      }
  
      const defaultMonster =
        window.BATTLE_STATS.monster ||
        (Array.isArray(pool) && pool[0]) ||
        SAFE_DEFAULT_STATS.monster;
  
      const pools = {};
      const levelKey = hero.level ?? 1;
      pools[levelKey] = Array.isArray(pool) && pool.length ? pool : [defaultMonster];
  
      const art =
        (typeof window.getQuestArtForCurrentQuest === "function" && window.getQuestArtForCurrentQuest()) ||
        null;
  
      const boss =
        (typeof window.getBossStatsForCurrentQuest === "function" && window.getBossStatsForCurrentQuest()) ||
        null;
  
      return {
        HERO_BASE: hero,
        DEFAULT_MONSTER: defaultMonster,
        MONSTER_POOLS: pools,
        ART: art,
        BOSS: boss,
        QUEST: null,
      };
    }
  
    // 3) Absolute fallback (never crash)
    const hero = SAFE_DEFAULT_STATS.hero;
    const defaultMonster = SAFE_DEFAULT_STATS.monster;
    const pools = { 1: [defaultMonster] };
  
    return {
      HERO_BASE: hero,
      DEFAULT_MONSTER: defaultMonster,
      MONSTER_POOLS: pools,
      ART: null,
      BOSS: null,
      QUEST: null,
    };
  }  

  // Prefer art from battle-stats, fall back to QUESTS if needed
  function getBattleBackgroundsForCurrentQuest() {
    if (typeof window.getQuestArtForCurrentQuest === "function") {
      const art = window.getQuestArtForCurrentQuest();
      const cycle = art && art.backgrounds && art.backgrounds.battleCycle;
      if (Array.isArray(cycle) && cycle.length > 0) return cycle;
    }

    const questId = window.CURRENT_QUEST_ID || "quest_1";
    const quest = window.QUESTS && window.QUESTS[questId];
    return quest?.battleBackgrounds || [];
  }

  function getBossBattleBackgroundForCurrentQuest() {
    if (typeof window.getQuestArtForCurrentQuest === "function") {
      const art = window.getQuestArtForCurrentQuest();
      const bossBg = art && art.backgrounds && art.backgrounds.boss;
      if (bossBg) return bossBg;
    }

    const questId = window.CURRENT_QUEST_ID || "quest_1";
    const quest = window.QUESTS && window.QUESTS[questId];
    return quest?.bossBattleBackground || getBattleBackgroundsForCurrentQuest()[0] || "";
  }

  // ---------------------------------------------------------------------------
  // DOM + state (bootstrapped once, reused per game instance)
  // ---------------------------------------------------------------------------
  let bootstrapped = false;

  // Core DOM
  let gameRoot;
  let railEl;
  let handEl;
  let combatRowEl;

  // Cinematics
  let cinematicEl;
  let equationAreaEl;
  let handAreaEl;
  let cinematicHero;
  let cinematicMonster;
  let cinematicVs;
  let cinematicAttack;
  let cinematicAttackFx;
  let cinematicStage;
  let cinematicHeroCharacter;
  let cinematicMonsterCharacter;

  // Stat panels
  let heroNameEl;
  let monsterNameEl;
  let heroHealthFillEl;
  let monsterHealthFillEl;

  // Mini-game mount
  let gridAreaEl;

  // Modal
  let resultEl;
  let resultKickerEl;
  let resultTitleEl;
  let resultSubEl;
  let resultHomeBtn;

  // Orientation overlay
  let orientationOverlayEl;

  // Game-state
  let HERO_BASE;
  let MONSTER_BASE;
  let MONSTER_POOLS;
  let HERO_LEVEL;
  let battleBackgroundIndex = 0;

  let heroHealthCurrent = 0;
  let monsterHealthCurrent = 0;

  // Game result resolution
  let pendingResolve = null;
  let currentBattleConfig = {};

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function restartAnimation(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth; // reflow
    el.classList.add(className);
  }

  function getQuestContext() {
    if (
      window.DifficultyService &&
      typeof window.DifficultyService.getQuestContext === "function"
    ) {
      return window.DifficultyService.getQuestContext();
    }

    const questId = window.CURRENT_QUEST_ID || "quest_1";
    const questDef = (window.QUESTS && window.QUESTS[questId]) || {};

    return {
      questId,
      mathTypeKey: questDef.mathTypeKey || "addition",
      playerLevel: HERO_LEVEL || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // Monster rotation
  // ---------------------------------------------------------------------------
  let monsterCycleIndexByLevel = new Map();

  function getNextMonsterForLevel(level) {
    const pool = MONSTER_POOLS[level];
    if (!pool || pool.length === 0) return MONSTER_BASE;

    if (!monsterCycleIndexByLevel.has(level)) {
      monsterCycleIndexByLevel.set(level, 0);
    }

    let index = monsterCycleIndexByLevel.get(level);
    const monster = pool[index];

    index = (index + 1) % pool.length;
    monsterCycleIndexByLevel.set(level, index);

    return monster;
  }

  function selectMonsterForCurrentHeroLevel() {
    MONSTER_BASE = getNextMonsterForLevel(HERO_LEVEL);

    if (cinematicMonster && MONSTER_BASE.spriteImage) {
      cinematicMonster.src = MONSTER_BASE.spriteImage;
    }

    monsterHealthCurrent = MONSTER_BASE.health;
    renderStatPanels();
  }

  // ---------------------------------------------------------------------------
  // Health + stat panels
  // ---------------------------------------------------------------------------
  function resetGameHealth() {
    heroHealthCurrent = HERO_BASE.health;
    monsterHealthCurrent = MONSTER_BASE.health;
    renderStatPanels();
  }

  function renderStatPanels() {
    if (heroNameEl) heroNameEl.textContent = HERO_BASE.name ?? "Hero";
    if (monsterNameEl) monsterNameEl.textContent = MONSTER_BASE.name ?? "Monster";

    if (heroHealthFillEl && HERO_BASE.health > 0) {
      const pct = Math.max(0, Math.min(100, (heroHealthCurrent / HERO_BASE.health) * 100));
      heroHealthFillEl.style.width = `${pct}%`;
    }

    if (monsterHealthFillEl && MONSTER_BASE.health > 0) {
      const pct = Math.max(0, Math.min(100, (monsterHealthCurrent / MONSTER_BASE.health) * 100));
      monsterHealthFillEl.style.width = `${pct}%`;
    }
  }

  function resetStatPanels() {
    document.querySelectorAll(".stat-panel").forEach((el) => el.classList.remove("stat-in"));
  }

  function animateStatPanels() {
    document.querySelectorAll(".stat-panel").forEach((el) => {
      if (el.offsetParent === null) return;
      restartAnimation(el, "stat-in");
    });
  }

  // ---------------------------------------------------------------------------
  // Battle backgrounds
  // ---------------------------------------------------------------------------
  function getNextBattleBackground() {
    const bgs = getBattleBackgroundsForCurrentQuest();
    if (!bgs.length) return "";
    const bg = bgs[battleBackgroundIndex];
    battleBackgroundIndex = (battleBackgroundIndex + 1) % bgs.length;
    return bg;
  }

  // ---------------------------------------------------------------------------
  // Orientation overlay
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Section visibility helpers
  // ---------------------------------------------------------------------------
  function showCinematic() {
    if (cinematicEl) cinematicEl.classList.remove("is-hidden");
  }

  function hideCinematic() {
    if (cinematicEl) cinematicEl.classList.add("is-hidden");
  }

// OLD rail/hand mini-game (kept, but now hidden when using grid mode)
function showCards() {
  if (combatRowEl) combatRowEl.classList.remove("is-hidden");
  if (handAreaEl) handAreaEl.classList.remove("is-hidden");
}
function hideCards() {
  if (combatRowEl) combatRowEl.classList.add("is-hidden");
  if (handAreaEl) handAreaEl.classList.add("is-hidden");
}

  // NEW mini-game mount (grid)
  function showMiniGameMount() {
    // always hide old rail/hand UI
    hideCards();
    if (gridAreaEl) gridAreaEl.classList.remove("is-hidden");
  }
  function hideMiniGameMount() {
    if (gridAreaEl) gridAreaEl.classList.add("is-hidden");
  }

  function setStage(stage) {
    gameRoot.classList.remove("stage-intro", "stage-game", "stage-result");
    gameRoot.classList.add(`stage-${stage}`);
  }

  function applyBattleOffset() {
    cinematicHeroCharacter?.classList.add("battle-offset");
    cinematicMonsterCharacter?.classList.add("battle-offset");
  }

  function clearBattleOffset() {
    cinematicHeroCharacter?.classList.remove("battle-offset");
    cinematicMonsterCharacter?.classList.remove("battle-offset");
  }

  function showCinematicShadows() {
    cinematicHeroCharacter?.classList.add("cinematic-character--shadow-visible");
    cinematicMonsterCharacter?.classList.add("cinematic-character--shadow-visible");
  }

  function hideCinematicShadows() {
    cinematicHeroCharacter?.classList.remove("cinematic-character--shadow-visible");
    cinematicMonsterCharacter?.classList.remove("cinematic-character--shadow-visible");
  }

  function resetCinematicSprites() {
    clearBattleOffset();
    hideCinematicShadows();

    if (!cinematicHero || !cinematicMonster || !cinematicVs || !cinematicAttack) return;

    if (cinematicStage) {
      cinematicStage.classList.remove("cinematic-fade-out");
      cinematicStage.style.opacity = "";
      cinematicStage.style.transform = "";
    }

    cinematicHero.style.opacity = "0";
    cinematicMonster.style.opacity = "0";
    cinematicVs.style.opacity = "0";
    cinematicAttack.style.opacity = "0";

    cinematicHero.classList.remove(
      "cinematic-in",
      "cinematic-fade-out",
      "cinematic-hero-attack",
      "cinematic-hit"
    );
    cinematicMonster.classList.remove(
      "cinematic-in",
      "cinematic-hit",
      "cinematic-fade-out",
      "cinematic-monster-attack"
    );
    cinematicVs.classList.remove("cinematic-show", "cinematic-fade-out");
    cinematicAttack.classList.remove("cinematic-attack-in", "cinematic-attack-out");
  }

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------
  function hideModal() {
    // Old modal removed; keep as safe no-op to prevent crashes.
  }

  function showModal() {
    // Old modal removed; keep as safe no-op to prevent crashes.
  }

  // ---------------------------------------------------------------------------
  // Mini-game runner + outcome reporting
  // ---------------------------------------------------------------------------
  function reportMiniGameOutcome(outcome) {
    const ctx = getQuestContext();

    try {
      if (window.FillEquationGame && ctx && typeof window.FillEquationGame.reportResultForContext === "function") {
        window.FillEquationGame.reportResultForContext(ctx, outcome);
        return;
      }
    } catch (err) {
      console.error("[MonsterBattle] FillEquationGame.reportResultForContext error:", err);
    }

    try {
      if (window.DifficultyEngine && typeof window.DifficultyEngine.reportResult === "function") {
        window.DifficultyEngine.reportResult(outcome);
      }
    } catch (err) {
      console.error("[MonsterBattle] DifficultyEngine.reportResult error:", err);
    }
  }

  async function runMiniGameRound() {
    const miniGameId = "equation-cards";
  
    // If the game isn’t registered, don’t hang forever waiting for onComplete.
    const gameFactory = window.GameRegistry?.get?.(miniGameId);
    if (!gameFactory) {
      console.error("[MonsterBattle] GameRegistry has no game:", miniGameId);
      return { outcome: "lose" };
    }
  
    if (typeof window.runGameMode !== "function") {
      console.error("[MonsterBattle] runGameMode is not available (game-runner.js missing).");
      return { outcome: "lose" };
    }
  
    showMiniGameMount();
  
    const result = await new Promise((resolve) => {
      try {
        window.runGameMode(miniGameId, {
          config: {
            mount: gridAreaEl, // so equation-cards renders into the battle mount
          },
          onComplete: (res) => resolve(res),
        });
      } catch (err) {
        console.error("[MonsterBattle] runGameMode crashed:", err);
        resolve({ outcome: "lose" });
      }
    });
  
    hideMiniGameMount();
  
    if (!result || (result.outcome !== "win" && result.outcome !== "lose")) {
      return { outcome: "lose" };
    }
    return result;
  }  
  

  async function startMiniGameLoop() {
    // stage is already "game" when called
    const result = await runMiniGameRound();

    reportMiniGameOutcome(result.outcome);

    if (result.outcome === "win") {
      await runHeroBattleWin();
    } else {
      await runMonsterBattleWin();
    }
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  function showHeroGameWinModal() {
    showModal(
      "You Won the Game!",
      "The monster has been defeated. Continue your journey on the map.",
      "Back to Map",
      () => {
        if (pendingResolve) {
          pendingResolve("win");
          pendingResolve = null;
        }
      }
    );
  }

  function showMonsterGameWinModal() {
    showModal(
      "Game Over",
      "The monster defeated you. Return to the map and try again.",
      "Back to Map",
      () => {
        if (pendingResolve) {
          pendingResolve("lose");
          pendingResolve = null;
        }
      }
    );
  }

    // ---------------------------------------------------------------------------
  // Battle end (NEW result screen + resolve)
  // ---------------------------------------------------------------------------
  let battleEnded = false;

  // Wait for the result button click, resolve, then hide screen
  function showBattleResultScreen({ outcome }) {
    // outcome is "win" or "lose"
    const win = outcome === "win";
  
    showBattleResult({
      win,
      monsterName: MONSTER_BASE?.name,
    });
  
    return new Promise((resolve) => {
      const root = document.getElementById("battle-result");
      if (!root) {
        resolve();
        return;
      }
  
      const btn = root.querySelector(".battle-result__btn");
      if (!btn) {
        console.warn("[MonsterBattle] Missing .battle-result__btn");
        resolve();
        return;
      }
  
      const onClick = () => {
        btn.removeEventListener("click", onClick);
        hideBattleResult();
        // If you add a fade transition later, bump this to match it.
        setTimeout(() => resolve(), 0);
      };
  
      btn.addEventListener("click", onClick, { once: true });
    });
  }

  function hideBattleResultScreenNow() {
    const root = document.getElementById("battle-result");
    if (!root) return;
    root.classList.add("is-hidden");
    root.setAttribute("aria-hidden", "true");
  }

  async function endBattle(outcome) {
    if (battleEnded) return;
    battleEnded = true;

    // Ensure UI state is sane
    setStage("result");
    showCinematic();
    hideCards();
    hideMiniGameMount();

    // Show your new screen and WAIT for click
    await showBattleResultScreen({ outcome });

    // Resolve back to runner (this is what actually returns you to map)
    if (pendingResolve) {
      pendingResolve(outcome);
      pendingResolve = null;
    }
  }

  function checkGameOver() {
    // Hero wins
    if (monsterHealthCurrent <= 0 && heroHealthCurrent > 0) {
      void endBattle("win");
      return true;
    }

    // Monster wins
    if (heroHealthCurrent <= 0 && monsterHealthCurrent > 0) {
      void endBattle("lose");
      return true;
    }

    // Tie -> treat as win (your existing behavior)
    if (heroHealthCurrent <= 0 && monsterHealthCurrent <= 0) {
      void endBattle("win");
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Cinematic attack positioning
  // ---------------------------------------------------------------------------
  function positionAttackOverMonster() {
    if (!cinematicStage || !cinematicMonster || !cinematicAttack) return;

    const stageRect = cinematicStage.getBoundingClientRect();
    const monsterRect = cinematicMonster.getBoundingClientRect();

    const centerX = monsterRect.left + monsterRect.width / 2 - stageRect.left;
    const centerY = monsterRect.top + monsterRect.height / 2 - stageRect.top;

    const attackWidth = 200;
    const attackHeight = 200;

    cinematicAttack.style.left = `${centerX - attackWidth / 2}px`;
    cinematicAttack.style.top = `${centerY - attackHeight / 2}px`;
  }

  function positionAttackOverHero() {
    if (!cinematicStage || !cinematicHero || !cinematicAttack) return;

    const stageRect = cinematicStage.getBoundingClientRect();
    const heroRect = cinematicHero.getBoundingClientRect();

    const centerX = heroRect.left + heroRect.width / 2 - stageRect.left;
    const centerY = heroRect.top + heroRect.height / 2 - stageRect.top;

    const attackWidth = 200;
    const attackHeight = 200;

    cinematicAttack.style.left = `${centerX - attackWidth / 2}px`;
    cinematicAttack.style.top = `${centerY - attackHeight / 2}px`;
  }

  // ---------------------------------------------------------------------------
  // Cinematic sequences
  // ---------------------------------------------------------------------------
  async function runIntroSequence() {
    setStage("intro");

    resetGameHealth();

    showCinematic();
    hideCards();
    hideMiniGameMount();
    resetCinematicSprites();
    resetStatPanels();
    renderStatPanels();

    await delay(750);

    showCinematicShadows();

    restartAnimation(cinematicHero, "cinematic-in");
    restartAnimation(cinematicMonster, "cinematic-in");

    applyBattleOffset();

    await delay(1500);
    animateStatPanels();

    await delay(1000);

    restartAnimation(cinematicVs, "cinematic-show");

    await delay(2500);

    if (cinematicStage) restartAnimation(cinematicStage, "cinematic-fade-out");

    await delay(1000);

    // ✅ now enter game stage + run mini-game loop
    hideCinematic();
    clearBattleOffset();
    setStage("game");

    await startMiniGameLoop();
  }

  async function runHeroBattleWin() {
    setStage("result");

    showCinematic();
    hideCards();
    hideMiniGameMount();
    resetCinematicSprites();
    resetStatPanels();
    renderStatPanels();

    await delay(750);

    showCinematicShadows();

    restartAnimation(cinematicHero, "cinematic-in");
    restartAnimation(cinematicMonster, "cinematic-in");

    applyBattleOffset();

    await delay(1500);

    animateStatPanels();

    await delay(1000);

    restartAnimation(cinematicHero, "cinematic-hero-attack");
    await delay(750);

    if (cinematicAttack && HERO_BASE.attackImage) {
      cinematicAttack.src = HERO_BASE.attackImage;
    }

    positionAttackOverMonster();
    restartAnimation(cinematicAttack, "cinematic-attack-in");
    restartAnimation(cinematicMonster, "cinematic-hit");

    await delay(500);

    monsterHealthCurrent = Math.max(0, monsterHealthCurrent - HERO_BASE.damage);
    renderStatPanels();

    await delay(800);

    restartAnimation(cinematicAttack, "cinematic-attack-out");

    await delay(2000);

    if (!checkGameOver()) {
      hideCinematic();
      clearBattleOffset();
      setStage("game");
      await startMiniGameLoop();
    }
  }

  async function runMonsterBattleWin() {
    setStage("result");

    showCinematic();
    hideCards();
    hideMiniGameMount();
    resetCinematicSprites();
    resetStatPanels();
    renderStatPanels();

    await delay(750);

    showCinematicShadows();

    restartAnimation(cinematicHero, "cinematic-in");
    restartAnimation(cinematicMonster, "cinematic-in");

    applyBattleOffset();

    await delay(1500);

    animateStatPanels();

    await delay(1000);

    restartAnimation(cinematicMonster, "cinematic-monster-attack");
    await delay(750);

    if (cinematicAttack && MONSTER_BASE.attackImage) {
      cinematicAttack.src = MONSTER_BASE.attackImage;
    }

    positionAttackOverHero();
    restartAnimation(cinematicAttack, "cinematic-attack-in");
    restartAnimation(cinematicHero, "cinematic-hit");

    await delay(500);

    heroHealthCurrent = Math.max(0, heroHealthCurrent - MONSTER_BASE.damage);
    renderStatPanels();

    await delay(800);

    restartAnimation(cinematicAttack, "cinematic-attack-out");

    await delay(1000);

    if (!checkGameOver()) {
      hideCinematic();
      clearBattleOffset();
      setStage("game");
      await startMiniGameLoop();
    }
  }

  // ---------------------------------------------------------------------------
  // Start a new battle run
  // ---------------------------------------------------------------------------
  function startNewBattleRun(config) {
    battleEnded = false;
    hideBattleResultScreenNow();
    currentBattleConfig = config || {};
    const isBossBattle = currentBattleConfig.nodeType === "boss";

    // Monster selection
    if (
      isBossBattle &&
      typeof window.getBossStatsForCurrentQuest === "function"
    ) {
      const bossStats = window.getBossStatsForCurrentQuest();
      if (bossStats) {
        MONSTER_BASE = bossStats;
        monsterHealthCurrent = MONSTER_BASE.health;
        if (cinematicMonster && MONSTER_BASE.spriteImage) {
          cinematicMonster.src = MONSTER_BASE.spriteImage;
        }
      } else {
        selectMonsterForCurrentHeroLevel();
      }
    } else {
      selectMonsterForCurrentHeroLevel();
    }

    // Background selection
    const battleBg = isBossBattle
      ? getBossBattleBackgroundForCurrentQuest()
      : getNextBattleBackground();

    if (gameRoot && battleBg) {
      const bgAbs = new URL(battleBg, document.baseURI).href;
      gameRoot.style.setProperty("--battle-bg-image", `url("${bgAbs}")`);

    }

    // Reset health + intro
    resetGameHealth();
    hideCards();
    hideMiniGameMount();

    runIntroSequence().catch((err) => {
      console.error("[MonsterBattle] runIntroSequence crashed:", err);
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap DOM once
  // ---------------------------------------------------------------------------
  function bootstrapOnce() {
    if (bootstrapped) return;
    bootstrapped = true;
  
    const ctx = getQuestContext();
    const statsConfig = getBattleConfig(ctx);
  
    HERO_BASE = statsConfig.HERO_BASE || SAFE_DEFAULT_STATS.hero;
    MONSTER_BASE = statsConfig.DEFAULT_MONSTER || SAFE_DEFAULT_STATS.monster;
    MONSTER_POOLS = statsConfig.MONSTER_POOLS || { 1: [MONSTER_BASE] };
  
    // Prefer run context level, then hero.level, then global, then 1
    HERO_LEVEL =
      ctx.playerLevel ??
      ctx.level ??
      HERO_BASE.level ??
      window.HERO_LEVEL ??
      1;

    // DOM
    gameRoot = document.getElementById("game-root");
    railEl = document.getElementById("equation-rail");
    handEl = document.getElementById("card-hand");
    combatRowEl = document.getElementById("combat-row");

    cinematicEl = document.getElementById("cinematic");
    handAreaEl = document.querySelector(".hand-area");

    // ✅ mini-game mount
    gridAreaEl = document.getElementById("grid-area");

    cinematicHero = document.getElementById("cinematic-hero");
    cinematicMonster = document.getElementById("cinematic-monster");
    cinematicVs = document.getElementById("cinematic-vs");
    cinematicAttack = document.getElementById("cinematic-attack");
    cinematicStage = document.querySelector(".cinematic-stage");

    cinematicHeroCharacter = document.querySelector(".cinematic-character--hero");
    cinematicMonsterCharacter = document.querySelector(".cinematic-character--monster");

    heroNameEl = document.getElementById("hero-name");
    monsterNameEl = document.getElementById("monster-name");
    heroHealthFillEl = document.getElementById("hero-health-fill");
    monsterHealthFillEl = document.getElementById("monster-health-fill");

    orientationOverlayEl = document.getElementById("orientation-overlay");

    // Sync sprite images
    if (cinematicHero && HERO_BASE.spriteImage) cinematicHero.src = HERO_BASE.spriteImage;
    if (cinematicMonster && MONSTER_BASE.spriteImage) cinematicMonster.src = MONSTER_BASE.spriteImage;

    // Double-tap zoom guard
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) event.preventDefault();
        lastTouchEnd = now;
      },
      false
    );

    window.addEventListener("resize", updateOrientationOverlay);
    window.addEventListener("orientationchange", updateOrientationOverlay);
    updateOrientationOverlay();
  }

  // ---------------------------------------------------------------------------
  // Factory: createMonsterBattleGame
  // ---------------------------------------------------------------------------
  function createMonsterBattleGame({ context, config } = {}) {
    return {
      async start() {
        bootstrapOnce();

        return new Promise((resolve) => {
          pendingResolve = resolve;
          startNewBattleRun(config || {});
        });
      },
    };
  }

  // Register with GameRegistry so runGameMode("monster-battle") works
  if (typeof window.GameRegistry.register === "function") {
    window.GameRegistry.register("monster-battle", createMonsterBattleGame);
  } else if (window.GameRegistry.set) {
    window.GameRegistry.set("monster-battle", createMonsterBattleGame);
  }

  // Optional direct access
  window.createMonsterBattleGame = createMonsterBattleGame;
})();