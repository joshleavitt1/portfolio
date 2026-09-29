import { pitchRoom } from "./config.js?v=20260928-45";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderTile = (tile) => {
  if (tile.type === "logo") {
    return `
      <article class="pitch-tile pitch-tile--logo" data-tile="${escapeHtml(tile.id)}" aria-label="${escapeHtml(tile.label)}">
        <img src="${escapeHtml(pitchRoom.brand.logo)}" alt="${escapeHtml(pitchRoom.brand.name)}" />
      </article>
    `;
  }

  if (tile.type === "motion") {
    return `
      <article
        class="pitch-tile pitch-tile--motion"
        data-tile="${escapeHtml(tile.id)}"
        data-shader
        data-texture="${escapeHtml(pitchRoom.brand.shaderTexture)}"
        aria-label="${escapeHtml(tile.label)}"
      >
        <canvas aria-hidden="true"></canvas>
        <div class="cascade-mark" data-animated-mark aria-hidden="true">
          ${Array.from({ length: 5 }, (_, index) => `
            <span class="cascade-mark__slice cascade-mark__slice--${index + 1}">
              <img src="${escapeHtml(pitchRoom.brand.mark)}" alt="" />
            </span>
          `).join("")}
        </div>
      </article>
    `;
  }

  if (tile.type === "flow") {
    const flowVariant = tile.variant === "map" ? "map" : "scan";
    const legacyScanCard = tile.legacy?.scanCard || tile.scanCard;
    const legacyResult = tile.legacy?.result || tile.result;
    const mapOptions = tile.options || [];
    const scanPositions = [
      { x: "-0.95rem", angle: "-2.7deg" },
      { x: "-0.32rem", angle: "-0.9deg" },
      { x: "0.32rem", angle: "0.9deg" },
      { x: "0.95rem", angle: "2.7deg" },
    ];
    return `
      <article
        class="pitch-tile pitch-tile--flow"
        data-tile="${escapeHtml(tile.id)}"
        data-shader
        data-shader-variant="flow"
        data-texture="${escapeHtml(pitchRoom.brand.flowTexture)}"
        aria-label="${escapeHtml(tile.label)}"
      >
        <canvas aria-hidden="true"></canvas>
        <div
          class="pitch-flow"
          data-flow
          data-flow-variant="${escapeHtml(flowVariant)}"
          data-demo-values="${escapeHtml(JSON.stringify(tile.demoValues || tile.legacy?.demoValues || []))}"
          data-legacy-demo-values="${escapeHtml(JSON.stringify(tile.legacy?.demoValues || []))}"
          data-state="idle"
        >
          <form class="pitch-flow__form" data-flow-form autocomplete="off" novalidate>
            <label>
              <span>I build in</span>
              <input type="text" name="location" aria-label="I build in" />
            </label>
            <label>
              <span>I specialize in</span>
              <input type="text" name="specialty" aria-label="I specialize in" />
            </label>
            <label>
              <span>Ideal project value</span>
              <input type="text" name="value" aria-label="Ideal project value" />
            </label>
          </form>
          <div class="pitch-flow__scan" aria-hidden="true">
            <span class="pitch-flow__scan-beam"></span>
            ${scanPositions.map((position, index) => `
              <img
                class="pitch-flow__scan-card"
                src="${escapeHtml(legacyScanCard)}"
                alt=""
                style="--scan-index: ${index}; --scan-x: ${position.x}; --scan-rotate: ${position.angle}"
              />
            `).join("")}
          </div>
          <div class="pitch-flow__result" aria-hidden="true">
            <img src="${escapeHtml(legacyResult)}" alt="" />
          </div>
          <div class="pitch-flow__map" aria-hidden="true">
            <img class="pitch-flow__map-image" src="${escapeHtml(tile.map)}" alt="" />
            ${mapOptions.map((src, index) => `
              <span class="pitch-flow__map-option pitch-flow__map-option--${index + 1}${index === 2 ? " is-selected" : ""}" style="--map-option-index: ${index}">
                <img src="${escapeHtml(src)}" alt="" />
              </span>
            `).join("")}
          </div>
          <div class="pitch-flow__map-result" aria-hidden="true">
            <span class="pitch-flow__map-result-card">
              <img src="${escapeHtml(tile.result)}" alt="" />
            </span>
          </div>
        </div>
      </article>
    `;
  }

  if (tile.type === "phone") {
    return `
      <article class="pitch-tile pitch-tile--phone" data-tile="${escapeHtml(tile.id)}" aria-label="${escapeHtml(tile.label)}">
        <img src="${escapeHtml(tile.src)}" alt="" aria-hidden="true" />
      </article>
    `;
  }

  if (tile.type === "web") {
    return `
      <article class="pitch-tile pitch-tile--web" data-tile="${escapeHtml(tile.id)}" aria-label="${escapeHtml(tile.label)}">
        <img src="${escapeHtml(tile.src)}" alt="${escapeHtml(tile.label)}" />
      </article>
    `;
  }

  if (tile.type === "image") {
    return `
      <article class="pitch-tile pitch-tile--image" data-tile="${escapeHtml(tile.id)}">
        <img src="${escapeHtml(tile.src)}" alt="${escapeHtml(tile.label)}" />
      </article>
    `;
  }

  if (tile.type === "palette") {
    return `
      <article class="pitch-tile pitch-tile--palette" data-tile="${escapeHtml(tile.id)}" data-palette aria-label="${escapeHtml(tile.label)}">
        ${tile.colors.map((color, index) => `
          <div
            class="pitch-palette__color"
            style="--palette-color: ${escapeHtml(color.color)}; --palette-text: ${escapeHtml(color.text)}; --palette-share: ${Number(color.share)}fr; --palette-index: ${index}"
          >
            <span class="pitch-palette__name">${escapeHtml(color.name)}</span>
            <span class="pitch-palette__value">${escapeHtml(color.value)}</span>
          </div>
        `).join("")}
      </article>
    `;
  }

  return `<div class="pitch-tile pitch-tile--placeholder" data-tile="${escapeHtml(tile.id)}" style="--placeholder: ${escapeHtml(tile.color || "rgba(0, 0, 0, 0.1)")}" aria-hidden="true"></div>`;
};

