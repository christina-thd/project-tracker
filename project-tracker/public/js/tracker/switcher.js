// Switching project: the project's name in the header opens a sheet listing every project, most recently active
// first, with how many items each has in Todo and Test. A search field shows once there are more than a few.
import { $, closest, escapeHtml } from '../shared/dom.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

const SEARCH_FROM = 7;                             // projects before the search field shows

/** When a project was last touched: its newest item move, or when it was added. */
function lastActive(project, items) {
  return items.reduce((latest, i) => (i.projectId === project.id && i.movedAt > latest ? i.movedAt : latest), project.createdAt);
}

/**
 * @param {{ getProjects(): Project[], getItems(): Item[], getCurrent(): string | null, onPick(id: string): void,
 *   onEdit(id: string): void, onNew(): void }} options
 */
export function createSwitcher({ getProjects, getItems, getCurrent, onPick, onEdit, onNew }) {
  const search = /** @type {HTMLInputElement} */ ($('switchSearch'));
  const sheet = createSheet($('switchLayer'), { onClose: () => search.blur() });

  function renderList() {
    const items = getItems();
    const query = search.value.trim().toLowerCase();
    const projects = getProjects()
      .map((p) => ({ p, at: lastActive(p, items) }))
      .sort((a, b) => b.at - a.at)
      .map(({ p }) => p)
      .filter((p) => !query || p.name.toLowerCase().includes(query));
    const current = getCurrent();

    $('switchList').innerHTML = projects.map((p) => {
      const mine = items.filter((i) => i.projectId === p.id);
      const todo = mine.filter((i) => i.status === 'todo').length;
      const test = mine.filter((i) => i.status === 'test').length;
      const counts = todo || test
        ? `${todo ? `<span class="count-todo">${todo} todo</span>` : ''}${test ? `<span class="count-test">${test} test</span>` : ''}`
        : '<span>Nothing open</span>';
      const selected = p.id === current;
      return `<div class="switch-row${selected ? ' selected' : ''}" role="listitem">
        <button type="button" class="switch-pick" data-pick="${p.id}" aria-current="${selected}">
          <span class="project-emoji">${escapeHtml(p.emoji)}</span>
          <span class="switch-text"><span class="switch-name">${escapeHtml(p.name)}</span><span class="switch-counts">${counts}</span></span>
          ${selected ? '<span class="switch-current">Current</span>' : ''}
        </button>
        <button type="button" class="switch-edit" data-edit="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">${icon('dots')}</button>
      </div>`;
    }).join('') || '<p class="switch-empty">No project matches.</p>';
  }

  $('switchNew').innerHTML = `${icon('plus')}<span>New project</span>`;
  $('switchNew').addEventListener('click', onNew);
  search.addEventListener('input', renderList);
  // Enter in the search picks the first match
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = /** @type {HTMLElement | null} */ ($('switchList').querySelector('[data-pick]'));
    if (first) first.click();
  });

  $('switchList').addEventListener('click', (e) => {
    const edit = closest(e, '[data-edit]');
    if (edit) return onEdit(edit.dataset.edit);
    const pick = closest(e, '[data-pick]');
    if (!pick) return;
    onPick(pick.dataset.pick);
    sheet.close();
  });

  return {
    open() {
      search.value = '';
      $('switchSearchRow').hidden = getProjects().length < SEARCH_FROM;
      renderList();
      sheet.open();
    },
    close: () => sheet.close(),
    get isOpen() {
      return sheet.isOpen;
    },
    /** After a change: counts, names and order may differ. */
    refresh() {
      if (!sheet.isOpen) return;
      $('switchSearchRow').hidden = getProjects().length < SEARCH_FROM;
      renderList();
    },
  };
}

/** The header button: the project you're on, with its color (just "Projects" before there's one). */
export function renderProjectButton(project) {
  const button = $('projectButton');
  button.hidden = !project;
  $('appName').hidden = Boolean(project);
  if (!project) return;
  button.innerHTML = `<span class="project-emoji">${escapeHtml(project.emoji)}</span><span class="project-button-name">${escapeHtml(project.name)}</span>${icon('chevron')}`;
  button.setAttribute('aria-label', `${project.name}: switch project`);
}
