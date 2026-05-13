import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-base font-bold text-slate-900">Something went wrong</p>
          <p className="text-sm text-slate-500">An unexpected error occurred. Please reload the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 h-10 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
