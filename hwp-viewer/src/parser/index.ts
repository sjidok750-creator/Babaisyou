import { detectFormat } from './detect'
import { parseHwpx } from './hwpx/parse'
import { parseHwpPreview } from './hwp/preview'
import { DocModel, DocOpenError } from './model'

export { detectFormat } from './detect'
export * from './model'

/** 파일 바이트를 받아 포맷 감지 → 알맞은 파서로 위임 */
export function parseDocument(bytes: Uint8Array): DocModel {
  switch (detectFormat(bytes)) {
    case 'hwpx':
      return parseHwpx(bytes)
    case 'hwp':
      return parseHwpPreview(bytes)
    case 'hwp3':
      throw new DocOpenError('한글 3.x 이하의 옛 포맷은 지원하지 않습니다. 한글에서 5.x 이상으로 다시 저장해 주세요.')
    default:
      throw new DocOpenError('HWP/HWPX 파일이 아닌 것 같습니다. 파일을 다시 확인해 주세요.')
  }
}
