"use client";

import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
      <h1 className="text-xl font-display text-gold mb-4">Something went wrong</h1>
      <p className="text-white/60 text-sm mb-6 text-center max-w-sm">
        {message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="px-6 py-3 bg-gold text-black font-medium rounded-lg"
      >
        Try again
      </button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
}
