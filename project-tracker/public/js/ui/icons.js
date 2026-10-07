// Line icons (24×24, drawn with the current text color; css/base.css styles svg.icon).

const PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  // a test tube: ready to test
  flask: '<path d="M9 3h6M10 3v6.5L5.2 17.8A2.2 2.2 0 0 0 7.1 21h9.8a2.2 2.2 0 0 0 1.9-3.2L14 9.5V3"/><path d="M7.5 15h9"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  dots: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  offline: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.6M19 12.9a10 10 0 0 0-2.2-1.6M2 9.3a15 15 0 0 1 4.3-2.8M22 9.3A15 15 0 0 0 10.5 5.1"/><path d="M12 20h.01"/>',
};

/** An icon as HTML, e.g. icon('plus'). */
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}

/** Each status's icon: todo an empty circle, test a test tube, done a check. */
export const STATUS_ICONS = Object.freeze({ todo: 'circle', test: 'flask', done: 'check' });

/**
 * Puts its status's icon in front of every [data-status] button and column dot inside `root` (tabs, the add and
 * item sheets' status pickers, the column headings). Runs once at start: the markup is in index.html.
 * @param {ParentNode} root
 */
export function addStatusIcons(root) {
  for (const el of root.querySelectorAll('.segmented > [data-status], .column-dot')) {
    const status = el instanceof HTMLElement && (el.dataset.status ?? el.closest('[data-status]')?.getAttribute('data-status'));
    if (STATUS_ICONS[status]) el.insertAdjacentHTML('afterbegin', icon(STATUS_ICONS[status]));
  }
}
