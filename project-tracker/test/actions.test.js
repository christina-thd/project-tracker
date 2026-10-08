import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleanUrl, EMOJIS, firstEmoji, githubRepo, githubUrl, HUES, isEmoji, MAX_ITEMS, MAX_PEOPLE, MAX_PROJECTS, MAX_TEXT, nextStatus, PERSON_EMOJIS, pickEmoji,
} from '../public/js/shared/tracker.js';
import { ACTION_TYPES, ActionError, applyAction } from '../src/tracker/actions.js';
import { createInitialState } from '../src/tracker/state.js';

const T0 = 1_700_000_000_000;

/** A tracker with one person in it, "Me": most tests are about one person's projects. */
function withPerson() {
  const state = createInitialState();
  applyAction(state, { type: 'addPerson', name: 'Me' }, T0);
  return state;
}

/** applyAction, where addProject is for the first person unless the test says whose. */
const act = (state, action, now = T0) => applyAction(state,
  action?.type === 'addProject' && !('personId' in action) ? { ...action, personId: state.people[0]?.id } : action, now);

function setup() {
  const state = withPerson();
  const { projectId } = act(state, { type: 'addProject', name: 'Website' });
  return { state, projectId };
}

const rejects = (state, action, status = 400) => assert.throws(
  () => act(state, action),
  (err) => err instanceof ActionError && err.status === status,
);

test('people: names required and unique, an emoji nobody has yet, at most MAX_PEOPLE', () => {
  const state = createInitialState();
  const { personId } = applyAction(state, { type: 'addPerson', name: ' Chris ' }, T0);
  applyAction(state, { type: 'addPerson', name: 'Alex', emoji: '🐙' }, T0);
  applyAction(state, { type: 'addPerson', name: 'Sam' }, T0);
  assert.deepEqual(state.people.map((p) => [p.name, p.emoji]), [['Chris', PERSON_EMOJIS[0]], ['Alex', '🐙'], ['Sam', PERSON_EMOJIS[1]]]);
  rejects(state, { type: 'addPerson', name: 'chris' }, 409);
  rejects(state, { type: 'addPerson', name: '' });
  rejects(state, { type: 'addPerson', name: 'Bad', emoji: 'x' });
  applyAction(state, { type: 'renamePerson', personId, name: 'Christina' }, T0);
  applyAction(state, { type: 'setPersonEmoji', personId, emoji: '🦄' }, T0);
  assert.deepEqual([state.people[0].name, state.people[0].emoji], ['Christina', '🦄']);
  rejects(state, { type: 'renamePerson', personId, name: 'ALEX' }, 409);
  rejects(state, { type: 'renamePerson', personId: 'abc', name: 'X' }, 404);
  for (let i = state.people.length; i < MAX_PEOPLE; i++) applyAction(state, { type: 'addPerson', name: `P${i}` }, T0);
  rejects(state, { type: 'addPerson', name: 'One more' });
});

test('each person has their own projects; two people can use the same project name', () => {
  const state = createInitialState();
  const { personId: chris } = applyAction(state, { type: 'addPerson', name: 'Chris' }, T0);
  const { personId: alex } = applyAction(state, { type: 'addPerson', name: 'Alex' }, T0);
  applyAction(state, { type: 'addProject', personId: chris, name: 'Garden' }, T0);
  applyAction(state, { type: 'addProject', personId: alex, name: 'garden' }, T0);
  assert.deepEqual(state.projects.map((p) => [p.personId, p.name]), [[chris, 'Garden'], [alex, 'garden']]);
  rejects(state, { type: 'addProject', personId: chris, name: 'GARDEN' }, 409);
  rejects(state, { type: 'addProject', personId: 'abc', name: 'X' }, 404);
  rejects(state, { type: 'addProject', personId: undefined, name: 'X' }, 404);
});

test('removing a person removes their projects and items, and nobody else\'s', () => {
  const state = createInitialState();
  const { personId: chris } = applyAction(state, { type: 'addPerson', name: 'Chris' }, T0);
  const { personId: alex } = applyAction(state, { type: 'addPerson', name: 'Alex' }, T0);
  const { projectId: mine } = applyAction(state, { type: 'addProject', personId: chris, name: 'Mine' }, T0);
  const { projectId: theirs } = applyAction(state, { type: 'addProject', personId: alex, name: 'Theirs' }, T0);
  applyAction(state, { type: 'addItem', projectId: mine, text: 'a' }, T0);
  applyAction(state, { type: 'addItem', projectId: theirs, text: 'b' }, T0);
  applyAction(state, { type: 'removePerson', personId: chris }, T0);
  assert.deepEqual(state.people.map((p) => p.name), ['Alex']);
  assert.deepEqual(state.projects.map((p) => p.name), ['Theirs']);
  assert.deepEqual(state.items.map((i) => i.text), ['b']);
  rejects(state, { type: 'removePerson', personId: chris }, 404);
});

