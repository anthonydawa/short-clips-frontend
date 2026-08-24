const button = document.querySelector('.mobile-menu');
const nav = document.querySelector('#main-nav');
button?.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!open)); button.querySelector('span').textContent = open ? 'Menu' : 'Close'; nav?.classList.toggle('open', !open); });
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { button?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }));
document.querySelectorAll('.faq-list details').forEach((item) => item.addEventListener('toggle', () => { if (item.open) document.querySelectorAll('.faq-list details[open]').forEach((other) => { if (other !== item) other.removeAttribute('open'); }); }));
