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
  document.querySelectorAll('[data-preview-action]').forEach((action) => {
    action.addEventListener('click', (event) => {
      event.preventDefault();
      setMenuOpen(false);
      action.blur();
    });
  });
}
