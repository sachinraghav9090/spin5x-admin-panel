import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 p-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-primary-600 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-dark-900 mb-2">Page Not Found</h2>
        <p className="text-dark-500 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
