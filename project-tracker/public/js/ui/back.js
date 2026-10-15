// The phone's back button (and the Home Assistant app's) undoes the last thing opened (a sheet, or a screen: a
// person's projects, a project) instead of leaving the page. Each opened thing adds a history entry and a handler;
// going back runs the handlers of every entry it goes past, newest first.

const handlers = [];

// The entry the page starts on is step 0: a reload keeps the old page's entry, with its old depth.
history.replaceState({ depth: 0 }, '');

window.addEventListener('popstate', (e) => {
  const depth = e.state?.depth ?? 0;               // how many entries are left after going back
  while (handlers.length > depth) handlers.pop()();
});

/** Adds a history entry; `onBack` runs when the user goes back past it. */
export function pushBack(onBack) {
  handlers.push(onBack);
  history.pushState({ depth: handlers.length }, '');
}

/** Goes back `steps` entries (one by default), the same as pressing the back button that many times. */
export function goBack(steps = 1) {
  history.go(-steps);
}
