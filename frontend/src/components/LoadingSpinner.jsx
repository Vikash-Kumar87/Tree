import React from 'react'
import { TreePine } from 'lucide-react'

export default function LoadingSpinner({ fullscreen = false, label = 'Loading…' }) {
  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-4 border-forest-800 border-t-forest-400 animate-spin" />
        <TreePine className="absolute inset-0 m-auto w-6 h-6 text-forest-400" />
      </div>
      <p className="text-sm text-forest-400 font-medium animate-pulse-slow">{label}</p>
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/80 backdrop-blur-sm">
        {content}
      </div>
    )
  }

  return <div className="flex items-center justify-center py-12">{content}</div>
}
