// Putting Todo items in another order: drag one by its grip (the dots on its right). It follows the finger or mouse,
// the others make room, the page scrolls near the edges, and the new place is sent once it's let go.

let drag = null;

/** True while an item is being dragged: the list isn't redrawn under it (js/tracker/board.js). */
export const isDragging = () => drag !== null;

const nextId = (li) => li.nextElementSibling?.getAttribute('data-item') ?? null;
const middle = (el) => {
  const box = el.getBoundingClientRect();
  return box.top + box.height / 2;
};

/**
 * @param {HTMLElement} list  the Todo list
 * @param {{ onMove(itemId: string, beforeId: string | null): void, onCancel(): void }} handlers
 *   onMove: it was let go somewhere else (before `beforeId`, or last); onCancel: it went back where it was
 */
export function wireReorder(list, { onMove, onCancel }) {
  let frame = 0;

  /** Keeps the item under the pointer, and moves it past the neighbours whose middle it crossed. */
  function follow() {
    const { li, y } = drag;
    const target = [...list.children].find((other) => other !== li && y < middle(other)) ?? null;
    if (target !== li.nextElementSibling) list.insertBefore(li, target);
    li.style.transform = `translateY(${y + window.scrollY - drag.startY - (li.offsetTop - drag.startTop)}px)`;
  }

  /** Near the top (under the pinned bar) or the bottom of the screen, the page scrolls along. */
  function scroll() {
    const top = document.querySelector('.tracker-head')?.getBoundingClientRect().bottom ?? 0;
    const edge = 64;
    const over = drag.y < top + edge ? drag.y - top - edge : drag.y > innerHeight - edge ? drag.y - innerHeight + edge : 0;
    if (over) {
      window.scrollBy(0, Math.max(-14, Math.min(14, over / 4)));
      follow();
    }
    frame = requestAnimationFrame(scroll);
  }

  list.addEventListener('pointerdown', (e) => {
    const grip = e.target instanceof Element ? e.target.closest('[data-grip]') : null;
    if (!grip || drag || e.button > 0) return;
    const li = /** @type {HTMLElement} */ (grip.closest('[data-item]'));
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    drag = { li, pointerId: e.pointerId, y: e.clientY, startY: e.clientY + window.scrollY, startTop: li.offsetTop, before: nextId(li) };
    li.classList.add('dragging');
    document.body.classList.add('reordering');
    frame = requestAnimationFrame(scroll);
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.y = e.clientY;
    follow();
  });

  function end(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    cancelAnimationFrame(frame);
    const { li, before } = drag;
    drag = null;
    li.style.transform = '';
    li.classList.remove('dragging');
    document.body.classList.remove('reordering');
    const after = nextId(li);
    if (after !== before) onMove(li.dataset.item, after);
    else onCancel();
  }
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}
