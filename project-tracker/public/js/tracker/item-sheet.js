// One item: what it says, its notes, its status and kind (its project is shown, not changed here). Changes are kept in the
// sheet until Save (bottom right) sends them all; Close, swiping down, back or Escape leave without saving.
// Delete applies right away (after a second tap).
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { dateTime } from '../shared/format.js';
import { statusLabel } from '../shared/tracker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { createKindPicker } from './kind-picker.js';
import { toast, toastError } from '../ui/toast.js';

/** @typedef {import('../shared/tracker.js').Project} Project */
/** @typedef {import('../shared/tracker.js').Item} Item */

/** Grows a textarea with its text, so nothing scrolls inside it. */
function fit(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * @param {{ getItem(id: string): Item | undefined, getProjects(): Project[], onDeleted(item: Item): void }} options
 */
export function createItemSheet({ getItem, getProjects, onDeleted }) {
  const text = /** @type {HTMLTextAreaElement} */ ($('itemText'));
  const note = /** @type {HTMLTextAreaElement} */ ($('itemNote'));
  const remove = $('itemDelete');
  let itemId = null;
  let status = 'todo';                             // the status picked here (saved with Save)
  let armed = false;
  let saving = false;
  const kind = createKindPicker($('itemKind'));    // saved with Save, like the rest

  const sheet = createSheet($('itemLayer'), {
    onClose: () => {
      text.blur();
      note.blur();
      itemId = null;                               // not saved: what was changed is dropped
    },
  });

  function disarm() {
    armed = false;
    remove.classList.remove('armed');
    remove.innerHTML = `${icon('trash')}<span>Delete</span>`;
  }

  function renderStatus() {
    for (const button of $('itemStatus').querySelectorAll('[data-status]')) {
      const selected = button instanceof HTMLElement && button.dataset.status === status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
  }

  /** The item's project and dates (they can change on another screen; what's being edited here doesn't). */
  function render(item) {
    const project = getProjects().find((p) => p.id === item.projectId);
    $('itemProjectEmoji').textContent = project?.emoji ?? '';
    $('itemProjectName').textContent = project?.name ?? '';
    $('itemDates').textContent = item.createdAt === item.movedAt
      ? `Added ${dateTime(item.createdAt)}`
      : `Added ${dateTime(item.createdAt)} · ${statusLabel(item.status)} since ${dateTime(item.movedAt)}`;
  }

  /** Sends what was changed (text, notes, status), then closes. Nothing changed: just closes. */
  async function save() {
    const item = itemId && getItem(itemId);
    if (!item || saving) return;
    const newText = text.value.replace(/\s+/g, ' ').trim();
    if (!newText) {
      toast('An item needs some text', { error: true });
      return text.focus();
    }
    const changes = {};
    if (newText !== item.text) changes.text = newText;
    if (note.value.trim() !== item.note) changes.note = note.value.trim();
    if (kind.value !== item.kind) changes.kind = kind.value;
    saving = true;
    try {
      if (Object.keys(changes).length) await sendAction({ type: 'editItem', itemId: item.id, ...changes });
      if (status !== item.status) await sendAction({ type: 'setStatus', itemId: item.id, status });
      sheet.close();
    } catch (err) {
      toastError(err);
    } finally {
      saving = false;
    }
  }

  $('itemStatus').addEventListener('click', (e) => {
    const button = closest(e, '[data-status]');
    if (!button || !itemId) return;
    status = button.dataset.status;
    renderStatus();
  });

  $('itemSave').addEventListener('click', save);

  text.addEventListener('input', () => fit(text));
  note.addEventListener('input', () => fit(note));
  // Enter in the title finishes it (it's one line, however long)
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      text.blur();
    }
  });

  remove.addEventListener('click', () => {
    const item = itemId && getItem(itemId);
    if (!item) return;
    if (!armed) {
      armed = true;
      remove.classList.add('armed');
      remove.innerHTML = `${icon('trash')}<span>Tap again to delete</span>`;
      return;
    }
    sheet.close();
    sendAction({ type: 'removeItem', itemId: item.id })
      .then(() => onDeleted(item))
      .catch(toastError);
  });

  return {
    /** @param {string} id */
    open(id) {
      const item = getItem(id);
      if (!item) return;
      itemId = id;
      text.value = item.text;
      note.value = item.note;
      status = item.status;
      kind.set(item.kind);
      disarm();
      renderStatus();
      render(item);
      $('itemSave').innerHTML = `${icon('check')}<span>Save</span>`;
      sheet.open();
      requestAnimationFrame(() => {
        fit(text);
        fit(note);
      });
    },

    /** After a change: the latest project name and dates, or closes if the item was deleted (e.g. on another screen). */
    refresh() {
      if (!itemId || !sheet.isOpen) return;
      const item = getItem(itemId);
      if (!item) {
        itemId = null;
        sheet.close();
        toast('That item was deleted');
        return;
      }
      render(item);
    },
  };
}
