import { Block, DocModel, Run, TableCell } from '../parser'

// 파서의 공통 모델을 읽기 좋은 HTML 흐름으로 렌더링한다.
// 목표는 "읽기용 뷰어" — 한글의 페이지 레이아웃 재현은 비목표.

export function DocumentView({ model }: { model: DocModel }) {
  return (
    <article className="mx-auto max-w-3xl rounded-xl bg-white px-8 py-10 shadow-sm dark:bg-gray-800">
      {model.sections.map((section, i) => (
        <section key={i}>
          {i > 0 && (
            <hr className="my-8 border-dashed border-gray-300 dark:border-gray-600" />
          )}
          <Blocks blocks={section.blocks} />
        </section>
      ))}
    </article>
  )
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) =>
        block.type === 'paragraph' ? (
          <p
            key={i}
            className="min-h-[1.5em] whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-gray-100"
          >
            {block.runs.map((run, j) => (
              <RunSpan key={j} run={run} />
            ))}
          </p>
        ) : (
          <table
            key={i}
            className="my-4 w-full border-collapse border border-gray-300 text-sm dark:border-gray-600"
          >
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <Cell key={c} cell={cell} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      )}
    </>
  )
}

function Cell({ cell }: { cell: TableCell }) {
  return (
    <td
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      className="border border-gray-300 px-3 py-1.5 align-top dark:border-gray-600"
    >
      <Blocks blocks={cell.blocks} />
    </td>
  )
}

function RunSpan({ run }: { run: Run }) {
  const style: React.CSSProperties = {}
  if (run.bold) style.fontWeight = 700
  if (run.italic) style.fontStyle = 'italic'
  if (run.underline) style.textDecoration = 'underline'
  if (run.color) style.color = run.color
  // 극단값으로 레이아웃이 깨지지 않게 6~48pt로 제한
  if (run.sizePt) style.fontSize = `${Math.min(48, Math.max(6, run.sizePt))}pt`
  return <span style={style}>{run.text}</span>
}
