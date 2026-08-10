import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './components/DashboardLayout'
import { LoginPage } from './pages/LoginPage'
import { FloatingWidget } from './pages/FloatingWidget'
import { StandaloneWidget } from './pages/StandaloneWidget'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { OverviewPage } from './pages/OverviewPage'
import { LeadsListPage } from './pages/LeadsListPage'
import { LeadDetailPage } from './pages/LeadDetailPage'
import { BriefSharePage } from './pages/BriefSharePage'
import { EmbedPage } from './pages/EmbedPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          {/* /widget = floating bubble, for iframe embed on customer sites */}
          <Route path="/widget" element={<FloatingWidget />} />
          {/* /chat = full-page standalone, for direct link visits */}
          <Route path="/chat" element={<StandaloneWidget />} />
          <Route path="/brief/:token" element={<BriefSharePage />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="leads" element={<LeadsListPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route path="knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="embed" element={<EmbedPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}