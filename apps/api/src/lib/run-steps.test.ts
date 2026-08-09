import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enqueueMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateReturningMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
  runPhaseFindManyMock: vi.fn(),
  runPhaseDependencyFindManyMock: vi.fn(),
}))

vi.mock('../queue/index.js', () => ({
  queue: { enqueue: mocks.enqueueMock },
}))

function tx() {
  return {
    query: {
      runStep: { findMany: mocks.runStepFindManyMock },
      runPhase: { findMany: mocks.runPhaseFindManyMock },
      runPhaseDependency: { findMany: mocks.runPhaseDependencyFindManyMock },
    },
    update: mocks.updateMock,
  }
}

const {
  AUTOMATED_STEP_EXECUTE_JOB,
  TASK_ASSIGNMENT_NOTIFY_JOB,
  completeRunStep,
  dispatchAutomatedSteps,
  dispatchTaskNotifications,
  loadNotifiableTasks,
  selectManualStepsToNotify,
  selectStepsToDispatch,
} = await import('./run-steps.js')

beforeEach(() => {
  mocks.enqueueMock.mockReset().mockResolvedValue(undefined)
  mocks.updateReturningMock.mockReset()
  mocks.updateWhereMock.mockReset().mockReturnValue({ returning: mocks.updateReturningMock })
  mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
  mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
  mocks.runStepFindManyMock.mockReset()
  mocks.runPhaseFindManyMock.mockReset()
  mocks.runPhaseDependencyFindManyMock.mockReset()
})

