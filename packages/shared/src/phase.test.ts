import { describe, expect, it } from 'vitest'
import { computeUnlockedPhaseIds, isStepLocked } from './phase.js'

const PHASES = [
  { id: 'notice', position: 0 },
  { id: 'final-day', position: 1 },
  { id: 'revocation', position: 2 },
]

describe('computeUnlockedPhaseIds', () => {
  it('unlocks only the first phase when nothing is completed', () => {
    const steps = [
      { phaseId: 'notice', status: 'pending' },
      { phaseId: 'final-day', status: 'pending' },
      { phaseId: 'revocation', status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, steps)).toEqual(new Set(['notice']))
  })

  it('unlocks the next phase once every step in the previous phase is completed', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'final-day', status: 'pending' },
      { phaseId: 'revocation', status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, steps)).toEqual(new Set(['notice', 'final-day']))
  })

  it('does not unlock a later phase while an earlier phase still has a step in parallel that is pending', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'notice', status: 'pending' }, // still one parallel step outstanding
    ]

    expect(computeUnlockedPhaseIds(PHASES, steps)).toEqual(new Set(['notice']))
  })

  it('treats a phase with no steps as vacuously complete and keeps unlocking', () => {
    const phasesWithEmptyMiddle = [
      { id: 'notice', position: 0 },
      { id: 'empty', position: 1 },
      { id: 'revocation', position: 2 },
    ]
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'revocation', status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(phasesWithEmptyMiddle, steps)).toEqual(
      new Set(['notice', 'empty', 'revocation']),
    )
  })

  it('unlocks every phase once the whole run is done', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'final-day', status: 'completed' },
      { phaseId: 'revocation', status: 'completed' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, steps)).toEqual(
      new Set(['notice', 'final-day', 'revocation']),
    )
  })

  it('ignores steps with a null phaseId (pre-phase legacy rows) when checking completeness', () => {
    const steps = [
      { phaseId: 'notice', status: 'completed' },
      { phaseId: 'final-day', status: 'pending' },
      { phaseId: null, status: 'pending' },
    ]

    expect(computeUnlockedPhaseIds(PHASES, steps)).toEqual(new Set(['notice', 'final-day']))
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
