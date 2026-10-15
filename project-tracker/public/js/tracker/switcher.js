// Switching project from inside one: the project's name in the header opens a sheet with the person's projects
// (js/tracker/project-list.js); picking one switches to it.
import { $, escapeHtml } from '../shared/dom.js';
import { githubRepo, shortUrl } from '../shared/tracker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { createProjectList } from './project-list.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

/**
 * @param {{ getProjects(): Project[], getItems(): Item[], getCurrent(): string | null, onPick(id: string): void,
 *   onEdit(id: string): void, onNew(): void }} options
 */
export function createSwitcher({ getProjects, getItems, getCurrent, onPick, onEdit, onNew }) {
  const search = /** @type {HTMLInputElement} */ ($('switchSearch'));
  const sheet = createSheet($('switchLayer'), { onClose: () => search.blur() });
  const list = createProjectList({
    list: $('switchList'),
    search,
    searchRow: $('switchSearchRow'),
    empty: 'No projects yet.',
    getProjects,
    getItems,
    getCurrent,
    onPick: (id) => {
      onPick(id);
      sheet.close();
    },
    onEdit,
  });

  $('switchNew').innerHTML = `${icon('plus')}<span>New project</span>`;
  $('switchNew').addEventListener('click', onNew);

  return {
    open() {
      list.reset();
      sheet.open();
    },
    close: () => sheet.close(),
    get isOpen() {
      return sheet.isOpen;
    },
    /** After a change: counts, names and order may differ. */
    refresh() {
      if (sheet.isOpen) list.render();
    },
  };
}
/**
 * The header: the project you're on (just "Projects" before there's one), and a link to its repo when it has one
 * (GitHub's mark for a GitHub repo, </> for anywhere else).
 */
export function renderProjectButton(project) {
  const button = $('projectButton');
  button.hidden = !project;
  $('appName').hidden = Boolean(project);
  const repo = /** @type {HTMLAnchorElement} */ ($('repoLink'));
  repo.hidden = !project?.url;
  if (project?.url && repo.href !== project.url) {
    repo.href = project.url;
    repo.innerHTML = icon(githubRepo(project.url) ? 'github' : 'code');
    repo.title = `Open ${shortUrl(project.url)}`;
    repo.setAttribute('aria-label', `Open the repo, ${shortUrl(project.url)}`);
  }
  if (!project) return;
  button.innerHTML = `<span class="project-emoji">${escapeHtml(project.emoji)}</span><span class="project-button-name">${escapeHtml(project.name)}</span>${icon('chevron')}`;
  button.setAttribute('aria-label', `${project.name}: switch project`);
}
