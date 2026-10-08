import { randomBytes } from 'node:crypto';
import {
  cleanUrl, DEFAULT_KIND, isEmoji, isHue, KIND_IDS, MAX_ITEMS, MAX_NAME, MAX_NOTE, MAX_PEOPLE, MAX_PROJECTS, MAX_TEXT, pickEmoji, pickHue,
  pickPersonEmoji, STATUS_IDS,
} from '../../public/js/shared/tracker.js';

/**
 * What's saved to disk (JSON): { schema, people, projects, items }.
 *   people    Person[] (public/js/shared/tracker.js), in the order they were added
 *   projects  Project[], each one person's, in the order they were added
 *   items     Item[], each in one project
 * Schema 1 had no people: its projects go to a first person, "Me" (see normalizeState).
 */
export const SCHEMA_VERSION = 2;

const ID = /^[a-f0-9]{1,32}$/;
const isId = (value) => typeof value === 'string' && ID.test(value);

export const newId = () => randomBytes(6).toString('hex');

export function createInitialState() {
  return { schema: SCHEMA_VERSION, people: [], projects: [], items: [] };
}

export const findPerson = (state, personId) => state.people.find((p) => p.id === personId);
export const findProject = (state, projectId) => state.projects.find((p) => p.id === projectId);
export const findItem = (state, itemId) => state.items.find((i) => i.id === itemId);

/** Text trimmed to `max` characters; '' for anything that isn't text. Line breaks are kept only when `multiline`. */
export function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  const text = multiline ? value.replace(/\r\n?/g, '\n') : value.replace(/\s+/g, ' ');
  return text.trim().slice(0, max).trim();
}

/** Two names that are the same apart from case ("Garden" and "garden"). */
export const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

const toTime = (value, fallback) => (Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback);

function normalizePerson(raw, now, taken) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, MAX_NAME);
  if (!name) return null;
  return {
    id: isId(raw.id) ? raw.id : newId(),
    name,
    emoji: isEmoji(raw.emoji) ? raw.emoji : pickPersonEmoji(taken),
    createdAt: toTime(raw.createdAt, now),
  };
}

function normalizeProject(raw, now, taken) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, MAX_NAME);
  if (!name) return null;
  return {
    id: isId(raw.id) ? raw.id : newId(),
    personId: raw.personId,
    name,
    emoji: isEmoji(raw.emoji) ? raw.emoji : pickEmoji(taken, name),   // from before emoji: one its name suggests
    hue: isHue(raw.hue) ? raw.hue : pickHue(taken),
    url: cleanUrl(raw.url) || null,                // none (or not a web address): null
    createdAt: toTime(raw.createdAt, now),
  };
}

function normalizeItem(raw, now, projectIds) {
  if (!raw || typeof raw !== 'object' || !projectIds.has(raw.projectId)) return null;
  const text = cleanText(raw.text, MAX_TEXT);
  if (!text) return null;
  const createdAt = toTime(raw.createdAt, now);
  return {
    id: isId(raw.id) ? raw.id : newId(),
    projectId: raw.projectId,
    text,
    note: cleanText(raw.note, MAX_NOTE, { multiline: true }),
    status: STATUS_IDS.includes(raw.status) ? raw.status : 'todo',
    kind: KIND_IDS.includes(raw.kind) ? raw.kind : DEFAULT_KIND,   // from before kinds: other
    createdAt,
    movedAt: toTime(raw.movedAt, createdAt),
  };
}

const unique = (list) => [...new Map(list.map((x) => [x.id, x])).values()];

/** Turns whatever was read from disk into a valid current-schema state (unusable entries are dropped). */
export function normalizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.projects)) return createInitialState();

  const people = [];
  for (const p of Array.isArray(raw.people) ? raw.people : []) {
    const person = normalizePerson(p, now, people);
    if (person && !people.some((x) => x.id === person.id || sameName(x.name, person.name))) people.push(person);
  }
  people.splice(MAX_PEOPLE);

  const projects = [];
  for (const p of raw.projects) {
    const project = normalizeProject(p, now, projects);
    if (!project) continue;
    if (!people.some((x) => x.id === project.personId)) {
      // nobody's (saved before there were people): they go to a first person, "Me", to be renamed
      if (!people.length) people.push({ id: newId(), name: 'Me', emoji: pickPersonEmoji([]), createdAt: now });
      project.personId = people[0].id;
    }
    const taken = (x) => x.id === project.id || (x.personId === project.personId && sameName(x.name, project.name));
    if (!projects.some(taken)) projects.push(project);   // ids are unique, and names within a person's projects
  }
  projects.splice(MAX_PROJECTS);

  const projectIds = new Set(projects.map((p) => p.id));
  const items = unique((Array.isArray(raw.items) ? raw.items : []).map((i) => normalizeItem(i, now, projectIds)).filter(Boolean));
  return { schema: SCHEMA_VERSION, people, projects, items: items.slice(0, MAX_ITEMS) };
}

/** What every screen receives. */
export function toView(state, appVersion) {
  return { version: appVersion, people: state.people, projects: state.projects, items: state.items };
}
