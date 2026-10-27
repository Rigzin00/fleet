import { describe, expect, it } from 'vitest'
import { containsPattern, escapeLike, MAX_QUERY_LENGTH, normalizeQuery, parseId } from './sanitize'

describe('normalizeQuery', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeQuery('  Imran   PASHA ')).toBe('imran pasha')
  })

  it('removes control characters and the PostgREST wildcard', () => {
    expect(normalizeQuery('va\u0000n\n*03')).toBe('va n 03')
  })

  it('caps the length', () => {
    expect(normalizeQuery('x'.repeat(500))).toHaveLength(MAX_QUERY_LENGTH)
  })

  it('returns an empty string for whitespace only', () => {
    expect(normalizeQuery(' \t\n ')).toBe('')
  })
})

describe('escapeLike', () => {
  it('makes LIKE wildcards literal', () => {
    expect(escapeLike('100%_done')).toBe('100\\%\\_done')
  })

  it('escapes the escape character first so it cannot be used to break out', () => {
    expect(escapeLike('a\\%')).toBe('a\\\\\\%')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeLike("o'neil, (van) 03")).toBe("o'neil, (van) 03")
  })
})

describe('containsPattern', () => {
  it('wraps an escaped query for a "contains" ILIKE', () => {
    expect(containsPattern(' 50%_Off ')).toBe('*50\\%\\_off*')
  })

  it('is null when there is nothing to search for', () => {
    expect(containsPattern('   ')).toBeNull()
    expect(containsPattern('***')).toBeNull()
  })

  it('never lets a lone wildcard match everything', () => {
    expect(containsPattern('%')).toBe('*\\%*')
    expect(containsPattern('_')).toBe('*\\_*')
  })
})

describe('parseId', () => {
  it('accepts positive integers', () => {
    expect(parseId('42')).toBe(42)
  })

  it.each(['0', '-1', '1.5', '1e3', ' 7', '7 ', 'abc', '', '123456789012345', '1;drop table'])('rejects %j', (raw) => {
    expect(parseId(raw)).toBeNull()
  })

  it('rejects missing values', () => {
    expect(parseId(undefined)).toBeNull()
    expect(parseId(null)).toBeNull()
  })
})
