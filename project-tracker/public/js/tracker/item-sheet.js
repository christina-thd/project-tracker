// One item: what it says, its notes, its status and kind, and in a 3D printing project the link to its file (its project
// is shown, not changed here). Changes are kept in the sheet until Save (bottom right) sends them all; Close, swiping
// down, back or Escape leave without saving. Delete applies right away (after a second tap); so does Move to backlog.
// A test only gets its two answers; a done item has no kind or backlog. Their notes are there to read, not to edit.
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { date } from '../shared/format.js';
import { BACKLOG, statusLabel } from '../shared/tracker.js';
import { icon, STATUS_ICONS } from '../ui/icons.js';
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
 * Puts text on the clipboard. The direct http address has no clipboard API (it needs https), so it falls back to
 * selecting the field and the browser's copy command. Returns whether it worked.
 * @param {string} value
 * @param {HTMLInputElement} field  holds the same text
 */
async function copy(value, field) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    field.select();
    const copied = document.execCommand('copy');
    field.setSelectionRange(0, 0);
    field.blur();
    return copied;
  }
}

/**
 * @param {{ getItem(id: string): Item | undefined, getProjects(): Project[], onDeleted(item: Item): void }} options
 */
export function createItemSheet({ getItem, getProjects, onDeleted }) {
  const text = /** @type {HTMLTextAreaElement} */ ($('itemText'));
  const note = /** @type {HTMLTextAreaElement} */ ($('itemNote'));
  const link = /** @type {HTMLInputElement} */ ($('itemLink'));
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

  const projectOf = (item) => getProjects().find((p) => p.id === item.projectId) ?? null;

  /** The item's project and dates (they can change on another screen; what's being edited here doesn't). */
  function render(item) {
    const project = projectOf(item);
    $('itemProjectEmoji').textContent = project?.emoji ?? '';
    $('itemProjectName').textContent = project?.name ?? '';
    $('itemDates').textContent = date(item.createdAt) === date(item.movedAt)
      ? `Added ${date(item.createdAt)}`
      : `Added ${date(item.createdAt)} · Moved to ${statusLabel(item.status, project)} ${date(item.movedAt)}`;
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
    if (link.value.trim() !== item.link) changes.link = link.value.trim();
    const edited = Object.keys(changes).length > 0;
    const moved = status !== item.status;
    const project = projectOf(item);
    saving = true;
    try {
      if (edited) await sendAction({ type: 'editItem', itemId: item.id, ...changes });
      if (moved) await sendAction({ type: 'setStatus', itemId: item.id, status });
      sheet.close();
      const action = { label: 'Undo', run: () => undo(item, edited, moved) };
      const where = status === 'done' ? statusLabel('done', project) : `Moved to ${statusLabel(status, project)}`;
      if (moved) toast(where, { icon: STATUS_ICONS[status], action });
      else if (edited) toast('Saved', { icon: 'check', action });
    } catch (err) {
      toastError(err);
    } finally {
      saving = false;
    }
  }

  /** Puts the item back as it was before Save. */
  async function undo(before, edited, moved) {
    try {
      if (edited) {
        await sendAction({ type: 'editItem', itemId: before.id, text: before.text, note: before.note, kind: before.kind, link: before.link });
      }
      if (moved) await sendAction({ type: 'setStatus', itemId: before.id, status: before.status });
    } catch (err) {
      toastError(err);
    }
  }

  $('itemStatus').addEventListener('click', (e) => {
    const button = closest(e, '[data-status]');
    if (!button || !itemId) return;
    status = button.dataset.status;
    renderStatus();
  });

  $('itemSave').addEventListener('click', save);

  // Into the backlog (or back out to Todo) right away, with whatever else was changed
  $('itemBacklog').addEventListener('click', () => {
    const item = itemId && getItem(itemId);
    if (!item) return;
    status = item.status === BACKLOG ? 'todo' : BACKLOG;
    save();
  });

  // A test has two answers. Passed: to Done right away. Didn't pass: a box for what went wrong; "Move to Todo" adds
  // that to the notes (dated) and sends it back. Either way with whatever else was changed.
  const failBox = $('itemFailBox');
  const failText = /** @type {HTMLTextAreaElement} */ ($('itemFailText'));
  function showFail(open) {
    failBox.hidden = !open;
    $('itemFail').classList.toggle('open', open);
    if (open) failText.focus();
  }
  $('itemFail').addEventListener('click', () => showFail(failBox.hidden));
  $('itemPassed').addEventListener('click', () => {
    if (!itemId) return;
    status = 'done';
    save();
  });
  failText.addEventListener('input', () => fit(failText));
  $('itemFailSend').addEventListener('click', () => {
    if (!itemId) return;
    const details = failText.value.trim();
    if (details) {
      const day = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const failed = projectOf(getItem(itemId) ?? {})?.print ? 'Print failed' : "Didn't pass";
      note.value = [note.value.trim(), `${failed} (${day}): ${details}`].filter(Boolean).join('\n\n');
    }
    status = 'todo';
    save();
  });

  // The link to the file: copied with a tap, to paste into the slicer (or a browser)
  $('itemLinkCopy').addEventListener('click', async () => {
    const value = link.value.trim();
    if (!value) return link.focus();
    toast((await copy(value, link)) ? 'Link copied' : 'Could not copy: select the link and copy it', { icon: 'copy' });
  });

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
      // a test: just its answers, and its notes to read (no editing, no Save or Delete); done: no kind or backlog, and
      // its notes to read (css/tracker.css .testing, .finished)
      const project = projectOf(item);
      const print = Boolean(project?.print);
      const testing = item.status === 'test';
      const finished = item.status === 'done';
      const view = $('itemLayer').querySelector('.item-sheet');
      view.classList.toggle('testing', testing);
      view.classList.toggle('finished', finished);
      $('itemKind').hidden = print;                // 3D printing projects have no bug / feature / other
      text.readOnly = testing;
      $('itemAnswers').hidden = !testing;
      $('itemNoteView').hidden = !(testing || finished) || !item.note;
      $('itemNoteView').textContent = item.note;
      $('itemPassed').innerHTML = `${icon('check')}<span>${print ? 'Printed' : 'Passed'}</span>`;
      $('itemFail').innerHTML = `${icon('undo')}<span>${print ? 'Print failed' : "Didn't pass"}</span>`;
      // the file to print (3D printing projects): to copy, and to change except while it's waiting to print
      $('itemLinkRow').hidden = !print || (testing && !item.link);   // waiting to print without a link: nothing to show
      link.value = item.link;
      link.readOnly = testing;
      $('itemLinkCopy').innerHTML = `${icon('copy')}<span>Copy</span>`;
      $('itemFailSend').innerHTML = `${icon('back')}<span>Move to Todo</span>`;
      failText.value = '';
      showFail(false);
      $('itemBacklog').innerHTML = item.status === BACKLOG
        ? `${icon(STATUS_ICONS.todo)}<span>Back to Todo</span>`
        : `${icon(STATUS_ICONS.backlog)}<span>Move to backlog</span>`;
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
