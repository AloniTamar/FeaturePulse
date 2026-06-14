export default function Account() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80 }}>
      <div className="bg-indigo-50 rounded-2xl flex items-center justify-center mb-5" style={{ width: 64, height: 64 }}>
        <svg width="28" height="28" viewBox="0 0 15 15" fill="none" stroke="#4F46E5" strokeWidth="1.4">
          <circle cx="7.5" cy="4" r="2.5" />
          <path d="M1.5 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-slate-900 font-extrabold mb-2" style={{ fontSize: 22 }}>Account</h1>
      <p className="text-slate-500" style={{ fontSize: 14 }}>Account management is coming soon.</p>
    </div>
  )
}
