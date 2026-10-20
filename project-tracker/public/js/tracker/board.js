// The three status columns of the project you're on. Phones show one column at a time (the tabs pick it);
// wide screens show all three side by side (css/tracker.css). The backlog sits dimmed under Todo, and can be hidden.
import { $, closest, escapeHtml } from '../shared/dom.js';
import { ago, plural } from '../shared/format.js';
import { storage } from '../shared/storage.js';
import { BACKLOG, DEFAULT_KIND, isOpen, kindOf, nextStatus, STATUS_IDS } from '../shared/tracker.js';
import { icon, STATUS_ICONS } from '../ui/icons.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

const EMPTY = {
  todo: 'Nothing to do. Tap + to add something.',
  test: 'Nothing waiting for a test.',
  done: 'Nothing done yet.',
};

const ADVANCE_LABEL = { todo: 'Move to Test', test: 'Tested: move to Done' };

const open = (items) => items.filter((i) => isOpen(i.status)).length;
const backlogHidden = () => storage.get('tracker.backlog') === 'hidden';

// Items already shown, per list: only ones that just arrived in a list slide in (not every item on every update)
const shown = new Set();
let firstRender = true;

function itemHtml(item, hue, now) {
  const key = `${item.id}:${item.status}`;
  const arrived = !firstRender && !shown.has(key);
  shown.add(key);
  const advance = nextStatus(item.status);
  const button = item.status === BACKLOG
    ? `<span class="advance parked" aria-hidden="true">${icon(STATUS_ICONS.backlog)}</span>`
    : advance
    ?`<button type="button" class="advance" data-advance="${item.id}" aria-label="${ADVANCE_LABEL[item.status]}">${icon(STATUS_ICONS[item.status])}</button>`
    : `<span class="advance done" aria-hidden="true">${icon(STATUS_ICONS.done)}</span>`;
  const note = item.note ? `<span class="has-note" title="Has notes">${icon('note')}</span>` : '';
  // bugs and features show their emoji; "other" shows nothing, to keep the list calm
  const kind = item.kind !== DEFAULT_KIND ? `<span class="item-kind" title="${kindOf(item.kind).label}">${kindOf(item.kind).emoji}</span>` : '';
  return `<li class="item${arrived ? ' arrived' : ''}" data-item="${item.id}" style="--hue: ${hue}">${button}
    <div class="item-body"><p class="item-text">${escapeHtml(item.text)}</p><div class="item-meta">${kind}${note}<time>${ago(item.movedAt, now)}</time></div></div></li>`;
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
  renderBacklog(mine.filter((i) => i.status === BACKLOG).sort((a, b) => b.movedAt - a.movedAt), project.hue, now);
  $('board').dataset.tab = tab;
  $('clearDone').hidden = !mine.some((i) => i.status === 'done');
  $('summary').textContent = plural(open(mine), 'open item');
  firstRender = false;
}

function renderBacklog(list, hue, now) {
  $('backlog').hidden = list.length === 0;
  $('backlogList').innerHTML = list.map((i) => itemHtml(i, hue, now)).join('');
  $('backlog').querySelector('.backlog-title').innerHTML = `${icon('box')}<span>Backlog · ${list.length}</span>`;
  showBacklog(!backlogHidden());
}

function showBacklog(shown) {
  $('backlogList').hidden = !shown;
  $('backlog').querySelector('.backlog-toggle').textContent = shown ? 'Hide' : 'Show';
  $('backlogToggle').setAttribute('aria-expanded', String(shown));
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
  $('backlogToggle').addEventListener('click', () => {
    const hide = !backlogHidden();
    storage.set('tracker.backlog', hide ? 'hidden' : null);
    showBacklog(!hide);
  });
}
