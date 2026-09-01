import './workflow.js';

const button = document.querySelector('.mobile-menu');
const nav = document.querySelector('#main-nav');
const setMenuOpen = (open) => {
  button?.setAttribute('aria-expanded', String(open));
  if (button) button.querySelector('span').textContent = open ? 'Close' : 'Menu';
  nav?.classList.toggle('open', open);
};
button?.addEventListener('click', () => setMenuOpen(button.getAttribute('aria-expanded') !== 'true'));
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && button?.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    button.focus();
  }
});
window.matchMedia('(max-width: 1050px)').addEventListener('change', () => setMenuOpen(false));
document.querySelectorAll('.faq-list details').forEach((item) => item.addEventListener('toggle', () => { if (item.open) document.querySelectorAll('.faq-list details[open]').forEach((other) => { if (other !== item) other.removeAttribute('open'); }); }));

if (document.body.dataset.publicPreview === 'true') {
  const previewNotice = document.querySelector('#preview-notice');
  document.querySelectorAll('[data-preview-action]').forEach((action) => {
    if (action.classList.contains('button')) action.innerHTML = 'Preview only · Signups closed <span aria-hidden="true">↗</span>';
    else action.textContent = 'Preview only';
    action.addEventListener('click', (event) => {
      event.preventDefault();
      setMenuOpen(false);
      previewNotice?.focus({ preventScroll: true });
    });
  });
}