describe('selectStepsToDispatch', () => {
  const phases = [{ id: 'p1' }, { id: 'p2' }]
  // p2 depends on p1 — same shape as ADR-0017's sequential chain, expressed
  // as an explicit edge (ADR-0019).
  const dependencies = [{ phaseId: 'p2', dependsOnPhaseId: 'p1' }]

  it('includes automated, pending steps in an unlocked (root) phase', () => {
    const steps = [
      { id: 's1', phaseId: 'p1', type: 'automated', status: 'pending' },
      { id: 's2', phaseId: 'p1', type: 'manual', status: 'pending' },
    ]

    expect(selectStepsToDispatch(phases, dependencies, steps)).toEqual([
      { id: 's1', phaseId: 'p1', type: 'automated', status: 'pending' },
    ])
  })

  it('excludes an automated step that is already completed', () => {
    const steps = [{ id: 's1', phaseId: 'p1', type: 'automated', status: 'completed' }]

    expect(selectStepsToDispatch(phases, dependencies, steps)).toEqual([])
  })

  it('excludes an automated step sitting in a still-locked phase', () => {
    const steps = [
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'pending' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ]

    expect(selectStepsToDispatch(phases, dependencies, steps)).toEqual([])
  })

  it('includes an automated step in phase 2 once phase 1 (its dependency) is fully complete', () => {
    const steps = [
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ]

    expect(selectStepsToDispatch(phases, dependencies, steps)).toEqual([
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
  })
})

describe('selectManualStepsToNotify', () => {
  const phases = [{ id: 'p1' }, { id: 'p2' }]
  const dependencies = [{ phaseId: 'p2', dependsOnPhaseId: 'p1' }]

  function task(overrides: Record<string, unknown> = {}) {
    return {
      id: 's1',
      phaseId: 'p1',
      type: 'manual',
      status: 'pending',
      assigneeId: 'm1',
      assignmentNotifiedAt: null,
      ...overrides,
    }
  }

  it('includes an assigned, pending manual task in an unlocked phase', () => {
    expect(selectManualStepsToNotify(phases, dependencies, [task()])).toEqual([task()])
  })

  it('excludes automated steps — they run themselves, nobody to tell', () => {
    const steps = [task({ id: 's1' }), task({ id: 's2', type: 'automated', assigneeId: null })]
    expect(selectManualStepsToNotify(phases, dependencies, steps)).toEqual([task({ id: 's1' })])
  })

  it('excludes an unassigned task — there is no one to email', () => {
    expect(selectManualStepsToNotify(phases, dependencies, [task({ assigneeId: null })])).toEqual(
      [],
    )
  })

  it('excludes a task whose assignee was already emailed', () => {
    const notified = task({ assignmentNotifiedAt: new Date('2026-08-01T09:00:00Z') })
    expect(selectManualStepsToNotify(phases, dependencies, [notified])).toEqual([])
  })

  it('excludes an already-completed task', () => {
    expect(
      selectManualStepsToNotify(phases, dependencies, [task({ status: 'completed' })]),
    ).toEqual([])
  })

  // The core of the design: a task behind an incomplete dependency can't be
  // completed in the UI, so its assignee is not told about it yet.
  it('excludes a task in a still-locked phase', () => {
    const blocked = task({ id: 's2', phaseId: 'p2' })
    const steps = [task({ id: 's1', phaseId: 'p1' }), blocked]
    expect(selectManualStepsToNotify(phases, dependencies, steps)).toEqual([
      task({ id: 's1', phaseId: 'p1' }),
    ])
  })

  it('includes that same task once the phase it waited on is fully complete', () => {
    const steps = [
      task({ id: 's1', phaseId: 'p1', status: 'completed' }),
      task({ id: 's2', phaseId: 'p2' }),
    ]
    expect(selectManualStepsToNotify(phases, dependencies, steps)).toEqual([
      task({ id: 's2', phaseId: 'p2' }),
    ])
  })
})

describe('dispatchTaskNotifications', () => {
  it('enqueues one notification job per task, keyed for dedup', async () => {
    await dispatchTaskNotifications('org-1', [{ id: 's1' }, { id: 's2' }])

    expect(mocks.enqueueMock).toHaveBeenCalledTimes(2)
    expect(mocks.enqueueMock).toHaveBeenCalledWith(
      { name: TASK_ASSIGNMENT_NOTIFY_JOB, data: { runStepId: 's1', organizationId: 'org-1' } },
      { singletonKey: 's1', retryLimit: 5, retryBackoff: true },
    )
  })

  // The two queues share the run-step id as their singletonKey; pg-boss
  // scopes that key per queue, so they must not be the same queue name.
  it('uses a different queue from automated step execution', () => {
    expect(TASK_ASSIGNMENT_NOTIFY_JOB).not.toBe(AUTOMATED_STEP_EXECUTE_JOB)
  })

  it('enqueues nothing for an empty list', async () => {
    await dispatchTaskNotifications('org-1', [])
    expect(mocks.enqueueMock).not.toHaveBeenCalled()
  })
})

describe('loadNotifiableTasks', () => {
  it('applies the same rule against a run read back from the database', async () => {
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    mocks.runPhaseDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'p2', dependsOnPhaseId: 'p1' },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        id: 's1',
        phaseId: 'p1',
        type: 'manual',
        status: 'pending',
        assigneeId: 'm1',
        assignmentNotifiedAt: null,
      },
      // Locked behind p1, so not reported even though it is assigned.
      {
        id: 's2',
        phaseId: 'p2',
        type: 'manual',
        status: 'pending',
        assigneeId: 'm2',
        assignmentNotifiedAt: null,
      },
    ])

    const tasks = await loadNotifiableTasks(tx() as never, 'r1')

    expect(tasks).toEqual([expect.objectContaining({ id: 's1' })])
  })

  it('skips the dependency query for a run with no phases', async () => {
    mocks.runPhaseFindManyMock.mockResolvedValue([])
    mocks.runStepFindManyMock.mockResolvedValue([])

    await expect(loadNotifiableTasks(tx() as never, 'r1')).resolves.toEqual([])
    expect(mocks.runPhaseDependencyFindManyMock).not.toHaveBeenCalled()
  })
})

describe('dispatchAutomatedSteps', () => {
  it('enqueues one job per step with a singletonKey and retry options', async () => {
    await dispatchAutomatedSteps('org-1', [{ id: 's1' }, { id: 's2' }])

    expect(mocks.enqueueMock).toHaveBeenCalledTimes(2)
    expect(mocks.enqueueMock).toHaveBeenCalledWith(
      { name: AUTOMATED_STEP_EXECUTE_JOB, data: { runStepId: 's1', organizationId: 'org-1' } },
      { singletonKey: 's1', retryLimit: 5, retryBackoff: true },
    )
    expect(mocks.enqueueMock).toHaveBeenCalledWith(
      { name: AUTOMATED_STEP_EXECUTE_JOB, data: { runStepId: 's2', organizationId: 'org-1' } },
      { singletonKey: 's2', retryLimit: 5, retryBackoff: true },
    )
  })

  it('enqueues nothing for an empty list', async () => {
    await dispatchAutomatedSteps('org-1', [])

    expect(mocks.enqueueMock).not.toHaveBeenCalled()
  })
})