test('projects get the next unused color, or the one given', () => {
  const state = withPerson();
  act(state, { type: 'addProject', name: 'One' });
  act(state, { type: 'addProject', name: 'Two' });
  act(state, { type: 'addProject', name: 'Three', hue: 12 });
  assert.deepEqual(state.projects.map((p) => p.hue), [HUES[0], HUES[1], 12]);
  rejects(state, { type: 'addProject', name: 'Four', hue: 400 });
});

test('a new project gets the emoji its name suggests, else one not used yet, or the one given', () => {
  const state = withPerson();
  act(state, { type: 'addProject', name: 'Garden sensors' });
  act(state, { type: 'addProject', name: 'Munchkin Counter' });
  act(state, { type: 'addProject', name: 'Zzz' });
  act(state, { type: 'addProject', name: 'Mine', emoji: '🦄' });
  assert.deepEqual(state.projects.map((p) => p.emoji), ['🌱', '🎲', EMOJIS[0], '🦄']);
  rejects(state, { type: 'addProject', name: 'Bad', emoji: 'abc' });
});

test('changing a project emoji takes exactly one emoji', () => {
  const { state, projectId } = setup();
  act(state, { type: 'setProjectEmoji', projectId, emoji: '👩‍💻' });   // several code points, one emoji
  assert.equal(state.projects[0].emoji, '👩‍💻');
  for (const emoji of ['', 'a', '🎮🎲', '🎮 ', null]) rejects(state, { type: 'setProjectEmoji', projectId, emoji });
});

test('emoji helpers: what counts as one, the first in some text, suggestions by whole words', () => {
  for (const ok of ['🎮', '✍️', '❤️', '🇬🇷', '👩‍💻', '1️⃣', '#️⃣', '👍🏽']) assert.ok(isEmoji(ok), ok);
  for (const bad of ['x', '12', '🎮🎮', '', '©', '™', '↔', '1', 42]) assert.ok(!isEmoji(bad), String(bad));
  assert.equal(firstEmoji('hello 🌱 there 🎮'), '🌱');
  assert.equal(firstEmoji('no emoji'), '');
  assert.equal(pickEmoji([], 'Sales charts'), '📊');           // "chart", not "art"
  assert.equal(pickEmoji([], 'Recipe book'), '🍳');            // food before books
  assert.equal(pickEmoji([], 'Email cleanup'), EMOJIS[0]);   // "ai" only as a word
  assert.equal(pickEmoji([], 'Video games'), '🎮');            // plurals count
  for (const name of ['Cookie banner', 'Display driver', 'Spreadsheet', 'Network', 'Discard pile']) {
    assert.equal(pickEmoji([], name), EMOJIS[0], name);       // inside another word: no suggestion
  }
});

test('with nothing suggested, a new project gets the least used emoji', () => {
  const state = withPerson();
  for (const name of ['One', 'Two', 'Three']) act(state, { type: 'addProject', name });
  assert.deepEqual(state.projects.map((p) => p.emoji), EMOJIS.slice(0, 3));
});

test('project names are required, trimmed and unique (ignoring case)', () => {
  const { state, projectId } = setup();
  rejects(state, { type: 'addProject', name: '   ' });
  rejects(state, { type: 'addProject', name: ' website ' }, 409);
  act(state, { type: 'addProject', name: '  Mobile   app ' });
  assert.equal(state.projects[1].name, 'Mobile app');
  rejects(state, { type: 'renameProject', projectId, name: 'MOBILE APP' }, 409);
  act(state, { type: 'renameProject', projectId, name: 'WEBSITE' });   // its own name in other case is fine
  assert.equal(state.projects[0].name, 'WEBSITE');
});

