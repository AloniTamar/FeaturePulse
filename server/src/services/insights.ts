import OpenAI from 'openai'
import { prisma } from '../db/client'
import { logger } from '../lib/logger'

export type InsightResult = {
  summary: string
  bullets: string[]
  generatedAt: string
} | null

export async function generateAndSaveInsights(appId: string): Promise<InsightResult> {
  const [app, stateCounts, dauRow, topDead, topDeclining] = await Promise.all([
    prisma.app.findUnique({
      where: { id: appId },
      select: { name: true, openRouterApiKey: true },
    }),
    prisma.feature.groupBy({ by: ['state'], where: { appId }, _count: true }),
    prisma.appDailyStats.findFirst({ where: { appId }, orderBy: { date: 'desc' } }),
    prisma.feature.findMany({
      where: { appId, state: 'DEAD', isIgnored: false },
      orderBy: { lastInteraction: 'asc' },
      take: 3,
      select: { resourceName: true, screenName: true, lastInteraction: true },
    }),
    prisma.feature.findMany({
      where: { appId, state: 'DECLINING' },
      take: 3,
      select: { resourceName: true, screenName: true },
    }),
  ])

  const apiKey = app?.openRouterApiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    logger.warn({ appId }, 'No OpenRouter API key available — skipping AI insights')
    return null
  }

  const openai = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })

  const counts: Record<string, number> = {}
  for (const g of stateCounts) counts[g.state] = g._count

  const dataContext = [
    `App: ${app?.name ?? appId}`,
    `Feature counts: ${JSON.stringify(counts)}`,
    `Daily active users (latest): ${dauRow?.dailyActiveUsers ?? 'no data'}`,
    `Dead features: ${topDead.map(f => `${f.resourceName ?? f.screenName} (last used: ${f.lastInteraction?.toISOString().slice(0, 10) ?? 'never'})`).join(', ') || 'none'}`,
    `Declining features: ${topDeclining.map(f => f.resourceName ?? f.screenName).join(', ') || 'none'}`,
  ].join('\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'google/gemma-4-31b-it:free',
      max_tokens: 512,
      messages: [
        {
          role: 'system',
          content: `You are a mobile app analytics assistant. Given feature usage data, respond ONLY with valid JSON matching this shape exactly:
{"summary":"2-3 sentence health overview","bullets":["actionable item 1","actionable item 2","actionable item 3"]}
Use specific feature names from the data. No markdown, no extra text.`,
        },
        { role: 'user', content: dataContext },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { summary?: string; bullets?: string[] }

    const summary = json.summary ?? 'Unable to generate summary.'
    const bullets = Array.isArray(json.bullets)
      ? (json.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
      : []

    await prisma.appInsight.upsert({
      where: { appId },
      update: { summary, bullets, generatedAt: new Date() },
      create: { appId, summary, bullets },
    })

    return { summary, bullets, generatedAt: new Date().toISOString() }
  } catch (err) {
    logger.warn({ appId, err }, 'AI insights generation failed — skipping, existing insight preserved')
    return null
  }
}
