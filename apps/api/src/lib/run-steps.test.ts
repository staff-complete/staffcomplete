import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enqueueMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateReturningMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
  runPhaseFindManyMock: vi.fn(),
}))

vi.mock('../queue/index.js', () => ({
  queue: { enqueue: mocks.enqueueMock },
}))

function tx() {
  return {
    query: {
      runStep: { findMany: mocks.runStepFindManyMock },
      runPhase: { findMany: mocks.runPhaseFindManyMock },
    },
    update: mocks.updateMock,
  }
}

const {
  AUTOMATED_STEP_EXECUTE_JOB,
  completeRunStep,
  dispatchAutomatedSteps,
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
})

describe('selectStepsToDispatch', () => {
  const phases = [
    { id: 'p1', position: 0 },
    { id: 'p2', position: 1 },
  ]

  it('includes automated, pending steps in an unlocked phase', () => {
    const steps = [
      { id: 's1', phaseId: 'p1', type: 'automated', status: 'pending' },
      { id: 's2', phaseId: 'p1', type: 'manual', status: 'pending' },
    ]

    expect(selectStepsToDispatch(phases, steps)).toEqual([
      { id: 's1', phaseId: 'p1', type: 'automated', status: 'pending' },
    ])
  })

  it('excludes an automated step that is already completed', () => {
    const steps = [{ id: 's1', phaseId: 'p1', type: 'automated', status: 'completed' }]

    expect(selectStepsToDispatch(phases, steps)).toEqual([])
  })

  it('excludes an automated step sitting in a still-locked phase', () => {
    const steps = [
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'pending' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ]

    expect(selectStepsToDispatch(phases, steps)).toEqual([])
  })

  it('includes an automated step in phase 2 once phase 1 is fully complete', () => {
    const steps = [
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ]

    expect(selectStepsToDispatch(phases, steps)).toEqual([
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
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
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', position: 0 }])

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
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', position: 0 }])

    const result = await completeRunStep(tx() as never, 's1')

    expect(result.stepsToDispatch).toEqual([
      { id: 's2', phaseId: 'p1', type: 'automated', status: 'pending' },
    ])
  })

  it('sets run.status to completed and reports a newly-unlocked automated step to dispatch', async () => {
    mocks.updateReturningMock
      .mockResolvedValueOnce([{ id: 's1', runId: 'r1', status: 'completed' }])
      .mockResolvedValueOnce([{ id: 'r1', status: 'completed' }])
    mocks.runStepFindManyMock.mockResolvedValue([
      { id: 's1', phaseId: 'p1', type: 'manual', status: 'completed' },
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([
      { id: 'p1', position: 0 },
      { id: 'p2', position: 1 },
    ])

    const result = await completeRunStep(tx() as never, 's1')

    expect(result.updatedRun).toEqual({ id: 'r1', status: 'completed' })
    expect(result.stepsToDispatch).toEqual([
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
  })
})
