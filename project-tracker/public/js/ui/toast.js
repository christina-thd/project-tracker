import { $, escapeHtml } from '../shared/dom.js';
import { icon as iconHtml } from './icons.js';

let timer = null;
let onAction = null;

$('toast').addEventListener('click', (e) => {
  if (!(/** @type {Element} */ (e.target).closest('.toast-action'))) return;
  const run = onAction;
  hide();
  run?.();
});

function hide() {
  clearTimeout(timer);
  onAction = null;
  $('toast').classList.remove('show');
}

/**
 * A short message at the top of the screen, always in the same place: sheets stop below it (--toast-room in
 * css/base.css), so it never covers their title or Close button. The page needs <div class="toast" id="toast">.
 * `icon` (an icons.js name, e.g. 'check') shows in front of it; `action` adds a button, e.g. Undo.
 * @param {string} message
 * @param {{ error?: boolean, icon?: string | null, action?: { label: string, run: () => void } | null }} [options]
 */
export function toast(message, { error = false, icon = null, action = null } = {}) {
  const el = $('toast');
  const iconSpan = icon ? `<span class="toast-icon">${iconHtml(icon)}</span>` : '';
  const button = action ? `<button type="button" class="toast-action">${escapeHtml(action.label)}</button>` : '';
  el.innerHTML = `${iconSpan}<span class="toast-text">${escapeHtml(message)}</span>${button}`;
  el.classList.toggle('error', error);
  el.classList.toggle('actionable', Boolean(action));
  el.classList.add('show');
  onAction = action?.run ?? null;
  clearTimeout(timer);
  timer = setTimeout(hide, error ? 4000 : action ? 5000 : 2600);
}

/** Shows an error from a failed request. */
export const toastError = (err) => toast(err.message, { error: true });
