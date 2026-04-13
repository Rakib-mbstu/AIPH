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
interface SystemDesignTopicSeed {
  name: string
  category: string
  description: string
  difficulty: string
  prerequisiteNames: string[]
}
interface SystemDesignResource {
  title: string
  url: string
  type: string
}
interface SystemDesignQuestionSeed {
  prompt: string
  difficulty: string
  expectedConcepts: string[]
  topicNames: string[]
  resources: SystemDesignResource[]
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

  // --- System Design Topics ---
  const sdTopics = loadJson<SystemDesignTopicSeed[]>('system-design-topics.json')

  for (const t of sdTopics) {
    await prisma.systemDesignTopic.upsert({
      where: { name: t.name },
      update: { category: t.category, description: t.description, difficulty: t.difficulty },
      create: { name: t.name, category: t.category, description: t.description, difficulty: t.difficulty },
    })
  }

  // Second pass: resolve prerequisiteNames → IDs and write prerequisiteIds
  const allSdTopics = await prisma.systemDesignTopic.findMany()
  const sdTopicId = new Map(allSdTopics.map((t) => [t.name, t.id]))

  for (const t of sdTopics) {
    const prereqIds = t.prerequisiteNames
      .map((name) => sdTopicId.get(name))
      .filter((id): id is string => id !== undefined)
    await prisma.systemDesignTopic.update({
      where: { name: t.name },
      data: { prerequisiteIds: prereqIds },
    })
  }
  console.log(`  ✓ ${sdTopics.length} system design topics`)

  // --- System Design Questions ---
  const sdQuestions = loadJson<SystemDesignQuestionSeed[]>('system-design-questions.json')

  for (const q of sdQuestions) {
    // Resolve topic names to IDs — skip unknown topics with a warning
    const resolvedTopicIds: string[] = []
    for (const name of q.topicNames) {
      const id = sdTopicId.get(name)
      if (!id) {
        console.warn(`  ⚠ question "${q.prompt.slice(0, 40)}…" — unknown topic "${name}"`)
      } else {
        resolvedTopicIds.push(id)
      }
    }

    // Upsert question on prompt
    const existing = await prisma.systemDesignQuestion.findFirst({ where: { prompt: q.prompt } })
    let questionId: string
    if (existing) {
      await prisma.systemDesignQuestion.update({
        where: { id: existing.id },
        data: { difficulty: q.difficulty, expectedConcepts: q.expectedConcepts, resources: q.resources },
      })
      questionId = existing.id
    } else {
      const created = await prisma.systemDesignQuestion.create({
        data: { prompt: q.prompt, difficulty: q.difficulty, expectedConcepts: q.expectedConcepts, resources: q.resources },
      })
      questionId = created.id
    }

    // Idempotent join rows — delete then recreate
    await prisma.systemDesignQuestionTopic.deleteMany({ where: { questionId } })
    await prisma.systemDesignQuestionTopic.createMany({
      data: resolvedTopicIds.map((topicId) => ({ questionId, topicId })),
    })
  }
  console.log(`  ✓ ${sdQuestions.length} system design questions`)

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
