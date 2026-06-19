import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './api/client'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Features from './pages/Features'
import FeatureDetail from './pages/FeatureDetail'
import Transitions from './pages/Transitions'
import Settings from './pages/Settings'
import Account from './pages/Account'
import Apps from './pages/Apps'
import Docs from './pages/Docs'
import Analytics from './pages/Analytics'

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
            <Route path="transitions"            element={<Transitions />} />
            <Route path="analytics"              element={<Analytics />} />
            <Route path="settings"               element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/apps" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
