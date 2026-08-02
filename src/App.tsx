import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './components/DashboardLayout'
import { LoginPage } from './pages/LoginPage'
import { WidgetPage } from './pages/WidgetPage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { OverviewPage } from './pages/OverviewPage'
import { LeadsListPage } from './pages/LeadsListPage'
import { LeadDetailPage } from './pages/LeadDetailPage'
import { BriefSharePage } from './pages/BriefSharePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/widget" element={<WidgetPage />} />
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
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}