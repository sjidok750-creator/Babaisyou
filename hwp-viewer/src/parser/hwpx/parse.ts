import { unzipSync, strFromU8 } from 'fflate'
import {
  Block,
  DocModel,
  DocOpenError,
  Run,
  Section,
  Table,
  TableCell,
  plainParagraph,
} from '../model'

// HWPX(OWPML, KS X 6101): ZIP 컨테이너 안의 XML.
//  - Contents/header.xml   : charPr(문자 모양) 정의
//  - Contents/section*.xml : 본문 (hp:p > hp:run > hp:t / hp:tbl)
//  - Preview/PrvText.txt   : 순수 텍스트 미리보기 (파싱 실패 시 폴백)

interface CharShape {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  sizePt?: number
  color?: string
}

export function parseHwpx(bytes: Uint8Array): DocModel {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new DocOpenError('ZIP 컨테이너를 열 수 없습니다. 손상된 파일일 수 있습니다.')
  }

  const warnings: string[] = []
  const sectionNames = Object.keys(files)
    .map((name) => {
      const match = /^Contents\/section(\d+)\.xml$/.exec(name)
      return match ? { name, index: Number(match[1]) } : null
    })
    .filter((entry): entry is { name: string; index: number } => entry !== null)
    .sort((a, b) => a.index - b.index)

  if (sectionNames.length === 0) {
    // 본문 XML이 없으면 HWPX가 아니거나(예: docx) 변형된 컨테이너 → 미리보기 텍스트 폴백
    const preview = readPreviewText(files)
    if (preview === null) {
      throw new DocOpenError(
        'HWPX 본문(Contents/section*.xml)을 찾을 수 없습니다. HWPX 파일이 맞는지 확인해 주세요.',
      )
    }
    warnings.push('본문 파싱에 실패해 미리보기 텍스트를 표시합니다.')
    return {
      format: 'hwpx',
      warnings,
      sections: [{ blocks: preview.split(/\r?\n/).map(plainParagraph) }],
    }
  }

  const charShapes = parseCharShapes(files['Contents/header.xml'])
  const sections: Section[] = sectionNames.map(({ name }) => {
    const xml = parseXml(strFromU8(files[name]), name)
    const blocks: Block[] = []
    for (const p of childElements(xml.documentElement, 'p')) {
      blocks.push(...paragraphToBlocks(p, charShapes))
    }
    return { blocks }
  })

  return { format: 'hwpx', sections, warnings }
}

function readPreviewText(files: Record<string, Uint8Array>): string | null {
  const entry = files['Preview/PrvText.txt']
  if (!entry) return null
  // BOM으로 UTF-16LE/UTF-8 판별
  if (entry.length >= 2 && entry[0] === 0xff && entry[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(entry.subarray(2))
  }
  return strFromU8(entry)
}

function parseXml(text: string, name: string): XMLDocument {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new DocOpenError(`XML 파싱에 실패했습니다: ${name}`)
  }
  return doc
}

/** 네임스페이스 접두사(hp:, hh: 등)와 무관하게 localName으로 자식 요소를 찾는다. */
function childElements(parent: Element, localName?: string): Element[] {
  const out: Element[] = []
  for (const node of Array.from(parent.children)) {
    if (!localName || node.localName === localName) out.push(node)
  }
  return out
}

function descendants(root: Element | XMLDocument, localName: string): Element[] {
  const all = root.getElementsByTagName('*')
  const out: Element[] = []
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].localName === localName) out.push(all[i])
  }
  return out
}

