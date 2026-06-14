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
