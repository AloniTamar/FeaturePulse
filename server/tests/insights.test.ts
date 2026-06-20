import { generateAndSaveInsights } from '../src/services/insights'
import { prisma } from '../src/db/client'

// The second test makes a real HTTPS call to openrouter.ai with an invalid key
// and waits for a 401 response. CI environments that throttle external connections
// can exceed Jest's default 5 s timeout, so we bump it to 15 s for the whole file.
jest.setTimeout(15000)

beforeEach(async () => {
  await prisma.appInsight.deleteMany()
  await prisma.appDailyStats.deleteMany()
  await prisma.weeklyAggregate.deleteMany()
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createInsightTestApp(overrides: Record<string, unknown> = {}) {
  const user = await prisma.user.create({ data: { email: 'insights@test.com', passwordHash: 'x' } })
  return prisma.app.create({
    data: {
      name: 'InsightApp', packageName: 'com.insight.test',
      apiKey: 'fp_insight_key', apiKeyHash: 'fp_insight_key',
      userId: user.id, aiInsightsEnabled: true,
      ...overrides,
    },
  })
}

test('returns null when no OpenRouter API key is configured', async () => {
  const savedKey = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  const app = await createInsightTestApp()
  const result = await generateAndSaveInsights(app.id)
  expect(result).toBeNull()
  process.env.OPENROUTER_API_KEY = savedKey
})

test('returns null and does not throw when OpenRouter call fails', async () => {
  // Set an invalid key so the API call fails
  process.env.OPENROUTER_API_KEY = 'sk_invalid_key_that_will_fail'
  const app = await createInsightTestApp()
  const result = await generateAndSaveInsights(app.id)
  // Must not throw — must return null
  expect(result).toBeNull()
})