test('items are added to do by default, or as ready to test', () => {
  const { state, projectId } = setup();
  const { itemId } = act(state, { type: 'addItem', projectId, text: '  Fix   the login  ' });
  act(state, { type: 'addItem', projectId, text: 'Dark mode', status: 'test', note: 'Settings → Theme' });
  assert.deepEqual(state.items[0], { id: itemId, projectId, text: 'Fix the login', note: '', status: 'todo', createdAt: T0, movedAt: T0 });
  assert.equal(state.items[1].status, 'test');
  assert.equal(state.items[1].note, 'Settings → Theme');
});

test('adding needs text and an existing project', () => {
  const { state, projectId } = setup();
  rejects(state, { type: 'addItem', projectId, text: ' ' });
  rejects(state, { type: 'addItem', projectId: 'abc', text: 'x' }, 404);
  rejects(state, { type: 'addItem', projectId, text: 'x', status: 'later' });
  act(state, { type: 'addItem', projectId, text: 'y'.repeat(MAX_TEXT + 50) });
  assert.equal(state.items[0].text.length, MAX_TEXT);
});

test('status moves along and records when', () => {
  const { state, projectId } = setup();
  const { itemId } = act(state, { type: 'addItem', projectId, text: 'Search' });
  act(state, { type: 'setStatus', itemId, status: 'test' }, T0 + 1000);
  assert.equal(state.items[0].status, 'test');
  assert.equal(state.items[0].movedAt, T0 + 1000);
  act(state, { type: 'setStatus', itemId, status: 'test' }, T0 + 5000);   // no change: same time
  assert.equal(state.items[0].movedAt, T0 + 1000);
  rejects(state, { type: 'setStatus', itemId, status: 'archived' });
});

test('the round button goes to do → to test → done, and stops there', () => {
  assert.equal(nextStatus('todo'), 'test');
  assert.equal(nextStatus('test'), 'done');
  assert.equal(nextStatus('done'), null);
});

test('editing changes only what is given, and never the project', () => {
  const { state, projectId } = setup();
  const { projectId: other } = act(state, { type: 'addProject', name: 'App' });
  const { itemId } = act(state, { type: 'addItem', projectId, text: 'Old', note: 'keep' });
  rejects(state, { type: 'editItem', itemId, text: '  ' });
  assert.equal(state.items[0].text, 'Old');                                    // nothing changed
  act(state, { type: 'editItem', itemId, text: 'New' });
  assert.deepEqual([state.items[0].text, state.items[0].note], ['New', 'keep']);
  act(state, { type: 'editItem', itemId, note: ' line 1\r\nline 2 ', projectId: other });   // projectId ignored
  assert.deepEqual([state.items[0].note, state.items[0].projectId], ['line 1\nline 2', projectId]);
});

test('clearing done items removes only that project\'s done ones', () => {
  const { state, projectId } = setup();
  const { projectId: other } = act(state, { type: 'addProject', name: 'App' });
  act(state, { type: 'addItem', projectId, text: 'a', status: 'done' });
  act(state, { type: 'addItem', projectId, text: 'b' });
  act(state, { type: 'addItem', projectId: other, text: 'c', status: 'done' });
  assert.deepEqual(act(state, { type: 'clearDone', projectId }), { removed: 1 });
  assert.deepEqual(state.items.map((i) => i.text), ['b', 'c']);
  rejects(state, { type: 'clearDone' }, 404);                                  // always one project
});

test('removing a project removes its items too', () => {
  const { state, projectId } = setup();
  const { projectId: other } = act(state, { type: 'addProject', name: 'App' });
  act(state, { type: 'addItem', projectId, text: 'a' });
  act(state, { type: 'addItem', projectId: other, text: 'b' });
  act(state, { type: 'removeProject', projectId });
  assert.deepEqual(state.projects.map((p) => p.name), ['App']);
  assert.deepEqual(state.items.map((i) => i.text), ['b']);
});

test('removing an item, and unknown ones', () => {
  const { state, projectId } = setup();
  const { itemId } = act(state, { type: 'addItem', projectId, text: 'a' });
  assert.deepEqual(act(state, { type: 'removeItem', itemId }), { ok: true });
  assert.equal(state.items.length, 0);
  rejects(state, { type: 'removeItem', itemId }, 404);
});

