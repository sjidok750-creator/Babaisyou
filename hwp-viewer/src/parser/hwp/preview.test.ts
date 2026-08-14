import { describe, expect, it } from 'vitest'
import * as CFB from 'cfb'
import { parseHwpPreview } from './preview'
import { extractText } from '../model'

function makeFileHeader(flags: number): Uint8Array {
  const raw = new Uint8Array(256)
  const signature = 'HWP Document File'
  for (let i = 0; i < signature.length; i += 1) raw[i] = signature.charCodeAt(i)
  const view = new DataView(raw.buffer)
  view.setUint32(32, 0x05000300, true) // 버전 5.0.3.0
  view.setUint32(36, flags, true)
  return raw
}

function utf16le(text: string): Uint8Array {
  const raw = new Uint8Array(text.length * 2)
  const view = new DataView(raw.buffer)
  for (let i = 0; i < text.length; i += 1) view.setUint16(i * 2, text.charCodeAt(i), true)
  return raw
}

function makeHwp(flags: number, prvText?: string): Uint8Array {
  const container = CFB.utils.cfb_new()
  CFB.utils.cfb_add(container, '/FileHeader', makeFileHeader(flags))
  if (prvText !== undefined) CFB.utils.cfb_add(container, '/PrvText', utf16le(prvText))
  const out = CFB.write(container, { type: 'buffer' })
  return out instanceof Uint8Array ? out : Uint8Array.from(out as number[])
}

describe('parseHwpPreview', () => {
  it('PrvText 미리보기를 추출하고 안내 문구를 남긴다', () => {
    const model = parseHwpPreview(makeHwp(0b001, '첫 줄\r\n둘째 줄\0\0'))
    expect(model.format).toBe('hwp')
    expect(extractText(model)).toBe('첫 줄\n둘째 줄')
    expect(model.warnings[0]).toContain('5.0.3.0')
  })

  it('암호화된 문서는 명확한 에러를 던진다', () => {
    expect(() => parseHwpPreview(makeHwp(0b011, '내용'))).toThrowError(/암호/)
  })

  it('배포용 문서는 경고와 함께 미리보기를 보여준다', () => {
    const model = parseHwpPreview(makeHwp(0b101, '배포 문서 내용'))
    expect(model.warnings.some((w) => w.includes('배포용'))).toBe(true)
    expect(extractText(model)).toBe('배포 문서 내용')
  })

  it('PrvText가 없으면 명확한 에러를 던진다', () => {
    expect(() => parseHwpPreview(makeHwp(0b001))).toThrowError(/미리보기|본문/)
  })
})
