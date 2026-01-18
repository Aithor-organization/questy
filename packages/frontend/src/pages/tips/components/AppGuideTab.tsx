/**
 * AppGuideTab
 * 앱 사용법 탭 컴포넌트
 */

import { appGuides } from '../constants';

export function AppGuideTab() {
  return (
    <div className="space-y-4">
      {/* 앱 소개 */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">📓</span>
          <span className="font-bold text-amber-800">Questy이란?</span>
        </div>
        <p className="text-sm text-gray-700">
          AI 학습 코치와 함께하는 스마트 학습 앱이에요.
          교재 목차만 찍으면 맞춤 학습 플랜을 만들어주고,
          매일 퀘스트 형태로 학습을 관리해줘요!
        </p>
      </div>

      {/* 가이드 카드들 */}
      {appGuides.map((guide) => (
        <div
          key={guide.id}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                {guide.icon}
              </div>
              <div>
                <div className="font-bold text-gray-800">{guide.title}</div>
                <div className="text-sm text-gray-500">{guide.description}</div>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <ul className="space-y-2">
                {guide.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}

      {/* 추가 팁 */}
      <div className="postit">
        <p className="handwrite text-lg mb-2">💡 더 알면 좋은 것들</p>
        <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
          <li>• 구글 계정으로 간편 로그인 가능해요</li>
          <li>• 데이터는 자동으로 저장되니 걱정 마세요</li>
          <li>• 힘들 때는 코치에게 솔직하게 말해도 돼요</li>
          <li>• 꿀팁 탭에서 강사 추천도 확인해보세요!</li>
        </ul>
      </div>
    </div>
  );
}
