// Entry point: keeps the latest people, projects and items from the server and hands them to the three screens, each
// a step deeper (the back button goes up one): home (who's this?), a person's projects, and one project's lists.
// The server is the only source of truth; views never change anything locally, they send actions.
import { sendAction, subscribe } from './shared/api.js';
import { $ } from './shared/dom.js';
import { storage } from './shared/storage.js';
import { nextStatus, statusLabel, STATUS_IDS } from './shared/tracker.js';
import { createAddSheet } from './tracker/add-sheet.js';
import { renderBoard, wireBoard } from './tracker/board.js';
import { clearDone } from './tracker/clear-done.js';
import { renderHome, wireHome } from './tracker/home.js';
import { createItemSheet } from './tracker/item-sheet.js';
import { createPersonSheet } from './tracker/person-sheet.js';
import { createProjectList } from './tracker/project-list.js';
import { createProjectSheet } from './tracker/project-sheet.js';
import { createSwitcher, renderProjectButton } from './tracker/switcher.js';
import { goBack, pushBack } from './ui/back.js';
import { addStatusIcons, icon } from './ui/icons.js';
import { closeTopSheet } from './ui/sheet.js';
import { toast, toastError } from './ui/toast.js';
import { trackVisibleViewport } from './ui/viewport.js';

/** @type {import('./shared/tracker.js').Person[]} */
let people = [];
/** @type {import('./shared/tracker.js').Project[]} */
let allProjects = [];
/** @type {import('./shared/tracker.js').Project[]} */
let projects = [];                               // the person's own
/** @type {import('./shared/tracker.js').Item[]} */
let items = [];
let loaded = false;
// what you were looking at, remembered on this device
let person = storage.get('tracker.person');      // who's using it (an id); the home screen picks
let current = null;                              // the project you're on (an id), remembered per person
let tab = STATUS_IDS.includes(storage.get('tracker.tab')) ? storage.get('tracker.tab') : 'todo';
/** @type {'home' | 'projects' | 'board'} */
let screen = 'home';
const DEPTH = { home: 0, projects: 1, board: 2 };   // history entries above the first screen (one per step in)

const projectKey = () => `tracker.project.${person}`;
const getItem = (id) => items.find((i) => i.id === id);
const getPerson = () => people.find((p) => p.id === person);
const getProject = () => projects.find((p) => p.id === current);

const itemSheet = createItemSheet({ getItem, getProjects: () => allProjects, onDeleted: offerRestore });
let closeSwitcherNext = false;                   // a project was made from the switching sheet: close that too
let openNext = null;                             // a project was made on the projects screen: open it once the sheet's gone
const projectSheet = createProjectSheet({
  getPersonId: () => person,
  getProjects: () => projects,
  getItems: () => items,
  onCreated: (id) => {
    if (screen === 'board') {
      showProject(id);
      closeSwitcherNext = switcher.isOpen;
    } else {
      openNext = id;
    }
  },
  onDeleted: (id) => {
    if (id === current && screen === 'board') goBack();   // back to the projects
  },
  // once the project sheet is gone (going back is one step at a time), what comes next can go ahead
  onClose: () => {
    if (closeSwitcherNext) switcher.close();
    closeSwitcherNext = false;
    const id = openNext;
    openNext = null;
    if (id) setTimeout(() => openProject(id), 0);
  },
});
const projectList = createProjectList({
  list: $('projectsList'),
  search: /** @type {HTMLInputElement} */ ($('projectsSearch')),
  searchRow: $('projectsSearchRow'),
  empty: 'No projects yet. Add your first one below.',
  getProjects: () => projects,
  getItems: () => items,
  getCurrent: () => null,
  onPick: (id) => openProject(id),
  onEdit: (id) => projectSheet.open(id),
});
const switcher = createSwitcher({
  getProjects: () => projects,
  getItems: () => items,
  getCurrent: () => current,
  onPick: (id) => showProject(id),
  onEdit: (id) => projectSheet.open(id),
  onNew: () => projectSheet.open(),
});
const addSheet = createAddSheet({
  getProjects: () => projects,
  onAdded: (status) => {
    if (tab !== status) setTab(status);           // show where it went
  },
});
let pickNext = null;                             // the first person was just added: show their projects once the sheet's gone
const personSheet = createPersonSheet({
  getPeople: () => people,
  getProjects: () => allProjects,
  onCreated: (id) => {
    if (people.filter((p) => p.id !== id).length === 0) pickNext = id;   // the first one: straight in
  },
  onDeleted: (id) => {
    if (id === person) forgetPerson();
  },
  onClose: () => {
    const id = pickNext;
    pickNext = null;
    if (id) setTimeout(() => pickPerson(id), 0);   // after the sheet's step back in history
  },
});

