'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginStaff, registerStaff } from '@/actions/authActions';
import OfficialSairamLogo from '@/components/OfficialSairamLogo';

export default function LoginClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Sign In State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  // Sign Up State
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setSignInLoading(true);

    try {
      const res = await loginStaff({ username, password });
      if (res.success) {
        window.location.href = '/dashboard';
      } else {
        setSignInError(res.message || 'Invalid credentials');
        setSignInLoading(false);
      }
    } catch {
      setSignInError('An unexpected error occurred. Please try again.');
      setSignInLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');
    setSignUpSuccess('');

    if (regPassword !== regConfirmPassword) {
      setSignUpError('Passwords do not match.');
      return;
    }

    setSignUpLoading(true);

    try {
      const res = await registerStaff({
        name: regName,
        username: regUsername,
        email: regEmail,
        password: regPassword,
      });

      if (res.success) {
        setSignUpSuccess('Account registered successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 1000);
      } else {
        setSignUpError(res.message || 'Failed to register account');
        setSignUpLoading(false);
      }
    } catch {
      setSignUpError('An unexpected error occurred during registration.');
      setSignUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Official College Logo & Subtitle */}
        <div className="flex flex-col items-center justify-center text-center">
          <OfficialSairamLogo className="mb-3" />
          <div className="bg-indigo-900 text-white text-xs font-semibold tracking-wider px-4 py-1.5 rounded-full shadow-xs">
            INCUBATION CENTRE · FOOD MANAGEMENT SYSTEM
          </div>
        </div>

        {/* Tab Toggle: Sign In / Sign Up */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex gap-1 mb-4">
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setSignInError(''); }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setSignUpError(''); }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account (Sign Up)
          </button>
        </div>

        {/* Card Body */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          {activeTab === 'signin' ? (
            /* Sign In Form */
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Staff Portal Sign In</h2>
                <p className="text-xs text-slate-500 mt-0.5">Access staff controls and food token system</p>
              </div>

              {signInError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
                  {signInError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={signInLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer mt-1"
              >
                {signInLoading ? 'Authenticating...' : 'Sign In to Portal'}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Default Credentials: <span className="font-mono font-medium text-slate-700">staff / Sairam@123</span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <a
                  href="/mobile-scan"
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  <span>📱</span>
                  <span>Open Mobile QR Scanner (No Login Required)</span>
                </a>
              </div>
            </form>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">New Staff Registration</h2>
                <p className="text-xs text-slate-500 mt-0.5">Register a new staff user for token management</p>
              </div>

              {signUpError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
                  {signUpError}
                </div>
              )}

              {signUpSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-medium">
                  {signUpSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Dr. A. Kumar"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="e.g. akumar"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. akumar@sairam.edu.in"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={signUpLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {signUpLoading ? 'Registering Account...' : 'Create Staff Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
