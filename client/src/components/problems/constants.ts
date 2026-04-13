export const LANGUAGES = [
  { value: 'python',     label: 'Python',     monaco: 'python' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'typescript', label: 'TypeScript', monaco: 'typescript' },
  { value: 'java',       label: 'Java',       monaco: 'java' },
  { value: 'cpp',        label: 'C++',        monaco: 'cpp' },
  { value: 'c',          label: 'C',          monaco: 'c' },
  { value: 'go',         label: 'Go',         monaco: 'go' },
  { value: 'rust',       label: 'Rust',       monaco: 'rust' },
  { value: 'ruby',       label: 'Ruby',       monaco: 'ruby' },
  { value: 'swift',      label: 'Swift',      monaco: 'swift' },
  { value: 'kotlin',     label: 'Kotlin',     monaco: 'kotlin' },
  { value: 'other',      label: 'Other',      monaco: 'plaintext' },
] as const

export function monacoLang(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.monaco ?? 'plaintext'
}

export const DIFFICULTY_BADGE: Record<string, string> = {
  easy:   'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  hard:   'bg-red-100 text-red-800',
}

export function difficultyBadgeClass(difficulty: string): string {
  return DIFFICULTY_BADGE[difficulty.toLowerCase()] ?? 'bg-gray-100 text-gray-700'
}
