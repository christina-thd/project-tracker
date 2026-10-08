// What the tracker is made of, shared by the server (validation) and the page (labels, colors).

/**
 * @typedef {'todo' | 'test' | 'done'} Status
 * @typedef {{ id: string, name: string, emoji: string, createdAt: number }} Person
 *   someone in the house: each person has their own projects (picked on the home screen; no passwords)
 * @typedef {{ id: string, personId: string, name: string, emoji: string, hue: number, url: string | null,
 *   createdAt: number }} Project
 *   emoji: what marks the project (header, project list); hue: its color (item stripe, the + button);
 *   url: its repository (e.g. on GitHub), opened from the header; null when it has none
 * @typedef {{ id: string, projectId: string, text: string, note: string, status: Status,
 *   createdAt: number, movedAt: number }} Item
 *   movedAt: when it got its current status (lists show the latest first)
 */

/** The way every item goes: todo → test (built, waiting to be tried) → done. A failed test sends it back to todo. */
export const STATUSES = Object.freeze([
  { id: 'todo', label: 'Todo' },
  { id: 'test', label: 'Test' },
  { id: 'done', label: 'Done' },
]);
export const STATUS_IDS = Object.freeze(STATUSES.map((s) => s.id));

/** @param {string} status */
export const statusLabel = (status) => STATUSES.find((s) => s.id === status)?.label ?? status;

/** Where the round button on an item takes it; null once done. */
export function nextStatus(status) {
  const index = STATUS_IDS.indexOf(status);
  return index >= 0 && index < STATUS_IDS.length - 1 ? STATUS_IDS[index + 1] : null;
}

export const MAX_NAME = 40;
export const MAX_URL = 300;
export const MAX_PEOPLE = 20;
export const MAX_TEXT = 300;
export const MAX_NOTE = 2000;
export const MAX_PROJECTS = 100;
export const MAX_ITEMS = 5000;

/** Project colors (hues), handed out in this order so neighbours look different. */
export const HUES = Object.freeze([230, 160, 30, 330, 190, 270, 95, 0, 50, 300]);

export const isHue = (value) => Number.isInteger(value) && value >= 0 && value < 360;

/** The first of `choices` that none of `taken` has yet (or the least used one). */
function leastUsed(choices, taken) {
  const uses = (choice) => taken.filter((t) => t === choice).length;
  return choices.reduce((best, choice) => (uses(choice) < uses(best) ? choice : best), choices[0]);
}

/** The first color no project has yet (or the least used one). */
export const pickHue = (projects) => leastUsed(HUES, projects.map((p) => p.hue));

// ----- a project's link (its repository) -----

/**
 * A project's link, as typed or pasted: '' for none, the full address for a web address (https:// is added when it's
 * left out, as in "github.com/you/repo"), or null when it isn't one.
 * @param {unknown} value
 */
