# Multi-App Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Allow one FeaturePulse account to own multiple apps, with app context living in the URL (`/apps/:appId/...`) instead of localStorage.

**Architecture:** Replace `App.ownerEmail` string with a proper `userId` FK, add cascade deletes throughout the schema, update the auth and apps routes, then migrate the portal to URL-based app routing with a new Apps management page and sidebar app switcher.

**Tech Stack:** Server — Node.js, Express, Prisma, PostgreSQL, Zod, bcryptjs, jsonwebtoken. Portal — React 18, React Router v6, TypeScript, Tailwind CSS, Vite.

---

## File Map

**Server — Modify:**
- `server/prisma/schema.prisma` — add `userId` FK, cascade deletes, remove `ownerEmail`
- `server/src/routes/auth.ts` — register without app, login returns `apps[]`, add delete-account
- `server/src/routes/apps.ts` — scope GET to userId, add POST/PATCH/DELETE, ownership guard
- `server/tests/e2e.test.ts` — update register step (no longer returns appId/apiKey directly)
- `server/tests/routes.test.ts` — update beforeAll (App now requires userId FK)

**Server — Create:**
- `server/tests/apps.test.ts` — new tests for app CRUD endpoints

**Portal — Modify:**
- `portal/src/api/client.ts` — updated types, new methods, trimmed localStorage cleanup
- `portal/src/App.tsx` — new nested routing with `/apps/:appId/*`
- `portal/src/components/Layout.tsx` — optional appId, app switcher, updated nav groups
- `portal/src/pages/Login.tsx` — remove app fields from register, handle `apps[]` response
- `portal/src/pages/Dashboard.tsx` — `useParams()` replaces `localStorage.getItem('fp_appId')`
- `portal/src/pages/Features.tsx` — same
- `portal/src/pages/Settings.tsx` — redesign: SDK config pulled from active app via AppContext
- `portal/src/pages/Account.tsx` — build out: email, password change, delete account

**Portal — Create:**
- `portal/src/context/AppContext.tsx` — shared app list + active app, loaded once in Layout
- `portal/src/components/AppModal.tsx` — shared "New App" modal
- `portal/src/pages/Apps.tsx` — full CRUD apps management page

---

## Task 1: Schema — `userId` FK + cascade deletes

**Files:**
- Modify: `server/prisma/schema.prisma`

- [x] **Step 1: Update schema.prisma**

Replace the entire file with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  apps         App[]
}

model App {
  id          String   @id @default(uuid())
  name        String
  packageName String
  apiKey      String   @unique
  apiKeyHash  String
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  config      Json     @default("{}")
  features    Feature[]
  rawEvents   RawEvent[]
}

model Feature {
  id               String    @id
  appId            String
  app              App       @relation(fields: [appId], references: [id], onDelete: Cascade)
  elementType      String
  resourceName     String?
  screenName       String
  hierarchyPath    String?
  firstSeen        DateTime  @default(now())
  lastInteraction  DateTime?
  state            String    @default("THRIVING")
  isIgnored        Boolean   @default(false)
  metadata         Json      @default("{}")
  dailyAggregates  DailyAggregate[]
  stateTransitions StateTransition[]

  @@index([appId, state])
  @@index([appId, screenName])
}

model RawEvent {
  id        String   @id
  featureId String
  appId     String
  app       App      @relation(fields: [appId], references: [id], onDelete: Cascade)
  eventType String
  timestamp DateTime
  sessionId String?
  deviceId  String?

  @@index([featureId, timestamp])
  @@index([appId, timestamp])
}

model DailyAggregate {
  featureId       String
  date            DateTime @db.Date
  impressions     Int      @default(0)
  interactions    Int      @default(0)
  uniqueUsers     Int      @default(0)
  interactionRate Float    @default(0.0)
  feature         Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@id([featureId, date])
  @@index([date])
}

model StateTransition {
  id        Int      @id @default(autoincrement())
  featureId String
  feature   Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)
  oldState  String?
  newState  String
  changedAt DateTime @default(now())
  reason    String?

  @@index([featureId, changedAt])
}
```

- [x] **Step 2: Create the migration (two-step, dev environment)**

Because existing `App` rows have `ownerEmail` but no `userId`, run two migrations:

```bash
cd server
# Step A: add userId as nullable, keep ownerEmail
npx prisma migrate dev --name add_app_userid_nullable --create-only
```

Open the generated file at `server/prisma/migrations/<timestamp>_add_app_userid_nullable/migration.sql` and **replace its content** with:

```sql
-- Add userId column as nullable first (so existing rows don't fail)
ALTER TABLE "App" ADD COLUMN "userId" TEXT;

-- Backfill userId from the User table via ownerEmail
UPDATE "App" SET "userId" = u.id FROM "User" u WHERE u.email = "App"."ownerEmail";
```

Then run only this migration:

```bash
npx prisma migrate deploy
```

- [x] **Step 3: Run the second migration to finalize**

```bash
npx prisma migrate dev --name finalize_app_userid --create-only
```

Open the generated file and **replace its content** with:

```sql
-- Make userId non-null now that all rows are backfilled
ALTER TABLE "App" ALTER COLUMN "userId" SET NOT NULL;

-- Add the FK constraint
ALTER TABLE "App" ADD CONSTRAINT "App_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop ownerEmail
ALTER TABLE "App" DROP COLUMN "ownerEmail";

-- Add cascade deletes for all child relations (Prisma defaults to RESTRICT)
ALTER TABLE "Feature"
  DROP CONSTRAINT "Feature_appId_fkey",
  ADD CONSTRAINT "Feature_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RawEvent"
  DROP CONSTRAINT "RawEvent_appId_fkey",
  ADD CONSTRAINT "RawEvent_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyAggregate"
  DROP CONSTRAINT "DailyAggregate_featureId_fkey",
  ADD CONSTRAINT "DailyAggregate_featureId_fkey"
    FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StateTransition"
  DROP CONSTRAINT "StateTransition_featureId_fkey",
  ADD CONSTRAINT "StateTransition_featureId_fkey"
    FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Then:

```bash
npx prisma migrate deploy
npx prisma generate
```

- [x] **Step 4: Verify migrations applied**

```bash
npx prisma db pull 2>&1 | head -5
```

Expected: no error. Then:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.app.findMany({ include: { user: true } }).then(a => console.log(a.length + ' apps found')).finally(() => p.\$disconnect());
"
```

Expected: prints `N apps found` with no error.

- [x] **Step 5: Update `server/tests/routes.test.ts` — fix beforeAll**

The `beforeAll` creates an `App` directly with `ownerEmail`. Replace that block:

```typescript
beforeAll(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
  const testUser = await prisma.user.create({
    data: { email: 'route@test.com', passwordHash: 'x' },
  })
  const testApp = await prisma.app.create({
    data: {
      name: 'RouteTest', packageName: 'com.routetest',
      apiKey: 'fp_route_key', apiKeyHash: 'fp_route_key',
      userId: testUser.id,
    },
  })
  testApiKey = testApp.apiKey
  testAppId  = testApp.id
})
```

- [x] **Step 6: Run existing tests and confirm they pass**

```bash
cd server && npx jest --testPathPattern="routes|ingestion|classification" --forceExit 2>&1 | tail -20
```

Expected: all suites pass (the e2e test will be updated in Task 2).

- [x] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/tests/routes.test.ts
git commit -m "feat(schema): replace ownerEmail with userId FK, add cascade deletes on all child relations"
```