describe('completeRunStep', () => {
  it('marks the step completed and sets run.status to in_progress when a manual step remains pending', async () => {
    mocks.updateReturningMock
      .mockResolvedValueOnce([{ id: 's1', runId: 'r1', status: 'completed' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'in_progress' }])
    mocks.runStepFindManyMock.mockResolvedValue([
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p1', type: 'manual', status: 'pending' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1' }])
    mocks.runPhaseDependencyFindManyMock.mockResolvedValue([])

    const result = await completeRunStep(tx() as never, 's1')

    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'completed' }),
    )
    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'in_progress' }),
    )
    // s2 is manual, not automated — nothing to dispatch.
    expect(result.stepsToDispatch).toEqual([])
  })

  it('still reports an already-pending automated sibling in the same (already-unlocked) phase', async () => {
    // A phase's steps run in parallel — completing one sibling doesn't gate
    // another already-dispatchable automated step in that same phase.
    // dispatchAutomatedSteps' singletonKey makes re-dispatching it a safe
    // no-op if its earlier job is still queued/active.
    mocks.updateReturningMock
      .mockResolvedValueOnce([{ id: 's1', runId: 'r1', status: 'completed' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'in_progress' }])
    mocks.runStepFindManyMock.mockResolvedValue([
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p1', type: 'automated', status: 'pending' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1' }])
    mocks.runPhaseDependencyFindManyMock.mockResolvedValue([])

    const result = await completeRunStep(tx() as never, 's1')

    expect(result.stepsToDispatch).toEqual([
      { id: 's2', phaseId: 'p1', type: 'automated', status: 'pending' },
    ])
  })

  it('reports a newly-unlocked automated step in the next phase, run still in_progress', async () => {
    mocks.updateReturningMock
      .mockResolvedValueOnce([{ id: 's1', runId: 'r1', status: 'completed' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'in_progress' }])
    mocks.runStepFindManyMock.mockResolvedValue([
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    mocks.runPhaseDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'p2', dependsOnPhaseId: 'p1' },
    ])

    const result = await completeRunStep(tx() as never, 's1')

    // s2 is still pending, so the run is not finished — assert what the code
    // writes, not what the update mock was told to echo back.
    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'in_progress' }),
    )
    expect(result.stepsToDispatch).toEqual([
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
  })

  it('reports a newly-unlocked manual task alongside the automated steps', async () => {
    mocks.updateReturningMock
      .mockResolvedValueOnce([{ id: 's1', runId: 'r1', status: 'completed' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'in_progress' }])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        id: 's1',
        phaseId: 'p1',
        type: 'manual',
        status: 'completed',
        assigneeId: 'm1',
        assignmentNotifiedAt: new Date('2026-08-01T09:00:00Z'),
      },
      {
        id: 's2',
        phaseId: 'p2',
        type: 'manual',
        status: 'pending',
        assigneeId: 'm2',
        assignmentNotifiedAt: null,
      },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    mocks.runPhaseDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'p2', dependsOnPhaseId: 'p1' },
    ])

    const result = await completeRunStep(tx() as never, 's1')

    // Completing the last step of p1 unlocks p2, making m2's task actionable
    // — and the step just completed is not re-announced to m1.
    expect(result.stepsToDispatch).toEqual([])
    expect(result.tasksToNotify).toEqual([expect.objectContaining({ id: 's2', assigneeId: 'm2' })])
  })

  it('sets run.status to completed when the step completed was the last one left', async () => {
    mocks.updateReturningMock
      .mockResolvedValueOnce([{ id: 's1', runId: 'r1', status: 'completed' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'completed' }])
    mocks.runStepFindManyMock.mockResolvedValue([
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'completed' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    mocks.runPhaseDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'p2', dependsOnPhaseId: 'p1' },
    ])

    const result = await completeRunStep(tx() as never, 's1')

    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'completed' }),
    )
    // Nothing left to dispatch once every step is done.
    expect(result.stepsToDispatch).toEqual([])
  })
})