// ----- the three screens: home → a person's projects → a project -----

/** Someone picked on the home screen: their projects. */
function pickPerson(id) {
  person = id;
  storage.set('tracker.person', id);
  current = storage.get(projectKey());
  keepChoicesValid();
  pushBack(() => showScreen('home'));
  projectList.reset();
  showScreen('projects');
}

/** A project picked on the projects screen: its lists. */
function openProject(id) {
  showProject(id);
  pushBack(() => showScreen('projects'));
  showScreen('board');
}

function forgetPerson() {
  person = null;
  storage.set('tracker.person', null);
  goHome();
}

/** The person button in the header: back to the home screen, through history (as far back as that is). */
function goHome() {
  if (DEPTH[screen]) goBack(DEPTH[screen]);
  else render();
}

function showScreen(name) {
  if (clearArmed) disarmClear();
  screen = name;
  $('homeView').hidden = screen !== 'home';
  $('projectsView').hidden = screen !== 'projects';
  $('trackerView').hidden = screen !== 'board';
  render();
  window.scrollTo(0, 0);
}

function setTab(status) {
  if (clearArmed) disarmClear();
  tab = status;
  storage.set('tracker.tab', status);
  render();
}

function showProject(id) {
  if (clearArmed) disarmClear();                   // "Clear all?" was about the other project
  current = id;
  storage.set(projectKey(), id);
  render();
  window.scrollTo(0, 0);
}

/**
 * Keeps the choices pointing at what exists (something may be deleted on another screen): the person (else back to
 * the home screen), their projects, and the project you're on (else back to their projects).
 */
function keepChoicesValid() {
  if (person && !getPerson()) {
    person = null;
    storage.set('tracker.person', null);
    if (screen !== 'home') goHome();
  }
  projects = allProjects.filter((p) => p.personId === person);
  if (person && current && !getProject()) {
    current = null;
    storage.set(projectKey(), null);
    if (screen === 'board') goBack();
  }
}

/** The person's emoji at the top right: tap to go back to the home screen. */
function renderPersonButton(button, who) {
  button.textContent = who?.emoji ?? '';
  button.title = `${who?.name ?? ''}: switch person`;
  button.setAttribute('aria-label', `${who?.name ?? ''}: switch person`);
}

function render() {
  if (!loaded) return;
  $('addButton').hidden = screen !== 'board';
  document.body.classList.toggle('has-fab', screen === 'board');
  if (screen === 'home') return renderHome({ people, projects: allProjects, items, current: person });
  const who = getPerson();
  if (screen === 'projects') {
    $('projectsPerson').textContent = `Not ${who?.name ?? 'you'}?`;
    $('projectsEmoji').textContent = who?.emoji ?? '';
    $('projectsTitle').textContent = `Hi ${who?.name ?? ''}`;
    $('projectsTagline').textContent = projects.length ? 'Pick a project to work on' : 'Add your first project to get started';
    $('projectsNew').innerHTML = `${icon('plus')}<span>${projects.length ? 'New project' : 'Add your first project'}</span>`;
    $('projectsNew').classList.toggle('primary', !projects.length);
    $('projectsNew').classList.toggle('ghost', projects.length > 0);
    return projectList.render();
  }
  renderPersonButton($('personButton'), who);
  const project = getProject();
  renderProjectButton(project);
  if (!project) return;
  if (clearArmed && !items.some((i) => i.projectId === current && i.status === 'done')) disarmClear();
  renderBoard({ project, items, tab });
  $('addButton').style.setProperty('--hue', String(project.hue));   // the + takes the project's color
}

/** Opens the add sheet for the project you're on, adding to the tab you're on (Todo when you're on Done). */
const openAdd = () => addSheet.open(current, tab);

