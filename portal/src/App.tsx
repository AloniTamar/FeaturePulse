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
import Landing from './pages/Landing'
import LandingDocs from './pages/LandingDocs'
import Analytics from './pages/Analytics'
import PrivacyPolicy from './pages/PrivacyPolicy'

function AuthLayout() {
  return isLoggedIn() ? <Layout /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no login required */}
        <Route path="/" element={<Landing />} />
        <Route path="/docs" element={<LandingDocs />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Protected routes */}
        <Route element={<AuthLayout />}>
          <Route path="/apps" element={<Apps />} />
          <Route path="/account" element={<Account />} />
          <Route path="/apps/:appId">
            <Route path="dashboard"           element={<Dashboard />} />
            <Route path="features"            element={<Features />} />
            <Route path="features/:featureId" element={<FeatureDetail />} />
            <Route path="transitions"         element={<Transitions />} />
            <Route path="analytics"           element={<Analytics />} />
            <Route path="settings"            element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
