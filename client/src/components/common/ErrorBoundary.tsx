import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Catch and display React rendering errors with a retry button fallback
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let currentToasts: Toast[] = [];

// Notify all subscribed listeners of the current toast list
function notifyListeners() {
  toastListeners.forEach((fn) => fn([...currentToasts]));
}

// Global toast notification manager for showing success, error, info, and warning messages
export const toast = {
  show(type: Toast['type'], message: string, duration = 4000) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const t: Toast = { id, type, message, duration };
    currentToasts = [...currentToasts, t];
    notifyListeners();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  success(message: string, duration?: number) {
    return toast.show('success', message, duration);
  },
  error(message: string, duration?: number) {
    return toast.show('error', message, duration ?? 6000);
  },
  info(message: string, duration?: number) {
    return toast.show('info', message, duration);
  },
  warning(message: string, duration?: number) {
    return toast.show('warning', message, duration ?? 5000);
  },
  dismiss(id: string) {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    notifyListeners();
  },
  subscribe(fn: (toasts: Toast[]) => void) {
    toastListeners.push(fn);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== fn);
    };
  },
};

const typeStyles: Record<Toast['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-yellow-500 text-gray-900',
};

const typeIcons: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

// Render the fixed-position toast notification container in the bottom-right corner
export function ToastContainer() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    return toast.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${typeStyles[t.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in`}
        >
          <span className="font-bold text-sm">{typeIcons[t.type]}</span>
          <span className="text-sm flex-1">{t.message}</span>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-white/70 hover:text-white ml-2 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
