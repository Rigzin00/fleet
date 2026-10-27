import { describe, expect, it } from 'vitest'
import { formatDuration, speedBand, timeAgo } from './format'

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1 min'],
    [59 * 60, '59 min'],
    [3600, '1h'],
    [3660, '1h 1m'],
    [5 * 3600 + 40 * 60, '5h 40m'],
  ])('%is → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })

  it('never goes negative', () => {
    expect(formatDuration(-30)).toBe('0s')
  })
})

describe('timeAgo', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')
  it('says "just now" for fresh data', () => {
    expect(timeAgo('2026-10-27T11:59:55Z', now)).toBe('just now')
  })
  it('counts seconds, minutes and hours', () => {
    expect(timeAgo('2026-10-27T11:59:30Z', now)).toBe('30s ago')
    expect(timeAgo('2026-10-27T11:15:00Z', now)).toBe('45 min ago')
    expect(timeAgo('2026-10-27T06:20:00Z', now)).toBe('5h 40m ago')
  })
  it('treats timestamps in the future as "now"', () => {
    expect(timeAgo('2026-10-27T12:05:00Z', now)).toBe('just now')
  })
})

describe('speedBand', () => {
  it('flags only speeds meaningfully above the limit', () => {
    expect(speedBand(60, 60)).toBe('normal')
    expect(speedBand(62, 60)).toBe('normal')
    expect(speedBand(63, 60)).toBe('over')
  })
  it('marks crawling speeds as slow', () => {
    expect(speedBand(0, 60)).toBe('slow')
    expect(speedBand(19, 60)).toBe('slow')
    expect(speedBand(20, 60)).toBe('normal')
  })
})
