import { Component, type ReactNode } from 'react';

// Catches render errors in a dashboard view so one broken view cannot
// whitescreen the whole app. The fallback names the demo build honestly
// and offers the two sensible recoveries: another view, or a reload.
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="view">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>This view hit an error</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
              The demo build could not render this view. Your other views are unaffected — pick one
              from the sidebar, or reload the page to try again.
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
