import { isLoggedIn, clearToken } from '../api/client'

const CATEGORIES = [
  { name: 'E-Commerce',    color: '#6366F1', bg: '#EEF2FF', reason: 'Product pages accumulate UI over years. FeaturePulse shows which filters and widgets users actually tap.', examples: ['Product filters', 'Checkout steps', 'Recommendation widgets', 'Wish-list buttons', 'Size guides'] },
  { name: 'Social',        color: '#0EA5E9', bg: '#E0F2FE', reason: 'Social apps ship new engagement features every sprint. Dead ones create clutter that hurts retention.', examples: ['Reaction types', 'Share destinations', 'Story features', 'Privacy toggles', 'Profile badges'] },
  { name: 'Fintech',       color: '#10B981', bg: '#D1FAE5', reason: 'Regulatory requirements drive feature addition. FeaturePulse identifies which compliance screens users actually reach.', examples: ['Payment methods', 'Card management', 'Report types', 'Budget categories', 'Alert settings'] },
  { name: 'News & Media',  color: '#F59E0B', bg: '#FEF3C7', reason: 'Media apps push users toward algorithmic feeds. Manual category browsing often dies silently.', examples: ['Content categories', 'Playback controls', 'Sharing options', 'Bookmark types', 'Text size settings'] },
  { name: 'Entertainment', color: '#EC4899', bg: '#FCE7F3', reason: 'Games add seasonal content that overstays its welcome. Dead features waste memory and bloat APK size.', examples: ['Game modes', 'Achievement screens', 'Difficulty settings', 'Seasonal events', 'In-app purchase paths'] },
  { name: 'Productivity',  color: '#8B5CF6', bg: '#EDE9FE', reason: 'Productivity apps accumulate power-user features. FeaturePulse shows which advanced tools the average user ignores.', examples: ['Template types', 'Export formats', 'Advanced settings', 'Integration options', 'View modes'] },
]

