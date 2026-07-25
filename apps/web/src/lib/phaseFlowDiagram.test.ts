import { describe, expect, it } from 'vitest'
import { buildPhaseFlowDiagram } from './phaseFlowDiagram'

describe('buildPhaseFlowDiagram', () => {
  it('returns an empty string for no phases', () => {
    expect(buildPhaseFlowDiagram([])).toBe('')
  })

  it('declares a lone root phase with no edges', () => {
    const source = buildPhaseFlowDiagram([
      { id: 'p1', name: 'Offer accepted', dependsOnPhaseIds: [] },
    ])

    expect(source).toBe('flowchart TD\n    phase0["Offer accepted"]')
  })

  it('draws an edge from each dependency to the dependent phase', () => {
    const source = buildPhaseFlowDiagram([
      { id: 'p1', name: 'Offer accepted', dependsOnPhaseIds: [] },
      { id: 'p2', name: 'IT', dependsOnPhaseIds: ['p1'] },
    ])

    expect(source).toBe(
      [
        'flowchart TD',
        '    phase0["Offer accepted"]',
        '    phase1["IT"]',
        '    phase0 --> phase1',
      ].join('\n'),
    )
  })

  it('draws one edge per dependency for a phase converging on several branches', () => {
    const source = buildPhaseFlowDiagram([
      { id: 'it', name: 'IT', dependsOnPhaseIds: [] },
      { id: 'office', name: 'Office', dependsOnPhaseIds: [] },
      { id: 'day1', name: 'First day', dependsOnPhaseIds: ['it', 'office'] },
    ])

    expect(source.split('\n')).toEqual(
      expect.arrayContaining(['    phase0 --> phase2', '    phase1 --> phase2']),
    )
  })

  it('escapes double quotes in a phase name so the label cannot break out of its quotes', () => {
    const source = buildPhaseFlowDiagram([{ id: 'p1', name: 'Say "hi"', dependsOnPhaseIds: [] }])

    expect(source).toBe('flowchart TD\n    phase0["Say &quot;hi&quot;"]')
  })

  it('collapses embedded newlines in a phase name to spaces', () => {
    const source = buildPhaseFlowDiagram([
      { id: 'p1', name: 'Line one\nLine two', dependsOnPhaseIds: [] },
    ])

    expect(source).toBe('flowchart TD\n    phase0["Line one Line two"]')
  })

  it('falls back to a placeholder label for a blank phase name', () => {
    const source = buildPhaseFlowDiagram([{ id: 'p1', name: '   ', dependsOnPhaseIds: [] }])

    expect(source).toBe('flowchart TD\n    phase0["Untitled"]')
  })

  it('throws if a dependency points at a phase outside the given list', () => {
    expect(() =>
      buildPhaseFlowDiagram([{ id: 'p1', name: 'Onboard', dependsOnPhaseIds: ['missing'] }]),
    ).toThrow('missing')
  })
})
