export default function Alerts() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80 }}>
      <div className="bg-indigo-50 rounded-2xl flex items-center justify-center mb-5" style={{ width: 64, height: 64 }}>
        <svg width="28" height="28" viewBox="0 0 15 15" fill="none" stroke="#4F46E5" strokeWidth="1.4">
          <path d="M7.5 1.5A5 5 0 0 1 12.5 6.5c0 3-1.2 4.5-2.2 5.5h-5.6C3.7 11 2.5 9.5 2.5 6.5a5 5 0 0 1 5-5z" />
          <path d="M5.5 12v.5a2 2 0 0 0 4 0V12" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-slate-900 font-extrabold mb-2" style={{ fontSize: 22 }}>Alerts</h1>
      <p className="text-slate-500" style={{ fontSize: 14 }}>Webhook notifications are coming soon.</p>
    </div>
  )
}
