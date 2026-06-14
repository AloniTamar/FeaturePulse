export default function Docs() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80 }}>
      <div className="bg-indigo-50 rounded-2xl flex items-center justify-center mb-5" style={{ width: 64, height: 64 }}>
        <svg width="28" height="28" viewBox="0 0 15 15" fill="none" stroke="#4F46E5" strokeWidth="1.4">
          <rect x="1" y="1" width="13" height="13" rx="1.5" />
          <line x1="4" y1="5" x2="11" y2="5" strokeLinecap="round" />
          <line x1="4" y1="7.5" x2="11" y2="7.5" strokeLinecap="round" />
          <line x1="4" y1="10" x2="8" y2="10" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-slate-900 font-extrabold mb-2" style={{ fontSize: 22 }}>Documentation</h1>
      <p className="text-slate-500" style={{ fontSize: 14 }}>Full SDK and API docs are coming soon.</p>
    </div>
  )
}
