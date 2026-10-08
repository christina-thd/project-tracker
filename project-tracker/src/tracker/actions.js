import {
  cleanUrl, DEFAULT_KIND, isEmoji, isHue, KIND_IDS, MAX_ITEMS, MAX_NAME, MAX_NOTE, MAX_PEOPLE, MAX_PROJECTS, MAX_TEXT, pickEmoji, pickHue,
  pickPersonEmoji, STATUS_IDS,
} from '../../public/js/shared/tracker.js';
import { cleanText, findItem, findPerson, findProject, newId, sameName } from './state.js';

/** A rejected action. `status` is the HTTP status the API answers with. */
export class ActionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ActionError';
    this.status = status;
  }
}

// ----- input helpers -----

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new ActionError(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

function getPerson(state, personId) {
  const person = findPerson(state, personId);
  if (!person) throw new ActionError(`No person ${personId}`, 404);
  return person;
}

function getProject(state, projectId) {
  const project = findProject(state, projectId);
  if (!project) throw new ActionError(`No project ${projectId}`, 404);
  return project;
}

function getItem(state, itemId) {
  const item = findItem(state, itemId);
  if (!item) throw new ActionError(`No item ${itemId}`, 404);
  return item;
}

/** A name: required, and not the same as another's in `others` (ignoring case). */
function uniqueName(others, value, what, exceptId = null) {
  const name = cleanText(value, MAX_NAME);
  if (!name) throw new ActionError('name is required');
  const same = others.find((x) => x.id !== exceptId && sameName(x.name, name));
  if (same) throw new ActionError(`There is already ${what} "${same.name}"`, 409);
  return name;
}

/** A project name: unique among that person's projects (two people can both have a "Garden"). */
const projectName = (state, personId, value, exceptId = null) =>
  uniqueName(state.projects.filter((p) => p.personId === personId), value, 'a project', exceptId);

/** A project's link: the full address, or null for none ('' or null clears it). */
function projectUrl(value) {
  const url = cleanUrl(value);
  if (url === null) throw new ActionError('url must be a web address, like https://github.com/you/project');
  return url || null;
}

function emojiOrNull(emoji) {
  if (emoji != null && !isEmoji(emoji)) throw new ActionError('emoji must be a single emoji');
  return emoji ?? null;
}

// ----- actions -----
// Each handler changes `state` in place and may return a result for the caller. `now` is the time of the action.

const handlers = {
  /** Adds someone, with the emoji given or one nobody has yet. */
  addPerson(state, { name, emoji }, now) {
    if (state.people.length >= MAX_PEOPLE) throw new ActionError(`At most ${MAX_PEOPLE} people`);
    const person = {
      id: newId(),
      name: uniqueName(state.people, name, 'someone called'),
      emoji: emojiOrNull(emoji) ?? pickPersonEmoji(state.people),
      createdAt: now,
    };
    state.people.push(person);
    return { personId: person.id };
  },

  renamePerson(state, { personId, name }) {
    const person = getPerson(state, personId);
    person.name = uniqueName(state.people, name, 'someone called', person.id);
  },

  setPersonEmoji(state, { personId, emoji }) {
    const person = getPerson(state, personId);
    if (!isEmoji(emoji)) throw new ActionError('emoji must be a single emoji');
    person.emoji = emoji;
  },

  /** Removes someone, with their projects and everything in them. */
  removePerson(state, { personId }) {
    getPerson(state, personId);
    const theirs = new Set(state.projects.filter((p) => p.personId === personId).map((p) => p.id));
    state.people = state.people.filter((p) => p.id !== personId);
    state.projects = state.projects.filter((p) => !theirs.has(p.id));
    state.items = state.items.filter((i) => !theirs.has(i.projectId));
  },

  /** Adds a project for someone, with the emoji and color given, or ones picked for it (see pickEmoji, pickHue). */
  addProject(state, { personId, name, emoji, hue, url }, now) {
    getPerson(state, personId);
    if (state.projects.length >= MAX_PROJECTS) throw new ActionError(`At most ${MAX_PROJECTS} projects`);
    if (hue != null && !isHue(hue)) throw new ActionError('hue must be a whole number from 0 to 359');
    const clean = projectName(state, personId, name);
    const theirs = state.projects.filter((p) => p.personId === personId);
    const project = {
      id: newId(),
      personId,
      name: clean,
      emoji: emojiOrNull(emoji) ?? pickEmoji(theirs, clean),
      hue: hue ?? pickHue(theirs),
      url: projectUrl(url),
      createdAt: now,
    };
    state.projects.push(project);
    return { projectId: project.id };
  },

  setProjectEmoji(state, { projectId, emoji }) {
    const project = getProject(state, projectId);
    if (!isEmoji(emoji)) throw new ActionError('emoji must be a single emoji');
    project.emoji = emoji;
  },

  renameProject(state, { projectId, name }) {
    const project = getProject(state, projectId);
    project.name = projectName(state, project.personId, name, project.id);
  },

  /** A project's link (e.g. its GitHub repository); empty clears it. */
  setProjectUrl(state, { projectId, url }) {
    getProject(state, projectId).url = projectUrl(url);
  },

  setProjectHue(state, { projectId, hue }) {
    const project = getProject(state, projectId);
    if (!isHue(hue)) throw new ActionError('hue must be a whole number from 0 to 359');
    project.hue = hue;
  },

  /** Removes a project and everything in it. */
  removeProject(state, { projectId }) {
    getProject(state, projectId);
    state.projects = state.projects.filter((p) => p.id !== projectId);
    state.items = state.items.filter((i) => i.projectId !== projectId);
  },

  /** Adds an item to a project, to do unless another status is given. `note` and `kind` (bug, feature…) are optional. */
  addItem(state, { projectId, text, note, status, kind }, now) {
    getProject(state, projectId);
    if (state.items.length >= MAX_ITEMS) throw new ActionError(`At most ${MAX_ITEMS} items: clear some done ones first`);
    const clean = cleanText(text, MAX_TEXT);
    if (!clean) throw new ActionError('text is required');
    const item = {
      id: newId(),
      projectId,
      text: clean,
      note: cleanText(note, MAX_NOTE, { multiline: true }),
      status: oneOf(status ?? 'todo', STATUS_IDS, 'status'),
      kind: oneOf(kind ?? DEFAULT_KIND, KIND_IDS, 'kind'),
      createdAt: now,
      movedAt: now,
    };
    state.items.push(item);
    return { itemId: item.id };
  },

  /**
   * Changes what an item says, its note or its kind; only the fields given. An item stays in the project it was
   * added to.
   */
  editItem(state, { itemId, text, note, kind }) {
    const item = getItem(state, itemId);
    const clean = text === undefined ? item.text : cleanText(text, MAX_TEXT);
    if (!clean) throw new ActionError('text is required');
    if (kind !== undefined) oneOf(kind, KIND_IDS, 'kind');
    // all checked: change it
    item.text = clean;
    if (note !== undefined) item.note = cleanText(note, MAX_NOTE, { multiline: true });
    if (kind !== undefined) item.kind = kind;
  },

  setStatus(state, { itemId, status }, now) {
    const item = getItem(state, itemId);
    oneOf(status, STATUS_IDS, 'status');
    if (item.status === status) return;
    item.status = status;
    item.movedAt = now;
  },

  removeItem(state, { itemId }) {
    getItem(state, itemId);
    state.items = state.items.filter((i) => i.id !== itemId);
  },

  /** Removes a project's done items. */
  clearDone(state, { projectId }) {
    getProject(state, projectId);
    const before = state.items.length;
    state.items = state.items.filter((i) => !(i.projectId === projectId && i.status === 'done'));
    return { removed: before - state.items.length };
  },
};

export const ACTION_TYPES = Object.freeze(Object.keys(handlers));

/**
 * Applies one action to the state (mutating it) and returns the handler's result.
 * Throws ActionError for anything invalid; the state is left unchanged in that case.
 */
export function applyAction(state, action, now = Date.now()) {
  if (!action || typeof action !== 'object') throw new ActionError('Action must be a JSON object');
  if (!Object.hasOwn(handlers, action.type)) throw new ActionError(`Unknown action: ${action.type}`);
  return handlers[action.type](state, action, now) ?? { ok: true };
}
