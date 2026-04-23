/**
 * Lightweight drag-and-drop for kanban boards (HTML5 DnD API).
 *
 * @param {HTMLElement} board - The kanban board root element
 * @param {function} onCardDrop - Called as onCardDrop(cardEl, targetColumnEl)
 * @returns {function} cleanup - Removes all listeners
 */
export function initDragDrop(board, onCardDrop) {
  let draggingCard = null;
  let ghostEl     = null;
  let overColumn  = null;

  function cardOf(el) { return el.closest?.('.kanban-card') || null; }
  function colOf(el)  { return el.closest?.('.kanban-column') || null; }
  function cardsOf(col) { return col?.querySelector('.kanban-column-cards') || null; }

  function highlightCol(col) {
    if (col === overColumn) return;
    if (overColumn) cardsOf(overColumn)?.classList.remove('drag-over');
    overColumn = col;
    if (col) cardsOf(col)?.classList.add('drag-over');
  }

  function clearHighlight() { highlightCol(null); }

  /* ── dragstart ──────────────────────────────────────────────── */
  function handleDragStart(e) {
    const card = cardOf(e.target);
    if (!card) return;
    draggingCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.candidateId || '');

    // Custom ghost image
    ghostEl = card.cloneNode(true);
    ghostEl.classList.add('drag-ghost');
    ghostEl.style.cssText = `width:${card.offsetWidth}px;position:fixed;top:-9999px;left:-9999px;`;
    document.body.appendChild(ghostEl);
    e.dataTransfer.setDragImage(ghostEl, Math.min(100, card.offsetWidth / 2), 20);
  }

  /* ── dragend ────────────────────────────────────────────────── */
  function handleDragEnd() {
    draggingCard?.classList.remove('dragging');
    ghostEl?.remove();
    ghostEl      = null;
    draggingCard = null;
    clearHighlight();
  }

  /* ── dragover ───────────────────────────────────────────────── */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    highlightCol(colOf(e.target));
  }

  /* ── dragleave ──────────────────────────────────────────────── */
  function handleDragLeave(e) {
    if (!board.contains(e.relatedTarget)) clearHighlight();
  }

  /* ── drop ───────────────────────────────────────────────────── */
  function handleDrop(e) {
    e.preventDefault();
    const targetCol = colOf(e.target);
    if (targetCol && draggingCard && colOf(draggingCard) !== targetCol) {
      onCardDrop(draggingCard, targetCol);
    }
    clearHighlight();
  }

  board.addEventListener('dragstart',  handleDragStart);
  board.addEventListener('dragend',    handleDragEnd);
  board.addEventListener('dragover',   handleDragOver);
  board.addEventListener('dragleave',  handleDragLeave);
  board.addEventListener('drop',       handleDrop);

  return function cleanup() {
    board.removeEventListener('dragstart',  handleDragStart);
    board.removeEventListener('dragend',    handleDragEnd);
    board.removeEventListener('dragover',   handleDragOver);
    board.removeEventListener('dragleave',  handleDragLeave);
    board.removeEventListener('drop',       handleDrop);
  };
}
