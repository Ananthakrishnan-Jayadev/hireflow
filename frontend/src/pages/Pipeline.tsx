import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Columns, GripVertical } from 'lucide-react';
import { api } from '../lib/api';
import { stageBadgeClass, formatSource } from '../lib/helpers';
import { Topbar } from '../components/ui/Topbar';
import { PageSpinner } from '../components/ui/Spinner';
import { toast } from '../store/toastStore';

interface Job { id: number; title: string; }

interface KanbanCandidate {
  id: number;
  name: string;
  email: string;
  source?: string;
  ai_match_score?: number;
  days_in_stage?: number;
}

interface KanbanStage { name?: string; stage?: string; candidates: KanbanCandidate[]; }

interface Pipeline { job_title: string; stages: KanbanStage[]; }

const STAGE_ORDER = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

function getStageName(stage: KanbanStage) {
  return stage.name ?? stage.stage ?? '';
}

function CandidateCard({
  candidate,
  isDragging,
  onView,
}: {
  candidate: KanbanCandidate;
  isDragging?: boolean;
  onView: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: candidate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const score = candidate.ai_match_score != null ? Math.round(candidate.ai_match_score) : null;
  const scoreColor = score == null ? '#9ca3af' : score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className="kanban-card"
        style={{
          cursor: 'default',
          boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
          transform: isDragging ? 'scale(1.02)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <button
            {...listeners}
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 4px', cursor: 'grab', color: 'var(--text-muted)', flexShrink: 0 }}
            aria-label="Drag to reorder"
          >
            <GripVertical size={13} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600, fontSize: 13,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {candidate.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {candidate.email}
            </div>
          </div>
          {score != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor, flexShrink: 0 }}>
              {score}%
            </span>
          )}
        </div>

        {candidate.source && (
          <div style={{ marginTop: 6 }}>
            <span className="badge badge-default" style={{ fontSize: 10 }}>
              {formatSource(candidate.source)}
            </span>
          </div>
        )}

        <div style={{
          display: 'flex', gap: 4, marginTop: 10,
          borderTop: '1px solid var(--border-light)', paddingTop: 8,
        }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, fontSize: 11 }}
            onClick={() => onView(candidate.id)}
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  candidates,
  onViewCandidate,
}: {
  stage: string;
  candidates: KanbanCandidate[];
  onViewCandidate: (id: number) => void;
}) {
  const ids = candidates.map(c => c.id);
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage}` });

  return (
    <div className="kanban-column" ref={setNodeRef}>
      <div className="kanban-column-header">
        <span className={`badge ${stageBadgeClass(stage)}`}>{stage}</span>
        <span className="kanban-column-count">{candidates.length}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={`kanban-column-cards${isOver ? ' drag-over' : ''}`}>
          {candidates.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No candidates
            </div>
          ) : (
            candidates.map(c => (
              <CandidateCard
                key={c.id}
                candidate={c}
                onView={onViewCandidate}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function PipelinePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    api.get<{ items: Job[] }>('/jobs?per_page=100&status=open')
      .then(d => setJobs(d.items ?? []))
      .catch(() => toast.error('Failed to load jobs.'))
      .finally(() => setJobsLoading(false));
  }, []);

  const loadPipeline = useCallback(async (jobId: number) => {
    setLoading(true);
    setPipeline(null);
    try {
      const data = await api.get<Pipeline>(`/pipeline/${jobId}`);
      const sorted: Pipeline = {
        ...data,
        stages: [...data.stages].sort((a, b) => {
          const ai = STAGE_ORDER.indexOf(getStageName(a)), bi = STAGE_ORDER.indexOf(getStageName(b));
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        }),
      };
      setPipeline(sorted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load pipeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function moveCandidate(candidateId: number, newStage: string) {
    if (!selectedJobId) return;
    try {
      await api.put('/pipeline/move', { candidate_id: candidateId, new_stage: newStage });
      toast.success(`Moved to ${newStage}.`);
      await loadPipeline(selectedJobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed.');
    }
  }

  function onJobChange(jobId: string) {
    if (!jobId) { setSelectedJobId(null); setPipeline(null); return; }
    const id = parseInt(jobId, 10);
    setSelectedJobId(id);
    loadPipeline(id);
  }

  function candidateId(id: UniqueIdentifier) {
    return typeof id === 'number' ? id : parseInt(String(id), 10);
  }

  function stageFromOverId(id: UniqueIdentifier) {
    const raw = String(id);
    return raw.startsWith('stage:') ? raw.slice(6) : null;
  }

  function findStageByCandidate(id: number) {
    return pipeline?.stages.find(stage => stage.candidates.some(c => c.id === id));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(candidateId(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !pipeline) return;

    const activeId = candidateId(active.id);
    const overStageName = stageFromOverId(over.id);
    const sourceStage = findStageByCandidate(activeId);
    const destStage = overStageName
      ? pipeline.stages.find(s => getStageName(s) === overStageName)
      : findStageByCandidate(candidateId(over.id));
    const sourceStageName = sourceStage ? getStageName(sourceStage) : null;
    const destStageName = destStage ? getStageName(destStage) : null;

    if (sourceStageName && destStageName && sourceStageName !== destStageName) {
      await moveCandidate(activeId, destStageName);
    } else {
      // Revert optimistic update by reloading
      if (selectedJobId) await loadPipeline(selectedJobId);
    }
  }

  const totalCandidates = pipeline?.stages.reduce((s, st) => s + st.candidates.length, 0) ?? 0;
  const activeCandidate = activeId
    ? pipeline?.stages.flatMap(s => s.candidates).find(c => c.id === activeId)
    : null;

  return (
    <div>
      <Topbar title="Pipeline" subtitle="Drag candidates between hiring stages" />
      <div className="kanban-job-selector">
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Job:
        </label>
        <select
          className="form-select"
          onChange={e => onJobChange(e.target.value)}
          disabled={jobsLoading}
          style={{ maxWidth: 320 }}
        >
          <option value="">{jobsLoading ? 'Loading…' : '— Select a job —'}</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        {pipeline && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''} · {pipeline.job_title}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><PageSpinner /></div>
      ) : !pipeline ? (
        <div className="kanban-empty">
          <div style={{ textAlign: 'center' }}>
            <Columns size={48} style={{ color: 'var(--border)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select a job above to view its pipeline.</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {pipeline.stages.map(stageData => (
              <KanbanColumn
                key={getStageName(stageData)}
                stage={getStageName(stageData)}
                candidates={stageData.candidates}
                onViewCandidate={id => navigate(`/candidates/${id}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCandidate ? (
              <div style={{ width: 240 }}>
                <CandidateCard
                  candidate={activeCandidate}
                  isDragging
                  onView={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
