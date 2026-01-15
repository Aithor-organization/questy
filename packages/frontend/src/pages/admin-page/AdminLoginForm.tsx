/**
 * Admin Page - Login Form Component
 * 관리자 로그인 폼
 */

import { useState } from 'react';
import { Lock, Mail, AlertCircle, X, Loader2 } from 'lucide-react';

interface AdminLoginFormProps {
  login: (email: string, password: string) => Promise<boolean>;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

export function AdminLoginForm({
  login,
  authLoading,
  authError,
  clearAuthError,
}: AdminLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !password.trim()) {
      setLocalError('이메일과 비밀번호를 입력해주세요');
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError('올바른 이메일 형식을 입력해주세요');
      return;
    }

    await login(email.trim(), password);
  };

  const error = localError || authError;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">관리자 로그인</h1>
          <p className="text-gray-500 text-sm mt-2">관리자 계정으로 로그인하세요</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button onClick={() => { setLocalError(null); clearAuthError(); }} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {authLoading && <Loader2 size={20} className="animate-spin" />}
            관리자 로그인
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          관리자 권한이 있는 계정만 로그인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
