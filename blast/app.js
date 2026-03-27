(function () {
  "use strict";

  function syncAdventureViewportScale() {
    const root = document.documentElement;
  
    const baseW = 390;
    const baseH = 844;
    const outerPad = 48;
  
    const usableW = Math.max(320, window.innerWidth - outerPad);
    const usableH = Math.max(560, window.innerHeight - outerPad);
  
    const scaleFromWidth = usableW / baseW;
    const scaleFromHeight = usableH / baseH;
  
    const scale = Math.min(scaleFromWidth, scaleFromHeight, 1);
  
    root.style.setProperty("--nb-ui-scale", scale.toFixed(4));
  }

  function refreshAdventureLayout() {
    syncAdventureViewportScale();
  }

  function createBlastAdventureApp({ mount }) {
    if (!mount) throw new Error("Mount is required");
    let isStarted = false;
    let state = window.BlastAdventureData.loadState();

    function save() {
      window.BlastAdventureData.saveState(state);
    }

    function refreshState() {
      state = window.BlastAdventureData.loadState();
      return state;
    }

    function getRewardDisplayMarkup(display) {
      if (!display) return "";

      if (display.mode === "value") {
        return `
          <div class="nb-reward-value-row">
            <span class="nb-reward-value">${display.from}</span>
            <img
              src="images/adventure/win/arrow.svg"
              alt=""
              class="nb-reward-arrow-icon"
            />
            <span class="nb-reward-value">${display.to}</span>
          </div>
        `;
      }

      if (display.mode === "bar") {
        const from = Math.max(0, Number(display.from || 0));
        const max = Math.max(1, Number(display.max || 1));
        const pct = Math.max(0, Math.min(100, (from / max) * 100));
        
        return `
          <div class="nb-reward-health-wrap">
            <div class="nb-reward-healthbar">
              <div class="nb-reward-healthbar-fill" style="width:${pct}%"></div>
            </div>
            <div class="nb-reward-health-count" data-reward-health-count>${from}/${max}</div>
          </div>
        `;
      }

      return "";
    }

    function triggerRewardPageReveal() {
      const title = mount.querySelector("[data-reward-title]");
      const orb = mount.querySelector("[data-reward-orb]");
      const meta = mount.querySelector("[data-reward-meta]");
    
      title?.classList.add("nb-reveal");
      setTimeout(() => orb?.classList.add("nb-reveal"), 90);
      setTimeout(() => meta?.classList.add("nb-reveal"), 180);
    }
    
    function animateRewardDisplay(display) {
      if (!display || display.mode !== "bar") return;
    
      const fill = mount.querySelector(".nb-reward-healthbar-fill");
      const count = mount.querySelector("[data-reward-health-count]");
      if (!fill) return;
    
      const from = Math.max(0, Number(display.from || 0));
      const to = Math.max(0, Number(display.to || 0));
      const max = Math.max(1, Number(display.max || 1));
    
      fill.style.width = `${(from / max) * 100}%`;
      if (count) count.textContent = `${from}/${max}`;
    
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fill.style.width = `${(to / max) * 100}%`;
        });
      });
    
      if (!count) return;
    
      const duration = 900;
      const start = performance.now();
    
      function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const value = Math.round(from + (to - from) * progress);
        count.textContent = `${value}/${max}`;
        if (progress < 1) requestAnimationFrame(tick);
      }
    
      requestAnimationFrame(tick);
    }

    function revealBattleReward({ reward, display, onContinue, autoAdvanceMs = 4000 }) {
      mount.innerHTML = `
        <section class="nb-page nb-reward-page">
          <div class="nb-page-center">
            <div class="nb-reward-wrap">
              <h1 class="nb-reward-title nb-reward-reveal-item" data-reward-title>${reward.title}</h1>
    
              <div
                class="nb-reward-orb ${reward.colorClass} nb-reward-reveal-item"
                data-reward-orb
                aria-hidden="true"
              >
                <span class="nb-reward-box-shell">
                  <span class="nb-reward-icon-badge" aria-hidden="true"></span>
                  <img src="${reward.icon}" alt="" class="nb-reward-icon" />
                </span>
              </div>
    
              <div class="nb-reward-meta nb-reward-reveal-item" data-reward-meta>
                <div class="nb-reward-stat-label">${display.label}</div>
                ${getRewardDisplayMarkup(display)}
              </div>
            </div>
          </div>
        </section>
      `;

      refreshAdventureLayout();
    
      triggerRewardPageReveal();
    
      requestAnimationFrame(() => {
        animateRewardDisplay(display);
      });
    
      window.setTimeout(() => {
        onContinue?.();
      }, autoAdvanceMs);
    }

    function renderBattleRewardScreen({ reward, display, onContinue }) {
      const mysteryIcon = window.BlastAdventureData.BATTLE_REWARD_ICONS.mystery;

      mount.innerHTML = `
        <section class="nb-page nb-reward-page">
          <div class="nb-page-center">
            <div class="nb-reward-wrap">
              <h1 class="nb-reward-title nb-reward-reveal-item" data-reward-title>Mystery Prize</h1>

              <button
                class="nb-reward-box nb-reward-reveal-item"
                data-reward-orb
                type="button"
                aria-label="Open mystery prize"
              >
                <span class="nb-reward-box-shell">
                  <span class="nb-reward-icon-badge" aria-hidden="true"></span>
                  <img src="${mysteryIcon}" alt="" class="nb-reward-icon nb-reward-icon--mystery" />
                </span>
              </button>

              <div class="nb-reward-meta nb-reward-reveal-item nb-reward-meta--placeholder" data-reward-meta aria-hidden="true"></div>
            </div>
          </div>
        </section>
      `;

      triggerRewardPageReveal();

      mount.querySelector(".nb-reward-box")?.addEventListener(
        "click",
        () => {
          const rewardBox = mount.querySelector(".nb-reward-box");
          rewardBox?.classList.add("is-opening");

          window.setTimeout(() => {
            revealBattleReward({ reward, display, onContinue, autoAdvanceMs: 4000 });
          }, 420);
        },
        { once: true }
      );
    }

    function transitionRewardToMap() {
      const rewardPage = mount.querySelector(".nb-reward-page");
      rewardPage?.classList.add("nb-page-fade-out");
    
      window.setTimeout(() => {
        state.lastCompletedNodeId = null;
        save();
    
        renderMapScreen("", {
          forceInitialReveal: true,
        });
      }, 320);
    }

    function start() {
      if (isStarted) return;
      isStarted = true;
      const handleResize = () => {
        syncAdventureViewportScale();
      };

      syncAdventureViewportScale();
      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", handleResize);

      renderHomePage();
    }

    function renderHomePage() {
      refreshState();
    
      mount.innerHTML = `
        <div class="nb-page nb-home">
          <div class="nb-home-logo-wrap nb-home-reveal-item">
            <img class="nb-home-logo-img" src="images/auth/logo.png" alt="Blast Math" />
          </div>
    
          <div class="nb-home-actions">
            <button
              id="nb-play-adventure"
              class="nb-home-btn nb-home-btn--blue nb-home-reveal-item"
              type="button"
            >
              Play
            </button>
          </div>
        </div>
      `;

      refreshAdventureLayout();
    
      requestAnimationFrame(() => {
        const logo = mount.querySelector(".nb-home-logo-wrap");
        const button = mount.querySelector("#nb-play-adventure");
    
        logo?.classList.add("nb-reveal");
        setTimeout(() => button?.classList.add("nb-reveal"), 120);
      });
    
      mount.querySelector("#nb-play-adventure")?.addEventListener("click", () => {
        renderMapScreen();
      });
    }

    function buildNodeMarkup(node, slotIndex, options = {}) {
      const { isLevelUpSequence = false } = options;
    
      const nodeStateClass = node.completed
        ? "is-complete"
        : node.current
        ? "is-current"
        : "is-incomplete";
    
      const iconClass = node.completed
        ? "nb-map-node-icon--check"
        : node.type === "battle"
        ? "nb-map-node-icon--tall"
        : "nb-map-node-icon--wide";
    
      const iconSrc = node.completed
        ? "images/adventure/map/check.svg"
        : node.icon;
    
      const shouldEnter = !isLevelUpSequence;
    
      return `
        <button
          type="button"
          class="nb-map-node ${node.colorClass} ${nodeStateClass}${shouldEnter ? " nb-map-node-enter" : ""}"
          data-node-id="${node.id}"
          data-node-current="${node.current ? "true" : "false"}"
          data-node-complete="${node.completed ? "true" : "false"}"
          data-node-row="${node.row}"
          data-node-lane="${node.lane}"
          data-slot-order="${slotIndex}"
          ${node.current ? "" : "disabled"}
        >
          <span class="nb-map-node-inner">
            <img
              class="nb-map-node-icon ${iconClass}"
              src="${iconSrc}"
              alt="${node.label}"
            />
          </span>
        </button>
      `;
    }
    
    const MAP_TOTAL_ROWS = 8;
    const MAP_LANES = ["left", "center", "right"];
    
    function getSlotKey(row, lane) {
      return `${row}:${lane}`;
    }
    
    function buildMapGridMarkup(nodes, options = {}) {
      const nodeBySlot = new Map();
    
      nodes.forEach((node) => {
        nodeBySlot.set(getSlotKey(Number(node.row || 0), node.lane || "center"), node);
      });
    
      const rows = [];
    
      for (let visualRow = MAP_TOTAL_ROWS - 1; visualRow >= 0; visualRow--) {
        const slotMarkup = MAP_LANES.map((lane, laneIndex) => {
          const node = nodeBySlot.get(getSlotKey(visualRow, lane));
          const slotIndex =
            (MAP_TOTAL_ROWS - 1 - visualRow) * MAP_LANES.length + laneIndex;
    
          if (node) {
            return `
              <div class="nb-map-slot" data-row="${visualRow}" data-lane="${lane}">
                ${buildNodeMarkup(node, slotIndex, options)}
              </div>
            `;
          }
    
          return `
            <div class="nb-map-slot" data-row="${visualRow}" data-lane="${lane}">
              <div class="nb-map-node nb-map-node--placeholder" aria-hidden="true"></div>
            </div>
          `;
        }).join("");
    
        rows.push(`
          <div class="nb-map-row" data-row="${visualRow}">
            ${slotMarkup}
          </div>
        `);
      }
    
      return rows.join("");
    }
    
    function getNodeByIdFromRenderable(nodes, nodeId) {
      return nodes.find((node) => node.id === nodeId) || null;
    }
    
    function getNextNodeIdByRow(afterState, completedNodeId) {
      const nodes = window.BlastAdventureData.getRenderableNodes(afterState);
      const completedNode = getNodeByIdFromRenderable(nodes, completedNodeId);
      if (!completedNode) return afterState.currentNodeId || null;
    
      const targetRow = Number(completedNode.row) + 1;
      const nextNode = nodes.find((node) => Number(node.row) === targetRow);
    
      return nextNode ? nextNode.id : null;
    }
    
    function renderMapScreen(statusMessage = "", options = {}) {
      refreshState();
    
      const {
        transitionFromState = null,
        transitionCompletedNodeId = null,
        forceInitialReveal = false,
      } = options;
      
      const lastCompletedNodeId = forceInitialReveal
        ? null
        : (transitionCompletedNodeId || state.lastCompletedNodeId);
    
      const isLevelUpSequence = Boolean(lastCompletedNodeId);
    
      const renderState = transitionFromState || state;
      const nodes = window.BlastAdventureData.getRenderableNodes(renderState);
    
      const nextCurrentNodeId = lastCompletedNodeId
        ? getNextNodeIdByRow(state, lastCompletedNodeId)
        : state.currentNodeId;
    
        mount.innerHTML = `
          <div class="nb-page nb-map-page${forceInitialReveal ? " nb-map-page--enter" : ""}">
          <div class="nb-page-center">
            <div class="nb-map-stage">
              <div class="nb-map-grid">
                ${buildMapGridMarkup(nodes, { isLevelUpSequence })}
              </div>
            </div>
          </div>
        </div>
      `;

      refreshAdventureLayout();

      if (forceInitialReveal) {
        requestAnimationFrame(() => {
          mount.querySelector(".nb-map-page")?.classList.add("is-visible");
        });
      }
    
      mount.querySelectorAll(".nb-map-node[data-node-id]").forEach((el) => {
        el.addEventListener("click", async () => {
          const nodeId = el.dataset.nodeId;
          if (!nodeId) return;
          await handleNode(nodeId);
        });
      });
    
      const nodeEls = Array.from(mount.querySelectorAll(".nb-map-node-enter"));
      const currentNodeEl = !isLevelUpSequence
        ? mount.querySelector(".nb-map-node.is-current")
        : null;
    
      if (!isLevelUpSequence) {
        const laneOrder = { left: 0, center: 1, right: 2 };
    
        nodeEls
          .sort((a, b) => {
            const rowA = Number(a.dataset.nodeRow);
            const rowB = Number(b.dataset.nodeRow);
    
            if (rowA !== rowB) return rowA - rowB;
    
            const laneA = laneOrder[a.dataset.nodeLane] ?? 0;
            const laneB = laneOrder[b.dataset.nodeLane] ?? 0;
    
            return laneA - laneB;
          })
          .forEach((el, index) => {
            setTimeout(() => {
              el.classList.add("is-visible");
            }, index * 90);
          });
    
        if (currentNodeEl) {
          const totalLoadMs = Math.max(0, (nodeEls.length - 1) * 90 + 420);
          setTimeout(() => {
            currentNodeEl.classList.add("nb-node-idle");
          }, totalLoadMs);
        }
    
        return;
      }
    
      const completedEl = mount.querySelector(
        `.nb-map-node[data-node-id="${lastCompletedNodeId}"]`
      );
    
      const nextEl = nextCurrentNodeId
        ? mount.querySelector(`.nb-map-node[data-node-id="${nextCurrentNodeId}"]`)
        : null;
    
      if (completedEl) {
        const completedImg = completedEl.querySelector(".nb-map-node-icon");
    
        setTimeout(() => {
          completedEl.classList.remove("is-current", "nb-node-idle");
          completedEl.classList.add("is-complete");
          completedEl.disabled = true;
          completedEl.setAttribute("data-node-current", "false");
          completedEl.setAttribute("data-node-complete", "true");
    
          if (completedImg) {
            completedImg.classList.remove(
              "nb-map-node-icon--tall",
              "nb-map-node-icon--wide"
            );
            completedImg.classList.add("nb-map-node-icon--check");
            completedImg.src = "images/adventure/map/check.svg";
          }
    
          completedEl.classList.add("nb-node-check-pop");
        }, 260);
      }
    
      if (nextEl && nextEl !== completedEl) {
        setTimeout(() => {
          nextEl.classList.remove("is-incomplete", "nb-map-node-enter");
          nextEl.classList.add("is-current");
          nextEl.disabled = false;
          nextEl.setAttribute("data-node-current", "true");
          nextEl.classList.add("nb-node-activate-pop");
        }, 620);
    
        setTimeout(() => {
          nextEl.classList.add("nb-node-idle");
        }, 980);
      }
    
      setTimeout(() => {
        state.lastCompletedNodeId = null;
        save();
      }, 1200);
    }

    async function handleNode(nodeId) {
      refreshState();
      const map = window.BlastAdventureData.getCurrentMap(state);
      const node = window.BlastAdventureData.getNodeById(map, nodeId);
      if (!node) return;
    
      if (node.type === "reward" || node.type === "heal") {
        const beforeState = JSON.parse(JSON.stringify(state));
    
        state = window.BlastAdventureData.resolveNode(state, nodeId, "win");
        state.lastCompletedNodeId = nodeId;
        save();
    
        renderMapScreen("", {
          transitionFromState: beforeState,
          transitionCompletedNodeId: nodeId,
        });
        return;
      }
    
      if (node.type === "battle" || node.type === "boss") {
        const game = window.createNumberBlastGame({
          config: {
            mount,
            mode: "adventure",
            level: state.currentLevelId,
            nodeId: node.id,
            battleConfig: node.battle,
            enemyName: node.battle?.enemyName,
            enemySprite: node.battle?.enemySprite,
            heroName: node.battle?.heroName,
            heroSprite: node.battle?.heroSprite,
          },
        });
    
        const result = await game.start();

        const characterId = state.selectedCharacterId || "knight";

        if (Number.isFinite(result?.remainingLives)) {
          window.BlastAdventureData.syncCharacterHearts(state, result.remainingLives, characterId);
          save();
        }

        if (result?.outcome === "win") {
          const beforeState = JSON.parse(JSON.stringify(state));

          state = window.BlastAdventureData.resolveNode(state, nodeId, "win");

          const pickedReward = window.BlastAdventureData.rollBattleReward();
          const rewardResult = window.BlastAdventureData.applyBattleReward(state, pickedReward.id);

          state.lastCompletedNodeId = nodeId;
          save();

          renderBattleRewardScreen({
            reward: rewardResult.reward,
            display: rewardResult.display,
            onContinue: () => {
              transitionRewardToMap();
            },
          });

          return;
        }

        save();
        renderMapScreen();
      }
    }

    window.__showMap = renderMapScreen;

    window.__testMapTransitionWithLoad = function (beforeState, afterState, completedNodeId) {
      // Step 1: save BEFORE state and render it (like a real page load)
      window.BlastAdventureData.saveState(beforeState);
      state = beforeState;
    
      window.__showMap();
    
      // Step 2: after a short delay, apply the win + animate
      setTimeout(() => {
        window.BlastAdventureData.saveState(afterState);
        state = afterState;
    
        renderMapScreen("", {
          transitionFromState: beforeState,
          transitionCompletedNodeId: completedNodeId,
        });
      }, 500); // tweak timing if needed
    };

    return { start };
  }

  window.createBlastAdventureApp = createBlastAdventureApp;
})();
