// Run decorative motion only while the explainer is visible. Nothing here calls the product API.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('.workflow-demo').forEach((demo) => {
  const toggle = demo.querySelector('.workflow-toggle');
  let visible = false;
  let paused = false;
  const update = () => {
    demo.dataset.running = String(visible && !document.hidden && !paused && !reducedMotion.matches);
    if (toggle) {
      toggle.hidden = reducedMotion.matches;
      toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
      toggle.setAttribute('aria-pressed', String(paused));
    }
  };
  toggle?.addEventListener('click', () => { paused = !paused; update(); });
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.1 });
  observer.observe(demo);
  reducedMotion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  update();
});
