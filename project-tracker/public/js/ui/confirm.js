// Guarding what can't be undone (deleting a project or a person, with everything in them): a sheet that says what will
// go, and only lets you go ahead once you've typed "delete". It opens on top of the sheet that asked. The page needs
// the #confirmLayer markup (index.html).
import { $ } from '../shared/dom.js';
import { createSheet } from './sheet.js';

let resolveOpen = null;                            // the open() waiting for an answer
let confirmed = false;
const WORD = 'delete';                             // what has to be typed (capitals don't matter)

const input = /** @type {HTMLInputElement} */ ($('confirmInput'));
const go = /** @type {HTMLButtonElement} */ ($('confirmGo'));

const sheet = createSheet($('confirmLayer'), {
  // answers once the sheet has gone (one step back in history), so whoever asked can close their own sheet next
  onClose: () => {
    input.blur();
    resolveOpen?.(confirmed);
    resolveOpen = null;
  },
});

const matches = () => input.value.trim().toLowerCase() === WORD;

input.addEventListener('input', () => {
  go.disabled = !matches();
});

$('confirmForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!matches()) return input.focus();
  confirmed = true;
  sheet.close();
});

/**
 * Asks to confirm a delete by typing "delete". Resolves true once confirmed, false when cancelled (Cancel, swipe, back,
 * Escape).
 * @param {{ title: string, text: string, button: string }} options
 * @returns {Promise<boolean>}
 */
export function confirmDelete({ title, text, button }) {
  confirmed = false;
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmLabel').textContent = `Type "${WORD}" to confirm`;
  input.value = '';
  go.textContent = button;
  go.disabled = true;
  return new Promise((resolve) => {
    resolveOpen = resolve;
    sheet.open();
    setTimeout(() => input.focus(), 320);          // after it slides in
  });
}
