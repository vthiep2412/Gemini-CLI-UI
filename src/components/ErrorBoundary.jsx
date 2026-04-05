import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }
  }

  renderErrorDetails() {
    const { error } = this.state;
    if (process.env.NODE_ENV !== 'development' || !error) return null;

    const isErrorObject = error instanceof Error || (typeof error === 'object' && error !== null && 'message' in error);
    const displayName = isErrorObject ? (error.name || 'Error') : `<${typeof error}>`;
    const displayMessage = isErrorObject ? error.message : String(error);
    const stack = isErrorObject ? error.stack : null;

    return (
      <div className="mt-6 text-left">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md p-3 overflow-hidden">
          <p className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">
            {displayName}: {displayMessage}
          </p>
          {stack && (
            <pre className="text-xs text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre font-mono max-h-60 opacity-80 mt-2">
              {stack}
            </pre>
          )}
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                Oops! Something went wrong
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                An unexpected error occurred. Please refresh the page to try again.
              </p>
              
              {this.renderErrorDetails()}

              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                title="Refresh Page"
              >
                Refresh Page
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