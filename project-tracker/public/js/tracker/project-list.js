// A person's projects, most recently active first: used by the projects screen and the switching sheet.
import { closest, escapeHtml } from '../shared/dom.js';
import { githubRepo, shortUrl } from '../shared/tracker.js';
import { icon } from '../ui/icons.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

const SEARCH_FROM = 7;                             // projects before the search field shows

function lastActive(project, items) {
  return items.reduce((latest, i) => (i.projectId === project.id && i.movedAt > latest ? i.movedAt : latest), project.createdAt);
}

function rowHtml(p, items, selected) {
  const mine = items.filter((i) => i.projectId === p.id);
  const todo = mine.filter((i) => i.status === 'todo').length;
  const test = mine.filter((i) => i.status === 'test').length;
  const counts = todo || test
    ? `${todo ? `<span class="count-todo">${todo} todo</span>` : ''}${test ? `<span class="count-test">${test} test</span>` : ''}`
    : '<span>Nothing open</span>';
  const repo = p.url
    ? `<a class="switch-repo" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer"
        aria-label="Open the repo of ${escapeHtml(p.name)}" title="${escapeHtml(shortUrl(p.url))}">${icon(githubRepo(p.url) ? 'github' : 'code')}</a>`
    : '';
  return `<div class="switch-row${selected ? ' selected' : ''}" role="listitem">
    <button type="button" class="switch-pick" data-pick="${p.id}" aria-current="${selected}">
      <span class="project-emoji">${escapeHtml(p.emoji)}</span>
      <span class="switch-text"><span class="switch-name">${escapeHtml(p.name)}</span><span class="switch-counts">${counts}</span></span>
      ${selected ? '<span class="switch-current">Current</span>' : ''}
    </button>
    ${repo}
    <button type="button" class="switch-edit" data-edit="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">${icon('dots')}</button>
  </div>`;
}

/**
 * @param {{ list: HTMLElement, search: HTMLInputElement, searchRow: HTMLElement, empty: string,
 *   getProjects(): Project[], getItems(): Item[], getCurrent(): string | null,
 *   onPick(id: string): void, onEdit(id: string): void }} options
 */
export function createProjectList({ list, search, searchRow, empty, getProjects, getItems, getCurrent, onPick, onEdit }) {
  function render() {
    const items = getItems();
    const all = getProjects();
    searchRow.hidden = all.length < SEARCH_FROM;
    const query = search.value.trim().toLowerCase();
    const projects = all
      .map((p) => ({ p, at: lastActive(p, items) }))
      .sort((a, b) => b.at - a.at)
      .map(({ p }) => p)
      .filter((p) => !query || p.name.toLowerCase().includes(query));
    const current = getCurrent();
    list.innerHTML = projects.map((p) => rowHtml(p, items, p.id === current)).join('')
      || `<p class="switch-empty">${all.length ? 'No project matches.' : escapeHtml(empty)}</p>`;
  }

  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = /** @type {HTMLElement | null} */ (list.querySelector('[data-pick]'));
    if (first) first.click();
  });

  list.addEventListener('click', (e) => {
    const edit = closest(e, '[data-edit]');
    if (edit) return onEdit(edit.dataset.edit);
    const pick = closest(e, '[data-pick]');
    if (pick) onPick(pick.dataset.pick);
  });

  return {
    render,
    reset() {
      search.value = '';
      render();
    },
  };
}
