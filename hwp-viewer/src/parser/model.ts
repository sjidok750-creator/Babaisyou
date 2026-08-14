// 공통 문서 모델: HWPX/HWP 파서가 모두 이 모델로 수렴하고, 렌더러는 이 모델만 안다.

export type DocFormat = 'hwpx' | 'hwp'

export interface DocModel {
  format: DocFormat
  sections: Section[]
  /** 사용자에게 보여줄 파싱 관련 안내 (예: 미리보기 폴백 사용됨) */
  warnings: string[]
}

export interface Section {
  blocks: Block[]
}

export type Block = Paragraph | Table

export interface Paragraph {
  type: 'paragraph'
  runs: Run[]
}

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** 글자 크기(pt). 없으면 렌더러 기본값 사용 */
  sizePt?: number
  /** CSS 색상 문자열 (예: #ff0000) */
  color?: string
}

export interface Table {
  type: 'table'
  rows: TableCell[][]
}

export interface TableCell {
  blocks: Block[]
  colSpan?: number
  rowSpan?: number
}

/** 문서를 열 수 없는 사유를 사용자 언어로 전달하기 위한 에러 */
export class DocOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocOpenError'
  }
}

export function plainParagraph(text: string): Paragraph {
  return { type: 'paragraph', runs: text.length > 0 ? [{ text }] : [] }
}

/** 모델 전체에서 순수 텍스트만 뽑는다 (검색/내보내기/테스트용) */
export function extractText(model: DocModel): string {
  const lines: string[] = []
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        lines.push(block.runs.map((r) => r.text).join(''))
      } else {
        for (const row of block.rows) {
          lines.push(row.map((cell) => cellText(cell)).join('\t'))
        }
      }
    }
  }
  const cellText = (cell: TableCell): string => {
    const inner: string[] = []
    for (const block of cell.blocks) {
      if (block.type === 'paragraph') inner.push(block.runs.map((r) => r.text).join(''))
      else for (const row of block.rows) inner.push(row.map(cellText).join('\t'))
    }
    return inner.join(' ')
  }
  for (const section of model.sections) walk(section.blocks)
  return lines.join('\n')
}
