// A person: adding someone, or renaming them, picking their emoji and deleting them (with their projects).
import { sendAction } from '../shared/api.js';
import { $ } from '../shared/dom.js';
import { plural } from '../shared/format.js';
import { PERSON_EMOJIS, pickPersonEmoji } from '../shared/tracker.js';
import { confirmDelete } from '../ui/confirm.js';
import { createEmojiPicker } from '../ui/emoji-picker.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';

/** @typedef {import('../shared/tracker.js').Person} Person */
/** @typedef {import('../shared/tracker.js').Project} Project */

/**
 * @param {{ getPeople(): Person[], getProjects(): Project[], onCreated(personId: string): void,
 *   onDeleted(personId: string): void, onClose?: () => void }} options
 *   getProjects: everyone's projects (to say what deleting someone removes)
 *   onClose: once it's closing (going back is one step at a time: what opens next waits for this)
 */
export function createPersonSheet({ getPeople, getProjects, onCreated, onDeleted, onClose }) {
  const name = /** @type {HTMLInputElement} */ ($('personName'));
  const custom = /** @type {HTMLInputElement} */ ($('personEmojiCustom'));
  const remove = $('personDelete');
  let personId = null;                             // null: someone new
  let edited = false;                              // emoji changed while open: "Saved" on closing
  let before = null;                               // the person as they were when opened, for Undo
  let busy = false;

  const sheet = createSheet($('personLayer'), {
    onClose: () => {
      name.blur();
      custom.blur();
      saveName();                                  // a rename is kept however the sheet is closed
      onClose?.();
    },
  });

  const emoji = createEmojiPicker({
    grid: $('personEmojis'),
    custom,
    choices: PERSON_EMOJIS,
    onPick: (picked) => {
      $('personEmoji').textContent = picked;
      if (!personId) return;
      edited = true;
      sendAction({ type: 'setPersonEmoji', personId, emoji: picked }).catch(toastError);
    },
  });

  /** Someone's new name, if it was changed; "Saved" when anything was. */
  function saveName() {
    const person = personId && getPeople().find((p) => p.id === personId);
    if (!person) return;
    const value = name.value.trim();
    const renamed = Boolean(value) && value !== person.name;
    if (renamed) sendAction({ type: 'renamePerson', personId, name: value }).catch(toastError);
    if (renamed || edited) {
      const old = before;
      toast(`Saved ${value || person.name}`, { icon: 'check', action: { label: 'Undo', run: () => restore(old) } });
    }
  }

  /** Undo of "Saved": their name and emoji as they were. */
  async function restore(old) {
    const person = getPeople().find((p) => p.id === old.id);
    if (!person) return;
    try {
      if (person.name !== old.name) await sendAction({ type: 'renamePerson', personId: old.id, name: old.name });
      if (person.emoji !== old.emoji) await sendAction({ type: 'setPersonEmoji', personId: old.id, emoji: old.emoji });
    } catch (err) {
      toastError(err);
    }
  }

  /** Undo of "Added": takes them away again, unless they have projects by now. */
  async function unadd(id) {
    if (getProjects().some((p) => p.personId === id)) return toast('They have projects now: delete them from their ⋯ instead', { error: true });
    try {
      await sendAction({ type: 'removePerson', personId: id });
      onDeleted(id);
    } catch (err) {
      toastError(err);
    }
  }

  function renderDelete() {
    $('personExtra').hidden = !personId;
    remove.innerHTML = `${icon('trash')}<span>Delete person</span>`;
  }

  $('personForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value || busy) return name.focus();
    busy = true;
    try {
      if (personId) {
        sheet.close();                             // saves the name (saveName)
      } else {
        const { personId: created } = await sendAction({ type: 'addPerson', name: value, emoji: emoji.value });
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

  // Someone goes with all their projects, for good: type "delete" to confirm (js/ui/confirm.js).
  remove.addEventListener('click', async () => {
    const person = personId && getPeople().find((p) => p.id === personId);
    if (!person) return;
    const projects = getProjects().filter((p) => p.personId === person.id).length;
    const sure = await confirmDelete({
      title: 'Delete person?',
      text: `This deletes ${person.name}${projects ? `, their ${plural(projects, 'project')} and everything in them` : ''}, for good. It can't be undone.`,
      button: 'Delete person',
    });
    if (!sure || personId !== person.id) return;
    personId = null;                               // nothing to save on close
    sheet.close();
    sendAction({ type: 'removePerson', personId: person.id })
      .then(() => {
        toast(`Deleted ${person.name}`);
        onDeleted(person.id);
      })
      .catch(toastError);
  });

  return {
    /** Opens for someone new (no id) or an existing person. */
    open(id = null) {
      const person = id ? getPeople().find((p) => p.id === id) : null;
      personId = person?.id ?? null;
      before = person && { ...person };
      edited = false;
      const value = person?.emoji ?? pickPersonEmoji(getPeople());
      emoji.set(value);
      $('personEmoji').textContent = value;
      name.value = person?.name ?? '';
      $('personTitle').textContent = person ? 'Person' : 'New person';
      $('personSave').textContent = person ? 'Save' : 'Add person';
      renderDelete();
      sheet.open();
      if (!person) setTimeout(() => name.focus(), 320);    // after it slides in, so the page doesn't jump
    },

    /** After a change: they may be gone (deleted on another screen). */
    refresh() {
      if (!sheet.isOpen || !personId) return;
      if (!getPeople().some((p) => p.id === personId)) {
        personId = null;
        sheet.close();
        return;
      }
      renderDelete();
    },
  };
}