/** header.xml의 charPr 정의를 id → 문자 모양 맵으로 변환 */
function parseCharShapes(headerFile: Uint8Array | undefined): Map<string, CharShape> {
  const shapes = new Map<string, CharShape>()
  if (!headerFile) return shapes
  let doc: XMLDocument
  try {
    doc = parseXml(strFromU8(headerFile), 'Contents/header.xml')
  } catch {
    return shapes // 헤더가 깨져도 본문 텍스트는 보여준다
  }
  for (const charPr of descendants(doc, 'charPr')) {
    const id = charPr.getAttribute('id')
    if (id === null) continue
    const shape: CharShape = {}
    // height 단위는 1/100 pt (1000 = 10pt)
    const height = Number(charPr.getAttribute('height'))
    if (Number.isFinite(height) && height > 0) shape.sizePt = height / 100
    const color = charPr.getAttribute('textColor')?.toLowerCase()
    // 기본 검정색은 색상 미지정으로 취급 (다크 모드에서 본문이 안 보이는 문제 방지)
    if (color && color !== 'none' && color !== '#000000') shape.color = color
    for (const child of childElements(charPr)) {
      if (child.localName === 'bold') shape.bold = true
      if (child.localName === 'italic') shape.italic = true
      if (child.localName === 'underline') {
        const type = child.getAttribute('type')
        if (!type || type.toUpperCase() !== 'NONE') shape.underline = true
      }
    }
    shapes.set(id, shape)
  }
  return shapes
}

/** hp:p 하나를 블록 목록으로. 표가 런 안에 끼어 있으면 문단을 쪼개 표 블록을 삽입한다. */
function paragraphToBlocks(p: Element, charShapes: Map<string, CharShape>): Block[] {
  const blocks: Block[] = []
  let runs: Run[] = []
  const flush = () => {
    blocks.push({ type: 'paragraph', runs })
    runs = []
  }

  for (const runEl of childElements(p, 'run')) {
    const shape = charShapes.get(runEl.getAttribute('charPrIDRef') ?? '') ?? {}
    for (const child of childElements(runEl)) {
      if (child.localName === 't') {
        const text = textOfT(child)
        if (text.length > 0) runs.push({ text, ...shape })
      } else if (child.localName === 'tbl') {
        flush()
        blocks.push(tableToBlock(child, charShapes))
      }
      // secPr, ctrl 등 나머지 컨트롤은 M1 범위 밖 — 무시
    }
  }
  flush()

  // 표만 있고 마지막 문단이 비어 있으면 군더더기 빈 문단 제거
  const last = blocks[blocks.length - 1]
  if (blocks.length > 1 && last.type === 'paragraph' && last.runs.length === 0) blocks.pop()
  return blocks
}

/** hp:t 안의 텍스트. hp:tab/hp:lineBreak 같은 인라인 컨트롤을 문자로 치환한다. */
function textOfT(t: Element): string {
  let out = ''
  for (const node of Array.from(t.childNodes)) {
    if (node.nodeType === 3 /* TEXT_NODE */) out += node.nodeValue ?? ''
    else if (node.nodeType === 1 /* ELEMENT_NODE */) {
      const el = node as Element
      if (el.localName === 'tab') out += '\t'
      else if (el.localName === 'lineBreak') out += '\n'
    }
  }
  return out
}

function tableToBlock(tbl: Element, charShapes: Map<string, CharShape>): Table {
  const rows: TableCell[][] = []
  for (const tr of childElements(tbl, 'tr')) {
    const row: TableCell[] = []
    for (const tc of childElements(tr, 'tc')) {
      const cell: TableCell = { blocks: [] }
      const span = childElements(tc, 'cellSpan')[0]
      if (span) {
        const colSpan = Number(span.getAttribute('colSpan'))
        const rowSpan = Number(span.getAttribute('rowSpan'))
        if (colSpan > 1) cell.colSpan = colSpan
        if (rowSpan > 1) cell.rowSpan = rowSpan
      }
      const subList = childElements(tc, 'subList')[0]
      if (subList) {
        for (const p of childElements(subList, 'p')) {
          cell.blocks.push(...paragraphToBlocks(p, charShapes))
        }
      }
      row.push(cell)
    }
    if (row.length > 0) rows.push(row)
  }
  return { type: 'table', rows }
}
