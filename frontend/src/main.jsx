import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#166534',
              color: '#dcfce7',
              borderRadius: '12px',
              border: '1px solid #15803d',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#4ade80', secondary: '#052e16' } },
            error: {
              style: { background: '#7f1d1d', color: '#fecaca', border: '1px solid #991b1b' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
