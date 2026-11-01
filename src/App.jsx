import React from 'react';
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import Withdrawals from './pages/Withdrawals.jsx';
import Tasks from './pages/Tasks.jsx';
import Quizzes from './pages/Quizzes.jsx';
import Surveys from './pages/Surveys.jsx';
import Settings from './pages/Settings.jsx';
import Chat from './pages/Chat.jsx';
import Analytics from './pages/Analytics.jsx';
import AdConfig from './pages/AdConfig.jsx';
import Broadcasts from './pages/Broadcasts.jsx';
import NotFound from './pages/NotFound.jsx';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-dark-50 p-4">
          <div className="max-w-md text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold text-dark-900 mb-2">Something went wrong</h2>
            <p className="text-dark-500 mb-4">The admin panel encountered an error.</p>
            <details className="text-left bg-dark-100 p-4 rounded-lg text-sm text-dark-600">
              <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
              <pre className="whitespace-pre-wrap text-xs overflow-auto">{this.state.error?.toString()}</pre>
              {this.state.errorInfo && (
                <pre className="whitespace-pre-wrap text-xs overflow-auto mt-2">{this.state.errorInfo.componentStack}</pre>
              )}
            </details>
            <button onClick={() => window.location.reload()} className="mt-4 btn-primary">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivateRoute({ children }) {
  const { user, initialized } = useAuthStore();
  const isLocalhost = Boolean(
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );

  if (isLocalhost) {
    return <>{children}</>;
  }

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <div className="animate-pulse-slow text-center">
          <svg className="w-12 h-12 text-primary-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-dark-500">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-dark-50">
      <ErrorBoundary>
        {!initialized ? (
          <div className="min-h-screen flex items-center justify-center bg-dark-50">
            <div className="animate-pulse-slow text-center">
              <svg className="w-12 h-12 text-primary-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-dark-500">Loading admin panel...</p>
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/withdrawals" element={<Withdrawals />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/quizzes" element={<Quizzes />} />
              <Route path="/surveys" element={<Surveys />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/ad-config" element={<AdConfig />} />
              <Route path="/broadcasts" element={<Broadcasts />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </ErrorBoundary>
    </div>
  );
}

export default App;