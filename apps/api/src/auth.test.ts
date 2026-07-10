import { describe, expect, it } from 'vitest'
import { escapeHtml } from './auth.js'

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml(`<script>alert("hi") & 'bye'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;hi&quot;) &amp; &#39;bye&#39;&lt;/script&gt;',
    )
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('Ada Lovelace')).toBe('Ada Lovelace')
  })
})
