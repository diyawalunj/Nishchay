import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
          <div className="bg-white rounded-[2.5rem] p-10 md:p-14 max-w-lg text-center shadow-2xl border border-gray-100">
            <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-8 text-red-500">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight mb-4">Something went wrong</h2>
            <p className="text-gray-500 font-medium mb-6 text-sm">An unexpected error occurred. Please try refreshing the page.</p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-red-50/70 border border-red-100 rounded-xl text-left">
                <p className="text-xs font-mono text-red-700 break-all leading-relaxed">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  // @ts-expect-error — React 19 types removed setState from Component; runtime is correct
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="w-full px-8 py-4 bg-[#1B4332] text-white rounded-2xl font-black tracking-widest text-xs uppercase shadow-lg shadow-[#1B4332]/20 hover:bg-[#2D6A4F] transition-all cursor-pointer"
              >
                RELOAD PAGE
              </button>

              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('nishchay_subject_notes');
                    localStorage.removeItem('nishchay_pyq_papers');
                  } catch {}
                  window.location.reload();
                }}
                className="w-full px-6 py-3 bg-gray-50 text-gray-500 hover:text-gray-800 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border border-gray-200 cursor-pointer"
              >
                Clear Corrupted Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
