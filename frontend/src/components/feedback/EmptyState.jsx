import { Button } from '@/components/ui/button'

const ChatIcon = (
  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

// action: { label, onClick, primary?: boolean }
// primary=true renders a Button; default renders a text link
export function EmptyState({ icon = ChatIcon, heading, description, action, className = 'min-h-[60vh]' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <p className="text-base font-bold text-slate-900">{heading}</p>
      {description && <p className="text-sm text-slate-500 mt-1.5">{description}</p>}
      {action && (
        action.primary ? (
          <Button className="mt-5" onClick={action.onClick}>{action.label}</Button>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
