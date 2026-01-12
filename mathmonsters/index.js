/* index.js — FULL SWAP-IN */
/* Math Monsters — MVP Single-Page App (no frameworks) */
(() => {
  const LS_PROFILE = "mm_profile";
  const LS_MONSTER = "mm_monster";
  const LS_XP_ANIM = "mm_xp_anim";
  const LS_EVOLVE = "mm_evolve";

  const appEl = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  const bubblesEl = document.getElementById("bubbles");
  const QCARD_IN_DELAY_MS = 320; // was effectively ~1800ms via battlePause()

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const raf2 = async () => {
    await raf();
    await raf();
  };

  const EVOLVE_BEAT_MS = 750; // “cinematic beat” used for pacing
  const EVOLVE_HOLD_MS = 3000; // ✅ “admire the new sprite” hold

  // Loader: always show for 1.5s, even if assets are already cached.
  const MIN_LOADER_MS = 1500;

  // Battle pacing: slow all battle pauses/steps by 50%
  const BATTLE_TIME_SCALE = 3;
  const battleSleep = (ms) => sleep(ms * BATTLE_TIME_SCALE);

  // Uniform battle pacing
  const BATTLE_PAUSE_MS = 600;
  const END_BATTLE_BEAT_MS = 120; // faster pop for win/lose card // pause before end card appears
  const BATTLE_ANIM_MS = 360;
  const PRE_HP_DROP_BEAT_MS = 180; // pause after hit before HP drops

  // New attack feel tuning
  const ATTACK_WINDUP_MS = 90; // ⬅️ small anticipatory pause
  const ATTACK_SLIDE_MS = 720;
  const FX_POP_MS = 300;
  const FX_OUT_MS = 280;
  const FX_HOLD_MS = 220;

  const battlePause = () => battleSleep(BATTLE_PAUSE_MS);

  const state = {
    screen: "landing",
    progression: null,
    questions: null,

    profile: null,
    monster: null,

    battle: {
      currentQ: null,
      selected: null,
      asked: 0,
      correctStreak: 0,
      qStartTs: 0,
    },
  };

  function syncBubblesForScreen(screen) {
    // No bubbles on landing or loader
    const off = screen === "landing" || screen === "loader";
    if (off) {
      if (bubblesEl) bubblesEl.innerHTML = "";
      return;
    }
    // Ensure bubbles exist on home/battle
    spawnBubbles();
  }

  // ---------- Background bubbles ----------
  function spawnBubbles() {
    const w = window.innerWidth;
    const count = Math.round(clamp(w / 34, 10, 22));
    bubblesEl.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const b = document.createElement("div");
      b.className = "mm-bubble";
      const size = 6 + Math.random() * 16;
      const left = Math.random() * 100;
      const dur = 6 + Math.random() * 9;
      const delay = -Math.random() * dur;
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.style.left = `${left}%`;
      b.style.bottom = `${-10 - Math.random() * 20}%`;
      b.style.animationDuration = `${dur}s`;
      b.style.animationDelay = `${delay}s`;
      bubblesEl.appendChild(b);
    }
  }

  // ---------- Toast ----------
  let toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("is-show"), 1400);
  }

  // ---------- Storage ----------
  function normalizeProfile(p) {
    if (!p || typeof p !== "object") return null;
    const xp = Number(p.xp);
    if (!Number.isFinite(xp)) p.xp = 0;
    if (!Number.isFinite(Number(p.difficulty))) p.difficulty = 1;
    if (!Number.isFinite(Number(p.playerGrade))) p.playerGrade = 2;
    return p;
  }

  function loadLocal() {
    try {
      state.profile = normalizeProfile(
        JSON.parse(localStorage.getItem(LS_PROFILE) || "null")
      );
      state.monster = JSON.parse(localStorage.getItem(LS_MONSTER) || "null");
    } catch {
      state.profile = null;
      state.monster = null;
    }
  }

  function saveLocal() {
    localStorage.setItem(LS_PROFILE, JSON.stringify(state.profile));
    localStorage.setItem(LS_MONSTER, JSON.stringify(state.monster));
  }

  function hasSave() {
    return !!state.profile;
  }

  // ---------- Home XP animation (only when returning from a win) ----------
  function setXpAnim(fromXp, toXp) {
    try {
      localStorage.setItem(
        LS_XP_ANIM,
        JSON.stringify({
          from: Number(fromXp || 0),
          to: Number(toXp || 0),
          at: Date.now(),
        })
      );
    } catch {}
  }
  function takeXpAnim() {
    try {
      const raw = localStorage.getItem(LS_XP_ANIM);
      if (!raw) return null;
      localStorage.removeItem(LS_XP_ANIM);
      const obj = JSON.parse(raw);
      if (
        !obj ||
        !Number.isFinite(Number(obj.from)) ||
        !Number.isFinite(Number(obj.to))
      )
        return null;
      return { from: Number(obj.from), to: Number(obj.to) };
    } catch {
      return null;
    }
  }

  // ---------- Evolution trigger (only for level-ups) ----------
  function setEvolveAnim(payload) {
    try {
      localStorage.setItem(
        LS_EVOLVE,
        JSON.stringify({ ...payload, at: Date.now() })
      );
    } catch {}
  }
  function takeEvolveAnim() {
    try {
      const raw = localStorage.getItem(LS_EVOLVE);
      if (!raw) return null;
      localStorage.removeItem(LS_EVOLVE);
      const obj = JSON.parse(raw);
      if (!obj) return null;
      // minimal validation
      if (!obj.fromSprite || !obj.toSprite) return null;
      if (
        !Number.isFinite(Number(obj.fromXp)) ||
        !Number.isFinite(Number(obj.toXp))
      )
        return null;
      return obj;
    } catch {
      return null;
    }
  }

  async function launchEvolutionFlow({ fromSprite, toSprite }, opts = {}) {
    const {
      revealDelayMs = 300,
      pulseBeatMs = EVOLVE_BEAT_MS,
      holdMs = EVOLVE_HOLD_MS, // ✅ NEW
      onBeforeClose = null,
    } = opts;

    await preloadImages([fromSprite, toSprite]);

    const overlay = document.createElement("div");
    overlay.className = "mm-evolve is-show mm-evolve--transparent";
    overlay.style.setProperty("--evolve-ms", "1650ms"); // keep your cinematic morph speed

    overlay.innerHTML = `
      <div class="mm-evolve__wrap" role="dialog" aria-label="Level Up Evolution">
        <h1 class="mm-evolve__title">Level Up!</h1>

        <div class="mm-evolve__stage">
          <div class="mm-evolve__ring"></div>
          <img class="mm-evolve__img mm-evolve__img--from" src="${fromSprite}" alt="Evolution from" />
          <img class="mm-evolve__img mm-evolve__img--to"   src="${toSprite}"   alt="Evolution to" />
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 1) Pause (beats after meter finishes)
    await sleep(pulseBeatMs);

    // 2) Fade in title + sprite (content reveal)
    await sleep(revealDelayMs);
    void overlay.offsetWidth; // ✅ ensures initial hidden state is committed
    overlay.classList.add("is-reveal");

    // 3) Pause so reveal reads
    await sleep(pulseBeatMs);

    // 4) Pulse 3× (your loop)
    for (let i = 0; i < 3; i++) {
      overlay.classList.remove("is-pulse");
      void overlay.offsetWidth;
      overlay.classList.add("is-pulse");
      await sleep(pulseBeatMs);
      overlay.classList.remove("is-pulse");
      await sleep(pulseBeatMs);
    }

    // 5) Morph
    await sleep(pulseBeatMs);
    overlay.classList.add("is-morph");
    await sleep(pulseBeatMs);

    // 6) Hold on new form (pause on the new sprite)
    await sleep(holdMs);

    // 7) Fade OUT content (title + sprite), leaving only background
    await raf2(); // if you want it extra stable
    overlay.classList.add("is-hide");
    await sleep(820); // match .mm-evolve__wrap transition

    // 8) Now that only background is visible, reload Home (new sprite)
    if (typeof onBeforeClose === "function") {
      await onBeforeClose(); // typically: await go("home")
    }

    // 9) Fade out overlay itself + cleanup
    overlay.style.opacity = "0";
    await sleep(420);
    overlay.remove();
  }

  // ---------- Data ----------
  async function loadStaticData() {
    if (state.progression && state.questions) return;
    const [p, q] = await Promise.all([
      fetch("data/progression.json").then((r) => r.json()),
      fetch("data/questions.json").then((r) => r.json()),
    ]);
    state.progression = p;
    state.questions = q;
  }

  // ---------- Image preloading ----------
  function preloadImages(urls) {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    if (!unique.length) return Promise.resolve();
    return Promise.all(
      unique.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // fail-soft
            img.src = src;
          })
      )
    ).then(() => undefined);
  }

  // ---------- Progression + derived rules ----------
  function computeLevelFromXP(xp) {
    return clamp(Math.floor((xp || 0) / 10) + 1, 1, 3);
  }

  function applyHeroProgressionFromXP() {
    const xp = Number(state.profile.xp ?? 0);
    state.profile.xp = Number.isFinite(xp) ? xp : 0;

    const level = computeLevelFromXP(state.profile.xp);
    state.profile.level = level;

    const lvl = state.progression.hero.levels[String(level)];
    state.profile.heroName = lvl.heroName;
    state.profile.heroSprite = lvl.heroSprite;
    state.profile.attackSprite = lvl.attackSprite;
    state.profile.attack = lvl.attack;
    state.profile.health = lvl.health;
    state.profile.damage = 0;
  }

  function ensureMonsterForCurrentHero() {
    if (!state.monster) {
      const pick =
        state.progression.monsters[
          Math.floor(Math.random() * state.progression.monsters.length)
        ];
      state.monster = {
        monsterName: pick.name,
        monsterSprite: pick.monsterSprite,
        attackSprite: pick.attackSprite,
        attack: state.profile.attack,
        health: state.profile.health,
        damage: 0,
      };
      return;
    }
    state.monster.attack = state.profile.attack;
    state.monster.health = state.profile.health;
    state.monster.damage = 0;
  }

  // ---------- Questions (Addition only) ----------
  function makeAdditionQuestion(grade, difficulty) {
    const cfg = state.questions.addition;
    const g = cfg.gradeSettings[String(grade)] || cfg.gradeSettings["2"];
    const scale =
      cfg.difficultyScale[String(difficulty)] || cfg.difficultyScale["1"];
    const maxAddend = clamp(
      g.baseMaxAddend + (scale.maxAddendBoost || 0),
      5,
      99
    );

    const a = 1 + Math.floor(Math.random() * maxAddend);
    const b = 1 + Math.floor(Math.random() * maxAddend);
    const correct = a + b;

    const maxOffset = cfg.distractors?.maxOffset ?? 6;
    const answers = new Set([correct]);

    while (answers.size < 4) {
      const offset =
        Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
      const candidate = correct + offset;
      if (candidate >= 0) answers.add(candidate);
    }

    const arr = Array.from(answers);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return {
      prompt: `${a} + ${b} = ?`,
      correct,
      answers: arr,
    };
  }

  function nextQuestion() {
    const grade = state.profile.playerGrade ?? 2;
    const difficulty = clamp(state.profile.difficulty ?? 1, 1, 10);
    const q = makeAdditionQuestion(grade, difficulty);
    state.battle.currentQ = q;
    state.battle.selected = null;
    state.battle.qStartTs = performance.now();
    state.battle.asked += 1;
  }

  // ---------- Battle mechanics ----------
  function resetBattleDamages() {
    state.profile.damage = 0;
    state.monster.damage = 0;
  }

  function healthPct(health, damage) {
    const h = Number(health || 0);
    const d = Number(damage || 0);
    const remain = clamp(h - d, 0, h);
    return h <= 0 ? 0 : (remain / h) * 100;
  }

  function didWin() {
    return state.monster.damage >= state.monster.health;
  }
  function didLose() {
    return state.profile.damage >= state.profile.health;
  }

  function maybeIncreaseDifficulty(answerTimeMs, wasCorrect) {
    if (!wasCorrect) {
      state.battle.correctStreak = 0;
      return;
    }

    state.battle.correctStreak += 1;
    const fastEnough = answerTimeMs < (state.questions.speedThresholdMs || 3000);

    if (state.battle.correctStreak >= 3 && fastEnough) {
      state.profile.difficulty = clamp(
        (state.profile.difficulty || 1) + 1,
        1,
        10
      );
      state.battle.correctStreak = 0;
      toast(`Difficulty up → ${state.profile.difficulty}`);
    }
  }

  async function playAttackFx({ who }) {
    const stage = document.querySelector("[data-battle-stage]");
    if (!stage) return;

    const heroImg = stage.querySelector("[data-hero-sprite]");
    const monImg = stage.querySelector("[data-monster-sprite]");

    const attacker = who === "hero" ? heroImg : monImg;
    const target = who === "hero" ? monImg : heroImg;

    /* 1️⃣ WIND-UP BEAT */
    await sleep(ATTACK_WINDUP_MS);

    /* 2️⃣ START ATTACK SLIDE */
    attacker.classList.add(
      who === "hero" ? "mm-attack-slide-hero" : "mm-attack-slide-monster"
    );

    /* 3️⃣ WAIT UNTIL IMPACT MOMENT */
    await sleep(ATTACK_SLIDE_MS * 0.55); // sweet spot

    /* 4️⃣ IMPACT — SHAKE + FX TOGETHER */
    target.classList.add("mm-hit-shake");

    const fx = document.createElement("img");
    fx.className = "mm-attackFx";
    fx.src = who === "hero" ? state.profile.attackSprite : state.monster.attackSprite;

    const rect = target.getBoundingClientRect();
    const srect = stage.getBoundingClientRect();

    fx.style.left = `${rect.left - srect.left + rect.width / 2 - 90}px`;
    fx.style.top = `${rect.top - srect.top + rect.height / 2 - 90}px`;

    stage.appendChild(fx);

    // 🔥 SAME FRAME
    requestAnimationFrame(() => {
      fx.classList.add("is-pop");

      // 🔥 hit-scale pop (restart-safe)
      fx.classList.remove("mm-fx-hit");
      fx.offsetWidth; // force reflow so it can replay
      fx.classList.add("mm-fx-hit");
    });

    await sleep(FX_POP_MS);

    // ✅ keep it on screen longer
    await sleep(FX_HOLD_MS);

    fx.classList.add("is-out");
    await sleep(FX_OUT_MS);

    /* 5️⃣ CLEANUP */
    attacker.classList.remove("mm-attack-slide-hero", "mm-attack-slide-monster");
    target.classList.remove("mm-hit-shake");
    fx.remove();
  }
  // ---------- Damage Mini Game (tap-to-attack) ----------
  // Runs only on correct answers. Returns BONUS damage (integer >= 0).
  async function runTapAttackMiniGame() {
    const stage = document.querySelector("[data-battle-stage]");
    if (!stage) return 0;

    const monImg = stage.querySelector("[data-monster-sprite]");
    if (!monImg) return 0;

    const cfg = (state.progression && state.progression.attackMini) ? state.progression.attackMini : {};
    const countdownFrom = Number.isFinite(Number(cfg.countdownFrom)) ? Number(cfg.countdownFrom) : 3;
    const countdownStepMs = Number.isFinite(Number(cfg.countdownStepMs)) ? Number(cfg.countdownStepMs) : 320;
    const windowMs = Number.isFinite(Number(cfg.windowMs)) ? Number(cfg.windowMs) : 2200;
    const bonusPerTap = Number.isFinite(Number(cfg.bonusPerTap)) ? Number(cfg.bonusPerTap) : 1;
    const maxBonus = Number.isFinite(Number(cfg.maxBonus)) ? Number(cfg.maxBonus) : 6;

    // Reduced-motion: skip mini game entirely
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return 0;
    }

    // Build overlay
    const overlay = document.createElement("div");
    overlay.className = "mm-attackMini";

    overlay.innerHTML = `
      <div class="mm-attackMini__wrap" role="dialog" aria-label="Attack mini game">
        <div class="mm-attackMini__card mm-card mm-card__pad">
          <div class="mm-attackMini__title" data-mini-title>Get Ready</div>
          <div class="mm-attackMini__count" data-mini-count>3</div>
          <div class="mm-attackMini__sub" data-mini-sub>Tap the enemy to power up your attack</div>

          <div class="mm-attackMini__meterRow">
            <div class="mm-attackMini__meterLabel">Power</div>
            <div class="mm-attackMini__meterBonus" data-mini-bonus>+0</div>
          </div>

          <div class="mm-attackMini__meter" aria-hidden="true">
            <div class="mm-attackMini__meterFill" data-mini-power></div>
          </div>

          <div class="mm-attackMini__timer" aria-hidden="true">
            <div class="mm-attackMini__timerFill" data-mini-timer></div>
          </div>

          <div class="mm-attackMini__hits" data-mini-hits>Hits: 0</div>
        </div>
      </div>
    `;

    stage.appendChild(overlay);

    const titleEl = overlay.querySelector("[data-mini-title]");
    const countEl = overlay.querySelector("[data-mini-count]");
    const subEl = overlay.querySelector("[data-mini-sub]");
    const powerEl = overlay.querySelector("[data-mini-power]");
    const timerEl = overlay.querySelector("[data-mini-timer]");
    const bonusEl = overlay.querySelector("[data-mini-bonus]");
    const hitsEl = overlay.querySelector("[data-mini-hits]");

    const maxTaps = Math.max(1, Math.ceil(maxBonus / Math.max(0.0001, bonusPerTap)));// Create a tap-target ring positioned over the monster sprite
    const stageRect = stage.getBoundingClientRect();
    const monRect = monImg.getBoundingClientRect();

    const target = document.createElement("div");
    target.className = "mm-attackMini__target";
    target.style.left = `${monRect.left - stageRect.left}px`;
    target.style.top = `${monRect.top - stageRect.top}px`;
    target.style.width = `${monRect.width}px`;
    target.style.height = `${monRect.height}px`;
    stage.appendChild(target);

    // Lock page scroll while the mini game is up
    const prevOverscroll = document.body.style.overscrollBehavior;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";

    const cleanup = () => {
      target.remove();
      overlay.remove();
      document.body.style.overscrollBehavior = prevOverscroll;
      document.body.style.touchAction = prevTouchAction;
    };

    // Countdown
    titleEl.textContent = "Countdown to attack";
    subEl.textContent = "Get ready…";
    hitsEl.textContent = "Hits: 0";
    if (powerEl) powerEl.style.width = "0%";
    if (timerEl) timerEl.style.width = "0%";
    if (bonusEl) bonusEl.textContent = "+0";

    for (let n = countdownFrom; n >= 1; n--) {
      countEl.textContent = String(n);
      await battleSleep(countdownStepMs);
    }

    // Tap window
    titleEl.textContent = "ATTACK!";
    countEl.textContent = "";
    subEl.textContent = "Tap the enemy as fast as you can!";
    overlay.classList.add("is-live");
    target.classList.add("is-live");

    let taps = 0;
    let live = true;

    const spawnBurst = (clientX, clientY) => {
      const sr = stage.getBoundingClientRect();
      const b = document.createElement("div");
      b.className = "mm-miniBurst";
      b.style.left = `${clientX - sr.left}px`;
      b.style.top = `${clientY - sr.top}px`;

      // 6 particle dots
      for (let i = 0; i < 6; i++) {
        const p = document.createElement("span");
        p.className = "mm-miniBurst__p";
        const a = (Math.PI * 2 * i) / 6 + (Math.random() * 0.35);
        const d = 18 + Math.random() * 18;
        const s = 3 + Math.random() * 3;
        p.style.setProperty("--a", `${a}rad`);
        p.style.setProperty("--d", `${d}px`);
        p.style.setProperty("--s", `${s}px`);
        b.appendChild(p);
      }

      stage.appendChild(b);
      setTimeout(() => b.remove(), 560);
    };

    const onTap = (e) => {
      if (!live) return;
      e.preventDefault();

      taps += 1;

      // Power meter is based on taps (capped by maxTaps)
      const cappedTaps = Math.min(taps, maxTaps);
      const powerPct = (cappedTaps / maxTaps) * 100;
      if (powerEl) powerEl.style.width = `${powerPct}%`;

      const bonusNow = Math.min(cappedTaps * bonusPerTap, maxBonus);
      if (bonusEl) bonusEl.textContent = `+${Math.max(0, Math.round(bonusNow))}`;

      if (hitsEl) hitsEl.textContent = `Hits: ${taps}`;

      // punchy feedback
      monImg.classList.remove("mm-mini-hit", "mm-mini-flash");
      monImg.offsetWidth; // restart-safe
      monImg.classList.add("mm-mini-hit", "mm-mini-flash");

      const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
      spawnBurst(pt.clientX, pt.clientY);
    };

    target.addEventListener("pointerdown", onTap, { passive: false });
    target.addEventListener("touchstart", onTap, { passive: false });

    const t0 = performance.now();
    const tick = () => {
      if (!live) return;
      const elapsed = performance.now() - t0;
      const pct = clamp((elapsed / windowMs) * 100, 0, 100);
      if (timerEl) timerEl.style.width = `${pct}%`;
      if (elapsed >= windowMs) {
        live = false;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    await sleep(windowMs);

    live = false;
    target.removeEventListener("pointerdown", onTap);
    target.removeEventListener("touchstart", onTap);

    // Result moment
    overlay.classList.remove("is-live");
    const bonusNow = Math.min(Math.min(taps, maxTaps) * bonusPerTap, maxBonus);
    titleEl.textContent = "Power Up!";
    subEl.textContent = `Bonus +${Math.max(0, Math.round(bonusNow))} dmg`;
    countEl.textContent = "";
    await battleSleep(260);

    cleanup();

    const bonus = Math.min(taps * bonusPerTap, maxBonus);
    return Math.max(0, Math.round(bonus));
  }


  // ---------- Screens ----------
  function shell({ bodyHtml, footerHtml }) {
    return `
      <div class="mm-shell">
        <div class="mm-screen">
          <div class="mm-screen__grow">${bodyHtml}</div>
          ${footerHtml ? `<div>${footerHtml}</div>` : ""}
        </div>
      </div>
    `;
  }

  function renderLanding() {
    const saved = hasSave();

    const body = `
      <section class="landing-wrap" aria-label="Math Monsters Landing">
        <div class="landing-brand">
          <img class="landing-logo" src="images/brand/logo.png" alt="Math Monsters" />
        </div>

        <div class="landing-actions">
          ${
            saved
              ? `<button class="button button--primary" type="button" data-act="continue">Continue</button>`
              : ``
          }
          <button class="button button--primary" type="button" data-act="newGame">New Game</button>
          <button class="button button--outline" type="button" data-act="level3">Level 1</button>
          <button class="button button--outline" type="button" data-act="level2">Level 2</button>
        </div>
      </section>
    `;

    appEl.innerHTML = shell({ bodyHtml: body });

    appEl
      .querySelector("[data-act='continue']")
      ?.addEventListener("click", () => go("loader", { next: "home" }));

    appEl.querySelector("[data-act='newGame']")?.addEventListener("click", async () => {
      await loadStaticData();
      makeDefaultProfile();
      ensureMonsterForCurrentHero();
      saveLocal();
      go("loader", { next: "home" });
    });

    appEl.querySelector("[data-act='level2']")?.addEventListener("click", async () => {
      await loadStaticData();
      if (!hasSave()) makeDefaultProfile();
      state.profile.xp = 19;
      applyHeroProgressionFromXP();
      ensureMonsterForCurrentHero();
      saveLocal();
      go("loader", { next: "home" });
    });

    appEl.querySelector("[data-act='level3']")?.addEventListener("click", async () => {
      await loadStaticData();
      if (!hasSave()) makeDefaultProfile();
      state.profile.xp = 9;
      applyHeroProgressionFromXP();
      ensureMonsterForCurrentHero();
      saveLocal();
      go("loader", { next: "home" });
    });
  }

  function makeDefaultProfile() {
    const lvl1 = state.progression.hero.levels["1"];
    state.profile = {
      playerName: "Player",
      playerGrade: 2,
      xp: 0,
      level: 1,
      difficulty: 1,
      heroType: "blue",
      heroName: lvl1.heroName,
      heroSprite: lvl1.heroSprite,
      attackSprite: lvl1.attackSprite,
      attack: lvl1.attack,
      health: lvl1.health,
      damage: 0,
    };
  }

  // Loader that preloads current hero/monster assets, then routes or calls a callback.
  // IMPORTANT: It forces a dark loader bg via body.is-loader no matter what screen called it.
  function renderLoader(next) {
    // show loader visuals
    document.body.classList.add("is-loader");

    appEl.innerHTML = `
      <section class="mm-loaderFull" aria-label="Loading">
        <div class="mm-loaderFull__inner">
          <img class="mm-loaderLogo" src="images/brand/logo.png" alt="Math Monsters" />
          <div class="mm-loaderTitle">Loading</div>
          <div class="mm-spinner" aria-label="Loading"></div>
        </div>
      </section>
    `;

    const urls = [];
    if (state.profile) urls.push(state.profile.heroSprite, state.profile.attackSprite);
    if (state.monster) urls.push(state.monster.monsterSprite, state.monster.attackSprite);

    Promise.all([preloadImages(urls), sleep(MIN_LOADER_MS)]).then(() => {
      // hide loader visuals
      document.body.classList.remove("is-loader");

      if (typeof next === "function") next();
      else if (next) go(next);
    });
  }

  function applyScreenClasses(screen) {
    document.body.classList.toggle("is-landing", screen === "landing");
    document.body.classList.toggle("is-home", screen === "home");
    document.body.classList.toggle("is-battle", screen === "battle");
  }

  function renderHome() {
    // One-time XP animation payload (set only when winning a battle)
    const xpAnim = takeXpAnim();
    const evolveAnim = takeEvolveAnim();

    const xp = Number(state.profile.xp ?? 0);
    const xpMod = ((xp % 10) + 10) % 10;
    const level = state.profile.level ?? 1;
    const pct = (xpMod / 10) * 100;

    // If we have an animation payload AND it matches current xp, animate.
    const shouldAnimate = xpAnim && xpAnim.to === xp;

    const fromXp = shouldAnimate ? Number(xpAnim.from) : xp;
    const xpDelta = shouldAnimate ? Math.max(0, xp - fromXp) : 0;
    const fromMod = ((fromXp % 10) + 10) % 10;
    const fromPct = (fromMod / 10) * 100;

    const isLevelUpWrap =
      shouldAnimate && computeLevelFromXP(fromXp) < computeLevelFromXP(xp);
    const battleLocked = Boolean(
      evolveAnim && isLevelUpWrap && Number(evolveAnim.toXp) === xp
    );

    // Disable battle tap while Level Up / Evolution is pending
    const heroLinkAttrs = battleLocked
      ? `aria-disabled="true" tabindex="-1"`
      : `data-act="battle" role="button" aria-label="Start Battle"`;

    // ✅ If this is a level-up, Home should *temporarily* show the PRE-evolution hero
    let displayHero = state.profile;
    let displayLevel = level;

    if (evolveAnim && isLevelUpWrap && Number(evolveAnim.toXp) === xp) {
      const fromLvl = state.progression.hero.levels[String(evolveAnim.fromLevel)];
      if (fromLvl?.heroSprite) {
        displayHero = {
          heroName: fromLvl.heroName,
          heroSprite: fromLvl.heroSprite,
        };
        displayLevel = evolveAnim.fromLevel;
      }
    }

    const body = `
      <div class="mm-hero mm-homeIntro" data-home-intro>
        <div class="mm-homeTop">
          <div class="mm-stack" style="align-items:center;">
            <div class="mm-pill" data-level-pill>Level ${displayLevel}</div>
          </div>

          <div class="mm-big">${displayHero.heroName}</div>

          <div class="mm-card mm-card__pad mm-xpCard" style="max-width:420px;">
            <div class="mm-row mm-row--between" style="margin-bottom:8px; width:100%;">
              <div style="font-weight:950;">Gems</div>
              <div style="font-weight:800; color: rgba(13,20,32,.65);" data-xp-text>
                ${xpMod} / 10
              </div>
            </div>

            <div class="mm-progress mm-progress--lg mm-progress--xp is-static" data-xp-bar>
              <div class="mm-progress__fill" data-xp-fill style="width:${shouldAnimate ? fromPct : pct}%"></div>
            </div>

            <!-- XP reward burst (only shown when returning from a win) -->
            <div class="mm-xpReward" data-xp-reward aria-hidden="true">
              <div class="mm-xpReward__label" data-xp-reward-label>+${xpDelta || 1} XP</div>
              <div class="mm-xpReward__spark" style="--dx:-54px; --dy:-26px; --d:0ms"></div>
              <div class="mm-xpReward__spark" style="--dx:-18px; --dy:-42px; --d:40ms"></div>
              <div class="mm-xpReward__spark" style="--dx:22px; --dy:-44px; --d:80ms"></div>
              <div class="mm-xpReward__spark" style="--dx:56px; --dy:-24px; --d:120ms"></div>
              <div class="mm-xpReward__spark" style="--dx:-36px; --dy:6px; --d:60ms"></div>
              <div class="mm-xpReward__spark" style="--dx:40px; --dy:8px; --d:100ms"></div>
            </div>
          </div>
        </div>

        <div class="mm-homeSwimWrap">
          <!-- ✅ Pokemon-style ground shadow -->
          <div class="mm-groundShadow" aria-hidden="true"></div>

          <div class="mm-heroShimmer" style="--mm-sprite-mask: url('${displayHero.heroSprite}')">
            <img class="mm-homeSwim mm-homeHero ${battleLocked ? "is-locked" : ""}"
              src="${displayHero.heroSprite}"
              alt="${displayHero.heroName}"
              ${heroLinkAttrs} />
          </div>
        </div>
      </div>
    `;

    appEl.innerHTML = shell({ bodyHtml: body });
    appEl.querySelectorAll("[data-act='battle']").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (battleLocked) {
          e.preventDefault();
          e.stopPropagation();
          toast("Leveling up...");
          return;
        }
        go("battle");
      });
    });

    const intro = appEl.querySelector("[data-home-intro]");
    const bar = appEl.querySelector("[data-xp-bar]");
    const fill = appEl.querySelector("[data-xp-fill]");
    const xpText = appEl.querySelector("[data-xp-text]");
    const reward = appEl.querySelector("[data-xp-reward]");
    const rewardLabel = appEl.querySelector("[data-xp-reward-label]");

    const popXpReward = (delta) => {
      const d = Math.max(1, Number(delta || 1));
      if (!reward || !rewardLabel) return;
      rewardLabel.textContent = `+${d} Gem`;
      reward.classList.remove("is-show");
      void reward.offsetWidth; // restart animation
      reward.classList.add("is-show");
      clearTimeout(popXpReward._t);
      popXpReward._t = setTimeout(() => reward.classList.remove("is-show"), 2400);
    };

    // Always: Home intro animation (staggered)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        intro?.classList.add("is-in");

        // ✨ Start hero shimmer AFTER home intro finishes
        // Delay shimmer an extra 1s when returning from a win so the +1 Gem moment can finish
        const SHIMMER_BASE_DELAY = 1400;
        const SHIMMER_WIN_EXTRA_DELAY = 1000;

        clearTimeout(renderHome._shimmerT);
        renderHome._shimmerT = setTimeout(() => {
          const shimmer = document.querySelector(".mm-heroShimmer");
          if (!shimmer) return;

          // Level-up ceremony: keep shimmer OFF
          if (shouldAnimate && isLevelUpWrap) {
            shimmer.classList.remove("is-shimmering");
            return;
          }

          shimmer.classList.add("is-shimmering");
        }, SHIMMER_BASE_DELAY + (shouldAnimate ? SHIMMER_WIN_EXTRA_DELAY : 0));

        // Home XP behavior:
        // - Normal Home load: render at pct with NO fill animation.
        // - Return from win: animate from previous XP -> new XP.
        if (!shouldAnimate) {
          bar?.classList.add("is-static");
          if (fill) fill.style.width = `${pct}%`;
          return;
        }

        // Animate after a small beat so it feels connected to "Claim Gem"
        setTimeout(() => {
          if (!bar || !fill) return;

          // Enable transition for the animation run
          bar.classList.remove("is-static");

          // ✅ START GREEN SWEEP (premium reward)
          bar.classList.add("is-rewarding");
          clearTimeout(renderHome._xpSweepT);
          renderHome._xpSweepT = setTimeout(() => {
            bar.classList.remove("is-rewarding");
          }, 1800);

          // Reward burst ties to XP gain
          popXpReward(xpDelta);

          if (isLevelUpWrap) {
            // 9/10 -> 10/10: fill to 100% then transition to Level Up screen
            if (xpText) xpText.textContent = `10 / 10`;
            fill.style.width = `100%`;

            const onDone = async () => {
              // 1) Pause on full bar so it reads
              await sleep(EVOLVE_BEAT_MS);

              // 2) Fade OUT home UI (everything except background)
              const introEl = appEl.querySelector("[data-home-intro]");
              introEl?.classList.add("is-evoFadeOut");
              await sleep(740);

              // 3) Evolution flow (transparent overlay; content fades in)
              if (evolveAnim && Number(evolveAnim.toXp) === xp) {
                await launchEvolutionFlow(evolveAnim, {
                  pulseBeatMs: EVOLVE_BEAT_MS,
                  onBeforeClose: async () => {
                    // ✅ Render updated Home (new sprite) while overlay still covers screen
                    await go("home");
                  },
                });
                return;
              }

              // Fallback
              await go("home");
            };

            fill.addEventListener("transitionend", onDone, { once: true });
            return;
          }

          // Standard: animate to new pct
          fill.style.width = `${pct}%`;
        }, 340);
      });
    });
  }

  function renderBattle() {
    resetBattleDamages();
    ensureMonsterForCurrentHero();
    saveLocal();

    state.battle.asked = 0;
    state.battle.correctStreak = 0;
    nextQuestion();

    const body = `
  <div class="mm-battleStage" data-battle-stage>
    <div class="mm-pill mm-diffPill" data-diff-pill>
      Difficulty: ${state.profile.difficulty ?? 1}
    </div>

    <!-- HERO -->
    <div class="mm-spriteWrap hero" data-hero-wrap style="left: calc(50% - var(--battle-gap) / 2 - 150px); top: calc(50% - 150px);">
      <div class="mm-groundShadow" aria-hidden="true"></div>

      <img class="mm-spriteImg hero"
           data-hero-sprite
           src="${state.profile.heroSprite}"
           alt="${escapeHtml(state.profile.heroName)}">

      <div class="mm-stat mm-glass hero" data-hero-stat>
        <div class="mm-stat__name">${escapeHtml(state.profile.heroName)}</div>
        <div class="mm-progress mm-progress--sm mm-progress--hp">
          <div class="mm-progress__fill" data-hero-hp></div>
        </div>
      </div>
    </div>

    <!-- MONSTER -->
    <div class="mm-spriteWrap monster" data-monster-wrap style="left: calc(50% + var(--battle-gap) / 2 - 150px); top: calc(50% - 150px);">
      <div class="mm-groundShadow" aria-hidden="true"></div>

      <img class="mm-spriteImg monster"
           data-monster-sprite
           src="${state.monster.monsterSprite}"
           alt="${escapeHtml(state.monster.monsterName)}">

      <div class="mm-stat mm-glass monster" data-mon-stat>
        <div class="mm-stat__name">${escapeHtml(state.monster.monsterName)}</div>
        <div class="mm-progress mm-progress--sm mm-progress--hp">
          <div class="mm-progress__fill" data-mon-hp></div>
        </div>
      </div>
    </div>

    <!-- QUESTION CARD -->
    <div class="mm-qCard" data-qcard>
      <div class="mm-row">
        <div class="mm-question" data-qtext></div>
      </div>

      <div class="mm-answers" data-answers></div>

      <div class="mm-qActions">
        <button class="button button--primary" data-act="submit">Submit</button>
      </div>
    </div>
  </div>

  <!-- END OVERLAY -->
  <div class="mm-overlay" data-overlay>
    <div class="mm-endCard mm-card mm-card__pad" data-end-card>
      <h2 class="mm-endTitle" data-end-title></h2>

      <div class="mm-gemBox" data-gem-box style="display:none;">
        <img class="mm-gemImg" src="images/additional/gem.png" alt="Gem" />
      </div>

      <button class="button button--primary" data-end-btn></button>
    </div>
  </div>
`;
    appEl.innerHTML = shell({ bodyHtml: body });
    function updateDifficultyPill(){
      const el = appEl.querySelector("[data-diff-pill]");
      if (!el) return;
      el.textContent = `Difficulty: ${state.profile.difficulty ?? 1}`;
    }
    

    const heroWrap = appEl.querySelector("[data-hero-wrap]"); // wrapper (base pose)
    const monWrap = appEl.querySelector("[data-monster-wrap]"); // wrapper (base pose)

    const heroStat = appEl.querySelector("[data-hero-stat]");
    const monStat = appEl.querySelector("[data-mon-stat]");
    const qcard = appEl.querySelector("[data-qcard]");

    bindBattleUI();
    updateBattleUI();

    // Intro sequence:
    // sprites in → stat boxes up → pause → qcard up
    (async () => {
      // ✅ Ensure initial styles paint BEFORE we toggle end-state classes
      await raf2();

      // reset in case of re-entry
      heroWrap.classList.remove("is-in", "is-settle");
      monWrap.classList.remove("is-in", "is-settle");

      // 1) slide in to overshoot pose
      heroWrap.classList.add("is-in");
      monWrap.classList.add("is-in");

      // 2) let the overshoot land, then settle back
      await battleSleep(180);
      heroWrap.classList.add("is-settle");
      monWrap.classList.add("is-settle");

      // keep your existing pacing
      await battleSleep(260);

      heroStat.classList.add("is-in");
      monStat.classList.add("is-in");
      await battleSleep(QCARD_IN_DELAY_MS);
      qcard.classList.add("is-up");
    })();
  }

  function bindBattleUI() {
    const answersEl = appEl.querySelector("[data-answers]");
    const submitBtn = appEl.querySelector("[data-act='submit']");
    const qcard = appEl.querySelector("[data-qcard]");

    let resolving = false;

    function renderAnswers() {
      const q = state.battle.currentQ;
      answersEl.innerHTML = q.answers
        .map((n) => `<button class="mm-answer" data-ans="${n}" aria-pressed="false">${n}</button>`)
        .join("");

      answersEl.querySelectorAll("[data-ans]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (resolving) return;
          answersEl.querySelectorAll(".mm-answer").forEach((b) => {
            b.classList.remove("is-selected");
            b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("is-selected");
          btn.setAttribute("aria-pressed", "true");
          state.battle.selected = Number(btn.getAttribute("data-ans"));
        });
      });
    }

    renderAnswers();

    submitBtn?.addEventListener("click", async () => {
      if (resolving) return;

      const q = state.battle.currentQ;
      if (state.battle.selected === null) {
        toast("Pick an answer");
        return;
      }

      resolving = true;
      submitBtn.disabled = true;

      // Evaluate
      const answerTime = performance.now() - state.battle.qStartTs;
      const correct = state.battle.selected === q.correct;

      maybeIncreaseDifficulty(answerTime, correct);

      // Lock answers + show feedback colors
      const ansBtns = Array.from(answersEl.querySelectorAll("[data-ans]"));
      ansBtns.forEach((b) => {
        b.disabled = true;
        const val = Number(b.getAttribute("data-ans"));
        if (val === q.correct) b.classList.add("is-correct");
      });

      const selectedBtn = ansBtns.find(
        (b) => Number(b.getAttribute("data-ans")) === state.battle.selected
      );
      if (selectedBtn && !correct) selectedBtn.classList.add("is-wrong");

      // Submit button feedback
      submitBtn.classList.remove("is-correct", "is-wrong");
      submitBtn.classList.add(correct ? "is-correct" : "is-wrong");
      submitBtn.textContent = correct ? "Correct" : "Incorrect";

      await battlePause();
      qcard.classList.remove("is-up");
      await battleSleep(260); // gives the fade a moment to read

      // ✅ If correct, run a quick tap-to-attack mini game to earn BONUS damage
      let dmg = correct
        ? Number(state.profile.attack || 0)
        : Number(state.monster.attack || 0);

      if (correct) {
        const bonus = await runTapAttackMiniGame();
        dmg += Number(bonus || 0);
      }

      await playAttackFx({ who: correct ? "hero" : "monster" });

      // Small beat after impact so the hit “lands”
      await battleSleep(0);

      // Apply damage AFTER the attack so the HP drop reads clearly

      if (dmg > 0) {
        // 🫁 small beat so impact lands before HP moves
        await battleSleep(PRE_HP_DROP_BEAT_MS);

        if (correct) state.monster.damage += dmg;
        else state.profile.damage += dmg;

        updateBattleUI();

        // Let HP meter animate down
        await battleSleep(420);

        if (didWin()) {
          endBattle({ won: true });
          return;
        }
        if (didLose()) {
          endBattle({ won: false });
          return;
        }

        // Next question
        nextQuestion();
      } else {
        // No damage → repeat the same question
        state.battle.qStartTs = performance.now();
      }

      // Reset UI for (next or repeated) question
      updateBattleUI();
      renderAnswers();

      submitBtn.disabled = false;
      submitBtn.classList.remove("is-correct", "is-wrong");
      submitBtn.textContent = "Submit";
      resolving = false;
      qcard.classList.add("is-up");
    });
  }

  function updateDifficultyPill(){
    const el = appEl.querySelector("[data-diff-pill]");
    if (!el) return;
    el.textContent = `Difficulty ${state.profile.difficulty ?? 1}`;
  }  

  function updateBattleUI() {
    const heroHpEl = appEl.querySelector("[data-hero-hp]");
    const monHpEl = appEl.querySelector("[data-mon-hp]");
    heroHpEl.style.width = `${healthPct(state.profile.health, state.profile.damage)}%`;
    monHpEl.style.width = `${healthPct(state.monster.health, state.monster.damage)}%`;

    const qtext = appEl.querySelector("[data-qtext]");
    qtext.textContent = state.battle.currentQ.prompt;
  }

  function showEndCard({ title, showGem, btnText, onBtn }) {
    const overlay = appEl.querySelector("[data-overlay]");
    const card = appEl.querySelector("[data-end-card]");
    const t = appEl.querySelector("[data-end-title]");
    const gemBox = appEl.querySelector("[data-gem-box]");
    const btn = appEl.querySelector("[data-end-btn]");

    t.textContent = title;

    if (gemBox) gemBox.style.display = showGem ? "flex" : "none";

    overlay.classList.add("is-show");
    requestAnimationFrame(() => {
      card.classList.add("is-in");
    });

    btn.textContent = btnText;
    btn.onclick = onBtn;
  }

  async function endBattle({ won }) {
    // 🫁 let the final hit + HP drain fully land
    await battleSleep(END_BATTLE_BEAT_MS);

    if (won) {
      const fromXp = Number(state.profile.xp ?? 0);
      const toXp = fromXp + 1;

      // store a one-time "animate XP" instruction for Home
      setXpAnim(fromXp, toXp);

      // Detect level up (10,20,30...) AFTER this win
      const fromLevel = computeLevelFromXP(fromXp);
      const toLevel = computeLevelFromXP(toXp);

      if (toLevel > fromLevel) {
        // snapshot sprites for the evolution overlay
        const fromLvl = state.progression.hero.levels[String(fromLevel)];
        const toLvl = state.progression.hero.levels[String(toLevel)];

        setEvolveAnim({
          fromXp,
          toXp,
          fromLevel,
          toLevel,
          fromSprite: fromLvl?.heroSprite,
          toSprite: toLvl?.heroSprite,
        });
      }

      state.profile.xp = toXp;
      saveLocal();

      showEndCard({
        title: "Great Job!",
        showGem: true,
        btnText: "Claim Gem",
        onBtn: () => go("home"),
      });
      return;
    }

    state.profile.xp = Number(state.profile.xp ?? 0) - 1;
    state.profile.difficulty = clamp((state.profile.difficulty ?? 1) - 1, 1, 10);
    function updateDifficultyPill(){
      const el = appEl.querySelector("[data-diff-pill]");
      if (!el) return;
      el.textContent = `Difficulty: ${state.profile.difficulty ?? 1}`;
    }    
    saveLocal();

    showEndCard({
      title: "Sorry!",
      showGem: false,
      btnText: "Try Again",
      onBtn: () => go("battle"),
    });
  }

  // ---------- Router ----------
  async function go(screen, opts = {}) {
    document.body.classList.remove("is-landing", "is-home", "is-battle", "is-loader");

    state.screen = screen;
    syncBubblesForScreen(screen);

    document.body.classList.toggle("is-landing", screen === "landing");
    document.body.classList.toggle("is-battle", screen === "battle");

    // Home class for swim animation (and any future Home-only styles)
    applyScreenClasses(screen);

    if (screen === "landing") {
      loadLocal();
      renderLanding();
      return;
    }

    if (screen === "loader") {
      await loadStaticData();
      loadLocal();
      if (!hasSave()) makeDefaultProfile();
      applyHeroProgressionFromXP();
      ensureMonsterForCurrentHero();
      saveLocal();
      renderLoader(opts.next);
      return;
    }

    if (screen === "home") {
      await loadStaticData();
      loadLocal();
      if (!hasSave()) {
        renderLanding();
        return;
      }
      applyHeroProgressionFromXP();
      ensureMonsterForCurrentHero();
      saveLocal();

      renderHome();
      return;
    }

    if (screen === "battle") {
      await loadStaticData();
      loadLocal();

      if (!hasSave()) {
        renderLanding();
        return;
      }

      applyHeroProgressionFromXP();
      ensureMonsterForCurrentHero();
      saveLocal();

      renderBattle();
      return;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  // ---------- Boot ----------
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const isSecure =
      window.location.protocol === "https:" || window.location.hostname === "localhost";
    if (!isSecure) return;

    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  function boot() {
    registerServiceWorker();
    window.addEventListener(
      "resize",
      () => {
        if (state.screen !== "landing" && state.screen !== "loader") spawnBubbles();
      },
      { passive: true }
    );

    loadLocal();
    go("landing");
  }

  boot();
})();