export default function Landing() {
  const loggedIn = isLoggedIn()

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200" style={{ height: 56 }}>
        <div className="flex items-center justify-between h-full" style={{ padding: '0 32px' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 overflow-hidden" style={{ width: 30, height: 30, borderRadius: 8 }}>
              <img src="/icon.png" alt="FeaturePulse" style={{ width: 30, height: 30, objectFit: 'cover' }} />
            </div>
            <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>FeaturePulse</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/docs" className="text-slate-600 font-medium hover:text-slate-900 transition-colors no-underline" style={{ fontSize: 13 }}>
              Docs
            </a>
            {loggedIn ? (
              <>
                <a href="/apps" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 13 }}>
                  Go to Dashboard
                </a>
                <button
                  onClick={() => { clearToken(); window.location.href = '/' }}
                  className="text-slate-500 font-medium hover:text-slate-800 transition-colors"
                  style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-slate-600 font-medium hover:text-slate-900 transition-colors no-underline" style={{ fontSize: 13 }}>Sign In</a>
                <a href="/login?register=1" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 13 }}>
                  Register
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(135deg, #F8FAFF 0%, #EEF2FF 100%)', padding: '80px 24px 72px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div className="inline-flex items-center bg-indigo-50 text-indigo-600 font-semibold rounded-full px-3 py-1 mb-5" style={{ fontSize: 12 }}>
            Android SDK
          </div>
          <h1 className="text-slate-900 font-extrabold mb-5" style={{ fontSize: 44, lineHeight: 1.13, letterSpacing: '-1px' }}>
            Stop shipping features<br />nobody uses
          </h1>
          <p className="text-slate-500 mb-8 mx-auto" style={{ fontSize: 17, lineHeight: 1.65, maxWidth: 520 }}>
            FeaturePulse automatically tracks which UI elements your users interact with — and classifies each one as <strong>THRIVING</strong>, <strong>DECLINING</strong>, <strong>DORMANT</strong>, or <strong>DEAD</strong>. No manual tagging required.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="/docs" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-6 py-3 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 14 }}>
              View Documentation
            </a>
            {!loggedIn && (
              <a href="/login?register=1" className="inline-flex items-center bg-white text-slate-700 font-semibold rounded-lg px-6 py-3 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors no-underline" style={{ fontSize: 14 }}>
                Get Started Free
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="border-b border-t border-slate-100" style={{ padding: '56px 24px', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p className="text-center text-slate-400 font-bold uppercase mb-10" style={{ fontSize: 11, letterSpacing: '0.1em' }}>How it works</p>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { n: '01', title: 'Add the SDK', body: 'One Gradle dependency and two lines in AndroidManifest.xml. No Application subclass changes needed.' },
              { n: '02', title: 'Events flow in', body: 'Touch events are intercepted via Window.Callback proxy and batched every 30 minutes using WorkManager.' },
              { n: '03', title: 'See what\'s dead', body: 'Nightly classification scores every feature — THRIVING, DECLINING, DORMANT, or DEAD — visible on your dashboard.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="text-indigo-600 font-extrabold mb-3" style={{ fontSize: 11, letterSpacing: '0.08em' }}>{n}</div>
                <p className="text-slate-900 font-bold mb-2" style={{ fontSize: 15 }}>{title}</p>
                <p className="text-slate-500" style={{ fontSize: 13, lineHeight: 1.6 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Best-fit categories ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px 100px' }}>
        <p className="text-slate-400 font-bold uppercase mb-2 text-center" style={{ fontSize: 11, letterSpacing: '0.1em' }}>Best-fit apps</p>
        <h2 className="text-slate-900 font-extrabold text-center mb-10" style={{ fontSize: 26, letterSpacing: '-0.4px' }}>Most valuable for feature-rich apps</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {CATEGORIES.map(({ name, color, bg, reason, examples }) => (
            <div key={name} className="group relative bg-white rounded-xl border border-slate-200 p-5 overflow-hidden transition-shadow hover:shadow-md" style={{ cursor: 'default' }}>
              {/* Normal content — blurs behind the overlay on hover */}
              <div className="group-hover:blur-sm transition-all duration-500">
                <span className="rounded-full font-bold px-3 py-0.5 inline-block mb-3" style={{ background: bg, color, fontSize: 12 }}>{name}</span>
                <p className="text-slate-500" style={{ fontSize: 13, lineHeight: 1.6 }}>{reason}</p>
              </div>
              {/* Frosted overlay — light, fades in on hover */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-center p-5"
                style={{ background: 'rgba(248, 250, 252, 0.93)' }}
              >
                <span className="rounded-full font-bold px-3 py-0.5 inline-block mb-3 self-start" style={{ background: bg, color, fontSize: 12 }}>{name}</span>
                <p className="font-semibold uppercase mb-2 text-slate-400" style={{ fontSize: 10, letterSpacing: '0.08em' }}>Example features tracked</p>
                <div className="flex flex-wrap gap-1.5">
                  {examples.map(ex => (
                    <span key={ex} className="rounded-full px-2.5 py-0.5 font-medium" style={{ background: bg, color, fontSize: 11 }}>{ex}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a href="/docs" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-6 py-3 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 14 }}>
            Read the SDK Docs →
          </a>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-slate-50/95 backdrop-blur-sm" style={{ padding: '12px 32px' }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 overflow-hidden" style={{ width: 20, height: 20, borderRadius: 5 }}>
              <img src="/icon.png" alt="" style={{ width: 20, height: 20, objectFit: 'cover' }} />
            </div>
            <span className="text-slate-400 font-medium">FeaturePulse</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">Cellular Seminar Project</span>
          </div>
          <div className="flex gap-4">
            <a href="/privacy" className="text-slate-400 hover:text-slate-600 no-underline">Privacy Policy</a>
            <a href="/docs" className="text-slate-400 hover:text-slate-600 no-underline">Docs</a>
            {loggedIn ? (
              <button
                onClick={() => { clearToken(); window.location.href = '/' }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}
              >
                Sign Out
              </button>
            ) : (
              <a href="/login" className="text-slate-400 hover:text-slate-600 no-underline">Sign In</a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
