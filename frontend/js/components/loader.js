/**
 * Show a full-page loading spinner in the given container.
 */
export function showPageLoader(container) {
  container.innerHTML = `
    <div class="page-loader">
      <div class="spinner">
        <div class="spinner-circle"></div>
      </div>
    </div>
  `;
}

/**
 * Returns an inline spinner HTML string.
 * @param {'sm'|''|'lg'} [size]
 */
export function spinnerHtml(size = '') {
  const cls = size ? `spinner spinner-${size}` : 'spinner';
  return `<div class="${cls}"><div class="spinner-circle"></div></div>`;
}

/**
 * Renders a list of skeleton card rows for table loading states.
 * @param {number} [count]
 * @param {number} [cols]
 */
export function skeletonTableRows(count = 5, cols = 5) {
  const colWidths = ['wide', 'medium', 'narrow', 'narrow', 'narrow'];
  const rows = Array.from({ length: count }, () => `
    <tr>
      ${Array.from({ length: cols }, (_, i) => `
        <td>
          <div class="skeleton skeleton-text ${colWidths[i] || 'medium'}"></div>
        </td>
      `).join('')}
    </tr>
  `).join('');
  return rows;
}

/**
 * Renders skeleton stat cards for dashboard loading.
 * @param {number} [count]
 */
export function skeletonStatCards(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="stat-card">
      <div class="skeleton skeleton-text narrow" style="height:11px;width:60%;margin-bottom:12px;"></div>
      <div class="skeleton skeleton-text" style="height:36px;width:50%;margin-bottom:10px;"></div>
      <div class="skeleton skeleton-text narrow" style="height:12px;width:40%;"></div>
    </div>
  `).join('');
}

/**
 * Renders skeleton kanban cards.
 * @param {number} [count]
 */
export function skeletonKanbanCards(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="kanban-card" style="pointer-events:none;">
      <div class="skeleton skeleton-text medium" style="margin-bottom:10px;"></div>
      <div class="skeleton skeleton-text narrow"></div>
    </div>
  `).join('');
}
