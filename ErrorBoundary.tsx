import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
          <div className="bg-white rounded-[2.5rem] p-16 max-w-lg text-center shadow-2xl border border-gray-100">
            <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-8 text-red-500">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight mb-4">Something went wrong</h2>
            <p className="text-gray-500 font-medium mb-10">An unexpected error occurred. Please try refreshing the page.</p>
            <button
              onClick={() => {
                // @ts-expect-error — React 19 types removed setState from Component; runtime is correct
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-10 py-4 bg-[#1B4332] text-white rounded-2xl font-black tracking-widest text-xs uppercase shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all"
            >
              RELOAD PAGE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