const tilesById = Object.fromEntries(pitchRoom.tiles.map((tile) => [tile.id, tile]));
const primaryTiles = ["clay", "logo", "flow"].map((id) => tilesById[id]).filter(Boolean);

document.querySelector("#pitchRoom").innerHTML = `
  ${pitchRoom.hero.hidden ? "" : `
    <header class="pitch-hero">
      <div class="pitch-hero__copy">
        <p class="pitch-hero__eyebrow">Brand Concept</p>
        <h1>${escapeHtml(pitchRoom.hero.title)}</h1>
        <p>${escapeHtml(pitchRoom.hero.body)}</p>
      </div>
    </header>
  `}
  <section class="pitch-grid" data-intro aria-label="Selected ${escapeHtml(pitchRoom.brand.name)} brand moments">
    ${primaryTiles.map(renderTile).join("")}
    <div class="pitch-device-stack" aria-label="Cascade mobile brand moments">
      ${tilesById.motion ? renderTile(tilesById.motion) : ""}
      ${tilesById.phone ? renderTile(tilesById.phone) : ""}
    </div>
  </section>
`;

const mountAnimatedMarks = () => {
  document.querySelectorAll("[data-animated-mark]").forEach((mark) => {
    mark.addEventListener(
      "pitch:play-mark",
      () => {
        mark.classList.add("is-playing");
      },
      { once: true },
    );
  });
};

