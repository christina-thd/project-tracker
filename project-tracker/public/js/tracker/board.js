// The three status columns of the project you're on. Phones show one column at a time (the tabs pick it);
// wide screens show all three side by side (css/tracker.css). The backlog sits dimmed under Todo, and can be hidden.
import { $, closest, escapeHtml } from '../shared/dom.js';
import { ago } from '../shared/format.js';
import { storage } from '../shared/storage.js';
import { BACKLOG, DEFAULT_KIND, kindOf, nextStatus, STATUS_IDS } from '../shared/tracker.js';
import { icon, STATUS_ICONS } from '../ui/icons.js';
import { isDragging } from './reorder.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

const EMPTY = {
  todo: 'Nothing to do. Tap + to add something.',
  test: 'Nothing waiting for a test.',
  done: 'Nothing done yet.',
};
// a 3D printing project's lists (shared/tracker.js statusLabel)
const PRINT_EMPTY = { ...EMPTY, test: 'Nothing waiting to print.', done: 'Nothing printed yet.' };

const ADVANCE_LABEL = { todo: 'Move to Test', test: 'Tested: move to Done' };
const PRINT_ADVANCE_LABEL = { todo: 'Move to To print', test: 'Printed: move to Printed' };

const byRank = (a, b) => a.rank - b.rank;
const backlogHidden = () => storage.get('tracker.backlog') === 'hidden';

// Items already shown, per list: only ones that just arrived in a list slide in (not every item on every update)
const shown = new Set();
let firstRender = true;

/**
 * @param {Project} project
 * @param {boolean} [grip] with a grip to drag it into another place (Todo and Test, with two items or more)
 */
function itemHtml(item, project, now, grip = false) {
  const hue = project.hue;
  const key = `${item.id}:${item.status}`;
  const arrived = !firstRender && !shown.has(key);
  shown.add(key);
  const advance = nextStatus(item.status);
  const button = item.status === BACKLOG
    ? `<span class="advance parked" aria-hidden="true">${icon(STATUS_ICONS.backlog)}</span>`
    : advance
    ?`<button type="button" class="advance" data-advance="${item.id}" aria-label="${(project.print ? PRINT_ADVANCE_LABEL : ADVANCE_LABEL)[item.status]}">${icon(STATUS_ICONS[item.status])}</button>`
    : `<span class="advance done" aria-hidden="true">${icon(STATUS_ICONS.done)}</span>`;
  const note = item.note ? `<span class="has-note" title="Has notes">${icon('note')}</span>` : '';
  const link = project.print && item.link ? `<span class="has-note" title="Has a link to the file">${icon('link')}</span>` : '';
  // bugs and features show their emoji; "other" shows nothing, to keep the list calm
  const kind = item.kind !== DEFAULT_KIND && !project.print ?`<span class="item-kind" title="${kindOf(item.kind).label}">${kindOf(item.kind).emoji}</span>` : '';
  return `<li class="item${arrived ? ' arrived' : ''}" data-item="${item.id}" style="--hue: ${hue}">${button}
    <div class="item-body"><p class="item-text">${escapeHtml(item.text)}</p><div class="item-meta">${kind}${link}${note}<time>${ago(item.movedAt, now)}</time></div></div>${grip
    ? `<button type="button" class="grip" data-grip aria-label="Drag to reorder">${icon('grip')}</button>` : ''}</li>`;
}

/**
 * Fills the columns with the project's items, in their order (newest first, unless dragged elsewhere), and the counts.
 * @param {{ project: Project, items: Item[], tab: string }} options
 */
export function renderBoard({ project, items, tab }) {
  const now = Date.now();
  const mine = items.filter((i) => i.projectId === project.id);

  for (const status of STATUS_IDS) {
    const list = mine.filter((i) => i.status === status).sort(byRank);
    const column = /** @type {HTMLElement} */ ($('board').querySelector(`.column[data-status="${status}"]`));
    const sortable = status === 'todo' || status === 'test';   // Todo and Test (To print) can be put in any order
    const grips = sortable && list.length > 1;
    if (!(sortable && isDragging())) {             // not under the item being dragged: once it's let go
      column.querySelector('.list').innerHTML = list.map((i) => itemHtml(i, project, now, grips)).join('');
    }
    column.querySelector('.count').textContent = list.length ? String(list.length) : '';
    const empty = /** @type {HTMLElement} */ (column.querySelector('.empty'));
    empty.textContent = (project.print ? PRINT_EMPTY : EMPTY)[status];
    empty.hidden = list.length > 0;
    column.classList.toggle('current', status === tab);
    const tabButton = $('statusTabs').querySelector(`[data-status="${status}"]`);
    tabButton.querySelector('.count').textContent = list.length ? String(list.length) : '';
    tabButton.classList.toggle('selected', status === tab);
    tabButton.setAttribute('aria-selected', String(status === tab));
  }
  renderBacklog(mine.filter((i) => i.status === BACKLOG).sort(byRank), project, now);
  $('board').dataset.tab = tab;
  $('clearDone').hidden = !mine.some((i) => i.status === 'done');
  firstRender = false;
}

function renderBacklog(list, project, now) {
  $('backlog').hidden = list.length === 0;
  $('backlogList').innerHTML = list.map((i) => itemHtml(i, project, now)).join('');
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
    if (closest(e, '[data-grip]')) return;         // dragging (js/tracker/reorder.js), not opening
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
