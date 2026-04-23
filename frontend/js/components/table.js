/**
 * DataTable — a reusable, sortable, filterable table component.
 *
 * Usage:
 *   const table = new DataTable(containerEl, {
 *     columns: [
 *       { key: 'name', label: 'Name', sortable: true, render: (val, row) => `<strong>${val}</strong>` },
 *       { key: 'status', label: 'Status', sortable: true },
 *     ],
 *     data: [],
 *     onRowClick: (row) => { ... },
 *     emptyMessage: 'No items found',
 *     pagination: { page: 1, total: 0, perPage: 20, onPageChange: (p) => {} },
 *   });
 *   table.render();
 *   table.setData(newData);
 */
export class DataTable {
  constructor(container, options = {}) {
    this.container = container;
    this.columns = options.columns || [];
    this.data = options.data || [];
    this.onRowClick = options.onRowClick || null;
    this.emptyMessage = options.emptyMessage || 'No data found';
    this.emptyIcon = options.emptyIcon || 'inbox';
    this.pagination = options.pagination || null;

    this.sortKey = null;
    this.sortDir = 'asc';
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  setPagination(pagination) {
    this.pagination = pagination;
    this._renderPagination();
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this._buildHtml();
    this.container.innerHTML = '';
    this.container.appendChild(wrapper);
    this._bindEvents();

    if (window.lucide) lucide.createIcons({ nodes: [this.container] });
  }

  _buildHtml() {
    if (this.data.length === 0) {
      return `
        <div class="empty-state" style="padding: 48px 24px;">
          <i data-lucide="${this.emptyIcon}" class="empty-state-icon"></i>
          <p class="empty-state-title">${this.emptyMessage}</p>
        </div>
      `;
    }

    const headerCells = this.columns.map(col => {
      const isSorted = this.sortKey === col.key;
      const sortedClass = isSorted ? ' sorted' : '';
      const sortIcon = col.sortable ? `<span class="sort-icon" aria-hidden="true">${isSorted ? (this.sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>` : '';
      return `<th class="${sortedClass}" data-sort="${col.sortable ? col.key : ''}" style="${col.width ? `width:${col.width}` : ''}">
        ${col.label}${sortIcon}
      </th>`;
    }).join('');

    const rows = this._getSortedData().map(row => {
      const cells = this.columns.map(col => {
        const val = row[col.key];
        const cellContent = col.render ? col.render(val, row) : (val !== undefined && val !== null ? String(val) : '—');
        return `<td>${cellContent}</td>`;
      }).join('');

      const clickable = this.onRowClick ? ' clickable' : '';
      return `<tr class="${clickable}" data-id="${row.id ?? ''}">
        ${cells}
      </tr>`;
    }).join('');

    const pagination = this.pagination ? this._buildPaginationHtml() : '';

    return `
      <div class="table-wrapper">
        <table class="data-table" role="grid">
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${pagination}
      </div>
    `;
  }

  _getSortedData() {
    if (!this.sortKey) return this.data;
    return [...this.data].sort((a, b) => {
      const aVal = a[this.sortKey];
      const bVal = b[this.sortKey];
      if (aVal === bVal) return 0;
      let cmp = aVal < bVal ? -1 : 1;
      return this.sortDir === 'desc' ? -cmp : cmp;
    });
  }

  _buildPaginationHtml() {
    const { page, total, perPage, onPageChange } = this.pagination;
    if (!total) return '';

    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    const pageButtons = [];

    // Always show first page
    pageButtons.push(this._pageBtn(1, page === 1));

    if (page > 3) pageButtons.push('<span style="padding: 0 4px; color: var(--text-muted);">…</span>');

    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
      pageButtons.push(this._pageBtn(p, page === p));
    }

    if (page < totalPages - 2) pageButtons.push('<span style="padding: 0 4px; color: var(--text-muted);">…</span>');

    if (totalPages > 1) pageButtons.push(this._pageBtn(totalPages, page === totalPages));

    return `
      <div class="pagination">
        <span class="pagination-info">Showing ${start}–${end} of ${total}</span>
        <div class="pagination-controls">
          <button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
          ${pageButtons.join('')}
          <button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">›</button>
        </div>
      </div>
    `;
  }

  _pageBtn(p, isActive) {
    return `<button class="page-btn ${isActive ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}" aria-current="${isActive ? 'page' : 'false'}">${p}</button>`;
  }

  _renderPagination() {
    const existing = this.container.querySelector('.pagination');
    if (existing) existing.outerHTML = this._buildPaginationHtml();
  }

  _bindEvents() {
    // Sort
    this.container.querySelectorAll('th[data-sort]').forEach(th => {
      const key = th.getAttribute('data-sort');
      if (!key) return;
      th.addEventListener('click', () => {
        if (this.sortKey === key) {
          this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortKey = key;
          this.sortDir = 'asc';
        }
        this.render();
      });
    });

    // Row click
    if (this.onRowClick) {
      this.container.querySelectorAll('tbody tr.clickable').forEach(tr => {
        tr.addEventListener('click', (e) => {
          // Don't trigger row click when clicking buttons/links inside the row
          if (e.target.closest('button, a, [data-no-row-click]')) return;
          const id = tr.getAttribute('data-id');
          const row = this.data.find(r => String(r.id) === id);
          if (row) this.onRowClick(row);
        });
      });
    }

    // Pagination
    if (this.pagination?.onPageChange) {
      this.container.querySelectorAll('.page-btn[data-page]:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.getAttribute('data-page'), 10);
          if (p > 0) this.pagination.onPageChange(p);
        });
      });
    }
  }
}
