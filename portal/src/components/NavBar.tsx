// portal/src/components/NavBar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/features',  label: 'Features'  },
  { to: '/alerts',    label: 'Alerts'    },
  { to: '/settings',  label: 'Settings'  },
]

export default function NavBar() {
  const nav = useNavigate()
  function logout() { clearToken(); nav('/login') }

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 32px', height: 56, borderBottom: '1px solid #E2E8F0',
      background: '#fff', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <span style={{ fontWeight: 800, fontSize: 17, color: '#4F46E5', marginRight: 24 }}>FeaturePulse</span>
      {LINKS.map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          padding: '6px 14px', borderRadius: 6, textDecoration: 'none', fontSize: 14,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? '#4F46E5' : '#475569',
          background: isActive ? '#EEF2FF' : 'transparent',
        })}>
          {label}
        </NavLink>
      ))}
      <button onClick={logout} style={{
        marginLeft: 'auto', padding: '6px 14px', border: '1px solid #E2E8F0',
        borderRadius: 6, cursor: 'pointer', fontSize: 14, background: '#fff', color: '#475569',
      }}>
        Logout
      </button>
    </nav>
  )
}
