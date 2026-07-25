import { describe, expect, it } from 'vitest'
import { computeUnlockedPhaseIds, isStepLocked, wouldCreateCycle } from './phase.js'

const PHASES = [{ id: 'notice' }, { id: 'final-day' }, { id: 'revocation' }]

// notice (root) -> final-day -> revocation, same shape as ADR-0017's
// position-walk chain, but expressed as explicit edges.
const SEQUENTIAL_DEPENDENCIES = [
  { phaseId: 'final-day', dependsOnPhaseId: 'notice' },
  { phaseId: 'revocation', dependsOnPhaseId: 'final-day' },
]

describe('computeUnlockedPhaseIds', () => {
  it('unlocks only root phases (no declared dependencies) when nothing is completed', () => {
    const steps = [
      { phaseId: 'notice', status: 'pending' },
      { phaseId: 'final-day', status: 'pending' },
      { phaseId: 'revocation', status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, SEQUENTIAL_DEPENDENCIES, steps)).toEqual(
      new Set(['notice']),
    )
  })

  it('unlocks the next phase once every step in its dependency is completed', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'final-day', status: 'pending' },
      { phaseId: 'revocation', status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, SEQUENTIAL_DEPENDENCIES, steps)).toEqual(
      new Set(['notice', 'final-day']),
    )
  })

  it('does not unlock a dependent phase while a dependency still has a step in parallel that is pending', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'notice', status: 'pending' }, // still one parallel step outstanding
    ]

    expect(computeUnlockedPhaseIds(PHASES, SEQUENTIAL_DEPENDENCIES, steps)).toEqual(
      new Set(['notice']),
    )
  })

  it('treats a dependency phase with no steps as vacuously complete and keeps unlocking', () => {
    const phasesWithEmptyMiddle = [{ id: 'notice' }, { id: 'empty' }, { id: 'revocation' }]
    const dependencies = [
      { phaseId: 'empty', dependsOnPhaseId: 'notice' },
      { phaseId: 'revocation', dependsOnPhaseId: 'empty' },
    ]
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'revocation', status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(phasesWithEmptyMiddle, dependencies, steps)).toEqual(
      new Set(['notice', 'empty', 'revocation']),
    )
  })

  it('unlocks every phase once the whole run is done', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'final-day', status: 'completed' },
      { phaseId: 'revocation', status: 'completed' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, SEQUENTIAL_DEPENDENCIES, steps)).toEqual(
      new Set(['notice', 'final-day', 'revocation']),
    )
  })

  it('ignores steps with a null phaseId (pre-phase legacy rows) when checking completeness', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'final-day', status: 'pending' },
      { phaseId: null, status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, SEQUENTIAL_DEPENDENCIES, steps)).toEqual(
      new Set(['notice', 'final-day']),
    )
  })

  it('unlocks a converging phase only once every one of its several dependency branches is complete', () => {
    // IT and Office both feed into "First day" — the shape ADR-0019 exists
    // to express, which a single position-ordered chain cannot.
    const phases = [{ id: 'it' }, { id: 'office' }, { id: 'first-day' }]
    const dependencies = [
      { phaseId: 'first-day', dependsOnPhaseId: 'it' },
      { phaseId: 'first-day', dependsOnPhaseId: 'office' },
    ]

    const itDone = [{ phaseId: 'it', status: 'completed' }]
    const officePending = [{ phaseId: 'office', status: 'pending' }]
    expect(computeUnlockedPhaseIds(phases, dependencies, [...itDone, ...officePending])).toEqual(
      new Set(['it', 'office']),
    )

    const officeDone = [{ phaseId: 'office', status: 'completed' }]
    expect(computeUnlockedPhaseIds(phases, dependencies, [...itDone, ...officeDone])).toEqual(
      new Set(['it', 'office', 'first-day']),
    )
  })

  it('unlocks independent parallel branches immediately — neither is a dependency of the other', () => {
    const phases = [{ id: 'it' }, { id: 'office' }]
    expect(computeUnlockedPhaseIds(phases, [], [])).toEqual(new Set(['it', 'office']))
  })
})

describe('isStepLocked', () => {
  it('is locked when its phase is not in the unlocked set', () => {
    expect(isStepLocked({ phaseId: 'revocation', status: 'pending' }, new Set(['notice']))).toBe(
      true,
    )
  })

  it('is not locked when its phase is unlocked', () => {
    expect(isStepLocked({ phaseId: 'notice', status: 'pending' }, new Set(['notice']))).toBe(false)
  })

  it('is never locked when phaseId is null (legacy row)', () => {
    expect(isStepLocked({ phaseId: null, status: 'pending' }, new Set())).toBe(false)
  })
})

describe('wouldCreateCycle', () => {
  it('rejects a phase depending on itself', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true)
  })

  it('allows a new phase to depend on an existing phase with no reverse path back to it', () => {
    expect(wouldCreateCycle(SEQUENTIAL_DEPENDENCIES, 'extra', 'notice')).toBe(false)
  })

  it('rejects an edge that would directly close a 2-cycle', () => {
    const existing = [{ phaseId: 'b', dependsOnPhaseId: 'a' }]
    expect(wouldCreateCycle(existing, 'a', 'b')).toBe(true)
  })

  it('rejects an edge that would close a longer cycle transitively', () => {
    const existing = [
      { phaseId: 'b', dependsOnPhaseId: 'a' },
      { phaseId: 'c', dependsOnPhaseId: 'b' },
    ]
    // c already (transitively) depends on a — a depending on c would close
    // a -> c -> b -> a.
    expect(wouldCreateCycle(existing, 'a', 'c')).toBe(true)
  })

  it('allows a converging phase to depend on two independent branches', () => {
    const existing = [{ phaseId: 'first-day', dependsOnPhaseId: 'it' }]
    expect(wouldCreateCycle(existing, 'first-day', 'office')).toBe(false)
  })
})
