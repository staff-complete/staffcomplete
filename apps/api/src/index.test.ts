import { describe, it } from 'vitest'

describe('api', () => {
  it('loads', async () => {
    await import('./index')
  })
})
