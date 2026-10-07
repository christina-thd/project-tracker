// The home screen: a tile per person, with how many items they have open. Picking one shows their projects;
// ⋯ on a tile edits that person; + adds someone.
import { $, closest, escapeHtml } from '../shared/dom.js';
import { plural } from '../shared/format.js';
import { icon } from '../ui/icons.js';

/** @typedef {import('../shared/tracker.js').Person} Person */
/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

/**
 * @param {{ people: Person[], projects: Project[], items: Item[], current: string | null }} view
 *   current: who this device last picked (marked on their tile)
 */
export function renderHome({ people, projects, items, current }) {
  $('homeTagline').textContent = people.length
    ? 'Pick yourself to see your projects.'
    : 'Add the people who use this, then pick yourself. Everyone has their own projects.';
  $('people').innerHTML = people.map((person) => {
    const theirs = new Set(projects.filter((p) => p.personId === person.id).map((p) => p.id));
    const open = items.filter((i) => theirs.has(i.projectId) && i.status !== 'done').length;
    const summary = theirs.size ? (open ? plural(open, 'open item') : 'All done') : 'No projects yet';
    const selected = person.id === current;
    return `<div class="person${selected ? ' selected' : ''}">
      <button type="button" class="person-pick" data-person="${person.id}">
        <span class="person-emoji">${escapeHtml(person.emoji)}</span>
        <span class="person-name">${escapeHtml(person.name)}</span>
        <span class="person-summary">${summary}</span>
      </button>
      <button type="button" class="person-edit" data-edit-person="${person.id}" aria-label="Edit ${escapeHtml(person.name)}">${icon('dots')}</button>
    </div>`;
  }).join('');
  $('addPerson').innerHTML = `${icon('plus')}<span>${people.length ? 'Add person' : 'Add the first person'}</span>`;
  $('addPerson').classList.toggle('primary', !people.length);   // the one thing to do on a first run
  $('addPerson').classList.toggle('ghost', people.length > 0);
}

/** @param {{ onPick(id: string): void, onEdit(id: string): void, onAdd(): void }} handlers */
export function wireHome({ onPick, onEdit, onAdd }) {
  $('people').addEventListener('click', (e) => {
    const edit = closest(e, '[data-edit-person]');
    if (edit) return onEdit(edit.dataset.editPerson);
    const pick = closest(e, '[data-person]');
    if (pick) onPick(pick.dataset.person);
  });
  $('addPerson').addEventListener('click', onAdd);
}
