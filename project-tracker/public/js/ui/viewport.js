// Keeps --viewport-top and --viewport-height on the page equal to the part of the screen you can see,
// which shrinks when the keyboard opens. Sheets are sized from them (css/base.css), so a sheet you type in
// sits right above the keyboard instead of sliding under it; messages sit at its bottom.
// Phones without visualViewport keep the CSS fallbacks (the full screen).

export function trackVisibleViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement.style;
  const standalone = Boolean(/** @type {any} */ (navigator).standalone);

  // Opened from an iPhone home-screen icon, the page can be measured shorter than the screen (by about the status
  // bar), leaving the + and messages that much too high. The part missing at the bottom is added back
  // (--viewport-gap); 0 everywhere else.
  function missing() {
    if (!standalone) return 0;
    const screenHeight = innerWidth > innerHeight ? screen.width : screen.height;
    const gap = screenHeight - innerHeight;
    return gap > 0 && gap <= 120 ? gap : 0;
  }

  function update() {
    const keyboard = viewport.height < innerHeight - 100;   // the keyboard is open: its top is the bottom
    const gap = keyboard ? 0 : missing();
    root.setProperty('--viewport-top', `${viewport.offsetTop}px`);
    root.setProperty('--viewport-height', `${viewport.height + gap}px`);
    root.setProperty('--viewport-gap', `${gap}px`);
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);      // iOS pans the page when the keyboard opens
  window.addEventListener('resize', update);        // the page measured again (it may stop being short)
  update();

  // Opened from an iPhone home-screen icon, the screen is measured a little short until the page first scrolls
  // (a WebKit quirk): a 1px scroll and back, once it has drawn, makes it measure again, as a scroll would. That
  // can't work when the page is too short to scroll: then the gap above covers it.
  if (standalone) {
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
