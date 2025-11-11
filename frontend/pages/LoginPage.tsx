import React, { useState } from 'react';
import { login, getCurrentUser } from '../services/authService';
import { TENANTS } from '../constants';
import { UserCircleIcon } from '../components/icons';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(TENANTS[0]?.id || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password, selectedTenant);

      if (!response.success || !response.data) {
        setError(response.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token and user info
      localStorage.setItem('jwtToken', response.data.token);
      localStorage.setItem('currentUser', JSON.stringify(response.data));

      console.log('✅ Login successful', {
        userId: response.data.user_id,
        role: response.data.role,
      });

      // Call success callback
      onLoginSuccess(response.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <UserCircleIcon className="h-8 w-8" />
            <h1 className="text-2xl font-bold">AgentHub</h1>
          </div>
          <p className="text-blue-100 text-sm mt-1">Multi-Tenant Chatbot Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <p className="font-semibold">Login Failed</p>
              <p>{error}</p>
            </div>
          )}

          {/* Tenant Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tenant
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              {TENANTS.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-lg text-center text-sm text-gray-600">
          <p>Use your company credentials to access the admin dashboard.</p>
          <p className="text-xs text-gray-500 mt-2">
            Supported roles: Admin, Staff, Tenant User
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
