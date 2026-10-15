// Adding items: the round + opens a sheet for the project you're on. Type, press Enter, and it's added; the field
// clears and stays focused, so several can go in a row. Todo or Test is picked at the top (the tab you're on, at first),
// and what it is: bug, feature or other (the last one picked, remembered on this device).
import { sendAction } from '../shared/api.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { storage } from '../shared/storage.js';
import { statusLabel } from '../shared/tracker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { createKindPicker } from './kind-picker.js';
import { toastError } from '../ui/toast.js';

/** @typedef {import('../shared/tracker.js').Project} Project */

const PLACEHOLDER = { todo: 'What needs doing?', test: 'What needs testing?' };

/**
 * @param {{ getProjects(): Project[], onAdded(status: string): void }} options
 */
export function createAddSheet({ getProjects, onAdded }) {
  const input = /** @type {HTMLInputElement} */ ($('addText'));
  let projectId = null;                            // the project it was opened for: always adds there
  let status = 'todo';
  let sending = false;
  let flash = null;                                // the + showing ✓ for a moment after adding
  let fade = null;                                 // the "Added …" line going back to the hint after a while
  const HINT = 'Tap + to add. It stays open for the next one.';

  function showHint() {
    clearTimeout(fade);
    $('addHint').textContent = HINT;
    $('addHint').classList.remove('added');
  }

  const sheet = createSheet($('addLayer'), { onClose: () => input.blur() });
  const kind = createKindPicker($('addKind'), {
    onPick: (picked) => {
      storage.set('tracker.kind', picked);
      input.focus();
    },
  });
  const getProject = () => getProjects().find((p) => p.id === projectId);

  function render() {
    const project = getProject();
    $('addProject').textContent = project ? `Add to ${project.name}` : 'Add';
    $('addEmoji').textContent = project?.emoji ?? '';
    for (const button of $('addStatus').querySelectorAll('[data-status]')) {
      const selected = button instanceof HTMLElement && button.dataset.status === status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    input.placeholder = PLACEHOLDER[status];
    if (!$('addSend').classList.contains('added')) $('addSend').innerHTML = icon('plus');
  }

  $('addStatus').addEventListener('click', (e) => {
    const button = closest(e, '[data-status]');
    if (!button) return;
    status = button.dataset.status;
    render();
    input.focus();
  });

  $('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const project = getProject();
    if (!text || sending || !project) return input.focus();
    sending = true;
    try {
      await sendAction({ type: 'addItem', projectId: project.id, text, status, kind: kind.value });
      input.value = '';
      showAdded(text);
      onAdded(status);
    } catch (err) {
      toastError(err);
    } finally {
      sending = false;
      if (sheet.isOpen) input.focus();             // ready for the next one (unless it was closed meanwhile)
    }
  });

  /** It's in: said under the field (green, with a little pop, for a few seconds) and with a ✓ on the + for a moment. */
  function showAdded(text) {
    const hint = $('addHint');
    hint.innerHTML = `${icon('check')}<span>Added "${escapeHtml(text)}" to ${statusLabel(status)}</span>`;
    hint.classList.remove('added');
    void hint.offsetWidth;                         // restart the pop for each one
    hint.classList.add('added');
    clearTimeout(fade);
    fade = setTimeout(showHint, 3000);
    clearTimeout(flash);
    $('addSend').innerHTML = icon('check');
    $('addSend').classList.add('added');
    flash = setTimeout(() => {
      $('addSend').innerHTML = icon('plus');
      $('addSend').classList.remove('added');
    }, 600);
  }

  return {
    /** Opens for a project, adding to `startStatus` (todo or test) at first. */
    open(id, startStatus = 'todo') {
      projectId = id;
      if (!getProject()) return;
      status = startStatus === 'test' ? 'test' : 'todo';
      kind.set(storage.get('tracker.kind'));
      input.value = '';
      showHint();
      render();
      sheet.open();
      input.focus();                               // in the tap itself, so phones open the keyboard
    },
    /** After a change: the project may have been renamed, or deleted on another screen (then it closes). */
    refresh() {
      if (!sheet.isOpen) return;
      if (!getProject()) return sheet.close();
      render();
    },
  };
}
