import { describe, expect, it } from 'vitest'
import { moveStep } from './reorderSteps'

describe('moveStep', () => {
  it('swaps a step with the previous one when moving up', () => {
    expect(moveStep(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
  })

  it('swaps a step with the next one when moving down', () => {
    expect(moveStep(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op when moving the first step up', () => {
    expect(moveStep(['a', 'b', 'c'], 'a', 'up')).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when moving the last step down', () => {
    expect(moveStep(['a', 'b', 'c'], 'c', 'down')).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when the step id is unknown', () => {
    expect(moveStep(['a', 'b', 'c'], 'z', 'up')).toEqual(['a', 'b', 'c'])
  })
})
