import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { LANGUAGES, monacoLang } from './constants'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  onLanguageChange: (lang: string) => void
  approachText: string
  onApproachTextChange: (text: string) => void
}

export function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  approachText,
  onApproachTextChange,
}: CodeEditorProps) {
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark')

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <button
          onClick={() => setTheme((t) => (t === 'vs-dark' ? 'light' : 'vs-dark'))}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {theme === 'vs-dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </div>

      {/* Editor */}
      <div className="rounded-lg overflow-hidden border border-gray-300">
        <Editor
          height="max(300px, calc(100vh - 520px))"
          language={monacoLang(language)}
          theme={theme}
          value={value}
          onChange={(val) => onChange(val ?? '')}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
          }}
        />
      </div>

      {/* Optional notes */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Notes (optional)</label>
        <textarea
          rows={2}
          value={approachText}
          onChange={(e) => onApproachTextChange(e.target.value)}
          placeholder="Algorithm notes, edge cases, trade-offs…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
    </div>
  )
}
