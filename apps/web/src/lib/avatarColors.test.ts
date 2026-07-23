import { describe, expect, it } from 'vitest'
import { avatarColorsFor, initialsFor } from './avatarColors'

describe('avatarColorsFor', () => {
  it('is deterministic for the same seed', () => {
    expect(avatarColorsFor('Jane Doe')).toEqual(avatarColorsFor('Jane Doe'))
  })

  it('can produce different colors for different seeds', () => {
    expect(avatarColorsFor('Jane Doe')).not.toEqual(avatarColorsFor('Alex Kim'))
  })
})

describe('initialsFor', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFor('Jane Doe')).toBe('JD')
  })

  it('upper-cases the result', () => {
    expect(initialsFor('jane doe')).toBe('JD')
  })

  it('handles a single-word name', () => {
    expect(initialsFor('Cher')).toBe('C')
  })

  it('falls back to a placeholder for an empty name', () => {
    expect(initialsFor('  ')).toBe('?')
  })
})
