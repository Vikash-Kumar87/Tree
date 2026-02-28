import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Navbar from './components/Navbar.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'

// Lazy load pages for code splitting
const Home        = lazy(() => import('./pages/Home.jsx'))
const Capture     = lazy(() => import('./pages/Capture.jsx'))
const Results     = lazy(() => import('./pages/Results.jsx'))
const History     = lazy(() => import('./pages/History.jsx'))
const Login       = lazy(() => import('./pages/Login.jsx'))

/** Route guard for authenticated pages */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner fullscreen />
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <div className="min-h-screen bg-app-gradient">
      <Navbar />
      <main className="pb-20 md:pb-6">
        <Suspense fallback={<LoadingSpinner fullscreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <PrivateRoute><Home /></PrivateRoute>
            } />
            <Route path="/capture" element={<Capture />} />
            <Route path="/results/preview" element={<Results />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/history" element={
              <PrivateRoute><History /></PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
