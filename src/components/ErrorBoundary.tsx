import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Illustration } from './icons'

interface State {
  failed: boolean
}

/** Last line of defence: a render error shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry backend in this prototype; keep the details for the console only.
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="screen-center">
        <div className="notice">
          <Illustration kind="error" />
          <h1>Something went wrong</h1>
          <p>The console hit an unexpected error. Your data is safe.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
