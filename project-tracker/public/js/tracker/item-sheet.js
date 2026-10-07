// One item: what it says, its notes and its status (its project is shown, not changed here). Text and notes are saved
// when the sheet closes (or the field loses focus); status and delete apply right away.
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { dateTime } from '../shared/format.js';
import { statusLabel } from '../shared/tracker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
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
  let armed = false;

  const sheet = createSheet($('itemLayer'), { onClose: () => { save(); itemId = null; } });

  let sent = { text: '', note: '' };               // what the server has (or was last sent), to send only changes

  /** Sends what changed in the text fields. */
  function save() {
    if (!itemId || !getItem(itemId)) return;
    const changes = {};
    const newText = text.value.replace(/\s+/g, ' ').trim();
    const newNote = note.value.trim();
    if (newText && newText !== sent.text) changes.text = newText;
    if (newNote !== sent.note) changes.note = newNote;
    if (!Object.keys(changes).length) return;
    sent = { ...sent, ...changes };
    sendAction({ type: 'editItem', itemId, ...changes }).catch(toastError);
  }

  function disarm() {
    armed = false;
    remove.classList.remove('armed');
    remove.innerHTML = `${icon('trash')}<span>Delete</span>`;
  }

  /** Shows the item's current status and project (it may have changed on another screen). */
  function render(item) {
    for (const button of $('itemStatus').querySelectorAll('[data-status]')) {
      const selected = button instanceof HTMLElement && button.dataset.status === item.status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    const project = getProjects().find((p) => p.id === item.projectId);
    $('itemProjectEmoji').textContent = project?.emoji ?? '';
    $('itemProjectName').textContent = project?.name ?? '';
    $('itemDates').textContent = item.createdAt === item.movedAt
      ? `Added ${dateTime(item.createdAt)}`
      : `Added ${dateTime(item.createdAt)} · ${statusLabel(item.status)} since ${dateTime(item.movedAt)}`;
  }

  $('itemStatus').addEventListener('click', (e) => {
    const button = closest(e, '[data-status]');
    if (!button || !itemId) return;
    sendAction({ type: 'setStatus', itemId, status: button.dataset.status }).catch(toastError);
  });

  text.addEventListener('input', () => fit(text));
  note.addEventListener('input', () => fit(note));
  text.addEventListener('blur', save);
  note.addEventListener('blur', save);
  // Enter in the title finishes it (it's one line, however long); Shift+Enter is not needed there
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
    itemId = null;                                 // nothing left to save on close
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
      sent = { text: item.text, note: item.note };
      disarm();
      render(item);
      sheet.open();
      requestAnimationFrame(() => {
        fit(text);
        fit(note);
      });
    },

    /** After a change: shows the latest, or closes if the item was deleted (e.g. on another screen). */
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
