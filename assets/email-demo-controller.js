// Preload near the viewport; play only after the embedded editor is ready.
// Observe the stable wrapper, not the oversized, transformed iframe.
(() => {
  document.querySelectorAll('.email-window').forEach(windowEl => {
    const frames = [...windowEl.querySelectorAll('iframe')];
    let inView = false;
    let exitTimer;
    const states = frames.map(frame => ({ frame, ready: false, sent: undefined, timer: 0 }));
    const sync = () => states.forEach(state => {
      const { frame } = state;
      const dev = frame.classList.contains('email-window__dev');
      const finished = frame.classList.contains('email-window__finished');
      const active = inView && !document.hidden;
      if (finished || !state.ready || state.sent === active) return;
      state.sent = active;
      clearTimeout(state.timer);
      if (dev) {
        windowEl.classList.remove('is-dev-playing');
        frame.contentWindow?.postMessage({type:'email-dev-preview',visible:false}, location.origin);
        if (active) state.timer = window.setTimeout(() => {
          windowEl.classList.add('is-dev-playing');
          frame.contentWindow?.postMessage({type:'email-dev-preview',visible:true}, location.origin);
        }, 700);
      } else frame.contentWindow?.postMessage({type:'email-demo-visibility',visible:active}, location.origin);
    });
    const preload = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      frames.forEach(frame => {
        if (frame.dataset.src) { frame.src = frame.dataset.src; delete frame.dataset.src; }
      });
      preload.disconnect();
    }, {rootMargin:'700px 0px'});
    preload.observe(windowEl);
    new IntersectionObserver(([entry]) => {
      clearTimeout(exitTimer);
      if (entry.isIntersecting) { inView = true; sync(); }
      else exitTimer = window.setTimeout(() => { inView = false; sync(); }, 180);
    }, {threshold:.1}).observe(windowEl);
    window.addEventListener('message', event => {
      if (event.origin !== location.origin) return;
      const state = states.find(item => event.source === item.frame.contentWindow);
      if (!state) return;
      const expected = state.frame.classList.contains('email-window__dev') ? 'email-dev-ready' : 'email-demo-ready';
      if (event.data?.type !== expected) return;
      state.ready = true;
      sync();
    });
    document.addEventListener('visibilitychange', sync);
  });
})();
