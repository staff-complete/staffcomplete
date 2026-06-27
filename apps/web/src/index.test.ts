import { describe, it } from 'vitest'

describe('web', () => {
  it('loads', async () => {
    await import('./index')
  })
})
