// Picking what an item is (bug, feature or other) by its emoji alone, to keep it compact (the add and item sheets).
// The names are there for screen readers and as a tooltip.
import { closest } from '../shared/dom.js';
import { DEFAULT_KIND, KINDS } from '../shared/tracker.js';

/**
 * @param {HTMLElement} el  an empty element with role="radiogroup"
 * @param {{ onPick?: (kind: string) => void }} [options]
 */
export function createKindPicker(el, { onPick } = {}) {
  let value = DEFAULT_KIND;

  el.innerHTML = KINDS.map((k) => `<button type="button" class="kind" role="radio" data-kind="${k.id}" title="${k.label}"
    aria-label="${k.label}"><span class="kind-emoji" aria-hidden="true">${k.emoji}</span></button>`).join('');

  function render() {
    for (const button of el.querySelectorAll('[data-kind]')) {
      const selected = button instanceof HTMLElement && button.dataset.kind === value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
  }

  el.addEventListener('click', (e) => {
    const button = closest(e, '[data-kind]');
    if (!button) return;
    value = button.dataset.kind;
    render();
    onPick?.(value);
  });

  render();
  return {
    get value() {
      return value;
    },
    /** @param {string} kind */
    set(kind) {
      value = KINDS.some((k) => k.id === kind) ? kind : DEFAULT_KIND;
      render();
    },
  };
}
