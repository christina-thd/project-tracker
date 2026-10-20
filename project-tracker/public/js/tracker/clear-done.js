// Clearing a project's done items, with Undo: they come back as new items in Done, with the same text, notes and kind.
import { sendAction } from '../shared/api.js';
import { plural } from '../shared/format.js';
import { toast, toastError } from '../ui/toast.js';

/** @typedef {import('../shared/tracker.js').Item} Item */

/**
 * @param {string} projectId
 * @param {Item[]} items  every item (the project's done ones are kept for Undo)
 */
export function clearDone(projectId, items) {
  const done = items.filter((i) => i.projectId === projectId && i.status === 'done')
    .sort((a, b) => a.movedAt - b.movedAt);       // oldest first, so the newest ends up on top again
  sendAction({ type: 'clearDone', projectId })
    .then(({ removed }) => toast(`Cleared ${plural(removed, 'done item')}`, {
      icon: 'check',
      action: { label: 'Undo', run: () => restore(done) },
    }))
    .catch(toastError);
}

async function restore(done) {
  try {
    for (const item of done) {
      await sendAction({ type: 'addItem', projectId: item.projectId, text: item.text, note: item.note, status: 'done', kind: item.kind });
    }
  } catch (err) {
    toastError(err);
  }
}
