// Keeps --viewport-top and --viewport-height on the page equal to the part of the screen you can see,
// which shrinks when the keyboard opens. Sheets are sized from them (css/base.css), so a sheet you type in
// sits right above the keyboard instead of sliding under it; the round + and messages sit at its bottom.
// Phones without visualViewport keep the CSS fallbacks (the full screen).

export function trackVisibleViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement.style;

  function update() {
    root.setProperty('--viewport-top', `${viewport.offsetTop}px`);
    root.setProperty('--viewport-height', `${viewport.height}px`);
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);      // iOS pans the page when the keyboard opens
  update();

  // Opened from an iPhone home-screen icon, the screen is measured a little short until the page first scrolls
  // (a WebKit quirk): a 1px scroll and back, once it has drawn, makes it measure again, as a scroll would.
  if (/** @type {any} */ (navigator).standalone) {
    const settle = () => {
      const { scrollY } = window;
      window.scrollTo(0, scrollY + 1);
      window.scrollTo(0, scrollY);
      update();
    };
    window.addEventListener('load', () => requestAnimationFrame(settle), { once: true });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) requestAnimationFrame(settle);   // back from the app switcher
    });
  }
}
