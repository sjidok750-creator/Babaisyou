export type DetectedFormat = 'hwpx' | 'hwp' | 'hwp3' | 'unknown'

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const HWP3_SIGNATURE = 'HWP Document File'

/** 매직 바이트로 파일 포맷을 감지한다. 확장자는 신뢰하지 않는다. */
export function detectFormat(bytes: Uint8Array): DetectedFormat {
  // ZIP(PK\x03\x04) → HWPX (컨테이너가 진짜 HWPX인지는 파서에서 검증)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'hwpx'
  // MS CFB 복합 문서 → HWP 5.x
  if (bytes.length >= 8 && CFB_MAGIC.every((b, i) => bytes[i] === b)) return 'hwp'
  // 옛 한글 3.x: 파일 선두가 "HWP Document File V3.00..." ASCII 시그니처
  if (bytes.length >= HWP3_SIGNATURE.length) {
    const head = String.fromCharCode(...bytes.slice(0, HWP3_SIGNATURE.length))
    if (head === HWP3_SIGNATURE) return 'hwp3'
  }
  return 'unknown'
}
