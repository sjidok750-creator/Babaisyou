import { describe, expect, it } from 'vitest'
import { strToU8 } from 'fflate'
import { detectFormat } from './detect'

describe('detectFormat', () => {
  it('ZIP 매직 바이트는 hwpx', () => {
    expect(detectFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBe('hwpx')
  })

  it('CFB 매직 바이트는 hwp', () => {
    expect(
      detectFormat(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    ).toBe('hwp')
  })

  it('파일 선두의 ASCII 시그니처는 hwp3', () => {
    expect(detectFormat(strToU8('HWP Document File V3.00 '))).toBe('hwp3')
  })

  it('그 외는 unknown', () => {
    expect(detectFormat(strToU8('%PDF-1.7'))).toBe('unknown')
    expect(detectFormat(new Uint8Array(0))).toBe('unknown')
  })
})
