import type { FC } from 'react'

const PrivacyPolicy: FC = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">FeaturePulse Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: 2026-06-19</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">What data we collect</h2>
        <p className="text-slate-700 mb-4">
          The FeaturePulse SDK collects the following data from end-users of apps that integrate it:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-900">Data</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-900">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">UI interaction events</td>
                <td className="py-2 px-3 text-slate-700">Element type, screen name, event type (tap/impression), timestamp</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">Session ID</td>
                <td className="py-2 px-3 text-slate-700">Random UUID generated per app session — not linked to any user account</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">Device ID</td>
                <td className="py-2 px-3 text-slate-700">Random UUID generated on first SDK init — not a hardware identifier</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-slate-700">
          The FeaturePulse web portal collects: email address and password hash (bcrypt) for account authentication.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">What we do NOT collect</h2>
        <ul className="list-disc list-inside space-y-2 text-slate-700">
          <li>Real names, phone numbers, or government IDs</li>
          <li>Hardware device identifiers (IMEI, MAC address, advertising ID)</li>
          <li>Location data</li>
          <li>Photos, contacts, or files</li>
          <li>Any data about end-users' identities</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How data is used</h2>
        <p className="text-slate-700">
          Raw interaction events are used solely to compute aggregated UI health metrics (interaction rate, feature state). Raw events are automatically deleted after the configured retention period (default: 7 days). Aggregated statistics are retained until the app developer deletes their account.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Who we share data with</h2>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-900">Provider</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-900">Purpose</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-900">DPA</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">Railway</td>
                <td className="py-2 px-3 text-slate-700">Server hosting + PostgreSQL database</td>
                <td className="py-2 px-3 text-slate-700"><a href="https://railway.app/legal/privacy" className="text-indigo-600 hover:underline">railway.app/legal/privacy</a></td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">OpenRouter</td>
                <td className="py-2 px-3 text-slate-700">AI insights (only if enabled per-app)</td>
                <td className="py-2 px-3 text-slate-700"><a href="https://openrouter.ai/privacy" className="text-indigo-600 hover:underline">openrouter.ai/privacy</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Your rights</h2>
        <ul className="space-y-3 text-slate-700">
          <li>
            <strong className="text-slate-900">Right to erasure:</strong> Delete your account via the portal (Settings → Delete Account). This permanently deletes all apps, features, events, and aggregates.
          </li>
          <li>
            <strong className="text-slate-900">Data portability:</strong> Export your feature data as CSV from the portal Features page.
          </li>
          <li>
            <strong className="text-slate-900">Contact:</strong> <a href="mailto:tamaraloni11@gmail.com" className="text-indigo-600 hover:underline">tamaraloni11@gmail.com</a>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Jurisdiction</h2>
        <p className="text-slate-700">
          This policy is governed by the laws of Israel.
        </p>
      </section>
    </div>
  )
}

export default PrivacyPolicy
