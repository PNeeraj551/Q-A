import { useEffect, useState } from 'react'

export function Toast({ message, type = 'error', onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 200)
    }, 3500)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  if (!message) return null

  const styles = {
    error: 'bg-destructive/10 border-destructive/20 text-destructive',
    success: 'bg-primary/10 border-primary/20 text-primary',
    info: 'bg-card border-border text-foreground',
  }

  const icons = {
    error: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
      </svg>
    ),
    success: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
      </svg>
    ),
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium max-w-sm transition-all duration-200 ${styles[type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {icons[type]}
      <span>{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 200) }}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