---

## Task 2: Auth routes — register (user only) + login (returns `apps[]`) + delete account

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/tests/e2e.test.ts`

- [x] **Step 1: Write failing tests for the new auth contract**

Create `server/tests/auth.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'
import bcrypt from 'bcryptjs'

beforeEach(async () => {
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

describe('POST /auth/register', () => {
  it('creates only a User — no App — and returns just a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new@example.com', password: 'password123',
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.apiKey).toBeUndefined()
    expect(res.body.appId).toBeUndefined()
    const users = await prisma.user.findMany()
    expect(users).toHaveLength(1)
    const apps = await prisma.app.findMany()
    expect(apps).toHaveLength(0)
  })

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'password123' })
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'password123' })
    expect(res.status).toBe(409)
  })
})

describe('POST /auth/login', () => {
  let userId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'login@example.com', passwordHash: await bcrypt.hash('pass1234', 10) },
    })
    userId = user.id
    await prisma.app.create({
      data: { name: 'App One', packageName: 'com.one', apiKey: 'fp_one', apiKeyHash: 'fp_one', userId },
    })
    await prisma.app.create({
      data: { name: 'App Two', packageName: 'com.two', apiKey: 'fp_two', apiKeyHash: 'fp_two', userId },
    })
  })

  it('returns token and apps[] sorted by createdAt', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com', password: 'pass1234',
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(Array.isArray(res.body.apps)).toBe(true)
    expect(res.body.apps).toHaveLength(2)
    expect(res.body.apps[0]).toMatchObject({ name: 'App One', packageName: 'com.one', apiKey: 'fp_one' })
    expect(res.body.apps[0].featureCount).toBe(0)
  })

  it('returns empty apps array when user has no apps', async () => {
    await prisma.app.deleteMany({ where: { userId } })
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com', password: 'pass1234',
    })
    expect(res.status).toBe(200)
    expect(res.body.apps).toEqual([])
  })
})

describe('PATCH /auth/me/password', () => {
  it('changes the password when current password is correct', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ email: 'pw@example.com', password: 'oldpass1' })
    const token = reg.body.token
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpass1', newPassword: 'newpass99' })
    expect(res.status).toBe(204)
    // Confirm new password works
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'pw@example.com', password: 'newpass99' })
    expect(login.status).toBe(200)
  })

  it('returns 401 when current password is wrong', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ email: 'pw2@example.com', password: 'oldpass1' })
    const token = reg.body.token
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass99' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /auth/me', () => {
  it('deletes the authenticated user and all their apps', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'del@example.com', password: 'password123',
    })
    const token = reg.body.token
    const user = await prisma.user.findUnique({ where: { email: 'del@example.com' } })
    await prisma.app.create({
      data: { name: 'A', packageName: 'com.a', apiKey: 'fp_del', apiKeyHash: 'fp_del', userId: user!.id },
    })

    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)

    const remaining = await prisma.user.findUnique({ where: { email: 'del@example.com' } })
    expect(remaining).toBeNull()
    const apps = await prisma.app.findMany()
    expect(apps).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest --testPathPattern="auth.test" --forceExit 2>&1 | tail -20
```

Expected: failures on all three describe blocks.

- [x] **Step 3: Rewrite `server/src/routes/auth.ts`**

```typescript
import { Router } from 'express'
import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'crypto'
import { jwtAuth, type AuthRequest } from '../middleware/auth'

export const authRouter = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

authRouter.post('/register', async (req, res) => {
  const result = RegisterSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email already registered' })

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { email, passwordHash } })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token })
})

authRouter.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const apps = await prisma.app.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { features: true } } },
  })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({
    token,
    apps: apps.map(a => ({
      id: a.id,
      name: a.name,
      packageName: a.packageName,
      apiKey: a.apiKey,
      createdAt: a.createdAt,
      featureCount: a._count.features,
    })),
  })
})

authRouter.delete('/me', jwtAuth, async (req: AuthRequest, res) => {
  await prisma.user.delete({ where: { id: req.userId! } })
  res.status(204).end()
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

authRouter.patch('/me/password', jwtAuth, async (req: AuthRequest, res) => {
  const result = ChangePasswordSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const valid = await bcrypt.compare(result.data.currentPassword, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

  const passwordHash = await bcrypt.hash(result.data.newPassword, 10)
  await prisma.user.update({ where: { id: req.userId! }, data: { passwordHash } })
  res.status(204).end()
})
```

- [x] **Step 4: Run auth tests to confirm they pass**

```bash
cd server && npx jest --testPathPattern="auth.test" --forceExit 2>&1 | tail -20
```

Expected: 5 passing tests.

- [x] **Step 5: Update `server/tests/e2e.test.ts`**

The first test and the variable setup need updating. Read the file, then replace the first `it` block and add an app-creation step after register:

```typescript
// Replace the 'POST /auth/register creates app and returns apiKey + token' test with:
it('POST /auth/register creates user (no app) and returns token', async () => {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'e2e@example.com', password: 'test1234',
  })
  expect(res.status).toBe(201)
  expect(res.body.token).toBeTruthy()
  jwtToken = res.body.token
})

it('POST /api/v1/apps creates the first app and returns apiKey', async () => {
  const res = await request(app)
    .post('/api/v1/apps')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({ name: 'E2E Demo App', packageName: 'com.e2e.demo' })
  expect(res.status).toBe(201)
  expect(res.body.apiKey).toMatch(/^fp_/)
  apiKey = res.body.apiKey
  appId  = res.body.id
})
```

- [x] **Step 6: Run all server tests**

```bash
cd server && npx jest --forceExit 2>&1 | tail -30
```

Expected: all suites pass.

- [x] **Step 7: Commit**

```bash
git add server/src/routes/auth.ts server/tests/auth.test.ts server/tests/e2e.test.ts
git commit -m "feat(auth): register creates user only; login returns apps[]; add DELETE /auth/me"
```

---

## Task 3: Apps routes — scoped list, create, rename, delete, ownership guard

**Files:**
- Modify: `server/src/routes/apps.ts`
- Create: `server/tests/apps.test.ts`

- [x] **Step 1: Write failing tests**

Create `server/tests/apps.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'
import jwt from 'jsonwebtoken'

function makeToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET ?? 'test-secret', { expiresIn: '1h' })
}

beforeEach(async () => {
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})
afterAll(async () => { await prisma.$disconnect() })

