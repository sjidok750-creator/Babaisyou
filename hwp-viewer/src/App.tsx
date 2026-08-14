import { useCallback, useState } from 'react'
import { DocModel, DocOpenError, parseDocument } from './parser'
import { DropZone } from './viewer/DropZone'
import { DocumentView } from './viewer/DocumentView'

interface OpenedDoc {
  name: string
  model: DocModel
}

export default function App() {
  const [doc, setDoc] = useState<OpenedDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const openFile = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      setDoc({ name: file.name, model: parseDocument(bytes) })
    } catch (err) {
      setDoc(null)
      setError(
        err instanceof DocOpenError
          ? err.message
          : '문서를 여는 중 알 수 없는 오류가 발생했습니다.',
      )
      if (!(err instanceof DocOpenError)) console.error(err)
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            HWP 뷰어
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              브라우저에서 한글 문서 열기
            </span>
          </h1>
          {doc && (
            <button
              onClick={() => {
                setDoc(null)
                setError(null)
              }}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              다른 파일 열기
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!doc && <DropZone onFile={openFile} busy={busy} />}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </div>
        )}

        {doc && (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-semibold uppercase text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {doc.model.format}
              </span>
              <span className="truncate font-medium">{doc.name}</span>
            </div>
            {doc.model.warnings.map((warning, i) => (
              <div
                key={i}
                className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                {warning}
              </div>
            ))}
            <DocumentView model={doc.model} />
          </>
        )}
      </main>
    </div>
  )
}
