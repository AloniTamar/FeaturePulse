import { getISOWeekStart } from '../src/services/aggregation'

describe('getISOWeekStart', () => {
  test('returns Monday for a Wednesday', () => {
    const wed = new Date('2026-06-17T12:00:00Z') // Wednesday
    const result = getISOWeekStart(wed)
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15') // Monday
  })

  test('returns same day for a Monday', () => {
    const mon = new Date('2026-06-15T00:00:00Z')
    const result = getISOWeekStart(mon)
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15')
  })

  test('returns previous Monday for a Sunday', () => {
    const sun = new Date('2026-06-21T00:00:00Z')
    const result = getISOWeekStart(sun)
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15')
  })
})