// ----- moving items along, with undo -----

function advance(itemId) {
  const item = getItem(itemId);
  const next = item && nextStatus(item.status);
  if (!next) return;
  const back = item.status;
  sendAction({ type: 'setStatus', itemId, status: next })
    .then(() => toast(next === 'done' ? 'Done' : `Moved to ${statusLabel(next)}`, {
      icon: next === 'done' ? 'check' : 'flask',
      action: { label: 'Undo', run: () => sendAction({ type: 'setStatus', itemId, status: back }).catch(toastError) },
    }))
    .catch(toastError);
}

/** After deleting an item: Undo adds it back (as a new item, with the same text, notes and status). */
function offerRestore(item) {
  toast('Deleted', {
    icon: 'trash',
    action: {
      label: 'Undo',
      run: () => sendAction({ type: 'addItem', projectId: item.projectId, text: item.text, note: item.note, status: item.status, kind: item.kind })
        .catch(toastError),
    },
  });
}

// Clearing done items: the first tap asks, a second one (within a few seconds) clears.
let clearArmed = null;
function tapClear() {
  if (!clearArmed) {
    $('clearDone').textContent = 'Clear all?';
    $('clearDone').classList.add('armed');
    clearArmed = setTimeout(disarmClear, 3000);
    return;
  }
  disarmClear();
  clearDone(current, items);
}
function disarmClear() {
  clearTimeout(clearArmed);
  clearArmed = null;
  $('clearDone').textContent = 'Clear';
  $('clearDone').classList.remove('armed');
}

// ----- start -----

trackVisibleViewport();
addStatusIcons(document);
wireHome({ onPick: pickPerson, onEdit: (id) => personSheet.open(id), onAdd: () => personSheet.open() });
$('personButton').addEventListener('click', goHome);
$('projectsPerson').addEventListener('click', goHome);
$('projectsNew').addEventListener('click', () => projectSheet.open());
$('addButton').innerHTML = icon('plus');
$('addButton').addEventListener('click', openAdd);

$('projectButton').addEventListener('click', () => switcher.open());

wireBoard({
  onTab: setTab,
  onAdvance: advance,
  onOpen: (id) => itemSheet.open(id),
  onClearDone: tapClear,
});

// On a PC: Escape closes the open sheet (like the back button); "n" or "+" opens the add sheet
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (e.repeat) return;                          // held down: one sheet, not everything behind it
    /** @type {HTMLElement} */ (document.activeElement)?.blur?.();   // an item's text and notes save on blur
    return closeTopSheet();
  }
  if (e.key !== 'n' && e.key !== '+') return;
  if (e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains('locked')) return;
  if (/** @type {Element} */ (e.target).closest('input, textarea, select')) return;
  if ($('addButton').hidden) return;
  e.preventDefault();
  openAdd();
});

// "2h ago" stays right while the page is open
setInterval(render, 60_000);

subscribe((view) => {
  const first = !loaded;
  people = view.people;
  allProjects = view.projects;
  items = view.items;
  loaded = true;
  // the project this device was on: read before keepChoicesValid(), which would otherwise save the first one over it
  if (first && person) current = storage.get(projectKey());
  keepChoicesValid();
  if (first) {
    // where this device was: its person's last project (with the screens before it in history, so back works), or
    // their projects; nobody picked yet: the home screen
    if (getPerson()) {
      pushBack(() => showScreen('home'));
      if (getProject()) pushBack(() => showScreen('projects'));
    }
    showScreen(!getPerson() ? 'home' : getProject() ? 'board' : 'projects');
  } else {
    render();
  }
  personSheet.refresh();
  addSheet.refresh();
  switcher.refresh();
  itemSheet.refresh();
  projectSheet.refresh();
}, showConnection);

// The live connection drops now and then (phone screen off, switching apps, Wi-Fi): it reconnects by itself, so
// "Offline" only shows when it's been down a few seconds.
let offlineTimer = null;
function showConnection(connected) {
  clearTimeout(offlineTimer);
  if (connected) return document.body.classList.remove('offline');
  offlineTimer = setTimeout(() => document.body.classList.add('offline'), 4000);
}
$('offline').innerHTML = `${icon('offline')}<span>Offline</span>`;
