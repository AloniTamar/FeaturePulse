// server/tests/classification.test.ts
import { determineState, calculateDecayRate } from '../src/services/classification'

describe('determineState', () => {
  test('DEAD when 30+ days no interactions', () => {
    expect(determineState(0, [], 30)).toBe('DEAD')
    expect(determineState(0, [], 60)).toBe('DEAD')
  })

  test('not DEAD at 29 days', () => {
    expect(determineState(0.01, [{ week: 1, rate: 0.01 }], 29)).not.toBe('DEAD')
  })

  test('DORMANT when rate < 1% for 2+ weeks', () => {
    const rates = [{ week: 1, rate: 0.005 }, { week: 2, rate: 0.004 }]
    expect(determineState(0.004, rates, 5)).toBe('DORMANT')
  })

  test('rate exactly 0.01 is NOT DORMANT (strict less-than boundary)', () => {
    const rates = [{ week: 1, rate: 0.01 }, { week: 2, rate: 0.01 }]
    expect(determineState(0.01, rates, 5)).not.toBe('DORMANT')
  })

  test('DECLINING when rate drops >20% WoW', () => {
    const rates = [{ week: 1, rate: 0.10 }, { week: 2, rate: 0.07 }]
    // (0.10 - 0.07) / 0.10 = 0.30 > 0.20
    expect(determineState(0.07, rates, 5)).toBe('DECLINING')
  })

  test('THRIVING when rate is healthy and stable', () => {
    const rates = [{ week: 1, rate: 0.10 }, { week: 2, rate: 0.11 }]
    expect(determineState(0.11, rates, 1)).toBe('THRIVING')
  })

  test('daysSinceLastInteraction null does not trigger DEAD', () => {
    expect(determineState(0, [], null)).toBe('THRIVING')
  })

  test('DORMANT takes priority over DECLINING when rate is extremely low', () => {
    const rates = [{ week: 1, rate: 0.002 }, { week: 2, rate: 0.001 }]
    expect(determineState(0.001, rates, 20)).toBe('DORMANT')
  })

  test('DEAD threshold is configurable — 10 days with custom threshold', () => {
    expect(determineState(0, [], 10, { deadDays: 10, dormantWeeks: 2 })).toBe('DEAD')
    expect(determineState(0, [], 9,  { deadDays: 10, dormantWeeks: 2 })).not.toBe('DEAD')
  })

  test('DORMANT threshold is configurable — 1 week with custom threshold', () => {
    const rates = [{ week: 1, rate: 0.005 }]
    expect(determineState(0.005, rates, 5, { deadDays: 30, dormantWeeks: 1 })).toBe('DORMANT')
  })
})

describe('calculateDecayRate', () => {
  test('returns 0 with < 2 data points', () => {
    expect(calculateDecayRate([])).toBe(0)
    expect(calculateDecayRate([0.1])).toBe(0)
  })

  test('correct decay: 0.10 → 0.07 = 30%', () => {
    expect(calculateDecayRate([0.1, 0.07])).toBeCloseTo(0.3)
  })

  test('returns 0 when prev rate is 0', () => {
    expect(calculateDecayRate([0, 0.05])).toBe(0)
  })
})
