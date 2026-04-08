import fs from 'fs'
import path from 'path'

// Resolve prompts directory — always read from source so .md files
// stay editable without a rebuild step.
const PROMPTS_DIR = path.resolve(
  process.cwd(),
  'src/lib/ai/prompts'
)

// In-memory cache to avoid re-reading files on every call
const promptCache = new Map<string, string>()

/**
 * Load a prompt file from the prompts directory.
 * Caches the content to avoid repeated disk reads.
 */
export function loadPrompt(name: string): string {
  if (promptCache.has(name)) {
    return promptCache.get(name)!
  }

  const filePath = path.join(PROMPTS_DIR, `${name}.md`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  promptCache.set(name, content)
  return content
}

/**
 * Render a prompt template by replacing {{ variable }} placeholders.
 * Unknown variables are replaced with empty strings.
 */
export function renderPrompt(
  name: string,
  variables: Record<string, string | number | undefined>
): string {
  const template = loadPrompt(name)

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    const value = variables[key]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

/**
 * Extract version metadata from a prompt file's header comment.
 * Format: <!-- version: 1.2 | updated: 2026-04-08 | tested: yes -->
 */
export function getPromptVersion(name: string): {
  version: string
  updated: string
  tested: boolean
} | null {
  const content = loadPrompt(name)
  const match = content.match(
    /<!--\s*version:\s*([\d.]+)\s*\|\s*updated:\s*([\d-]+)\s*\|\s*tested:\s*(yes|no)\s*-->/
  )

  if (!match) return null
  return {
    version: match[1],
    updated: match[2],
    tested: match[3] === 'yes',
  }
}

/**
 * Clear the prompt cache — useful for hot-reloading during development.
 */
export function clearPromptCache(): void {
  promptCache.clear()
}
