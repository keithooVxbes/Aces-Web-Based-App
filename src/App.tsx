import { Suspense, lazy } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { MainLayout } from "./components/layout"
import { AssignmentProvider } from "./lib/assignment-store"
import { ScheduleProvider } from "./lib/schedule-store"
import { ProfileProvider } from "./lib/profile-store"
import { NotesProvider } from "./lib/notes-store"
import { CashflowProvider } from "./lib/cashflow-store"
import { Skeleton } from "./components/ui/skeleton"
import { AuthProvider, useAuth } from "./lib/auth-provider"

const DashboardPage = lazy(() => import("./pages/dashboard"))
const AssignmentsPage = lazy(() => import("./pages/assignments"))
const SchedulePage = lazy(() => import("./pages/schedule"))
const SettingsPage = lazy(() => import("./pages/settings"))
const NotesPage = lazy(() => import("./pages/notes"))
const CashflowPage = lazy(() => import("./pages/cashflow"))
const LoginPage = lazy(() => import("./pages/login"))
const RegisterPage = lazy(() => import("./pages/register"))

import "./App.css"

function PageFallback() {
  return (
    <div className="flex min-h-[24rem] flex-col gap-6 motion-stagger" aria-label="Loading page" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return <div className="min-h-screen bg-background grid place-items-center"><PageFallback /></div>
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProfileProvider>
          <NotesProvider>
            <AssignmentProvider>
              <ScheduleProvider>
                <CashflowProvider>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      {/* Public Auth Routes */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      
                      {/* Protected Workspace Routes */}
                      <Route
                        path="/*"
                        element={
                          <ProtectedRoute>
                            <MainLayout>
                              <Routes>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/cashflow" element={<CashflowPage />} />
                                <Route path="/assignments" element={<AssignmentsPage />} />
                                <Route path="/schedule" element={<SchedulePage />} />
                                <Route path="/notes" element={<NotesPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                              </Routes>
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Suspense>
                </CashflowProvider>
              </ScheduleProvider>
            </AssignmentProvider>
          </NotesProvider>
        </ProfileProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
