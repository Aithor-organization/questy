/**
 * TabSelector
 * 탭 선택 컴포넌트
 */

import { Sparkles, GraduationCap, Target } from 'lucide-react';
import type { TabType } from '../types';

interface TabSelectorProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabSelector({ activeTab, onTabChange }: TabSelectorProps) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4">
      <button
        onClick={() => onTabChange('appguide')}
        className={`flex-shrink-0 py-2.5 px-4 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
          activeTab === 'appguide'
            ? 'bg-amber-500 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          <Sparkles size={16} />
          <span>앱 사용법</span>
        </div>
      </button>
      <button
        onClick={() => onTabChange('instructors')}
        className={`flex-shrink-0 py-2.5 px-4 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
          activeTab === 'instructors'
            ? 'bg-blue-500 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          <GraduationCap size={16} />
          <span>강사 가이드</span>
        </div>
      </button>
      <button
        onClick={() => onTabChange('strategies')}
        className={`flex-shrink-0 py-2.5 px-4 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
          activeTab === 'strategies'
            ? 'bg-green-500 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          <Target size={16} />
          <span>학습 전략</span>
        </div>
      </button>
    </div>
  );
}