export function cleanUrl(value) {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return '';
  const full = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url;
  try {
    url = new URL(full);
  } catch {
    return null;
  }
  const web = (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
  return web && url.href.length <= MAX_URL ? url.href : null;
}

/** A short form of a link for showing it: host and path, without https:// or a trailing slash. */
export const shortUrl = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const GITHUB = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[?#].*)?$/i;
const OWNER_REPO = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

/**
 * The project sheet's GitHub field, as typed after "github.com/": "you/project", or a whole GitHub link pasted in.
 * Gives the repo's address, '' for none, or null when it isn't a GitHub repo.
 * @param {unknown} value
 */
export function githubUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const match = GITHUB.exec(text) ?? OWNER_REPO.exec(text.replace(/^github\.com\//i, ''));
  return match ? `https://github.com/${match[1]}/${match[2]}` : null;
}

/** A GitHub repo's "owner/repo" (for the field), or null for any other link. */
export function githubRepo(url) {
  const match = url ? GITHUB.exec(url) : null;
  return match ? `${match[1]}/${match[2]}` : null;
}

// ----- people -----

/** A person's emoji, to pick from (any other emoji can be typed too). */
export const PERSON_EMOJIS = Object.freeze([
  '🦊', '🐻', '🐼', '🐸', '🐯', '🦁', '🐨', '🐰', '🐱', '🐶', '🦉', '🐙', '🦄', '🐝', '🐢', '🐧',
]);

/** The emoji for a new person: one nobody has yet (or the least used). */
export const pickPersonEmoji = (people) => leastUsed(PERSON_EMOJIS, people.map((p) => p.emoji));

// ----- project emoji -----

/** The ones offered to pick from (any other emoji can be typed too). */
export const EMOJIS = Object.freeze([
  '📱', '💻', '🌐', '🎮', '📚', '🎲', '🏠', '🌱', '💰', '📷', '🍳', '🎵',
  '✍️', '💼', '🚗', '✈️', '🧪', '🛠️', '🤖', '📊', '🎨', '🐾', '❤️', '⚽',
  '🎬', '🧩', '🔒', '☁️', '📦', '🚀', '⭐', '🔥',
]);

/** Whole words, also with -s, -es, -ing or -ed ("game" matches "games", not "endgame"). */
const words = (...list) => new RegExp(`\\b(?:${list.join('|')})(?:s|es|ing|ed)?\\b`);

/**
 * Words in a project's name that suggest an emoji (the first that matches wins).
 * @type {[RegExp, string][]}
 */
const SUGGESTIONS = [
  [words('recipe', 'food', 'cook', 'kitchen', 'meal'), '🍳'],   // before books: "Recipe book" is about food
  [words('game', 'gaming', 'play', 'steam', 'nintendo', 'xbox', 'playstation'), '🎮'],
  [words('book', 'library', 'libraries', 'read', 'reading', 'manga', 'comic', 'hoard'), '📚'],
  [words('card', 'dice', 'board ?game', 'munchkin'), '🎲'],
  [words('home', 'house', 'dashboard', 'assistant'), '🏠'],
  [words('garden', 'plant', 'sensor', 'grow'), '🌱'],
  [words('budget', 'money', 'finance', 'bank', 'invoice', 'pay', 'expense'), '💰'],
  [words('photo', 'camera', 'picture', 'image', 'gallery'), '📷'],
  [words('music', 'song', 'audio', 'sound', 'podcast'), '🎵'],
  [words('blog', 'write', 'writing', 'journal', 'note'), '✍️'],
  [words('work', 'job', 'client', 'office', 'api', 'gateway'), '💼'],
  [words('car', 'drive', 'driving'), '🚗'],
  [words('travel', 'trip', 'flight', 'holiday', 'vacation'), '✈️'],
  [words('test', 'qa', 'lab'), '🧪'],
  [words('tool', 'fix', 'repair', 'diy'), '🛠️'],
  [words('bot', 'ai', 'robot'), '🤖'],
  [words('stat', 'statistic', 'chart', 'report', 'analytic', 'tracker', 'track'), '📊'],
  [words('design', 'art', 'draw', 'drawing', 'paint'), '🎨'],
  [words('pet', 'dog', 'cat'), '🐾'],
  [words('sport', 'football', 'soccer', 'gym', 'fitness', 'run', 'running'), '⚽'],
  [words('movie', 'film', 'video', 'series'), '🎬'],
  [words('puzzle'), '🧩'],
  [words('security', 'secure', 'password', 'vpn'), '🔒'],
  [words('cloud', 'server', 'backup', 'nas'), '☁️'],
  [words('shipping', 'delivery', 'package', 'release'), '📦'],
  [words('launch', 'startup'), '🚀'],
  [words('app', 'mobile', 'phone', 'android', 'ios'), '📱'],
  [words('web', 'website', 'site', 'online'), '🌐'],
  [words('code', 'coding', 'dev', 'program', 'programming'), '💻'],
];

// An emoji as a phone's emoji keyboard types it: drawn as emoji by default (🎮), or asked to be with U+FE0F (✍️,
// ❤️), a flag (🇬🇷), or a keycap (1️⃣). Plain symbols that can be emoji but are text by default (©, ™, ↔) don't count.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|\p{Regional_Indicator}{2}|^[#*0-9]️?⃣$/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** One emoji (a single character as you see it, e.g. 👩‍💻 or 🇬🇷): no text, no spaces. */
export function isEmoji(value) {
  if (typeof value !== 'string' || !value || value.length > 16 || /\s/.test(value)) return false;
  return [...segmenter.segment(value)].length === 1 && EMOJI.test(value);
}
/** The first emoji in some text (what was typed or pasted), or ''. */
export function firstEmoji(text) {
  for (const { segment } of segmenter.segment(String(text ?? ''))) if (isEmoji(segment)) return segment;
  return '';
}

/** The emoji for a new project: one its name suggests, else one no project has yet (or the least used). */
export function pickEmoji(projects, name = '') {
  const lower = name.toLowerCase();
  const suggested = SUGGESTIONS.find(([words]) => words.test(lower))?.[1];
  return suggested ?? leastUsed(EMOJIS, projects.map((p) => p.emoji));
}
