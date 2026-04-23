import { starsHtml, formatSource, timeAgo } from '../utils/helpers.js';
import { initDragDrop } from '../utils/dragdrop.js';

/**
 * KanbanBoard renders a pipeline as draggable columns.
 *
 * @param {HTMLElement} container - Where to render
 * @param {object}      pipeline  - PipelineResponse from /api/pipeline/:job_id
 * @param {function}    onMove    - async onMove(candidateId, newStage) — handle API call + reload
 */
export class KanbanBoard {
  constructor(container, pipeline, onMove) {
    this.container = container;
    this.pipeline  = pipeline;
    this.onMove    = onMove;
    this._cleanup  = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="kanban-board" id="kanban-board">
        ${this.pipeline.stages.map(stage => this._columnHtml(stage)).join('')}
      </div>`;

    if (window.lucide) lucide.createIcons({ nodes: [this.container] });

    const board = this.container.querySelector('#kanban-board');
    if (board) {
      this._cleanup = initDragDrop(board, (cardEl, targetColEl) => {
        const candidateId = parseInt(cardEl.dataset.candidateId, 10);
        const newStage    = targetColEl.dataset.stage;
        if (candidateId && newStage) this.onMove(candidateId, newStage);
      });
    }

    // Click cards to navigate to profile
    this.container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-no-click]')) return;
        const id = card.dataset.candidateId;
        if (id) window.location.hash = `#/candidates/${id}`;
      });
    });
  }

  destroy() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
  }

  _columnHtml(stage) {
    const count = stage.candidates.length;
    return `
      <div class="kanban-column" data-stage="${stage.name}">
        <div class="kanban-column-header">
          <span class="kanban-column-name">${stage.name}</span>
          <span class="kanban-column-count">${count}</span>
        </div>
        <div class="kanban-column-cards">
          ${count === 0
            ? `<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">Drop here</div>`
            : stage.candidates.map(c => this._cardHtml(c)).join('')}
        </div>
      </div>`;
  }

  _cardHtml(c) {
    const daysAgo = timeAgo(c.applied_at);
    const stars   = starsHtml(c.rating || 0);
    return `
      <div class="kanban-card" draggable="true" data-candidate-id="${c.id}" tabindex="0"
           role="button" aria-label="View ${c.name}">
        <div class="kanban-card-name">${c.name}</div>
        ${c.source ? `<div class="kanban-card-source">
          <i data-lucide="link" style="width:10px;height:10px;"></i>
          ${formatSource(c.source)}
        </div>` : ''}
        <div class="kanban-card-meta" style="margin-top:8px;">
          <div class="kanban-card-stars">${stars}</div>
          <div class="kanban-card-days">${daysAgo}</div>
        </div>
        ${c.tags && c.tags.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
            ${c.tags.slice(0, 3).map(t => `<span class="badge badge-default" style="font-size:10px;">${t}</span>`).join('')}
          </div>` : ''}
      </div>`;
  }
}
