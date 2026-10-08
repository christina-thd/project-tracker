// Entry point: keeps the latest people, projects and items from the server and hands them to the views: the home
// screen (who's this?) and one person's projects. The server is the only source of truth; views never change
// anything locally, they send actions.
import { sendAction, subscribe } from './shared/api.js';
import { $ } from './shared/dom.js';
import { plural } from './shared/format.js';
import { storage } from './shared/storage.js';
import { nextStatus, statusLabel, STATUS_IDS } from './shared/tracker.js';
import { createAddSheet } from './tracker/add-sheet.js';
import { renderBoard, wireBoard } from './tracker/board.js';
import { renderHome, wireHome } from './tracker/home.js';
import { createItemSheet } from './tracker/item-sheet.js';
import { createPersonSheet } from './tracker/person-sheet.js';
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
let onHome = true;                               // the home screen is showing (else a person's projects)
let homeBehind = false;                          // came from the home screen: the back button returns there

const projectKey = () => `tracker.project.${person}`;
const getItem = (id) => items.find((i) => i.id === id);
const getPerson = () => people.find((p) => p.id === person);
const getProject = () => projects.find((p) => p.id === current);

const itemSheet = createItemSheet({ getItem, getProjects: () => allProjects, onDeleted: offerRestore });
let closeSwitcherNext = false;                   // a project was made from the project list: close that too
const projectSheet = createProjectSheet({
  getPersonId: () => person,
  getProjects: () => projects,
  getItems: () => items,
  onCreated: (id) => {
    showProject(id);
    closeSwitcherNext = switcher.isOpen;
  },
  onDeleted: (id) => {
    if (id === current) showProject(projects.find((p) => p.id !== id)?.id ?? null);
  },
  // once the project sheet is gone (going back is one step at a time), the list under it can close
  onClose: () => {
    if (closeSwitcherNext) switcher.close();
    closeSwitcherNext = false;
  },
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

// ----- the home screen and a person's projects -----

/** Someone picked on the home screen: their projects, and the phone's back button returns home. */
function pickPerson(id) {
  person = id;
  storage.set('tracker.person', id);
  current = storage.get(projectKey());
  keepChoicesValid();
  if (!homeBehind) {
    homeBehind = true;
    pushBack(() => {
      homeBehind = false;
      showHome();
    });
  }
  onHome = false;
  showView();
}

function forgetPerson() {
  person = null;
  storage.set('tracker.person', null);
  showHome();
}

/** The person button in the header: back to the home screen (through history, when that's where you came from). */
function goHome() {
  if (homeBehind) goBack();
  else showHome();
}

function showHome() {
  onHome = true;
  showView();
}

function showView() {
  if (clearArmed) disarmClear();
  $('homeView').hidden = !onHome;
  $('trackerView').hidden = onHome;
  render();
  window.scrollTo(0, 0);
}

function setTab(status) {
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
 * Keeps the choices pointing at what exists (something may be deleted on another screen): the person (else the
 * home screen), their projects, and the project you're on (else their first).
 */
function keepChoicesValid() {
  if (person && !getPerson()) {
    person = null;
    storage.set('tracker.person', null);
    onHome = true;
  }
  projects = allProjects.filter((p) => p.personId === person);
  if (person && !getProject()) {
    current = projects[0]?.id ?? null;
    storage.set(projectKey(), current);
  }
}

function render() {
  if (!loaded) return;
  if (onHome) {
    $('homeView').hidden = false;
    $('trackerView').hidden = true;
    $('addButton').hidden = true;
    return renderHome({ people, projects: allProjects, items, current: person });
  }
  const who = getPerson();
  $('personButton').textContent = who?.emoji ?? '';
  $('personButton').title = `${who?.name ?? ''}: switch person`;
  $('personButton').setAttribute('aria-label', `${who?.name ?? ''}: switch person`);
  const project = getProject();
  $('welcome').hidden = Boolean(project);
  for (const id of ['statusTabs', 'board', 'addButton']) $(id).hidden = !project;
  renderProjectButton(project);
  if (!project) {
    $('summary').textContent = '';
    return;
  }
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

// Clearing done items can't be undone: the first tap asks, a second one (within a few seconds) clears.
let clearArmed = null;
function clearDone() {
  if (!clearArmed) {
    $('clearDone').textContent = 'Clear all?';
    $('clearDone').classList.add('armed');
    clearArmed = setTimeout(disarmClear, 3000);
    return;
  }
  disarmClear();
  sendAction({ type: 'clearDone', projectId: current })
    .then(({ removed }) => toast(`Cleared ${plural(removed, 'done item')}`, { icon: 'check' }))
    .catch(toastError);
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
$('firstProject').innerHTML = `${icon('plus')}<span>Add your first project</span>`;
$('firstProject').addEventListener('click', () => projectSheet.open());
$('addButton').innerHTML = icon('plus');
$('addButton').addEventListener('click', openAdd);

$('projectButton').addEventListener('click', () => switcher.open());

wireBoard({
  onTab: setTab,
  onAdvance: advance,
  onOpen: (id) => itemSheet.open(id),
  onClearDone: clearDone,
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
    // this device's person, straight away; nobody picked yet: the home screen
    onHome = !getPerson();
    showView();
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
