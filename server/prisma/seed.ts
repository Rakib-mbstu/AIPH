/**
 * Idempotent seed for Topics, Patterns, and Problems.
 *
 * Order matters: Topics + Patterns first (so Problem FK lookups succeed),
 * then Problems. We resolve topic/pattern names to IDs at runtime so the
 * JSON files stay human-editable (no UUIDs cluttering them).
 *
 * Run with: `npx prisma db seed` (after `prisma migrate deploy` or `migrate dev`)
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface TopicSeed {
  name: string
  description?: string
}
interface PatternSeed {
  name: string
  description?: string
}
interface ProblemSeed {
  title: string
  difficulty: string
  topic: string
  pattern: string
  source?: string
  description?: string
}

function loadJson<T>(relPath: string): T {
  // Seed runs from server/, data/ lives at repo root
  const abs = path.resolve(__dirname, '..', '..', 'data', relPath)
  return JSON.parse(fs.readFileSync(abs, 'utf-8'))
}

async function main() {
  console.log('🌱 Seeding…')

  const topics = loadJson<TopicSeed[]>('topics.json')
  const patterns = loadJson<PatternSeed[]>('patterns.json')
  const problems = loadJson<ProblemSeed[]>('problems.json')

  // --- Topics ---
  for (const t of topics) {
    await prisma.topic.upsert({
      where: { name: t.name },
      update: { description: t.description },
      create: { name: t.name, description: t.description },
    })
  }
  console.log(`  ✓ ${topics.length} topics`)

  // --- Patterns ---
  for (const p of patterns) {
    await prisma.pattern.upsert({
      where: { name: p.name },
      update: { description: p.description },
      create: { name: p.name, description: p.description },
    })
  }
  console.log(`  ✓ ${patterns.length} patterns`)

  // --- Problems ---
  // Build name → id maps once to avoid N+1 lookups
  const allTopics = await prisma.topic.findMany()
  const allPatterns = await prisma.pattern.findMany()
  const topicId = new Map(allTopics.map((t) => [t.name, t.id]))
  const patternId = new Map(allPatterns.map((p) => [p.name, p.id]))

  let inserted = 0
  let skipped = 0
  for (const prob of problems) {
    const tId = topicId.get(prob.topic)
    const pId = patternId.get(prob.pattern)
    if (!tId || !pId) {
      console.warn(
        `  ⚠ skipping "${prob.title}" — unknown ${!tId ? `topic "${prob.topic}"` : `pattern "${prob.pattern}"`}`
      )
      skipped++
      continue
    }

    // Problem has no natural unique key besides title — use that for upsert
    const existing = await prisma.problem.findFirst({ where: { title: prob.title } })
    if (existing) {
      await prisma.problem.update({
        where: { id: existing.id },
        data: {
          difficulty: prob.difficulty,
          topicId: tId,
          patternId: pId,
          source: prob.source,
          description: prob.description,
        },
      })
    } else {
      await prisma.problem.create({
        data: {
          title: prob.title,
          difficulty: prob.difficulty,
          topicId: tId,
          patternId: pId,
          source: prob.source,
          description: prob.description,
        },
      })
    }
    inserted++
  }
  console.log(`  ✓ ${inserted} problems${skipped ? ` (${skipped} skipped)` : ''}`)
  console.log('🌱 Done.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