const mountFlows = () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-flow]").forEach((flow) => {
    const form = flow.querySelector("[data-flow-form]");
    const inputs = [...form.querySelectorAll("input")];
    let completionTimer = 0;
    let sequenceTimers = [];
    let running = false;
    let revealed = false;
    let activeIndex = 0;
    let demoRunning = false;
    let userInteracted = false;
    const parseValues = (attribute, fallback) => {
      try {
        const values = JSON.parse(attribute || "[]");
        return Array.isArray(values) && values.length === inputs.length ? values : fallback;
      } catch {
        return fallback;
      }
    };
    const flowVariant = flow.dataset.flowVariant === "map" ? "map" : "scan";
    const defaultValues = ["Dallas, TX", "Aviation", "$12.8M"];
    const demoValues = parseValues(
      flowVariant === "map" ? flow.dataset.demoValues : flow.dataset.legacyDemoValues,
      defaultValues,
    );

    const schedule = (callback, delay) => {
      const timer = window.setTimeout(callback, delay);
      sequenceTimers.push(timer);
      return timer;
    };

    const clearSequence = () => {
      sequenceTimers.forEach(window.clearTimeout);
      sequenceTimers = [];
    };

    const setActiveInput = (index, focus = false) => {
      activeIndex = index;
      inputs.forEach((input, inputIndex) => {
        const label = input.closest("label");
        const status = inputIndex < index ? "complete" : inputIndex === index ? "active" : "locked";
        label.dataset.status = status;
        input.readOnly = inputIndex !== index;
        input.tabIndex = inputIndex === index ? 0 : -1;
        input.setAttribute("aria-disabled", inputIndex === index ? "false" : "true");
      });
      if (focus) schedule(() => inputs[index]?.focus({ preventScroll: true }), 80);
    };

    const runDemo = () => {
      if (userInteracted || running || demoRunning || reduceMotion.matches) return;
      demoRunning = true;
      form.reset();
      setActiveInput(0);

      const typeField = (index) => {
        if (!demoRunning || userInteracted) return;
        const value = demoValues[index];
        let character = 0;

        const typeCharacter = () => {
          if (!demoRunning || userInteracted) return;
          character += 1;
          inputs[index].value = value.slice(0, character);

          if (character < value.length) {
            schedule(typeCharacter, 90);
            return;
          }

          inputs[index].closest("label").dataset.status = "complete";
          if (index < inputs.length - 1) {
            schedule(() => {
              setActiveInput(index + 1);
              typeField(index + 1);
            }, 420);
          } else {
            schedule(() => {
              demoRunning = false;
              finish();
            }, 650);
          }
        };

        typeCharacter();
      };

      typeField(0);
    };

    const takeOver = () => {
      if (userInteracted || running) return;
      const wasDemoRunning = demoRunning;
      userInteracted = true;
      demoRunning = false;
      clearSequence();
      window.clearTimeout(completionTimer);
      completionTimer = 0;
      running = false;
      if (wasDemoRunning || flow.dataset.state !== "form") form.reset();
      flow.dataset.state = "form";
      setActiveInput(0);
    };

    const finish = () => {
      if (running) return;
      running = true;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      inputs.forEach((input) => {
        input.readOnly = true;
        input.tabIndex = -1;
        input.setAttribute("aria-disabled", "true");
      });
      flow.dataset.state = "complete";

      if (reduceMotion.matches) {
        flow.dataset.state = flowVariant === "map" ? "map-result" : "result";
        return;
      }

      if (flowVariant === "map") {
        schedule(() => {
          flow.dataset.state = "map";
        }, 500);
        schedule(() => {
          flow.dataset.state = "map-result";
        }, 4100);
        return;
      }

      schedule(() => {
        flow.dataset.state = "scanning";
      }, 500);
      schedule(() => {
        flow.dataset.state = "result";
      }, 3300);
    };

    const advanceInput = (index) => {
      if (running || index !== activeIndex || !inputs[index].value.trim()) return;
      window.clearTimeout(completionTimer);
      const label = inputs[index].closest("label");
      label.dataset.status = "complete";

      if (index < inputs.length - 1) {
        setActiveInput(index + 1, true);
      } else {
        inputs[index].readOnly = true;
        inputs[index].tabIndex = -1;
        inputs[index].setAttribute("aria-disabled", "true");
        completionTimer = window.setTimeout(finish, 500);
      }
    };

    inputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        takeOver();
        if (running || index !== activeIndex) return;
        window.clearTimeout(completionTimer);
        if (!input.value.trim()) return;
        completionTimer = window.setTimeout(() => advanceInput(index), 550);
      });
      input.addEventListener("change", () => advanceInput(index));
      input.addEventListener("blur", () => advanceInput(index));
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        advanceInput(index);
      });
    });

    form.addEventListener("pointerdown", takeOver);
    form.addEventListener("focusin", takeOver);
    form.addEventListener("submit", (event) => event.preventDefault());
    setActiveInput(0);

    const revealFlow = () => {
      if (revealed) return;
      revealed = true;
      flow.dataset.state = "form";
      setActiveInput(0);
    };

    flow.addEventListener("pitch:reveal-flow", revealFlow, { once: true });

    flow.addEventListener("pitch:play-flow", () => {
      revealFlow();

      if (reduceMotion.matches) {
        inputs.forEach((input, index) => {
          input.value = demoValues[index];
          input.closest("label").dataset.status = "complete";
        });
        finish();
        return;
      }

      schedule(runDemo, 450);
    }, { once: true });
  });
};

