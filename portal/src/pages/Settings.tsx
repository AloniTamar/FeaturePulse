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
          {`// build.gradle.kts\nimplementation("com.github.featurepulse:sdk:1.0.0")\n\n// Application.kt\nFeaturePulse.init(this, PulseConfig.Builder()\n    .setApiKey("${activeApp.apiKey}")\n    .setAppId("${activeApp.id}")\n    .build())`}
        </pre>
      </div>
    </div>
  )
}
