import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parseHwpx } from './parse'
import { extractText, Paragraph, Table } from '../model'

const HEADER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.4">
  <hh:refList>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" textColor="#000000"/>
      <hh:charPr id="1" height="1600" textColor="#FF0000"><hh:bold/></hh:charPr>
      <hh:charPr id="2" height="1000"><hh:italic/><hh:underline type="SOLID"/></hh:charPr>
    </hh:charProperties>
  </hh:refList>
</hh:head>`

function sectionXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${body}</hs:sec>`
}

function makeHwpx(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content)
  }
  return zipSync(entries)
}

describe('parseHwpx', () => {
  it('문단과 런 텍스트를 추출한다', () => {
    const bytes = makeHwpx({
      mimetype: 'application/hwp+zip',
      'Contents/header.xml': HEADER_XML,
      'Contents/section0.xml': sectionXml(`
        <hp:p><hp:run charPrIDRef="0"><hp:t>안녕하세요</hp:t></hp:run></hp:p>
        <hp:p><hp:run charPrIDRef="0"><hp:t>두 번째 문단</hp:t></hp:run></hp:p>`),
    })
    const model = parseHwpx(bytes)
    expect(model.format).toBe('hwpx')
    expect(model.warnings).toEqual([])
    expect(extractText(model)).toBe('안녕하세요\n두 번째 문단')
  })

  it('문자 모양(굵게/크기/색/기울임/밑줄)을 매핑한다', () => {
    const bytes = makeHwpx({
      'Contents/header.xml': HEADER_XML,
      'Contents/section0.xml': sectionXml(`
        <hp:p>
          <hp:run charPrIDRef="1"><hp:t>제목</hp:t></hp:run>
          <hp:run charPrIDRef="2"><hp:t>강조</hp:t></hp:run>
        </hp:p>`),
    })
    const [para] = parseHwpx(bytes).sections[0].blocks as Paragraph[]
    expect(para.runs[0]).toMatchObject({ text: '제목', bold: true, sizePt: 16, color: '#ff0000' })
    expect(para.runs[1]).toMatchObject({ text: '강조', italic: true, underline: true })
    // 기본 검정색(#000000)은 색상 미지정으로 취급된다
    expect(para.runs[0].color).toBe('#ff0000')
  })

  it('표를 셀 병합 정보와 함께 추출한다', () => {
    const bytes = makeHwpx({
      'Contents/header.xml': HEADER_XML,
      'Contents/section0.xml': sectionXml(`
        <hp:p>
          <hp:run charPrIDRef="0">
            <hp:tbl>
              <hp:tr>
                <hp:tc><hp:cellSpan colSpan="2" rowSpan="1"/><hp:subList>
                  <hp:p><hp:run charPrIDRef="0"><hp:t>머리글</hp:t></hp:run></hp:p>
                </hp:subList></hp:tc>
              </hp:tr>
              <hp:tr>
                <hp:tc><hp:subList><hp:p><hp:run charPrIDRef="0"><hp:t>왼쪽</hp:t></hp:run></hp:p></hp:subList></hp:tc>
                <hp:tc><hp:subList><hp:p><hp:run charPrIDRef="0"><hp:t>오른쪽</hp:t></hp:run></hp:p></hp:subList></hp:tc>
              </hp:tr>
            </hp:tbl>
          </hp:run>
        </hp:p>`),
    })
    const blocks = parseHwpx(bytes).sections[0].blocks
    const table = blocks.find((b) => b.type === 'table') as Table
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0][0].colSpan).toBe(2)
    const headerPara = table.rows[0][0].blocks[0] as Paragraph
    expect(headerPara.runs[0].text).toBe('머리글')
  })

  it('탭과 줄바꿈 인라인 컨트롤을 문자로 치환한다', () => {
    const bytes = makeHwpx({
      'Contents/header.xml': HEADER_XML,
      'Contents/section0.xml': sectionXml(
        `<hp:p><hp:run charPrIDRef="0"><hp:t>앞<hp:tab/>뒤</hp:t></hp:run></hp:p>`,
      ),
    })
    expect(extractText(parseHwpx(bytes))).toBe('앞\t뒤')
  })

  it('여러 섹션을 순서대로 합친다', () => {
    const bytes = makeHwpx({
      'Contents/header.xml': HEADER_XML,
      'Contents/section0.xml': sectionXml(
        `<hp:p><hp:run charPrIDRef="0"><hp:t>1장</hp:t></hp:run></hp:p>`,
      ),
      'Contents/section1.xml': sectionXml(
        `<hp:p><hp:run charPrIDRef="0"><hp:t>2장</hp:t></hp:run></hp:p>`,
      ),
    })
    const model = parseHwpx(bytes)
    expect(model.sections).toHaveLength(2)
    expect(extractText(model)).toBe('1장\n2장')
  })

  it('본문이 없으면 미리보기 텍스트로 폴백한다', () => {
    const bytes = makeHwpx({
      mimetype: 'application/hwp+zip',
      'Preview/PrvText.txt': '미리보기 내용',
    })
    const model = parseHwpx(bytes)
    expect(model.warnings.length).toBeGreaterThan(0)
    expect(extractText(model)).toBe('미리보기 내용')
  })

  it('HWPX가 아닌 ZIP이면 명확한 에러를 던진다', () => {
    const bytes = makeHwpx({ 'word/document.xml': '<w:document/>' })
    expect(() => parseHwpx(bytes)).toThrowError(/HWPX/)
  })
})
