import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PEOPLE, MAX_PROJECTS } from '../public/js/shared/tracker.js';
import { createInitialState, normalizeState, SCHEMA_VERSION, toView } from '../src/tracker/state.js';

const NOW = 1_700_000_000_000;

test('nothing saved yet, or something unusable: a fresh tracker', () => {
  for (const raw of [null, 'text', 42, {}, { projects: 'no' }]) {
    assert.deepEqual(normalizeState(raw, NOW), createInitialState());
  }
});

test('a saved tracker comes back as it was', () => {
  const saved = {
    schema: SCHEMA_VERSION,
    people: [{ id: 'ab', name: 'Chris', emoji: '🦊', createdAt: NOW - 20 }],
    projects: [{ id: 'aa', personId: 'ab', name: 'Website', emoji: '🚀', hue: 230, url: 'https://github.com/me/site', createdAt: NOW - 10 }],
    items: [{ id: 'bb', projectId: 'aa', text: 'Fix', note: 'a\nb', status: 'test', createdAt: NOW - 5, movedAt: NOW - 1 }],
  };
  assert.deepEqual(normalizeState(structuredClone(saved), NOW), saved);
});

test('projects saved before there were people go to a first person, "Me"', () => {
  const state = normalizeState({
    schema: 1,
    projects: [{ id: 'aa', name: 'Website', hue: 230 }, { id: 'cc', name: 'Garden', hue: 160 }],
    items: [{ id: 'bb', projectId: 'aa', text: 'Fix' }],
  }, NOW);
  assert.equal(state.schema, SCHEMA_VERSION);
  assert.deepEqual(state.people.map((p) => p.name), ['Me']);
  assert.ok(state.projects.every((p) => p.personId === state.people[0].id));
  assert.equal(state.items.length, 1);
});

test('a project whose person is gone goes to the first person', () => {
  const state = normalizeState({
    people: [{ id: 'a1', name: 'Chris' }, { id: 'a2', name: 'Alex' }],
    projects: [{ id: 'aa', personId: 'a2', name: 'Kept' }, { id: 'bb', personId: 'gone', name: 'Orphan' }],
  }, NOW);
  assert.deepEqual(state.projects.map((p) => [p.name, p.personId]), [['Kept', 'a2'], ['Orphan', 'a1']]);
});

test('odd values are repaired, unusable entries dropped', () => {
  const state = normalizeState({
    people: [{ id: 'a1', name: 'Chris' }],
    projects: [
      { id: 'aa', personId: 'a1', name: '  Website ', hue: 999 },
      { id: 'aa', personId: 'a1', name: 'Duplicate id' },
      { personId: 'a1', name: '' },
      'junk',
    ],
    items: [
      { id: 'b1', projectId: 'aa', text: 'Fine', status: 'someday' },
      { id: 'b2', projectId: 'gone', text: 'Lost project' },
      { id: 'b3', projectId: 'aa', text: '   ' },
      { id: 'NOT-HEX', projectId: 'aa', text: 'New id', createdAt: -1 },
    ],
  }, NOW);

  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0].name, 'Website');
  assert.ok(Number.isInteger(state.projects[0].hue) && state.projects[0].hue < 360);
  assert.deepEqual(state.items.map((i) => i.text), ['Fine', 'New id']);
  assert.equal(state.items[0].status, 'todo');
  assert.match(state.items[1].id, /^[a-f0-9]{12}$/);
  assert.equal(state.items[1].createdAt, NOW);
  assert.equal(state.items[1].movedAt, NOW);
});

test('projects saved before emoji get one their name suggests; odd ones are replaced', () => {
  const state = normalizeState({
    people: [{ id: 'a1', name: 'Chris', emoji: 'nope' }],
    projects: [
      { id: 'aa', personId: 'a1', name: 'Garden sensors', hue: 160 },
      { id: 'bb', personId: 'a1', name: 'Other', emoji: 'not an emoji', hue: 30 },
    ],
  }, NOW);
  assert.equal(state.projects[0].emoji, '🌱');
  assert.notEqual(state.projects[1].emoji, 'not an emoji');
  assert.notEqual(state.people[0].emoji, 'nope');
});

test('ids must be text; names stay unique (projects: per person); limits are kept', () => {
  const state = normalizeState({
    people: [
      { id: 'a1', name: 'Chris' }, { id: 'a2', name: 'CHRIS' }, { id: 'a3', name: 'Alex' },
      ...Array.from({ length: MAX_PEOPLE }, (_, i) => ({ id: `e${i}`, name: `Person ${i}` })),
    ],
    projects: [
      { id: 'aa', personId: 'a1', name: 'Site' }, { id: 'bb', personId: 'a1', name: 'SITE' }, { id: 'cc', personId: 'a3', name: 'Site' },
      { id: 123, personId: 'a1', name: 'Numbered' },
      ...Array.from({ length: MAX_PROJECTS }, (_, i) => ({ id: `c${i}`, personId: 'a3', name: `P${i}` })),
    ],
    items: [
      { id: 'd1', projectId: 'aa', text: 'Kept' }, { id: 'd1', projectId: 'aa', text: 'Same id' },
      { id: 456, projectId: 'aa', text: 'Numbered' },
    ],
  }, NOW);
  assert.deepEqual(state.people.slice(0, 2).map((p) => p.name), ['Chris', 'Alex']);         // "CHRIS" dropped
  assert.equal(state.people.length, MAX_PEOPLE);
  assert.deepEqual(state.projects.slice(0, 3).map((p) => p.name), ['Site', 'Site', 'Numbered']);   // Chris's "SITE" dropped
  assert.equal(typeof state.projects[2].id, 'string');
  assert.equal(state.projects.length, MAX_PROJECTS);
  assert.equal(state.items.filter((i) => i.id === 'd1').length, 1);
  assert.ok(state.items.every((i) => typeof i.id === 'string'));
});

test('a project link is kept when it is a web address, else dropped', () => {
  const state = normalizeState({
    people: [{ id: 'a1', name: 'Chris' }],
    projects: [
      { id: 'aa', personId: 'a1', name: 'One', url: 'github.com/me/one' },
      { id: 'bb', personId: 'a1', name: 'Two', url: 'javascript:alert(1)' },
      { id: 'cc', personId: 'a1', name: 'Three' },
    ],
  }, NOW);
  assert.deepEqual(state.projects.map((p) => p.url), ['https://github.com/me/one', null, null]);
});

test('the view carries the app version', () => {
  const view = toView(createInitialState(), '1.2.3');
  assert.deepEqual(view, { version: '1.2.3', people: [], projects: [], items: [] });
});
