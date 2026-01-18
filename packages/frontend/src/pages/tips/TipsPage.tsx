/**
 * TipsPage - 학습 꿀팁 페이지
 * 인강 강사 선택 가이드 + 학습 전략 팁
 */

import { Lightbulb } from 'lucide-react';
import { NotebookLayout } from '../../components/notebook';
import { useTipsPage } from './hooks/useTipsPage';
import {
  TabSelector,
  AppGuideTab,
  InstructorsTab,
  StrategiesTab,
} from './components';

export function TipsPage() {
  const {
    activeTab, expandedInstructor, expandedTip, selectedSubject, selectedCategory,
    filteredInstructors, filteredTips, selectedSubjectTips,
    setActiveTab, setSelectedSubject, setSelectedCategory, toggleInstructor, toggleTip,
  } = useTipsPage();

  return (
    <NotebookLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full mb-3">
            <Lightbulb size={20} />
            <span className="font-medium">수험생 필독 꿀팁</span>
          </div>
          <p className="text-gray-600 text-sm">
            상위권 도약에 성공한 케이스들의 검증된 방법론
          </p>
        </div>

        {/* 탭 선택 */}
        <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 앱 사용법 탭 */}
        {activeTab === 'appguide' && <AppGuideTab />}

        {/* 인강 강사 가이드 탭 */}
        {activeTab === 'instructors' && (
          <InstructorsTab
            selectedSubject={selectedSubject}
            instructors={filteredInstructors}
            subjectTips={selectedSubjectTips}
            expandedId={expandedInstructor}
            onSubjectChange={setSelectedSubject}
            onToggle={toggleInstructor}
          />
        )}

        {/* 학습 전략 탭 */}
        {activeTab === 'strategies' && (
          <StrategiesTab
            selectedCategory={selectedCategory}
            tips={filteredTips}
            expandedId={expandedTip}
            onCategoryChange={setSelectedCategory}
            onToggle={toggleTip}
          />
        )}
      </div>
    </NotebookLayout>
  );
}

export default TipsPage;
