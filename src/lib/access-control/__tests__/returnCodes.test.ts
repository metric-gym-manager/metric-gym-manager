/**
 * Device return code classification.
 *
 * Codes come from VFT's "Commands Return Values" reference. The distinction
 * that matters: retrying a transient failure is correct, retrying a permanent
 * one burns quota and buries the real problem.
 */

import {
  classifyReturnCode,
  describeReturnCode,
  isRetryableReturnCode,
  ReturnCodeClass,
} from '../returnCodes'
import {
  formatSubjectName,
  isValidSubjectId,
  assertValidSubjectId,
  EMP_NAME_MAX_LENGTH,
} from '../fieldLimits'

describe('classifyReturnCode', () => {
  it('treats any non-negative code as success', () => {
    // The vendor documents ">= 0" rather than "== 0".
    expect(classifyReturnCode(0)).toBe(ReturnCodeClass.Success)
    expect(classifyReturnCode(1)).toBe(ReturnCodeClass.Success)
    expect(classifyReturnCode(42)).toBe(ReturnCodeClass.Success)
  })

  it.each([
    [-1, 'failed to send'],
    [-2, 'no response'],
    [-3, 'insufficient cache'],
    [-725, 'timed out waiting'],
    [-730, 'no response from server'],
  ])('retries transient failure %i (%s)', (code) => {
    expect(classifyReturnCode(code)).toBe(ReturnCodeClass.Retryable)
  })

  it.each([
    [-13, 'command does not exist'],
    [-14, 'incorrect communication password'],
    [-620, 'malformed server payload'],
    [-708, 'firmware does not support the command'],
    [-801, 'incorrect command format'],
  ])('never retries permanent failure %i (%s)', (code) => {
    expect(classifyReturnCode(code)).toBe(ReturnCodeClass.Permanent)
    expect(isRetryableReturnCode(code)).toBe(false)
  })

  it('escalates a full terminal rather than retrying it', () => {
    // -18 will fail identically until a human clears space on the device.
    expect(classifyReturnCode(-18)).toBe(ReturnCodeClass.NeedsAttention)
    expect(isRetryableReturnCode(-18)).toBe(false)
  })

  it('escalates a template the device could not use', () => {
    expect(classifyReturnCode(-26)).toBe(ReturnCodeClass.NeedsAttention)
    expect(classifyReturnCode(-27)).toBe(ReturnCodeClass.NeedsAttention)
  })

  it('treats a repeated command as benign', () => {
    // The desired state is already in flight; re-sending is the real mistake.
    expect(classifyReturnCode(-7)).toBe(ReturnCodeClass.Benign)
  })

  it('treats opening an already-open door as benign', () => {
    expect(classifyReturnCode(-28)).toBe(ReturnCodeClass.Benign)
  })

  it('retries unmapped negative codes rather than dead-lettering them', () => {
    // Reserved and firmware-internal ranges. A bounded retry is safer than
    // discarding what might be transient; backoff caps the cost.
    expect(classifyReturnCode(-703)).toBe(ReturnCodeClass.Retryable)
    expect(classifyReturnCode(-9999)).toBe(ReturnCodeClass.Retryable)
  })
})

describe('describeReturnCode', () => {
  it('names the codes an operator needs to act on', () => {
    expect(describeReturnCode(-18)).toMatch(/storage is full/i)
    expect(describeReturnCode(-708)).toMatch(/firmware/i)
  })

  it('falls back to the raw code so anything can still be looked up', () => {
    expect(describeReturnCode(-9999)).toBe('Device error -9999')
  })
})

describe('formatSubjectName', () => {
  it('replaces spaces with underscores', () => {
    expect(formatSubjectName('Kasun Perera')).toBe('Kasun_Perera')
  })

  it('collapses runs of whitespace', () => {
    expect(formatSubjectName('Kasun   Perera')).toBe('Kasun_Perera')
  })

  it('caps at the vendor limit', () => {
    const result = formatSubjectName(
      'Wickramasinghe Rajapaksa Mudiyanselage Silva'
    )

    expect(result.length).toBeLessThanOrEqual(EMP_NAME_MAX_LENGTH)
  })

  it('cuts at a word boundary rather than mid-word', () => {
    // A clipped whole name reads far better on a small reader display.
    const result = formatSubjectName('Wickramasinghe Rajapaksa Silva')

    expect(result).toBe('Wickramasinghe')
    expect(result.endsWith('_')).toBe(false)
  })

  it('accepts a mid-word cut when the boundary would lose too much', () => {
    const result = formatSubjectName('A Verylongsinglenamethatkeepsgoing')

    expect(result.length).toBe(EMP_NAME_MAX_LENGTH)
  })

  it('strips characters the vendor has not documented support for', () => {
    expect(formatSubjectName('Ann-Marie O’Brien')).toBe('Ann-Marie_OBrien')
  })

  it('handles a name that is already within limits untouched', () => {
    expect(formatSubjectName('Nimal')).toBe('Nimal')
  })
})

describe('subject id validation', () => {
  it('accepts a numeric id within the vendor limit', () => {
    expect(isValidSubjectId('100001')).toBe(true)
    expect(isValidSubjectId('123456789012345')).toBe(true) // exactly 15
  })

  it('rejects anything longer than the vendor limit', () => {
    expect(isValidSubjectId('1234567890123456')).toBe(false) // 16
  })

  it('rejects non-numeric ids', () => {
    expect(isValidSubjectId('abc123')).toBe(false)
    expect(isValidSubjectId('100-001')).toBe(false)
    expect(isValidSubjectId('')).toBe(false)
  })

  it('throws rather than trimming an oversized id', () => {
    // Silently shortening an identity could collide with another member's and
    // open a door for the wrong person. It must fail loudly instead.
    expect(() => assertValidSubjectId('1234567890123456')).toThrow(/EmpId/)
  })
})
