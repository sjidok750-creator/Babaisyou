import { useCallback, useRef, useState } from 'react'

interface DropZoneProps {
  onFile: (file: File) => void
  busy: boolean
}

export function DropZone({ onFile, busy }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragOver(false)
      const file = event.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="HWP 또는 HWPX 파일 선택"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
        dragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800'
      }`}
    >
      <span className="text-5xl" aria-hidden>
        📄
      </span>
      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {busy ? '문서를 여는 중…' : 'HWP · HWPX 파일을 끌어다 놓거나 클릭해서 선택'}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        파일은 서버로 전송되지 않고 브라우저 안에서만 처리됩니다.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".hwp,.hwpx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
