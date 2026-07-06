import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import JournalPage from './pages/JournalPage'
import EnglishHubPage from './pages/EnglishHubPage'
import DsaTrackerPage from './pages/DsaTrackerPage'
import SkillsPage from './pages/SkillsPage'
import ProjectsPage from './pages/ProjectsPage'
import InterviewPrepPage from './pages/InterviewPrepPage'
import JobTrackerPage from './pages/JobTrackerPage'
import MentorPage from './pages/MentorPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import { ThemeProvider } from './theme/ThemeProvider'

function PrivateRoute({ children, requireAuth = true }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (requireAuth && !user) return <Navigate to="/login" replace />
  return children
}

function FullScreenLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13
    }}>
      LOADING…
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <AppLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="english" element={<PrivateRoute requireAuth={false}><EnglishHubPage /></PrivateRoute>} />
              <Route path="dsa" element={<DsaTrackerPage />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="interview" element={<InterviewPrepPage />} />
              <Route path="jobs" element={<JobTrackerPage />} />
              <Route path="mentor" element={<MentorPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
