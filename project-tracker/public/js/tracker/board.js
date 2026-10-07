// The three status columns of the project you're on. Phones show one column at a time (the tabs pick it);
// wide screens show all three side by side (css/tracker.css).
import { $, closest, escapeHtml } from '../shared/dom.js';
import { ago, plural } from '../shared/format.js';
import { nextStatus, STATUS_IDS } from '../shared/tracker.js';
import { icon, STATUS_ICONS } from '../ui/icons.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

const EMPTY = {
  todo: 'Nothing to do. Tap + to add something.',
  test: 'Nothing waiting for a test.',
  done: 'Nothing done yet.',
};

const ADVANCE_LABEL = { todo: 'Move to Test', test: 'Tested: move to Done' };

const open = (items) => items.filter((i) => i.status !== 'done').length;

// Items already shown, per list: only ones that just arrived in a list slide in (not every item on every update)
const shown = new Set();
let firstRender = true;

function itemHtml(item, hue, now) {
  const key = `${item.id}:${item.status}`;
  const arrived = !firstRender && !shown.has(key);
  shown.add(key);
  const advance = nextStatus(item.status);
  const button = advance
    ? `<button type="button" class="advance" data-advance="${item.id}" aria-label="${ADVANCE_LABEL[item.status]}">${icon(STATUS_ICONS[item.status])}</button>`
    : `<span class="advance done" aria-hidden="true">${icon(STATUS_ICONS.done)}</span>`;
  const note = item.note ? `<span class="has-note" title="Has notes">${icon('note')}</span>` : '';
  return `<li class="item${arrived ? ' arrived' : ''}" data-item="${item.id}" style="--hue: ${hue}">${button}
    <div class="item-body"><p class="item-text">${escapeHtml(item.text)}</p><div class="item-meta">${note}<time>${ago(item.movedAt, now)}</time></div></div></li>`;
}

/**
 * Fills the columns with the project's items, newest move first, and the counts.
 * @param {{ project: Project, items: Item[], tab: string }} options
 */
export function renderBoard({ project, items, tab }) {
  const now = Date.now();
  const mine = items.filter((i) => i.projectId === project.id);

  for (const status of STATUS_IDS) {
    const list = mine.filter((i) => i.status === status).sort((a, b) => b.movedAt - a.movedAt);
    const column = /** @type {HTMLElement} */ ($('board').querySelector(`.column[data-status="${status}"]`));
    column.querySelector('.list').innerHTML = list.map((i) => itemHtml(i, project.hue, now)).join('');
    column.querySelector('.count').textContent = list.length ? String(list.length) : '';
    const empty = /** @type {HTMLElement} */ (column.querySelector('.empty'));
    empty.textContent = EMPTY[status];
    empty.hidden = list.length > 0;
    column.classList.toggle('current', status === tab);
    const tabButton = $('statusTabs').querySelector(`[data-status="${status}"]`);
    tabButton.querySelector('.count').textContent = list.length ? String(list.length) : '';
    tabButton.classList.toggle('selected', status === tab);
    tabButton.setAttribute('aria-selected', String(status === tab));
  }
  $('board').dataset.tab = tab;
  $('clearDone').hidden = !mine.some((i) => i.status === 'done');
  $('summary').textContent = plural(open(mine), 'open item');
  firstRender = false;
}

/**
 * One listener for the whole board.
 * @param {{ onTab(status: string): void, onAdvance(itemId: string): void, onOpen(itemId: string): void,
 *   onClearDone(): void }} handlers
 */
export function wireBoard(handlers) {
  $('statusTabs').addEventListener('click', (e) => {
    const tab = closest(e, '[data-status]');
    if (tab) handlers.onTab(tab.dataset.status);
  });
  $('board').addEventListener('click', (e) => {
    const advance = closest(e, '[data-advance]');
    if (advance) return handlers.onAdvance(advance.dataset.advance);
    const item = closest(e, '[data-item]');
    if (item) handlers.onOpen(item.dataset.item);
  });
  $('clearDone').addEventListener('click', handlers.onClearDone);
}
