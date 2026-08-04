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

  it('is a no-op when the step id is unknown and the direction is up', () => {
    expect(moveStep(['a', 'b', 'c'], 'z', 'up')).toEqual(['a', 'b', 'c'])
  })

  // The dangerous direction: an unknown id gives index -1, and moving "down"
  // lands on a swap target of 0, which is inside the array. Only the explicit
  // not-found guard stops that from writing undefined into the first slot.
  it('is a no-op when the step id is unknown and the direction is down', () => {
    expect(moveStep(['a', 'b', 'c'], 'z', 'down')).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op for a single-step list in either direction', () => {
    expect(moveStep(['a'], 'a', 'up')).toEqual(['a'])
    expect(moveStep(['a'], 'a', 'down')).toEqual(['a'])
  })
})
