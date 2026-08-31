import { Link } from 'react-router-dom';
import { Home, RefreshCw, ArrowLeft, Search, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center shadow-lg shadow-primary-400/25 animate-pulse">
            <Search className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-dark-900 mb-2">404</h1>
          <h2 className="text-xl text-dark-600 mb-4">Page Not Found</h2>
          <p className="text-dark-500 mb-8">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>
        </div>

        <div className="space-y-3">
          <Link to="/dashboard" className="btn-primary w-full">
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Link>
          <button 
            onClick={() => window.history.back()}
            className="btn-outline w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-dark-200">
          <p className="text-sm text-dark-500 mb-4">Quick Navigation</p>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/dashboard" className="btn-ghost justify-start">
              <Compass className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
            <Link to="/users" className="btn-ghost justify-start">
              <Search className="w-4 h-4 mr-2" />
              Users
            </Link>
            <Link to="/withdrawals" className="btn-ghost justify-start">
              <Compass className="w-4 h-4 mr-2" />
              Withdrawals
            </Link>
            <Link to="/analytics" className="btn-ghost justify-start">
              <Compass className="w-4 h-4 mr-2" />
              Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
