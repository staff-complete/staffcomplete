import { describe, it } from 'vitest'

describe('shared', () => {
  it('loads', async () => {
    await import('./index')
  })
})
