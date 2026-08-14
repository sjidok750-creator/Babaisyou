import * as CFB from 'cfb'
import { DocModel, DocOpenError, plainParagraph } from '../model'

// HWP 5.x: MS CFB(OLE 복합 문서) 컨테이너.
// M2(본문 레코드 파서) 전까지는 FileHeader로 문서 속성을 판정하고
// PrvText 스트림(UTF-16LE 미리보기 텍스트, 문서 앞부분만)을 표시한다.

const HWP5_SIGNATURE = 'HWP Document File'

interface HwpFileHeader {
  version: string
  compressed: boolean
  encrypted: boolean
  distribution: boolean
}

export function parseHwpPreview(bytes: Uint8Array): DocModel {
  let container: CFB.CFB$Container
  try {
    container = CFB.read(bytes, { type: 'buffer' })
  } catch {
    throw new DocOpenError('복합 문서 컨테이너를 열 수 없습니다. 손상된 파일일 수 있습니다.')
  }

  const header = readFileHeader(container)
  if (header.encrypted) {
    throw new DocOpenError('암호가 걸린 문서입니다. 암호화된 HWP는 열 수 없습니다.')
  }

  const warnings: string[] = [
    `HWP ${header.version} 문서입니다. 본문 파서는 준비 중이라 앞부분 미리보기 텍스트만 표시합니다.`,
  ]
  if (header.distribution) {
    warnings.push('배포용(DRM) 문서입니다. 본문 열람이 제한될 수 있습니다.')
  }

  const preview = readPrvText(container)
  if (preview === null) {
    throw new DocOpenError(
      header.distribution
        ? '배포용(DRM) 문서라 내용을 표시할 수 없습니다.'
        : '미리보기 텍스트(PrvText)가 없는 문서입니다. 본문 파서(M2) 지원을 기다려 주세요.',
    )
  }

  return {
    format: 'hwp',
    warnings,
    sections: [{ blocks: preview.split(/\r?\n/).map(plainParagraph) }],
  }
}

function findStream(container: CFB.CFB$Container, name: string): Uint8Array | null {
  const entry = CFB.find(container, name)
  if (!entry || !entry.content) return null
  const content = entry.content
  return content instanceof Uint8Array ? content : Uint8Array.from(content)
}

function readFileHeader(container: CFB.CFB$Container): HwpFileHeader {
  const raw = findStream(container, 'FileHeader')
  if (!raw || raw.length < 40) {
    throw new DocOpenError('HWP 파일 헤더(FileHeader)를 찾을 수 없습니다. HWP 5.x 파일이 맞는지 확인해 주세요.')
  }
  const signature = String.fromCharCode(...raw.subarray(0, HWP5_SIGNATURE.length))
  if (signature !== HWP5_SIGNATURE) {
    throw new DocOpenError('HWP 시그니처가 올바르지 않습니다.')
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  // 버전(DWORD, offset 32): 0xMMnnPPrr → M.n.P.r
  const versionDword = view.getUint32(32, true)
  const version = [
    (versionDword >>> 24) & 0xff,
    (versionDword >>> 16) & 0xff,
    (versionDword >>> 8) & 0xff,
    versionDword & 0xff,
  ].join('.')
  // 속성 플래그(DWORD, offset 36): bit0 압축, bit1 암호화, bit2 배포용
  const flags = view.getUint32(36, true)
  return {
    version,
    compressed: (flags & 0b001) !== 0,
    encrypted: (flags & 0b010) !== 0,
    distribution: (flags & 0b100) !== 0,
  }
}

function readPrvText(container: CFB.CFB$Container): string | null {
  const raw = findStream(container, 'PrvText')
  if (!raw || raw.length === 0) return null
  const text = new TextDecoder('utf-16le').decode(raw)
  // 스트림 끝의 NUL 패딩 제거
  return text.replace(/\0+$/g, '')
}
