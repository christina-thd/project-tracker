// A project: adding a new one, or renaming it, picking its emoji and color, clearing its done items and deleting it.
// A new project's emoji follows its name as you type (pickEmoji), until you pick one yourself.
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { plural } from '../shared/format.js';
import { EMOJIS, HUES, pickEmoji, pickHue } from '../shared/tracker.js';
import { createEmojiPicker } from '../ui/emoji-picker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';

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
  const remove = $('projectDelete');
  const clear = $('projectClear');
  const custom = /** @type {HTMLInputElement} */ ($('projectEmojiCustom'));
  let projectId = null;                            // null: a new project
  let hue = 0;
  let emojiChosen = false;                         // picked by hand: typing the name no longer changes it
  let armed = false;                               // Delete tapped once: the next tap deletes
  let clearArmed = false;                          // the same for clearing done items (neither can be undone)
  let busy = false;

  const sheet = createSheet($('projectLayer'), {
    onClose: () => {
      name.blur();
      custom.blur();
      saveName();                                  // a rename is kept however the sheet is closed
      onClose?.();
    },
  });

  /** An existing project's new name, if it was changed. */
  function saveName() {
    const project = projectId && getProjects().find((p) => p.id === projectId);
    const value = name.value.trim();
    if (project && value && value !== project.name) {
      sendAction({ type: 'renameProject', projectId, name: value }).catch(toastError);
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
      if (projectId) sendAction({ type: 'setProjectEmoji', projectId, emoji: picked }).catch(toastError);
    },
  });

  function showEmoji(value) {
    emoji.set(value);
    $('projectEmoji').textContent = value;
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
    remove.classList.toggle('armed', armed);
    remove.innerHTML = `${icon('trash')}<span>${armed ? `Tap again: delete it${items.length ? ` and its ${plural(items.length, 'item')}` : ''}` : 'Delete project'}</span>`;
  }

  $('projectHues').addEventListener('click', (e) => {
    const button = closest(e, '[data-hue]');
    if (!button) return;
    hue = Number(button.dataset.hue);
    renderHues();
    if (projectId) sendAction({ type: 'setProjectHue', projectId, hue }).catch(toastError);
  });

  $('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value || busy) return name.focus();
    busy = true;
    try {
      if (projectId) {
        sheet.close();                             // saves the name (saveName)
      } else {
        const { projectId: created } = await sendAction({
          type: 'addProject', personId: getPersonId(), name: value, emoji: emoji.value, hue,
        });
        sheet.close();
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
    sendAction({ type: 'clearDone', projectId })
      .then(({ removed }) => toast(`Cleared ${plural(removed, 'done item')}`, { icon: 'check' }))
      .catch(toastError);
  });

  remove.addEventListener('click', () => {
    if (!projectId) return;
    if (!armed) {
      armed = true;
      return renderExtra();
    }
    const id = projectId;
    const { name: deleted } = getProjects().find((p) => p.id === id) ?? { name: 'Project' };
    projectId = null;                              // nothing to save on close
    sheet.close();
    sendAction({ type: 'removeProject', projectId: id })
      .then(() => {
        toast(`Deleted ${deleted}`);
        onDeleted(id);
      })
      .catch(toastError);
  });

  return {
    /** Opens for a new project (no id) or an existing one. */
    open(id = null) {
      const project = id ? getProjects().find((p) => p.id === id) : null;
      projectId = project?.id ?? null;
      armed = false;
      clearArmed = false;
      hue = project?.hue ?? pickHue(getProjects());
      emojiChosen = false;
      showEmoji(project?.emoji ?? pickEmoji(getProjects()));
      name.value = project?.name ?? '';
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
