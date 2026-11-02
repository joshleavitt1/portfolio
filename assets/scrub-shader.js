/* The statement's blue fabric drifts only while its tile is in view. */
window.createScrubShader = function (canvas) {
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
  if (!gl) return;
  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() { vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uAspect;
    void main() {
      vec2 uv = vec2(vUv.x, 1. - vUv.y);
      float t = uTime * .22;
      float flow = sin(uv.x * 3.4 + uv.y * 2.8 + t);
      vec2 warp = vec2(sin(uv.y * 5. + t * .9), cos(uv.x * 4. - t * .7));
      uv = .07 + uv * .86 + warp * .035 + vec2(flow * .018, 0.);
      vec3 base = texture2D(uTexture, uv).rgb;
      vec2 p = vec2(vUv.x * uAspect, vUv.y);
      float fold = sin(p.x * 3.2 - p.y * 4.6 + t * 1.5);
      float broad = sin(p.x * 1.5 + p.y * 2.1 - t);
      float light = 1.03 + .025 * fold + .02 * broad;
      // Preserve the source's full grain and tonal detail while lifting the blue.
      vec3 color = base * vec3(.55, 1.08, 1.015) * light;
      color += vec3(0., .008, .012);
      gl_FragColor = vec4(color, 1.);
    }
  `;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const time = gl.getUniformLocation(program, 'uTime');
  const aspect = gl.getUniformLocation(program, 'uAspect');
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  let active = false, ready = false, frame = 0, started = 0;
  function draw(seconds) {
    if (!ready) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(time, seconds);
    gl.uniform1f(aspect, canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function tick(now) {
    if (!active || !ready) return;
    if (!started) started = now;
    draw((now - started) / 1000);
    frame = requestAnimationFrame(tick);
  }
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (ready && !active) draw(0);
  }
  new ResizeObserver(resize).observe(canvas);
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    ready = true;
    canvas.classList.add('is-ready');
    resize();
    draw(0);
    if (active) frame = requestAnimationFrame(tick);
  };
  image.src = new URL('assets/scrub/blue-shader-texture.png', document.baseURI).href;
  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      cancelAnimationFrame(frame);
      started = 0;
      if (active && ready) frame = requestAnimationFrame(tick);
      else draw(0);
    }
  };
};
