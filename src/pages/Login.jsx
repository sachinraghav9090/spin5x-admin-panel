import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const isLocalhost = Boolean(
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );

  useEffect(() => {
    if (isLocalhost) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLocalhost, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawInput = email.trim();
    if (!rawInput || !password) {
      toast.error('Please fill in both username/email and password');
      return;
    }

    // Support both username (e.g. 'admin') and full email ('admin@spin5x.com')
    const emailToUse = rawInput.includes('@') ? rawInput : `${rawInput}@spin5x.com`;

    setLoading(true);
    try {
      await login(emailToUse, password);
      toast.success('Welcome back, Admin!');
      navigate('/dashboard');
    } catch (error) {
      const code = error.code || '';
      let msg = error.message || 'Login failed. Please try again.';
      if (code === 'auth/invalid-credential' || msg.includes('invalid-credential')) {
        msg = 'Invalid credentials. Default admin: admin@spin5x.com. Please check your password.';
      } else if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
        msg = 'No user found with this email. Please check your email or contact support.';
      } else if (code === 'auth/wrong-password' || msg.includes('wrong-password')) {
        msg = 'Incorrect password. Please verify and try again.';
      } else if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        msg = 'Too many failed login attempts. Please wait a minute and try again.';
      } else if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        msg = 'Netlify domain is not authorized. Please add this domain to Firebase Console > Authentication > Settings > Authorized domains.';
      }
      toast.error(msg, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-dark-900">Spin5X Admin</h1>
          <p className="text-dark-500 mt-1">Sign in to access the admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl shadow-xl shadow-dark-950/5 border border-dark-100">
          <div>
            <label htmlFor="email" className="label font-semibold text-dark-700">Email Address or Username</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10"
                placeholder="admin@spin5x.com or admin"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label font-semibold text-dark-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10 pr-10"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-lg font-semibold shadow-lg shadow-primary-500/20">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {isLocalhost && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-primary-500 bg-primary-50 text-primary-700 font-semibold text-sm hover:bg-primary-100 transition-colors flex items-center justify-center gap-2"
            >
              ⚡ Enter Admin Panel Directly (Localhost Mode)
            </button>
          )}
        </form>

        <div className="mt-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200/70 text-xs text-blue-900 flex flex-col gap-1.5 shadow-sm">
          <p className="font-semibold text-blue-950 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            Verified Admin Credentials:
          </p>
          <div className="flex items-center justify-between">
            <span className="text-blue-700">Username/Email:</span>
            <code className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 select-all font-bold">admin@spin5x.com</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-700">Password:</span>
            <code className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 select-all font-bold">Spin5X@Admin2026!</code>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-dark-500">
          <p>Only authorized admin accounts can access this panel.</p>
        </div>
      </div>
    </div>
  );
}
