import { api } from '../api.js';
import { renderTopbar } from '../components/topbar.js';
import { showError, showSuccess } from '../components/toast.js';
import { KanbanBoard } from '../components/kanban.js';

let currentBoard = null; // KanbanBoard instance for cleanup

export async function render(container, params) {
  // Destroy previous board's drag listeners if navigating between jobs
  if (currentBoard) { currentBoard.destroy(); currentBoard = null; }

  const jobIdFromUrl = params[0] ? parseInt(params[0], 10) : null;

  // Load open jobs for the selector
  let jobs = [];
  let jobsError = null;
  try {
    const jd = await api.get('/jobs?per_page=100&status=open');
    jobs = jd.items || [];
  } catch (err) {
    jobsError = err.message;
    jobs = [];
  }

  container.innerHTML = `
    ${renderTopbar({
      title: 'Pipeline',
      subtitle: 'Drag candidates between hiring stages',
    })}
    <div class="kanban-job-selector">
      <label style="font-size:13px;font-weight:600;color:var(--text-secondary);white-space:nowrap;">Job:</label>
      <select class="form-select" id="pipeline-job-select" ${jobsError ? 'disabled' : ''}>
        <option value="">${jobsError ? 'Failed to load jobs' : '— Select a job —'}</option>
        ${jobs.map(j => `<option value="${j.id}" ${j.id === jobIdFromUrl ? 'selected' : ''}>${j.title}</option>`).join('')}
      </select>
      <span id="pipeline-total" style="font-size:13px;color:var(--text-muted);margin-left:auto;"></span>
      ${jobsError ? `<span style="font-size:12px;color:var(--color-error);display:flex;align-items:center;gap:4px;">
        <i data-lucide="alert-circle" style="width:13px;height:13px;"></i> ${jobsError}
      </span>` : ''}
    </div>
    <div id="pipeline-board-container"></div>
  `;

  if (window.lucide) lucide.createIcons();

  const select = container.querySelector('#pipeline-job-select');
  select?.addEventListener('change', () => {
    const val = parseInt(select.value, 10);
    if (val) {
      window.location.hash = `#/pipeline/${val}`;
    } else {
      showEmptyBoard(container);
    }
  });

  if (jobIdFromUrl) {
    await loadPipeline(container, jobIdFromUrl);
  } else {
    showEmptyBoard(container);
  }

  // Return cleanup function for app.js router
  return function cleanup() {
    if (currentBoard) { currentBoard.destroy(); currentBoard = null; }
  };
}

function showEmptyBoard(container) {
  const boardContainer = document.getElementById('pipeline-board-container');
  if (!boardContainer) return;
  boardContainer.innerHTML = `
    <div class="kanban-empty">
      <div style="text-align:center;">
        <i data-lucide="columns" style="width:48px;height:48px;color:var(--border);margin-bottom:12px;display:block;margin-inline:auto;"></i>
        <p style="color:var(--text-muted);font-size:14px;">Select a job above to view its pipeline.</p>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons({ nodes: [boardContainer] });
}

async function loadPipeline(container, jobId) {
  const boardContainer = document.getElementById('pipeline-board-container');
  if (!boardContainer) return;

  boardContainer.innerHTML = `
    <div style="padding:60px;text-align:center;">
      <div class="spinner"><div class="spinner-circle"></div></div>
    </div>`;

  try {
    const pipeline = await api.get(`/pipeline/${jobId}`);

    const totalEl = document.getElementById('pipeline-total');
    const total   = pipeline.stages.reduce((s, st) => s + st.candidates.length, 0);
    if (totalEl) totalEl.textContent = `${total} candidate${total !== 1 ? 's' : ''} · ${pipeline.job_title}`;

    if (currentBoard) { currentBoard.destroy(); currentBoard = null; }

    currentBoard = new KanbanBoard(boardContainer, pipeline, async (candidateId, newStage) => {
      try {
        await api.put('/pipeline/move', { candidate_id: candidateId, new_stage: newStage });
        showSuccess(`Moved to ${newStage}.`);
        await loadPipeline(container, jobId); // Refresh board
      } catch (err) {
        showError(err.message);
      }
    });

    currentBoard.render();
  } catch (err) {
    boardContainer.innerHTML = `
      <div class="kanban-empty">
        <div style="text-align:center;">
          <i data-lucide="alert-triangle" style="width:36px;height:36px;color:var(--color-error);display:block;margin:0 auto 12px;"></i>
          <p style="color:var(--text-muted);font-size:14px;">${err.message}</p>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [boardContainer] });
  }
}

