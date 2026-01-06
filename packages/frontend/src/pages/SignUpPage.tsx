/**
 * SignUpPage
 * 회원가입 페이지 - 노트북 스타일
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function SignUpPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setLocalError('비밀번호가 일치하지 않습니다');
      return;
    }

    // 비밀번호 길이 체크
    if (password.length < 6) {
      setLocalError('비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }

    const success = await register(email, password, name);
    if (success) {
      navigate('/');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen notebook-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 노트북 페이지 스타일 카드 */}
        <div className="notebook-page relative">
          {/* 스프링 홀 */}
          <div className="notebook-holes hidden sm:flex">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="notebook-hole" />
            ))}
          </div>

          <div className="p-8 pl-8 sm:pl-20">
            {/* 로고 영역 */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">📓</div>
              <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
                회원가입
              </h1>
              <p className="text-[var(--pencil-gray)] text-sm mt-1">
                QuestyBook과 함께 학습을 시작하세요
              </p>
            </div>

            {/* 구분선 */}
            <div className="border-b-2 border-dashed border-[var(--paper-lines)] mb-5" />

            {/* 회원가입 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink-black)] mb-1.5">
                  👤 이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink-black)] mb-1.5">
                  ✉️ 이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink-black)] mb-1.5">
                  🔒 비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="최소 6자 이상"
                  className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none transition-colors"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink-black)] mb-1.5">
                  🔒 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>

              {displayError && (
                <div className="bg-[var(--highlight-pink)] border border-[var(--ink-red)] rounded-lg p-3 text-[var(--ink-red)] text-sm">
                  ⚠️ {displayError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  isLoading
                    ? 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
                    : 'bg-[var(--sticker-mint)] text-[#064e3b] hover:opacity-90 active:scale-[0.98]'
                }`}
              >
                {isLoading ? '가입 중...' : '🎉 가입하기'}
              </button>
            </form>

            {/* 구분선 */}
            <div className="border-b-2 border-dashed border-[var(--paper-lines)] my-5" />

            {/* 로그인 링크 */}
            <div className="text-center">
              <span className="text-[var(--pencil-gray)] text-sm">
                이미 계정이 있으신가요?
              </span>
              <Link
                to="/login"
                className="ml-2 text-[var(--ink-blue)] font-medium hover:underline"
              >
                로그인 →
              </Link>
            </div>
          </div>
        </div>

        {/* 스티커 장식 */}
        <div className="flex justify-center gap-2 mt-4">
          <span className="sticker sticker-gold">🌟 새로운 시작!</span>
        </div>

        {/* 하단 메시지 */}
        <p className="text-center text-[var(--pencil-gray)] text-xs mt-6 handwrite">
          📚 함께 성장하는 학습 여정을 시작해요!
        </p>
      </div>
    </div>
  );
}
