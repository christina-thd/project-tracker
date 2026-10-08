// Adding items: the round + opens a sheet for the project you're on. Type, press Enter, and it's added; the field
// clears and stays focused, so several can go in a row. Todo or Test is picked at the top (the tab you're on, at first).
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
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
  let added = 0;                                   // in this opening of the sheet

  const sheet = createSheet($('addLayer'), { onClose: () => input.blur() });
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
    $('addSend').innerHTML = icon('plus');
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
      await sendAction({ type: 'addItem', projectId: project.id, text, status });
      input.value = '';
      added++;
      $('addHint').textContent = `Added ${added}. Type the next one, or tap Close.`;
      onAdded(status);
    } catch (err) {
      toastError(err);
    } finally {
      sending = false;
      if (sheet.isOpen) input.focus();             // ready for the next one (unless it was closed meanwhile)
    }
  });

  return {
    /** Opens for a project, adding to `startStatus` (todo or test) at first. */
    open(id, startStatus = 'todo') {
      projectId = id;
      if (!getProject()) return;
      status = startStatus === 'test' ? 'test' : 'todo';
      added = 0;
      input.value = '';
      $('addHint').textContent = 'Press Enter to add. It stays open for the next one.';
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
