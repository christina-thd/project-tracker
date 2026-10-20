// A project: adding a new one, or renaming it, setting its repo link, picking its emoji and color, clearing its done items and
// deleting it.
// A new project's emoji follows its name as you type (pickEmoji), until you pick one yourself.
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { plural } from '../shared/format.js';
import { EMOJIS, githubRepo, githubUrl, HUES, pickEmoji, pickHue, shortUrl } from '../shared/tracker.js';
import { confirmDelete } from '../ui/confirm.js';
import { createEmojiPicker } from '../ui/emoji-picker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { clearDone } from './clear-done.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

/**
 * @param {{ getPersonId(): string | null, getProjects(): Project[], getItems(): Item[], onCreated(projectId: string): void,
 *   onDeleted(projectId: string): void, onClose?: () => void }} options
 *   getPersonId: whose project a new one is; getProjects: that person's projects
 *   onClose: once it's closing (after Save, delete, swipe, back or Escape)
 */
export function createProjectSheet({ getPersonId, getProjects, getItems, onCreated, onDeleted, onClose }) {
  const name = /** @type {HTMLInputElement} */ ($('projectName'));
  const url = /** @type {HTMLInputElement} */ ($('projectUrl'));   // after "github.com/": you/project
  let urlShown = '';                               // what the field showed when opened (unchanged: nothing to save)
  const remove = $('projectDelete');
  const clear = $('projectClear');
  const custom = /** @type {HTMLInputElement} */ ($('projectEmojiCustom'));
  let projectId = null;                            // null: a new project
  let hue = 0;
  let emojiChosen = false;                         // picked by hand: typing the name no longer changes it
  let clearArmed = false;                          // Clear tapped once: the next tap clears
  let edited = false;                              // emoji or color changed while open: "Saved" on closing
  let before = null;                               // the project as it was when opened, for Undo
  let busy = false;

  const sheet = createSheet($('projectLayer'), {
    onClose: () => {
      name.blur();
      url.blur();
      custom.blur();
      saveTyped();                                 // a new name or link is kept however the sheet is closed
      onClose?.();
    },
  });

  const urlChanged = () => url.value.trim() !== urlShown;

  /** A GitHub field that isn't a repo: says so (and returns true). */
  function badUrl() {
    if (!urlChanged() || githubUrl(url.value) !== null) return false;
    toast('Type the repo as you/project, or paste its GitHub link', { error: true });
    return true;
  }

  /** An existing project's new name and link, if they were changed; "Saved" when anything was. */
  function saveTyped() {
    const project = projectId && getProjects().find((p) => p.id === projectId);
    if (!project) return;
    let changed = edited;
    const value = name.value.trim();
    if (value && value !== project.name) {
      sendAction({ type: 'renameProject', projectId, name: value }).catch(toastError);
      changed = true;
    }
    if (urlChanged()) {
      if (badUrl()) return;
      sendAction({ type: 'setProjectUrl', projectId, url: githubUrl(url.value) }).catch(toastError);
      changed = true;
    }
    if (changed) {
      const old = before;
      toast(`Saved ${value || project.name}`, { icon: 'check', action: { label: 'Undo', run: () => restore(old) } });
    }
  }

  /** Undo of "Saved": the project's name, link, emoji and color as they were. */
  async function restore(old) {
    const project = getProjects().find((p) => p.id === old.id);
    if (!project) return;
    try {
      if (project.name !== old.name) await sendAction({ type: 'renameProject', projectId: old.id, name: old.name });
      if (project.url !== old.url) await sendAction({ type: 'setProjectUrl', projectId: old.id, url: old.url ?? '' });
      if (project.emoji !== old.emoji) await sendAction({ type: 'setProjectEmoji', projectId: old.id, emoji: old.emoji });
      if (project.hue !== old.hue) await sendAction({ type: 'setProjectHue', projectId: old.id, hue: old.hue });
    } catch (err) {
      toastError(err);
    }
  }

  /** Undo of "Added": takes the new project away again, unless something was added to it since. */
  async function unadd(id) {
    if (itemsOf(id).length) return toast('It has items now: delete it from its ⋯ instead', { error: true });
    try {
      await sendAction({ type: 'removeProject', projectId: id });
      onDeleted(id);
    } catch (err) {
      toastError(err);
    }
  }

  const itemsOf = (id) => getItems().filter((i) => i.projectId === id);

  const emoji = createEmojiPicker({
    grid: $('projectEmojis'),
    custom,
    choices: EMOJIS,
    onPick: (picked) => {
      emojiChosen = true;
      $('projectEmoji').textContent = picked;
      if (!projectId) return;
      edited = true;
      sendAction({ type: 'setProjectEmoji', projectId, emoji: picked }).catch(toastError);
    },
  });

  function showEmoji(value) {
    emoji.set(value);
    $('projectEmoji').textContent = value;
  }

  url.addEventListener('change', () => {
    const repo = githubRepo(githubUrl(url.value));
    if (repo) url.value = repo;
  });
  url.addEventListener('input', renderOpen);

  /** "Open" in the GitHub field, while it holds a repo: to check it, or just to go there. */
  function renderOpen() {
    const open = /** @type {HTMLAnchorElement} */ ($('projectUrlOpen'));
    const full = githubUrl(url.value) || (url.value.trim() === urlShown && getProjects().find((p) => p.id === projectId)?.url);
    open.hidden = !full;
    if (full) open.href = full;
  }

  name.addEventListener('input', () => {
    if (!projectId && !emojiChosen) showEmoji(pickEmoji(getProjects(), name.value));
  });

  function renderHues() {
    $('projectHues').innerHTML = HUES.map((h) => `<button type="button" class="hue${h === hue ? ' selected' : ''}" data-hue="${h}"
      style="--hue: ${h}" role="radio" aria-checked="${h === hue}" aria-label="Color ${h}"></button>`).join('');
  }

  function renderExtra() {
    const items = projectId ? itemsOf(projectId) : [];
    const done = items.filter((i) => i.status === 'done').length;
    $('projectExtra').hidden = !projectId;
    clear.hidden = done === 0;
    clear.classList.toggle('armed', clearArmed);
    clear.innerHTML = `${icon('check')}<span>${clearArmed ? 'Tap again to clear them' : `Clear ${plural(done, 'done item')}`}</span>`;
    remove.innerHTML = `${icon('trash')}<span>Delete project</span>`;
  }

  $('projectHues').addEventListener('click', (e) => {
    const button = closest(e, '[data-hue]');
    if (!button) return;
    hue = Number(button.dataset.hue);
    renderHues();
    if (!projectId) return;
    edited = true;
    sendAction({ type: 'setProjectHue', projectId, hue }).catch(toastError);
  });

  $('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value || busy) return name.focus();
    if (badUrl()) return url.focus();
    busy = true;
    try {
      if (projectId) {
        sheet.close();                             // saves the name and link (saveTyped)
      } else {
        const { projectId: created } = await sendAction({
          type: 'addProject', personId: getPersonId(), name: value, emoji: emoji.value, hue, url: githubUrl(url.value),
        });
        sheet.close();
        toast(`Added ${value}`, { icon: 'check', action: { label: 'Undo', run: () => unadd(created) } });
        onCreated(created);
      }
    } catch (err) {
      toastError(err);
    } finally {
      busy = false;
    }
  });

  clear.addEventListener('click', () => {
    if (!projectId) return;
    if (!clearArmed) {
      clearArmed = true;
      return renderExtra();
    }
    clearArmed = false;
    clearDone(projectId, getItems());
  });

  // A whole project goes, with everything in it, for good: type "delete" to confirm (js/ui/confirm.js).
  remove.addEventListener('click', async () => {
    const project = projectId && getProjects().find((p) => p.id === projectId);
    if (!project) return;
    const count = itemsOf(project.id).length;
    const sure = await confirmDelete({
      title: 'Delete project?',
      text: `This deletes ${project.name}${count ? ` and its ${plural(count, 'item')}` : ''}, for good. It can't be undone.`,
      button: 'Delete project',
    });
    if (!sure || projectId !== project.id) return;
    projectId = null;                              // nothing to save on close
    sheet.close();
    sendAction({ type: 'removeProject', projectId: project.id })
      .then(() => {
        toast(`Deleted ${project.name}`);
        onDeleted(project.id);
      })
      .catch(toastError);
  });

  return {
    /** Opens for a new project (no id) or an existing one. */
    open(id = null) {
      const project = id ? getProjects().find((p) => p.id === id) : null;
      projectId = project?.id ?? null;
      before = project && { ...project };
      clearArmed = false;
      edited = false;
      hue = project?.hue ?? pickHue(getProjects());
      emojiChosen = false;
      showEmoji(project?.emoji ?? pickEmoji(getProjects()));
      name.value = project?.name ?? '';
      // a GitHub repo as you/project; any other link (set through the API) as it is, without https://
      urlShown = project?.url ? githubRepo(project.url) ?? shortUrl(project.url) : '';
      url.value = urlShown;
      renderOpen();
      $('projectTitle').textContent = project ? 'Project' : 'New project';
      $('projectSave').textContent = project ? 'Save' : 'Add project';
      renderHues();
      renderExtra();
      sheet.open();
      if (!project) setTimeout(() => name.focus(), 320);   // after it slides in, so the page doesn't jump
    },

    /** After a change: counts may differ, or the project may be gone (deleted on another screen). */
    refresh() {
      if (!sheet.isOpen || !projectId) return;
      if (!getProjects().some((p) => p.id === projectId)) {
        projectId = null;
        sheet.close();
        return;
      }
      renderExtra();
    },
  };
}
