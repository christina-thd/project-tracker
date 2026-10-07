// Picking an emoji: a grid of suggestions, plus a field where any emoji can be typed (e.g. from a phone's emoji
// keyboard). The page needs a grid element and a text input; used by the project and person sheets.
import { closest, escapeHtml } from '../shared/dom.js';
import { firstEmoji } from '../shared/tracker.js';

/**
 * @param {{ grid: HTMLElement, custom: HTMLInputElement, choices: readonly string[], onPick(emoji: string): void }} options
 *   onPick: when one is tapped or typed (not when set())
 */
export function createEmojiPicker({ grid, custom, choices, onPick }) {
  let value = '';

  function render() {
    // the current one is offered too when it isn't among the choices (typed by hand)
    const offered = choices.includes(value) || !value ? choices : [value, ...choices];
    grid.innerHTML = offered.map((e) => `<button type="button" class="emoji${e === value ? ' selected' : ''}"
      data-emoji="${escapeHtml(e)}" role="radio" aria-checked="${e === value}">${escapeHtml(e)}</button>`).join('');
  }

  function pick(emoji) {
    value = emoji;
    render();
    onPick(emoji);
  }

  grid.addEventListener('click', (e) => {
    const button = closest(e, '[data-emoji]');
    if (button) pick(button.dataset.emoji);
  });

  // the first emoji typed is used
  custom.addEventListener('input', () => {
    const typed = firstEmoji(custom.value);
    if (!typed) return;
    custom.value = '';
    pick(typed);
  });

  return {
    get value() {
      return value;
    },
    /** Shows `emoji` as the chosen one (and clears the typing field). */
    set(emoji) {
      value = emoji;
      custom.value = '';
      render();
    },
  };
}