describe('App CRUD', () => {
  let userId: string
  let token: string
  let otherUserId: string
  let otherToken: string

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: 'owner@test.com', passwordHash: 'x' } })
    userId = user.id
    token = makeToken(userId)
    const other = await prisma.user.create({ data: { email: 'other@test.com', passwordHash: 'x' } })
    otherUserId = other.id
    otherToken = makeToken(otherUserId)
  })

  it('GET /apps returns only the authenticated user\'s apps', async () => {
    await prisma.app.create({ data: { name: 'Mine', packageName: 'com.mine', apiKey: 'fp_m', apiKeyHash: 'fp_m', userId } })
    await prisma.app.create({ data: { name: 'Theirs', packageName: 'com.theirs', apiKey: 'fp_t', apiKeyHash: 'fp_t', userId: otherUserId } })
    const res = await request(app).get('/api/v1/apps').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Mine')
    expect(res.body[0].featureCount).toBe(0)
  })

  it('POST /apps creates an app owned by the authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New App', packageName: 'com.new' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('New App')
    expect(res.body.apiKey).toMatch(/^fp_/)
    const app_ = await prisma.app.findUnique({ where: { id: res.body.id } })
    expect(app_?.userId).toBe(userId)
  })

  it('PATCH /apps/:appId renames own app', async () => {
    const created = await prisma.app.create({ data: { name: 'Old', packageName: 'com.old', apiKey: 'fp_old', apiKeyHash: 'fp_old', userId } })
    const res = await request(app)
      .patch(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Name')
  })

  it('PATCH /apps/:appId returns 403 for another user\'s app', async () => {
    const created = await prisma.app.create({ data: { name: 'Theirs', packageName: 'com.t', apiKey: 'fp_th', apiKeyHash: 'fp_th', userId: otherUserId } })
    const res = await request(app)
      .patch(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hijacked' })
    expect(res.status).toBe(403)
  })

  it('DELETE /apps/:appId removes app and cascades features', async () => {
    const created = await prisma.app.create({ data: { name: 'ToDelete', packageName: 'com.del', apiKey: 'fp_d', apiKeyHash: 'fp_d', userId } })
    await prisma.feature.create({ data: { id: 'feat_del', appId: created.id, elementType: 'Button', screenName: 'Home' } })
    const res = await request(app)
      .delete(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
    expect(await prisma.app.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await prisma.feature.findUnique({ where: { id: 'feat_del' } })).toBeNull()
  })

  it('DELETE /apps/:appId returns 403 for another user\'s app', async () => {
    const created = await prisma.app.create({ data: { name: 'Theirs2', packageName: 'com.t2', apiKey: 'fp_t2', apiKeyHash: 'fp_t2', userId: otherUserId } })
    const res = await request(app)
      .delete(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('GET /apps/:appId/features returns 403 for another user\'s app', async () => {
    const created = await prisma.app.create({ data: { name: 'Theirs3', packageName: 'com.t3', apiKey: 'fp_t3', apiKeyHash: 'fp_t3', userId: otherUserId } })
    const res = await request(app)
      .get(`/api/v1/apps/${created.id}/features`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
```

- [x] **Step 2: Run to confirm failures**

```bash
cd server && npx jest --testPathPattern="apps.test" --forceExit 2>&1 | tail -20
```

Expected: multiple failures.

- [x] **Step 3: Rewrite `server/src/routes/apps.ts`**

```typescript
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, type AuthRequest } from '../middleware/auth'
import crypto from 'crypto'
import { z } from 'zod'

export const appsRouter = Router()

// Helper: verify app ownership. Returns app or sends 403/404.
async function requireOwnership(req: AuthRequest, res: any, appId: string) {
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) { res.status(404).json({ error: 'App not found' }); return null }
  if (app.userId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return null }
  return app
}

// Public — SDK fetches remote config via this (no auth)
appsRouter.get('/config', async (req, res) => {
  const appId = req.query.appId
  if (typeof appId !== 'string' || !appId) return res.status(400).json({ error: 'appId required' })
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return res.status(404).json({ error: 'App not found' })
  const storedConfig = app.config && typeof app.config === 'object' && !Array.isArray(app.config)
    ? app.config as Record<string, unknown>
    : {}
  res.json({
    enabled: true,
    syncIntervalMs: 1800000,
    batchSize: 500,
    minImpressionMs: 1000,
    excludeScreens: [],
    samplingRate: 1.0,
    sdkMinVersion: '1.0.0',
    ...storedConfig,
  })
})

// GET /api/v1/apps — list authenticated user's apps
appsRouter.get('/', jwtAuth, async (req: AuthRequest, res) => {
  const apps = await prisma.app.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { features: true } } },
  })
  res.json(apps.map(a => ({
    id: a.id,
    name: a.name,
    packageName: a.packageName,
    apiKey: a.apiKey,
    createdAt: a.createdAt,
    featureCount: a._count.features,
  })))
})

// POST /api/v1/apps — create new app
const CreateAppSchema = z.object({
  name: z.string().min(1),
  packageName: z.string().min(1),
})

appsRouter.post('/', jwtAuth, async (req: AuthRequest, res) => {
  const result = CreateAppSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { name, packageName } = result.data
  const apiKey = 'fp_' + crypto.randomBytes(24).toString('hex')
  const app = await prisma.app.create({
    data: { name, packageName, apiKey, apiKeyHash: apiKey, userId: req.userId! },
    include: { _count: { select: { features: true } } },
  })
  res.status(201).json({
    id: app.id, name: app.name, packageName: app.packageName,
    apiKey: app.apiKey, createdAt: app.createdAt, featureCount: app._count.features,
  })
})

// PATCH /api/v1/apps/:appId — rename
const RenameSchema = z.object({ name: z.string().min(1) })

appsRouter.patch('/:appId', jwtAuth, async (req: AuthRequest, res) => {
  const owned = await requireOwnership(req, res, req.params.appId)
  if (!owned) return

  const result = RenameSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const updated = await prisma.app.update({
    where: { id: req.params.appId },
    data: { name: result.data.name },
    include: { _count: { select: { features: true } } },
  })
  res.json({
    id: updated.id, name: updated.name, packageName: updated.packageName,
    apiKey: updated.apiKey, createdAt: updated.createdAt, featureCount: updated._count.features,
  })
})

// DELETE /api/v1/apps/:appId
appsRouter.delete('/:appId', jwtAuth, async (req: AuthRequest, res) => {
  const owned = await requireOwnership(req, res, req.params.appId)
  if (!owned) return
  await prisma.app.delete({ where: { id: req.params.appId } })
  res.status(204).end()
})

// PUT /api/v1/apps/:appId/config — SDK remote config update
appsRouter.put('/:appId/config', jwtAuth, async (req: AuthRequest, res) => {
  const owned = await requireOwnership(req, res, req.params.appId)
  if (!owned) return
  const app = await prisma.app.update({
    where: { id: req.params.appId },
    data: { config: req.body },
  })
  res.json(app)
})

// GET /api/v1/apps/:appId/features
appsRouter.get('/:appId/features', jwtAuth, async (req: AuthRequest, res) => {
  const owned = await requireOwnership(req, res, req.params.appId)
  if (!owned) return

  const { appId } = req.params
  const { state, screen, page = '1', limit = '20' } = req.query
  const where: Record<string, unknown> = { appId }
  if (state)  where.state = state
  if (screen) where.screenName = screen

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  try {
    const [features, total] = await Promise.all([
      prisma.feature.findMany({ where, skip, take: parseInt(limit as string), orderBy: { lastInteraction: 'desc' } }),
      prisma.feature.count({ where }),
    ])
    res.json({
      data: features.map(f => ({
        ...f,
        daysSinceLastUse: f.lastInteraction
          ? Math.floor((Date.now() - f.lastInteraction.getTime()) / 86_400_000)
          : null,
      })),
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
    })
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/apps/:appId/export
appsRouter.get('/:appId/export', jwtAuth, async (req: AuthRequest, res) => {
  const owned = await requireOwnership(req, res, req.params.appId)
  if (!owned) return
  try {
    const features = await prisma.feature.findMany({ where: { appId: req.params.appId } })
    if ((req.query.format as string) === 'csv') {
      const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`
      const header = 'featureId,elementType,resourceName,screenName,state,lastInteraction\n'
      const rows = features.map(f =>
        [csvEscape(f.id), csvEscape(f.elementType), csvEscape(f.resourceName ?? ''),
         csvEscape(f.screenName), csvEscape(f.state), csvEscape(f.lastInteraction?.toISOString() ?? '')].join(',')
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="features.csv"')
      return res.send(header + rows)
    }
    res.json(features)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
```

- [x] **Step 4: Add ownership guard to `dashboard.ts` routes**

Open `server/src/routes/dashboard.ts`. At the top, add the import and helper:

```typescript
import { type AuthRequest } from '../middleware/auth'
```

Then for each route (`/apps/:appId/dashboard`, `/apps/:appId/dead`, `/apps/:appId/declining`, `/apps/:appId/trend`), add an ownership check at the start of each handler. Example for the dashboard route:

```typescript
dashboardRouter.get('/apps/:appId/dashboard', jwtAuth, async (req: AuthRequest, res) => {
  const { appId } = req.params
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return res.status(404).json({ error: 'App not found' })
  if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })
  // ... rest of handler unchanged
```

Apply the same pattern to the `/dead`, `/declining`, and `/trend` routes.

- [x] **Step 5: Run all server tests**

```bash
cd server && npx jest --forceExit 2>&1 | tail -30
```

Expected: all suites pass.

- [x] **Step 6: Commit**

```bash
git add server/src/routes/apps.ts server/src/routes/dashboard.ts server/tests/apps.test.ts
git commit -m "feat(apps): scoped list, create, rename, delete; ownership guard on all :appId routes"
```

---

## Task 4: Portal — `api/client.ts` + `AppContext`

**Files:**
- Modify: `portal/src/api/client.ts`
- Create: `portal/src/context/AppContext.tsx`

- [x] **Step 1: Rewrite `portal/src/api/client.ts`**

```typescript
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken() { return localStorage.getItem('fp_token') }
export function setToken(t: string) { localStorage.setItem('fp_token', t) }
export function clearToken() {
  localStorage.removeItem('fp_token')
  localStorage.removeItem('fp_email')
}
export function isLoggedIn() { return !!getToken() }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; apps: AppSummary[] }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<{ token: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),

  deleteAccount: () =>
    request<void>('/auth/me', { method: 'DELETE' }),

  listApps: () =>
    request<AppSummary[]>('/apps'),

  createApp: (name: string, packageName: string) =>
    request<AppSummary>('/apps', { method: 'POST', body: JSON.stringify({ name, packageName }) }),

  renameApp: (appId: string, name: string) =>
    request<AppSummary>(`/apps/${appId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteApp: (appId: string) =>
    request<void>(`/apps/${appId}`, { method: 'DELETE' }),

  getDashboard: (appId: string) =>
    request<{ counts: Record<string, number>; recentTransitions: unknown[] }>(`/apps/${appId}/dashboard`),

  getFeatures: (appId: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<{ data: Feature[]; pagination: Pagination }>(`/apps/${appId}/features${qs ? `?${qs}` : ''}`)
  },

  getFeature: (featureId: string) =>
    request<Feature>(`/features/${featureId}`),

  getTimeline: (featureId: string, days = 30) =>
    request<TimelineRow[]>(`/features/${featureId}/timeline?days=${days}`),

  ignoreFeature: (featureId: string, ignore: boolean) =>
    request<Feature>(`/features/${featureId}/ignore`, { method: 'PATCH', body: JSON.stringify({ ignore }) }),

  getTrend: (appId: string, days = 30) =>
    request<TrendPoint[]>(`/apps/${appId}/trend?days=${days}`),

  getDeadFeatures: (appId: string) =>
    request<Feature[]>(`/apps/${appId}/dead`),

  exportFeatures: (appId: string, format: 'json' | 'csv') =>
    `${BASE}/api/v1/apps/${appId}/export?format=${format}`,
}

export interface AppSummary {
  id: string
  name: string
  packageName: string
  apiKey: string
  createdAt: string
  featureCount: number
}

export interface Feature {
  id: string; appId: string; elementType: string; resourceName: string | null
  screenName: string; state: 'THRIVING' | 'DECLINING' | 'DORMANT' | 'DEAD'
  lastInteraction: string | null; firstSeen: string; isIgnored: boolean
  daysSinceLastUse: number | null
}

export interface TimelineRow {
  featureId: string; date: string; impressions: number
  interactions: number; uniqueUsers: number; interactionRate: number
}

export interface Pagination { page: number; limit: number; total: number }
export interface TrendPoint { date: string; avgInteractionRate: number }
```

- [x] **Step 2: Create `portal/src/context/AppContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { api, type AppSummary } from '../api/client'

interface AppContextValue {
  apps: AppSummary[]
  activeApp: AppSummary | undefined
  reloadApps: () => Promise<void>
}

const AppContext = createContext<AppContextValue>({
  apps: [],
  activeApp: undefined,
  reloadApps: async () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const { appId } = useParams<{ appId?: string }>()
  const [apps, setApps] = useState<AppSummary[]>([])

  async function reloadApps() {
    try { setApps(await api.listApps()) } catch {}
  }

  useEffect(() => { reloadApps() }, [])

  const activeApp = apps.find(a => a.id === appId)

  return (
    <AppContext.Provider value={{ apps, activeApp, reloadApps }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
```

- [x] **Step 3: Verify TypeScript compiles**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to the new files).

- [x] **Step 4: Commit**

```bash
git add portal/src/api/client.ts portal/src/context/AppContext.tsx
git commit -m "feat(portal): update api client types; add AppContext for shared app list"
```

---

## Task 5: Portal routing + Login page

**Files:**
- Modify: `portal/src/App.tsx`
- Modify: `portal/src/pages/Login.tsx`

- [x] **Step 1: Rewrite `portal/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './api/client'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Features from './pages/Features'
import FeatureDetail from './pages/FeatureDetail'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Account from './pages/Account'
import Apps from './pages/Apps'
import Docs from './pages/Docs'

function AuthLayout() {
  return isLoggedIn() ? <Layout /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthLayout />}>
          {/* User-level routes — no appId */}
          <Route path="/apps" element={<Apps />} />
          <Route path="/account" element={<Account />} />
          <Route path="/docs" element={<Docs />} />
          {/* App-level routes — appId in URL */}
          <Route path="/apps/:appId">
            <Route path="dashboard"              element={<Dashboard />} />
            <Route path="features"               element={<Features />} />
            <Route path="features/:featureId"    element={<FeatureDetail />} />
            <Route path="alerts"                 element={<Alerts />} />
            <Route path="settings"               element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/apps" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [x] **Step 2: Rewrite `portal/src/pages/Login.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'

export default function Login() {
  const nav = useNavigate()
  const [tab,      setTab]    = useState<'login' | 'register'>('login')
  const [email,    setEmail]  = useState('')
  const [password, setPass]   = useState('')
  const [error,    setError]  = useState('')
  const [loading,  setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        const { token, apps } = await api.login(email, password)
        setToken(token)
        localStorage.setItem('fp_email', email)
        if (apps.length > 0) {
          nav(`/apps/${apps[0].id}/dashboard`)
        } else {
          nav('/apps')
        }
      } else {
        const { token } = await api.register(email, password)
        setToken(token)
        localStorage.setItem('fp_email', email)
        nav('/apps')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div
        className="bg-white border border-slate-200 shadow-md"
        style={{ width: 400, padding: 32, borderRadius: 14 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 32, height: 32, borderRadius: 9 }}
          >
            <img src="/icon.png" alt="FeaturePulse" style={{ width: 32, height: 32, objectFit: 'cover' }} />
          </div>
          <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>
            FeaturePulse
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded font-semibold transition-colors ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              style={{ fontSize: 13 }}
            >
              {t === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPass(e.target.value)} required
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          {error && <p className="text-red-600" style={{ fontSize: 13 }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            style={{ padding: '10px 0', fontSize: 14 }}
          >
            {loading ? 'Loading…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [x] **Step 3: Verify TypeScript compiles**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -30
```

- [x] **Step 4: Commit**

```bash
git add portal/src/App.tsx portal/src/pages/Login.tsx
git commit -m "feat(portal): URL-based routing /apps/:appId/*; login redirects by apps[] length"
```

---

## Task 6: Portal — `AppModal` component

**Files:**
- Create: `portal/src/components/AppModal.tsx`

- [x] **Step 1: Create `portal/src/components/AppModal.tsx`**

```tsx
import { useState, type FC } from 'react'
import { api, type AppSummary } from '../api/client'

interface Props {
  onClose: () => void
  onCreated: (app: AppSummary) => void
}

export const AppModal: FC<Props> = ({ onClose, onCreated }) => {
  const [name, setName]             = useState('')
  const [packageName, setPkg]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const app = await api.createApp(name, packageName)
      onCreated(app)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 16 }}>New App</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            placeholder="App name" value={name}
            onChange={(e) => setName(e.target.value)}
            required autoFocus
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          <input
            placeholder="Package name (com.example.app)" value={packageName}
            onChange={(e) => setPkg(e.target.value)}
            required
            className="border border-slate-200 rounded-lg text-slate-900 font-mono outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 13 }}
          />
          {error && <p className="text-red-600" style={{ fontSize: 13 }}>{error}</p>}
          <div className="flex gap-2 justify-end mt-1">
            <button
              type="button" onClick={onClose}
              className="border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {loading ? 'Creating…' : 'Create App'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Verify TypeScript compiles**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 3: Commit**

```bash
git add portal/src/components/AppModal.tsx
git commit -m "feat(portal): add shared AppModal component for creating new apps"
```

---

## Task 7: Portal — Apps management page

**Files:**
- Create: `portal/src/pages/Apps.tsx`

- [x] **Step 1: Create `portal/src/pages/Apps.tsx`**

```tsx
import { useState, type FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AppSummary } from '../api/client'
import { useApp } from '../context/AppContext'
import { AppModal } from '../components/AppModal'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="text-slate-400 hover:text-indigo-600 transition-colors"
      style={{ fontSize: 11, padding: '2px 6px' }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function DeleteModal({ app, onClose, onDeleted }: { app: AppSummary; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const matches = confirm === app.name

  async function handleDelete() {
    if (!matches) return
    setLoading(true)
    try {
      await api.deleteApp(app.id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-slate-900 font-bold mb-2" style={{ fontSize: 16 }}>
          Delete "{app.name}"?
        </h2>
        <p className="text-slate-500 mb-4" style={{ fontSize: 13 }}>
          This permanently deletes the app and all its features, events, and data. This cannot be undone.
        </p>
        <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>
          Type <span className="font-mono bg-slate-100 px-1 rounded">{app.name}</span> to confirm:
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={app.name}
          autoFocus
          className="w-full border border-red-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4 transition-colors"
          style={{ padding: '10px 14px', fontSize: 14 }}
        />
        {error && <p className="text-red-600 mb-3" style={{ fontSize: 13 }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button" onClick={onClose}
            className="border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!matches || loading}
            className="bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            {loading ? 'Deleting…' : 'Delete App'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AppCard({ app, onRenamed, onDeleted, onOpen }: {
  app: AppSummary
  onRenamed: (updated: AppSummary) => void
  onDeleted: () => void
  onOpen: () => void
}) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(app.name)
  const [saving, setSaving]     = useState(false)
  const [showDelete, setDelete] = useState(false)
  const [masked, setMasked]     = useState(true)
  const maskedKey = app.apiKey.slice(0, 6) + '••••••••••••' + app.apiKey.slice(-4)

  async function saveRename() {
    if (name === app.name) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.renameApp(app.id, name)
      onRenamed(updated)
    } catch {
      setName(app.name)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setName(app.name); setEditing(false) } }}
                autoFocus
                disabled={saving}
                className="border border-indigo-400 rounded-lg text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-600 w-full"
                style={{ padding: '4px 8px', fontSize: 15 }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-slate-900 font-bold truncate" style={{ fontSize: 15 }}>{app.name}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
                  title="Rename"
                >
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M10.5 1.5l3 3-9 9H1.5v-3l9-9z" />
                  </svg>
                </button>
              </div>
            )}
            <div className="font-mono text-slate-400 mt-0.5 truncate" style={{ fontSize: 11.5 }}>{app.packageName}</div>
          </div>
          <button
            onClick={onOpen}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
            style={{ padding: '6px 14px', fontSize: 12.5 }}
          >
            Open
          </button>
        </div>

        {/* API Key */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="font-mono text-slate-600 flex-1 truncate" style={{ fontSize: 11.5 }}>
            {masked ? maskedKey : app.apiKey}
          </span>
          <button onClick={() => setMasked(m => !m)} className="text-slate-400 hover:text-slate-600 transition-colors" style={{ fontSize: 11 }}>
            {masked ? 'Show' : 'Hide'}
          </button>
          <CopyButton text={app.apiKey} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400" style={{ fontSize: 11.5 }}>
            {app.featureCount} features · Created {new Date(app.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={() => setDelete(true)}
            className="text-red-400 hover:text-red-600 font-semibold transition-colors"
            style={{ fontSize: 12 }}
          >
            Delete
          </button>
        </div>
      </div>

      {showDelete && (
        <DeleteModal
          app={app}
          onClose={() => setDelete(false)}
          onDeleted={() => { setDelete(false); onDeleted() }}
        />
      )}
    </>
  )
}

export default function Apps() {
  const nav = useNavigate()
  const { apps, reloadApps } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [localApps, setLocalApps] = useState<AppSummary[] | null>(null)

  const displayApps = localApps ?? apps

  function handleCreated(app: AppSummary) {
    setShowModal(false)
    reloadApps()
    nav(`/apps/${app.id}/dashboard`)
  }

  function handleRenamed(updated: AppSummary) {
    setLocalApps(prev => (prev ?? apps).map(a => a.id === updated.id ? updated : a))
    reloadApps()
  }

  function handleDeleted(appId: string) {
    setLocalApps(prev => (prev ?? apps).filter(a => a.id !== appId))
    reloadApps()
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-900 font-extrabold mb-1" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
            Apps
          </h1>
          <p className="text-slate-500" style={{ fontSize: 13 }}>Manage all your apps in one place.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          style={{ padding: '8px 18px', fontSize: 13 }}
        >
          + New App
        </button>
      </div>

      {displayApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 py-16">
          <div className="bg-indigo-50 rounded-2xl flex items-center justify-center mb-4" style={{ width: 56, height: 56 }}>
            <svg width="24" height="24" viewBox="0 0 15 15" fill="none" stroke="#4F46E5" strokeWidth="1.4">
              <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
              <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
              <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
            </svg>
          </div>
          <p className="text-slate-900 font-bold mb-1" style={{ fontSize: 15 }}>No apps yet</p>
          <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>Create your first app to start tracking features.</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            style={{ padding: '9px 22px', fontSize: 13 }}
          >
            Create your first app
          </button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {displayApps.map(app => (
            <AppCard
              key={app.id}
              app={app}
              onRenamed={handleRenamed}
              onDeleted={() => handleDeleted(app.id)}
              onOpen={() => nav(`/apps/${app.id}/dashboard`)}
            />
          ))}
        </div>
      )}

      {showModal && <AppModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}
```

- [x] **Step 2: Verify TypeScript**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 3: Commit**

```bash
git add portal/src/pages/Apps.tsx
git commit -m "feat(portal): add Apps management page — create, rename, delete with confirmation"
```

---

## Task 8: Portal — Layout (AppProvider + app switcher + nav groups)

**Files:**
- Modify: `portal/src/components/Layout.tsx`

- [x] **Step 1: Rewrite `portal/src/components/Layout.tsx`**

Replace the full file:

```tsx
import { Outlet, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useEffect, useState, type FC } from 'react'
import { clearToken, api } from '../api/client'
import { TopbarProvider, useTopbar } from './TopbarContext'
import { AppProvider, useApp } from '../context/AppContext'
import { AppModal } from './AppModal'
import type { AppSummary } from '../api/client'

// ── Icons ──────────────────────────────────────────────────────────────────
const HomeIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="currentColor">
    <path d="M1 5.5L7.5 1 14 5.5V14H9.5v-3.5h-4V14H1V5.5z" />
  </svg>
)
const GridIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
)
const BellIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M7.5 1.5A5 5 0 0 1 12.5 6.5c0 3-1.2 4.5-2.2 5.5h-5.6C3.7 11 2.5 9.5 2.5 6.5a5 5 0 0 1 5-5z" />
    <path d="M5.5 12v.5a2 2 0 0 0 4 0V12" strokeLinecap="round" />
  </svg>
)
const CogIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="7.5" r="2" />
    <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14" strokeLinecap="round" />
    <path d="M3.2 3.2l1.06 1.06M10.74 10.74l1.06 1.06M3.2 11.8l1.06-1.06M10.74 4.26l1.06-1.06" strokeLinecap="round" />
  </svg>
)
const PersonIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="4" r="2.5" />
    <path d="M1.5 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
  </svg>
)
const AppsIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
)
const DocIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="13" height="13" rx="1.5" />
    <line x1="4" y1="5" x2="11" y2="5" strokeLinecap="round" />
    <line x1="4" y1="7.5" x2="11" y2="7.5" strokeLinecap="round" />
    <line x1="4" y1="10" x2="8" y2="10" strokeLinecap="round" />
  </svg>
)
const ChevronIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3.5 5.5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PAGE_LABELS: Record<string, string> = {
  '/apps': 'Apps',
  '/account': 'Account',
  '/docs': 'Docs',
  'dashboard': 'Dashboard',
  'features':  'Features',
  'alerts':    'Alerts',
  'settings':  'Settings',
}

function NavItem({
  to, label, Icon, badgeCount = 0, badgeColor = 'red', disabled = false,
}: {
  to: string; label: string; Icon: FC<{ className?: string }>
  badgeCount?: number; badgeColor?: 'red' | 'amber'; disabled?: boolean
}) {
  if (disabled) {
    return (
      <div
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-px text-slate-300 cursor-not-allowed font-medium"
        style={{ fontSize: 13.5 }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
      </div>
    )
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-px no-underline transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-600 font-semibold'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
        }`
      }
      style={{ fontSize: 13.5 }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {badgeCount > 0 && (
        <span
          className={`ml-auto font-bold rounded-full px-1.5 py-px ${
            badgeColor === 'red' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
          }`}
          style={{ fontSize: 10 }}
        >
          {badgeCount}
        </span>
      )}
    </NavLink>
  )
}

function AppSwitcher() {
  const nav = useNavigate()
  const { appId } = useParams<{ appId?: string }>()
  const { apps, activeApp, reloadApps } = useApp()
  const [open, setOpen]           = useState(false)
  const [showModal, setShowModal] = useState(false)

  function handleCreated(app: AppSummary) {
    setShowModal(false)
    reloadApps()
    nav(`/apps/${app.id}/dashboard`)
  }

  return (
    <div className="relative mb-2.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-400 transition-colors flex items-center justify-between"
        style={{ padding: '10px 12px' }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-slate-900 font-bold truncate" style={{ fontSize: 13 }}>
            {activeApp?.name ?? (appId ? 'Loading…' : 'Select App')}
          </div>
          <div className="font-mono text-slate-400 mt-0.5 truncate" style={{ fontSize: 11 }}>
            {activeApp?.packageName ?? ''}
          </div>
        </div>
        <ChevronIcon className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
            <div className="max-h-48 overflow-y-auto">
              {apps.length === 0 && (
                <p className="text-slate-400 text-center py-4" style={{ fontSize: 12 }}>No apps yet</p>
              )}
              {apps.map(app => (
                <button
                  key={app.id}
                  onClick={() => { setOpen(false); nav(`/apps/${app.id}/dashboard`) }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                    app.id === appId ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 font-semibold truncate" style={{ fontSize: 13 }}>{app.name}</div>
                    <div className="font-mono text-slate-400 truncate" style={{ fontSize: 11 }}>{app.packageName}</div>
                  </div>
                  {app.id === appId && <span className="text-indigo-600 text-xs">✓</span>}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100">
              <button
                onClick={() => { setOpen(false); setShowModal(true) }}
                className="w-full text-left px-3 py-2.5 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                style={{ fontSize: 13 }}
              >
                + New App
              </button>
            </div>
          </div>
        </>
      )}

      {showModal && <AppModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}

function Topbar({ lastSynced }: { lastSynced: Date | null }) {
  const location = useLocation()
  const { appId } = useParams<{ appId?: string }>()
  const { activeApp } = useApp()
  const { actions } = useTopbar()
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!lastSynced) return
    const id = setInterval(() => forceRender(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [lastSynced])

  function relativeTime(d: Date): string {
    const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
    if (mins < 1) return 'just now'
    if (mins === 1) return '1 min ago'
    return `${mins} min ago`
  }

  const segments = location.pathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1]
  const pageLabel = PAGE_LABELS[location.pathname] ?? PAGE_LABELS[lastSegment] ?? 'Detail'

  return (
    <div
      className="flex items-center bg-white border-b border-slate-200 flex-shrink-0 gap-3 px-7"
      style={{ height: 54 }}
    >
      {activeApp && (
        <>
          <span className="text-slate-400" style={{ fontSize: 13 }}>{activeApp.name}</span>
          <span className="text-slate-300" style={{ fontSize: 13 }}>/</span>
        </>
      )}
      <span className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{pageLabel}</span>
      <div className="ml-auto flex items-center gap-2.5">
        {lastSynced && (
          <div
            className="flex items-center gap-1.5 bg-green-100 text-green-600 font-medium rounded-full px-3 py-1"
            style={{ fontSize: 12 }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 animate-breathe" />
            Synced {relativeTime(lastSynced)}
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}

function Sidebar({ deadCount }: { deadCount: number }) {
  const nav = useNavigate()
  const { appId } = useParams<{ appId?: string }>()
  const email    = localStorage.getItem('fp_email') ?? ''
  const initials = email.slice(0, 2).toUpperCase() || 'FP'
  const hasApp   = !!appId

  return (
    <aside
      className="flex flex-col bg-white flex-shrink-0"
      style={{ width: 252, height: '100vh', borderRight: '1px solid #E2E8F0' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 border-b border-slate-100" style={{ paddingTop: 18, paddingBottom: 16 }}>
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ width: 32, height: 32, borderRadius: 9 }}
        >
          <img src="/icon.png" alt="FeaturePulse" style={{ width: 32, height: 32, objectFit: 'cover' }} />
        </div>
        <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>
          FeaturePulse
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="uppercase text-slate-400 font-bold px-2 mb-1" style={{ fontSize: 10, letterSpacing: '0.09em', marginTop: 4 }}>
          Analytics
        </p>
        <NavItem to={hasApp ? `/apps/${appId}/dashboard` : '#'} label="Dashboard" Icon={HomeIcon} disabled={!hasApp} />
        <NavItem to={hasApp ? `/apps/${appId}/features` : '#'}  label="Features"  Icon={GridIcon}  badgeCount={hasApp ? deadCount : 0} badgeColor="red" disabled={!hasApp} />
        <NavItem to={hasApp ? `/apps/${appId}/alerts` : '#'}    label="Alerts"    Icon={BellIcon}  disabled={!hasApp} />

        <div className="my-1" style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

        <p className="uppercase text-slate-400 font-bold px-2 mb-1 mt-3" style={{ fontSize: 10, letterSpacing: '0.09em' }}>
          App
        </p>
        <NavItem to={hasApp ? `/apps/${appId}/settings` : '#'} label="Settings" Icon={CogIcon} disabled={!hasApp} />

        <div className="my-1" style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

        <p className="uppercase text-slate-400 font-bold px-2 mb-1 mt-3" style={{ fontSize: 10, letterSpacing: '0.09em' }}>
          Global
        </p>
        <NavItem to="/apps"    label="Apps"    Icon={AppsIcon} />
        <NavItem to="/account" label="Account" Icon={PersonIcon} />
        <NavItem to="/docs"    label="Docs"    Icon={DocIcon} />
      </nav>

      {/* Footer — App Switcher + user info */}
      <div className="px-2.5 py-3 border-t border-slate-100">
        <AppSwitcher />
        <div className="flex items-center gap-2 px-0.5">
          <div
            className="flex-shrink-0 flex items-center justify-center bg-indigo-50 text-indigo-600 font-extrabold rounded-full"
            style={{ width: 28, height: 28, fontSize: 10 }}
          >
            {initials}
          </div>
          <span className="flex-1 text-slate-500 truncate" style={{ fontSize: 11.5 }}>{email}</span>
          <button
            onClick={() => { clearToken(); nav('/login') }}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            style={{ fontSize: 11, padding: '3px 7px' }}
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  )
}

function LayoutInner() {
  const { appId } = useParams<{ appId?: string }>()
  const [deadCount,  setDeadCount]  = useState(0)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  useEffect(() => {
    if (!appId) return
    api.getDashboard(appId)
      .then((d) => {
        setDeadCount((d.counts as Record<string, number>)['DEAD'] ?? 0)
        setLastSynced(new Date())
      })
      .catch(() => {})
  }, [appId])

  return (
    <div className="flex font-sans" style={{ height: '100vh', overflow: 'hidden', background: '#F8FAFC' }}>
      <Sidebar deadCount={deadCount} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar lastSynced={lastSynced} />
        <main className="flex-1 overflow-y-auto" style={{ padding: '26px 28px 40px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <TopbarProvider>
      <AppProvider>
        <LayoutInner />
      </AppProvider>
    </TopbarProvider>
  )
}
```

- [x] **Step 2: Verify TypeScript compiles**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -30
```

- [x] **Step 3: Commit**

```bash
git add portal/src/components/Layout.tsx
git commit -m "feat(portal): Layout — AppProvider, app switcher popover, three-group nav, optional appId"
```

---

## Task 9: Portal — Update data pages to use `useParams`

**Files:**
- Modify: `portal/src/pages/Dashboard.tsx`
- Modify: `portal/src/pages/Features.tsx`
- Modify: `portal/src/pages/Settings.tsx`

- [x] **Step 1: Update `Dashboard.tsx` — replace module-level `APP_ID` with `useParams`**

Remove line 13:
```typescript
const APP_ID = localStorage.getItem('fp_appId') ?? ''
```

Inside the `Dashboard` function, add at the top:
```typescript
const { appId = '' } = useParams<{ appId: string }>()
```

Add `useParams` to the import from `react-router-dom` (it already imports `useNavigate` and `Link`).

Also update line 224 (the sub-header that references localStorage):
```tsx
// Replace:
{localStorage.getItem('fp_appName') ?? 'My App'} · {APP_ID} · {counts['TOTAL'] ?? 0} features tracked
// With:
{counts['TOTAL'] ?? 0} features tracked
```

Replace every occurrence of `APP_ID` in the file with `appId`. There are occurrences in:
- The `useEffect` guard: `if (!APP_ID) { nav('/settings'); return }` → `if (!appId) { nav('/apps'); return }`
- `api.getDashboard(APP_ID)` → `api.getDashboard(appId)`
- `api.getFeatures(APP_ID, ...)` → `api.getFeatures(appId, ...)`
- `api.getTrend(APP_ID, 30)` → `api.getTrend(appId, 30)`
- The CSV export fetch URL: `apps/${APP_ID}/export` → `apps/${appId}/export`
- `api.getDashboard(APP_ID)` inside `runCron` → `api.getDashboard(appId)`
- `api.getTrend(APP_ID, 30)` inside `runCron` → `api.getTrend(appId, 30)`

Also add `appId` to the dependency arrays where missing:
```typescript
// Effect 1 depends on appId (add it to the dependency array)
useEffect(() => {
  if (!appId) { nav('/apps'); return }
  // ...
}, [nav, appId])
```

The `runCron` callback uses `appId` — since it's now from `useParams`, it's in scope as a closure variable and the `useCallback` dependency array should include it:
```typescript
const runCron = useCallback(async () => {
  // ...
}, [cronState, appId])
```

- [x] **Step 2: Update `Features.tsx` — replace module-level `APP_ID`**

Remove line 7:
```typescript
const APP_ID = localStorage.getItem('fp_appId') ?? ''
```

Inside the `Features` function, add at the top:
```typescript
const { appId = '' } = useParams<{ appId: string }>()
```

Add `useParams` to the import from `react-router-dom`.

Replace every occurrence of `APP_ID` with `appId`. Occurrences:
- `api.getFeatures(APP_ID, params)` → `api.getFeatures(appId, params)`
- The CSV export fetch URL → `apps/${appId}/export`

Update `useEffect(() => { load(1) }, [stateFilter])` to include `appId`:
```typescript
useEffect(() => { load(1) }, [stateFilter, appId])
```

- [x] **Step 3: Rewrite `Settings.tsx` — SDK config for the active app**

```tsx
import { useApp } from '../context/AppContext'

export default function Settings() {
  const { activeApp } = useApp()

  if (!activeApp) {
    return <p className="text-slate-400 p-8">Loading…</p>
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="text-slate-900 font-extrabold mb-1.5" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Settings
      </h1>
      <p className="text-slate-500 mb-7" style={{ fontSize: 13 }}>SDK integration config for {activeApp.name}.</p>

      {/* SDK snippet */}
      <div className="bg-white rounded-card border border-slate-200 p-6">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>SDK Integration</h2>
        <pre
          className="bg-slate-50 border border-slate-200 rounded-lg text-slate-700 overflow-x-auto font-mono"
          style={{ padding: 16, fontSize: 12.5, lineHeight: 1.6 }}
        >
{`// build.gradle.kts
implementation("com.github.featurepulse:sdk:1.0.0")

// Application.kt
FeaturePulse.init(this, PulseConfig.Builder()
    .setApiKey("${activeApp.apiKey}")
    .setAppId("${activeApp.id}")
    .build())`}
        </pre>
      </div>
    </div>
  )
}
```

- [x] **Step 4: Verify TypeScript**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -30
```

- [x] **Step 5: Commit**

```bash
git add portal/src/pages/Dashboard.tsx portal/src/pages/Features.tsx portal/src/pages/Settings.tsx
git commit -m "feat(portal): replace localStorage appId with useParams in Dashboard, Features, Settings"
```

---

## Task 10: Portal — Account page

**Files:**
- Modify: `portal/src/pages/Account.tsx`

- [x] **Step 1: Rewrite `portal/src/pages/Account.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api/client'

export default function Account() {
  const nav    = useNavigate()
  const email  = localStorage.getItem('fp_email') ?? ''

  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [pwSaved,    setPwSaved]    = useState(false)
  const [pwError,    setPwError]    = useState('')
  const [pwLoading,  setPwLoading]  = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting,      setDeleting]      = useState(false)
  const [delError,      setDelError]      = useState('')

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwLoading(true)
    try {
      await api.changePassword(currentPw, newPw)
      setPwSaved(true)
      setCurrentPw(''); setNewPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== email) return
    setDeleting(true)
    setDelError('')
    try {
      await api.deleteAccount()
      clearToken()
      nav('/login')
    } catch (err) {
      setDelError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="text-slate-900 font-extrabold mb-1.5" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Account
      </h1>
      <p className="text-slate-500 mb-7" style={{ fontSize: 13 }}>Manage your profile and account settings.</p>

      {/* Profile */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>Profile</h2>
        <div>
          <label className="block text-slate-500 font-semibold mb-1" style={{ fontSize: 12 }}>EMAIL</label>
          <p className="text-slate-900 font-mono" style={{ fontSize: 14 }}>{email}</p>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>Change Password</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
          <input
            type="password" placeholder="Current password" value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)} required
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          <input
            type="password" placeholder="New password (min 8 characters)" value={newPw}
            onChange={(e) => setNewPw(e.target.value)} required minLength={8}
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          {pwError && <p className="text-red-600" style={{ fontSize: 13 }}>{pwError}</p>}
          {pwSaved && <p className="text-green-600" style={{ fontSize: 13 }}>✓ Password updated</p>}
          <div>
            <button
              type="submit" disabled={pwLoading}
              className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              style={{ padding: '9px 20px', fontSize: 13 }}
            >
              {pwLoading ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-card border border-red-200 p-6">
        <h2 className="text-red-600 font-bold mb-2" style={{ fontSize: 14 }}>Danger Zone</h2>
        <p className="text-slate-500 mb-4" style={{ fontSize: 13 }}>
          Permanently delete your account, all your apps, and all their data. This cannot be undone.
        </p>
        <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>
          Type your email <span className="font-mono bg-slate-100 px-1 rounded">{email}</span> to confirm:
        </p>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder={email}
          className="w-full border border-red-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-3 transition-colors"
          style={{ padding: '10px 14px', fontSize: 14 }}
        />
        {delError && <p className="text-red-600 mb-2" style={{ fontSize: 13 }}>{delError}</p>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleteConfirm !== email || deleting}
          className="bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
          style={{ padding: '9px 20px', fontSize: 13 }}
        >
          {deleting ? 'Deleting…' : 'Delete My Account'}
        </button>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Verify TypeScript**

```bash
cd portal && npx tsc --noEmit 2>&1 | head -20
```

- [x] **Step 3: Commit**

```bash
git add portal/src/pages/Account.tsx
git commit -m "feat(portal): build out Account page — profile, password change, delete account danger zone"
```

---

## Task 11: Remove stale localStorage keys from remaining code

**Files:**
- Verify and clean up any remaining `localStorage.getItem('fp_appId')` / `fp_appName` / `fp_pkgName` / `fp_apiKey` references

- [x] **Step 1: Find all remaining stale localStorage references**

```bash
cd portal && grep -rn "fp_appId\|fp_appName\|fp_pkgName\|fp_apiKey" src/ 2>&1
```

- [x] **Step 2: Fix each occurrence**

For any remaining `localStorage.getItem('fp_appId')` in pages not yet updated, replace with `useParams()`. For any `localStorage.setItem('fp_appId', ...)` in Login or elsewhere, verify it's already been removed. If `fp_appName` appears in any page header, replace with `activeApp?.name` from `useApp()`.

- [x] **Step 3: Verify `clearToken` in `api/client.ts` no longer removes stale keys**

Confirm the updated `clearToken` function only removes `fp_token` and `fp_email` — already done in Task 4.

- [x] **Step 4: Final TypeScript check**

```bash
cd portal && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [x] **Step 5: Build check**

```bash
cd portal && npm run build 2>&1 | tail -15
```

Expected: build succeeds with no errors.

- [x] **Step 6: Run all server tests one final time**

```bash
cd server && npx jest --forceExit 2>&1 | tail -20
```

Expected: all tests pass.

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(multi-app): complete multi-app accounts — URL routing, Apps page, app switcher, account management"
```