const mountIntroSequence = () => {
  const grid = document.querySelector(".pitch-grid[data-intro]");
  if (!grid) return;

  const mobile = window.matchMedia("(max-width: 760px)");
  const tileIds = mobile.matches
    ? ["logo", "flow", "clay", "motion", "phone"]
    : ["clay", "flow", "logo", "phone", "motion"];
  const tileOrder = tileIds.map((id) => grid.querySelector(`[data-tile="${id}"]`)).filter(Boolean);
  const phone = grid.querySelector('[data-tile="phone"]');
  const mark = grid.querySelector("[data-animated-mark]");
  const webTile = grid.querySelector('[data-tile="clay"]');
  const logoTile = grid.querySelector('[data-tile="logo"]');
  const flow = grid.querySelector("[data-flow]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let contentReady = false;
  let markReady = false;
  const phoneVisible = true;
  const markVisible = true;
  let phonePlayed = false;
  let markPlayed = false;

  const maybePlayPhone = () => {
    if (!contentReady || !phoneVisible || phonePlayed) return;
    phonePlayed = true;
    phone?.classList.add("is-phone-playing");
  };

  const maybePlayMark = () => {
    if (!markReady || !markVisible || markPlayed) return;
    markPlayed = true;
    mark?.dispatchEvent(new Event("pitch:play-mark"));
  };

  const showEverything = () => {
    tileOrder.forEach((tile) => tile.classList.add("is-launched"));
    grid.classList.add("is-content-playing");
    webTile?.classList.add("is-content-visible");
    logoTile?.classList.add("is-content-visible");
    contentReady = true;
    markReady = true;
    phone?.classList.add("is-phone-playing");
    flow?.dispatchEvent(new Event("pitch:reveal-flow"));
    mark?.dispatchEvent(new Event("pitch:play-mark"));
    flow?.dispatchEvent(new Event("pitch:play-flow"));
    grid.classList.add("is-intro-complete");
    grid.removeAttribute("data-intro");
  };

  if (reduceMotion.matches) {
    showEverything();
    return;
  }

  requestAnimationFrame(() => {
    const tileStart = 120;
    const pairStep = 280;
    const contentLag = 170;
    let flowFallback = 0;
    let flowStarted = false;
    const startFlow = () => {
      if (flowStarted) return;
      flowStarted = true;
      window.clearTimeout(flowFallback);
      flow?.dispatchEvent(new Event("pitch:play-flow"));
    };
    const revealContent = {
      clay: () => webTile?.classList.add("is-content-visible"),
      flow: () => flow?.dispatchEvent(new Event("pitch:reveal-flow")),
      logo: () => logoTile?.classList.add("is-content-visible"),
      phone: () => {
        contentReady = true;
        maybePlayPhone();
      },
      motion: () => {
        const finalSlice = mark?.querySelector(".cascade-mark__slice--5");
        finalSlice?.addEventListener("animationend", startFlow, { once: true });
        markReady = true;
        maybePlayMark();
        flowFallback = window.setTimeout(startFlow, 2100);
      },
    };

    tileOrder.forEach((tile, index) => {
      const launchAt = tileStart + index * pairStep;
      window.setTimeout(() => tile.classList.add("is-launched"), launchAt);
      window.setTimeout(() => {
        grid.classList.add("is-content-playing");
        revealContent[tile.dataset.tile]?.();
      }, launchAt + contentLag);
    });

    const lastContentAt = tileStart + (tileOrder.length - 1) * pairStep + contentLag;
    window.setTimeout(() => {
      grid.classList.add("is-intro-complete");
      grid.removeAttribute("data-intro");
    }, lastContentAt + 950);
  });
};

const mountShaders = () => {
  document.querySelectorAll("[data-shader]").forEach((stage) => {
    const canvas = stage.querySelector("canvas");
    const gl = canvas?.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vertexSource = `
      attribute vec2 a_position;
      attribute vec2 a_uv;
      varying vec2 v_uv;
      void main() {
        v_uv = a_uv;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_time;
      uniform float u_variant;
      varying vec2 v_uv;
      void main() {
        float t = u_time * 0.001;
        vec2 uv = v_uv;
        float xFlow = sin(uv.y * 5.4 + t * 0.22) * 0.0036;
        xFlow += sin((uv.x + uv.y) * 3.2 - t * 0.14) * 0.0018;
        float yFlow = cos(uv.x * 4.4 - t * 0.18) * 0.003;
        yFlow += sin((uv.x - uv.y) * 3.8 + t * 0.12) * 0.0015;
        vec2 sampleUv = clamp(uv + vec2(xFlow, yFlow), 0.002, 0.998);
        vec4 color = texture2D(u_texture, sampleUv);
        float light = sin((uv.x * 2.7 + uv.y * 3.1) + t * 0.16) * 0.008;
        color.rgb += vec3(light, light * 0.28, 0.0);
        if (u_variant > 0.5) {
          float diagonal = abs(fract(uv.x * 0.72 + uv.y * 0.9 - t * 0.018) - 0.5);
          float streak = 1.0 - smoothstep(0.08, 0.28, diagonal);
          float bloom = 1.0 - smoothstep(0.0, 0.62, distance(uv, vec2(0.72, 0.18)));
          color.rgb = mix(color.rgb, vec3(0.96, 0.20, 0.012), 0.12);
          color.rgb = mix(color.rgb, vec3(1.0, 0.48, 0.24), streak * 0.10);
          color.rgb += vec3(0.012, 0.004, 0.0) * bloom;
        }
        gl_FragColor = color;
      }
    `;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };

    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const vertices = new Float32Array([
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1,
      -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.useProgram(program);

    const position = gl.getAttribLocation(program, "a_position");
    const uv = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);

    const time = gl.getUniformLocation(program, "u_time");
    const variant = gl.getUniformLocation(program, "u_variant");
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const image = new Image();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let ready = false;
    let visible = false;
    let frame = 0;

    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * scale));
      const height = Math.max(1, Math.round(bounds.height * scale));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const render = (now = 0) => {
      if (!ready) return;
      resize();
      gl.uniform1f(time, reduceMotion.matches ? 0 : now);
      gl.uniform1f(variant, stage.dataset.shaderVariant === "flow" ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (visible && !reduceMotion.matches && !document.hidden) {
        frame = requestAnimationFrame(render);
      }
    };

    image.addEventListener("load", () => {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      ready = true;
      canvas.classList.add("is-ready");
      render(performance.now());
    });
    image.src = stage.dataset.texture;

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) render(performance.now());
    }).observe(stage);

    new ResizeObserver(() => ready && render(performance.now())).observe(stage);
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && visible) render(performance.now());
    });
  });
};

const mountPalettes = () => {
  document.querySelectorAll("[data-palette]").forEach((palette) => {
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      palette.dataset.revealed = "true";
      observer.disconnect();
    }, { threshold: 0.35 }).observe(palette);
  });
};

mountAnimatedMarks();
mountFlows();
mountShaders();
mountPalettes();
mountIntroSequence();
