import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TreePine, Camera, History, Home, LogOut, Menu, X, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { to: '/',        icon: Home,    label: 'Home' },
  { to: '/capture', icon: Camera,  label: 'Capture' },
  { to: '/history', icon: History, label: 'History' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const location         = useLocation()
  const navigate         = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* ─── Desktop Navbar ─────────────────────────────────────── */}
      <nav className="hidden md:flex sticky top-0 z-40 items-center justify-between
                       px-6 py-3 shadow-lg"
           style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)' }}>
        <Link to="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="p-1.5 rounded-xl bg-white/20 group-hover:bg-white/30 transition-colors"
          >
            <TreePine className="w-5 h-5 text-white" />
          </motion.div>
          <span className="font-extrabold text-white tracking-tight text-lg">
            TreeMeasure <span className="opacity-70">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${location.pathname === to
                  ? 'bg-white/25 text-white shadow-sm'
                  : 'text-white/75 hover:text-white hover:bg-white/15'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border-2 border-white/40" />
              : <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <User className="w-4 h-4 text-white" />
                </div>
            }
            <span className="text-white font-medium truncate max-w-[140px]">
              {user.displayName || user.email}
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30
                       text-white text-sm font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </motion.button>
        </div>
      </nav>

      {/* ─── Mobile Top Bar ─────────────────────────────────────── */}
      <nav className="md:hidden sticky top-0 z-40 flex items-center justify-between
                       px-4 py-3 shadow-lg"
           style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)' }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-white/20">
            <TreePine className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-white text-base tracking-tight">TreeMeasure AI</span>
        </Link>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </nav>

      {/* ─── Mobile Bottom Nav ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40
                       bg-white/90 backdrop-blur-md border-t border-purple-100
                       flex items-center justify-around px-2 shadow-xl"
           style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {navLinks.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to
          return (
            <Link key={to} to={to}
              className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all"
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={`p-1.5 rounded-xl transition-all ${active ? 'bg-purple-100' : ''}`}
              >
                <Icon className={`w-5 h-5 transition-colors ${active ? 'text-purple-600 stroke-[2.5]' : 'text-gray-400'}`} />
              </motion.div>
              <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-purple-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* ─── Mobile Menu Drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-purple-100">
                <span className="font-extrabold text-gradient text-lg">TreeMeasure AI</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-xl bg-purple-50 text-purple-500 hover:bg-purple-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-2xl mb-6 border border-purple-100">
                {user.photoURL
                  ? <img src={user.photoURL} alt="avatar" className="w-10 h-10 rounded-full border-2 border-purple-200" />
                  : <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-purple-200"
                         style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                      <User className="w-5 h-5 text-white" />
                    </div>
                }
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{user.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>

              <div className="space-y-1">
                {navLinks.map(({ to, icon: Icon, label }) => (
                  <Link key={to} to={to}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all
                      ${location.pathname === to
                        ? 'text-purple-700 bg-purple-50 border border-purple-100'
                        : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'}`}
                  >
                    <Icon className="w-5 h-5" /> {label}
                  </Link>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleLogout}
                className="mt-8 w-full btn-danger justify-center gap-3"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
