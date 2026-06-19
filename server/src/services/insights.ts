import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateAndSaveInsights(appId: string): Promise<{
  summary: string
  bullets: string[]
  generatedAt: string
}> {
  const [app, stateCounts, dauRow, topDead, topDeclining] = await Promise.all([
    prisma.app.findUnique({ where: { id: appId }, select: { name: true } }),
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

  const counts: Record<string, number> = {}
  for (const g of stateCounts) counts[g.state] = g._count

  const dataContext = [
    `App: ${app?.name ?? appId}`,
    `Feature counts: ${JSON.stringify(counts)}`,
    `Daily active users (latest): ${dauRow?.dailyActiveUsers ?? 'no data'}`,
    `Dead features: ${topDead.map(f => `${f.resourceName ?? f.screenName} (last used: ${f.lastInteraction?.toISOString().slice(0, 10) ?? 'never'})`).join(', ') || 'none'}`,
    `Declining features: ${topDeclining.map(f => f.resourceName ?? f.screenName).join(', ') || 'none'}`,
  ].join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a mobile app analytics assistant. Given feature usage data, respond ONLY with valid JSON matching this shape exactly:
{"summary":"2-3 sentence health overview","bullets":["actionable item 1","actionable item 2","actionable item 3"]}
Use specific feature names from the data. No markdown, no extra text.`,
    messages: [{ role: 'user', content: dataContext }],
  })

  const raw  = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { summary?: string; bullets?: string[] }

  const summary = json.summary ?? 'Unable to generate summary.'
  const bullets = Array.isArray(json.bullets) ? json.bullets : []

  await prisma.appInsight.upsert({
    where: { appId },
    update: { summary, bullets, generatedAt: new Date() },
    create: { appId, summary, bullets },
  })

  return { summary, bullets, generatedAt: new Date().toISOString() }
}
