import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from '../useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 250))
    expect(result.current).toBe('a')
  })

  it('only updates after the delay has elapsed', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    expect(result.current).toBe('a') // not yet

    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current).toBe('ab')
  })

  it('collapses rapid successive changes into the last value', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'j' } }
    )

    rerender({ value: 'jo' })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    rerender({ value: 'joh' })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    rerender({ value: 'john' })

    // Still the original — no window ever completed.
    expect(result.current).toBe('j')

    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current).toBe('john')
  })
})