test('changing an unknown project, or to a bad color, is rejected', () => {
  const { state, projectId } = setup();
  rejects(state, { type: 'renameProject', projectId: 'abc', name: 'X' }, 404);
  rejects(state, { type: 'setProjectHue', projectId: 'abc', hue: 10 }, 404);
  rejects(state, { type: 'setProjectEmoji', projectId: 'abc', emoji: '🎮' }, 404);
  rejects(state, { type: 'removeProject', projectId: 'abc' }, 404);
  rejects(state, { type: 'setProjectHue', projectId, hue: 360 });
  rejects(state, { type: 'setProjectHue', projectId, hue: 1.5 });
  act(state, { type: 'setProjectHue', projectId, hue: 12 });
  assert.equal(state.projects[0].hue, 12);
});

test('there is a limit on projects and items', () => {
  const state = withPerson();
  for (let i = 0; i < MAX_PROJECTS; i++) act(state, { type: 'addProject', name: `P${i}` });
  rejects(state, { type: 'addProject', name: 'One more' });
  const projectId = state.projects[0].id;
  state.items = Array.from({ length: MAX_ITEMS }, (_, i) => ({ id: `${i}`, projectId, text: 'x', note: '', status: 'done', createdAt: T0, movedAt: T0 }));
  rejects(state, { type: 'addItem', projectId, text: 'One more' });
  act(state, { type: 'clearDone', projectId });
  act(state, { type: 'addItem', projectId, text: 'Room again' });
});

test('a project can link to its repo: added, changed, cleared; only web addresses', () => {
  const state = withPerson();
  const { projectId } = act(state, { type: 'addProject', name: 'Site', url: ' github.com/me/site ' });
  assert.equal(state.projects[0].url, 'https://github.com/me/site');
  act(state, { type: 'addProject', name: 'No link' });
  assert.equal(state.projects[1].url, null);
  act(state, { type: 'setProjectUrl', projectId, url: 'https://gitlab.com/me/site' });
  assert.equal(state.projects[0].url, 'https://gitlab.com/me/site');
  act(state, { type: 'setProjectUrl', projectId, url: '' });
  assert.equal(state.projects[0].url, null);
  for (const url of ['javascript:alert(1)', 'not a link', 'ftp://example.com/x', 42]) {
    rejects(state, { type: 'setProjectUrl', projectId, url });
  }
  rejects(state, { type: 'addProject', name: 'Bad', url: 'nope' });
  rejects(state, { type: 'setProjectUrl', projectId: 'abc', url: '' }, 404);
});

test('cleanUrl: adds https://, keeps http(s) web addresses, empty for none, null for anything else', () => {
  assert.equal(cleanUrl('github.com/me/repo'), 'https://github.com/me/repo');
  assert.equal(cleanUrl('http://192.168.1.10:8123/x'), 'http://192.168.1.10:8123/x');
  assert.equal(cleanUrl('  '), '');
  assert.equal(cleanUrl(null), '');
  for (const bad of ['localhost', 'mailto:me@example.com', 'data:text/html,hi', `https://example.com/${'x'.repeat(300)}`]) {
    assert.equal(cleanUrl(bad), null, bad);
  }
});

test('the GitHub field: you/project or a pasted link, back to you/project for showing', () => {
  for (const typed of ['you/project', ' you/project/ ', 'github.com/you/project', 'https://github.com/you/project',
    'https://www.github.com/you/project.git', 'https://github.com/you/project?tab=readme']) {
    assert.equal(githubUrl(typed), 'https://github.com/you/project', typed);
  }
  assert.equal(githubUrl(''), '');
  for (const bad of ['project', 'https://gitlab.com/you/project', 'you/project/tree/main', 'a b/c']) {
    assert.equal(githubUrl(bad), null, bad);
  }
  assert.equal(githubRepo('https://github.com/you/project'), 'you/project');
  assert.equal(githubRepo('https://gitlab.com/you/project'), null);
  assert.equal(githubRepo(null), null);
});

test('the actions are the ones the docs list', () => {
  assert.deepEqual([...ACTION_TYPES].sort(), ['addItem', 'addPerson', 'addProject', 'clearDone', 'editItem', 'removeItem',
    'removePerson', 'removeProject', 'renamePerson', 'renameProject', 'setPersonEmoji', 'setProjectEmoji', 'setProjectHue',
    'setProjectUrl', 'setStatus']);
});

test('unknown or malformed actions are rejected', () => {
  const { state } = setup();
  rejects(state, null);
  rejects(state, { type: 'dropTables' });
  rejects(state, { type: 'toString' });
});
