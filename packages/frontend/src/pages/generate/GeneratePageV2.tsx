/**
 * GeneratePageV2
 * 퀘스트 생성 페이지 - 탭 구조
 * - 탭 1: 새 플랜 (노트북 스타일 + YES24 검색)
 * - 탭 2: 커리큘럼 생성 (인강 기반)
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NotebookLayout, NotebookPage } from '../../components/notebook';
import { useGeneratePage } from './useGeneratePage';
import { useMembershipCheck } from '../../hooks/useMembershipCheck';
import { TrialEndedModal } from '../../components/TrialEndedModal';
import { ErrorBoundary, QuestGenerationErrorFallback } from '../../components/ErrorBoundary';
import {
  InputModeSelector,
  UploadForm,
  SearchForm,
  ManualForm,
  ImageZoomModal,
  DaysSelector,
  GenerateButton,
  GenerateResult,
  PlanDetailModal,
} from './components';
import { CurriculumContent } from './CurriculumContent';
import { CurriculumContentBeta } from './CurriculumContentBeta';

type TabType = 'plan' | 'curriculum' | 'beta';

export function GeneratePageV2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(
    tabFromUrl === 'curriculum' ? 'curriculum' : 'plan'
  );

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    if (tabFromUrl === 'curriculum') {
      setActiveTab('curriculum');
    } else if (tabFromUrl === 'beta') {
      setActiveTab('beta');
    } else {
      setActiveTab('plan');
    }
  }, [tabFromUrl]);

  // 탭 변경 핸들러
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'curriculum') {
      setSearchParams({ tab: 'curriculum' });
    } else if (tab === 'beta') {
      setSearchParams({ tab: 'beta' });
    } else {
      setSearchParams({});
    }
  };

  return (
    <NotebookLayout>
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTabChange('plan')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'plan'
              ? 'bg-[var(--ink-blue)] text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✨ 새 플랜
        </button>
        <button
          onClick={() => handleTabChange('curriculum')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'curriculum'
              ? 'bg-[var(--ink-blue)] text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📚 커리큘럼 생성
        </button>
        <button
          onClick={() => handleTabChange('beta')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'beta'
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🧪 Beta
        </button>
      </div>

      {/* 탭 콘텐츠 - ErrorBoundary로 감싸서 렌더링 에러 처리 */}
      <ErrorBoundary
        fallback={
          <QuestGenerationErrorFallback
            error="화면을 표시하는 중 오류가 발생했습니다."
            onReset={() => window.location.reload()}
          />
        }
        onError={(error, errorInfo) => {
          console.error('[GeneratePageV2] 렌더링 에러:', error);
          console.error('[GeneratePageV2] 컴포넌트 스택:', errorInfo.componentStack);
        }}
      >
        {activeTab === 'plan' ? (
          <NewPlanContent />
        ) : activeTab === 'curriculum' ? (
          <CurriculumContent />
        ) : (
          <CurriculumContentBeta />
        )}
      </ErrorBoundary>
    </NotebookLayout>
  );
}

// 새 플랜 탭 콘텐츠 (기존 GeneratePageV2 내용)
function NewPlanContent() {
  const {
    inputMode,
    images,
    materialName,
    totalDays,
    selectedDays,
    scheduleMode,
    step,
    selectedBook,
    previewImages,
    selectedPages,
    loadingPreview,
    zoomedImage,
    analyzingBook,
    viewingPlan,
    result,
    isLoading,
    error,
    manualUnits,
    isRepeatMode,
    repeatTargetDate,
    remainingGenerations,
    pendingPlanData,
    setInputMode,
    setImages,
    setMaterialName,
    setTotalDays,
    setSelectedDays,
    setScheduleMode,
    setZoomedImage,
    setViewingPlan,
    setManualUnits,
    setIsRepeatMode,
    setRepeatTargetDate,
    handleBookSelect,
    togglePageSelection,
    handleAnalyzeBook,
    handleGenerate,
    handleManualGenerate,
    handleSavePlan,
    handleReset,
    handleApplyPendingPlan,
    handleDismissPendingPlan,
  } = useGeneratePage();

  // 멤버십 체크 (AI 기능 사용 가능 여부)
  const {
    checkAndShowModal,
    showTrialEndedModal,
    attemptedFeature,
    closeModal,
  } = useMembershipCheck();

  // 생성 가능 여부 체크
  const canGenerate = inputMode === 'upload'
    ? images.length > 0
    : inputMode === 'search'
    ? selectedBook !== null && selectedPages.length > 0
    : manualUnits.length > 0 && materialName.trim().length > 0;

  // 생성 핸들러 (멤버십 체크 포함 - 직접 만들기 모드는 제외)
  const onGenerate = () => {
    // 직접 만들기 모드는 AI 기능을 사용하지 않으므로 멤버십 체크 없이 사용 가능
    if (inputMode === 'manual') {
      handleManualGenerate();
      return;
    }

    // AI 기능 사용 모드 (업로드, 검색)는 멤버십 체크
    if (!checkAndShowModal('AI 퀘스트 생성')) {
      return; // 모달이 표시되고 함수 종료
    }

    // 실제 생성 함수 호출
    if (inputMode === 'upload') {
      handleGenerate();
    } else if (inputMode === 'search') {
      handleAnalyzeBook();
    }
  };

  return (
    <>
      {step === 'upload' ? (
        <>
          {/* 업로드 폼 */}
          <NotebookPage title="✨ 새 퀘스트 만들기" decoration="holes">
            {/* 입력 모드 탭 */}
            <InputModeSelector mode={inputMode} onChange={setInputMode} />

            {inputMode === 'upload' ? (
              <UploadForm
                materialName={materialName}
                onMaterialNameChange={setMaterialName}
                images={images}
                onImagesChange={setImages}
              />
            ) : inputMode === 'search' ? (
              <SearchForm
                selectedBook={selectedBook}
                previewImages={previewImages}
                selectedPages={selectedPages}
                loadingPreview={loadingPreview}
                onBookSelect={handleBookSelect}
                onPageClick={setZoomedImage}
              />
            ) : (
              <ManualForm
                materialName={materialName}
                onMaterialNameChange={setMaterialName}
                units={manualUnits}
                onUnitsChange={setManualUnits}
                isRepeatMode={isRepeatMode}
                onRepeatModeChange={setIsRepeatMode}
                repeatTargetDate={repeatTargetDate}
                onRepeatTargetDateChange={setRepeatTargetDate}
              />
            )}

            {/* 요일 선택 및 일정 설정 */}
            <DaysSelector
              totalDays={totalDays}
              selectedDays={selectedDays}
              scheduleMode={scheduleMode}
              onTotalDaysChange={setTotalDays}
              onSelectedDaysChange={setSelectedDays}
              onScheduleModeChange={setScheduleMode}
              hideScheduleMode={inputMode === 'manual'}
            />

            {/* 에러 표시 - 재시도 버튼 포함 */}
            {error && (
              <div className="mb-4 p-4 bg-[var(--highlight-pink)] border border-pink-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--ink-black)] font-medium mb-1">
                      오류가 발생했습니다
                    </p>
                    <p className="text-xs text-[var(--pencil-gray)] mb-3">
                      {error}
                    </p>
                    <button
                      onClick={onGenerate}
                      disabled={!canGenerate || isLoading || analyzingBook}
                      className="px-4 py-2 bg-[var(--ink-blue)] text-white rounded-lg text-xs font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🔄 다시 시도
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 남은 생성 횟수 표시 (직접 만들기 모드에서는 숨김) */}
            {inputMode !== 'manual' && (
              <div className={`text-center text-sm mb-3 ${
                remainingGenerations === 0 ? 'text-red-500 font-medium' : 'text-gray-500'
              }`}>
                {remainingGenerations === 0 ? (
                  '🚫 오늘의 플랜 생성 횟수를 모두 사용했습니다'
                ) : (
                  `✨ 오늘 남은 생성 횟수: ${remainingGenerations}회`
                )}
              </div>
            )}

            {/* 생성 버튼 (직접 만들기 모드는 생성 횟수 제한 없음) */}
            <GenerateButton
              canGenerate={canGenerate && (inputMode === 'manual' || remainingGenerations > 0)}
              isLoading={isLoading || analyzingBook}
              onGenerate={onGenerate}
            />
          </NotebookPage>

          {/* 안내 포스트잇 */}
          <div className="postit mt-6 mx-auto max-w-xs">
            <p className="handwrite text-lg mb-2">💡 Tip</p>
            {inputMode === 'upload' ? (
              <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                <li>• 목차 전체가 보이게 촬영해요</li>
                <li>• 여러 페이지면 모두 올려도 OK!</li>
                <li>• AI가 자동으로 분석해요</li>
              </ul>
            ) : inputMode === 'search' ? (
              <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                <li>• Yes24에서 교재를 검색해요</li>
                <li>• 미리보기에서 목차를 선택해요</li>
                <li>• 최대 5페이지까지 선택 가능!</li>
              </ul>
            ) : (
              <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                <li>• 플랜 이름과 퀘스트를 입력해요</li>
                <li>• 드래그로 순서를 조정해요</li>
                <li>• 선택한 요일에 순차 배치돼요!</li>
              </ul>
            )}
          </div>

          {/* 미적용 플랜 카드 */}
          {pendingPlanData && (
            <div className="mt-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                    📋 적용하지 않은 플랜이 있어요
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    <span className="font-medium">{pendingPlanData.result.materialName}</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    ⏱️ {pendingPlanData.timeRemaining} 후 자동 삭제됩니다
                  </p>
                </div>
                <button
                  onClick={handleDismissPendingPlan}
                  className="text-amber-500 hover:text-amber-700 p-1"
                  title="삭제"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyPendingPlan}
                  className="flex-1 py-2 px-4 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  플랜 보기
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 결과 화면 */}
          {result && (
            <GenerateResult
              result={result}
              onViewPlan={setViewingPlan}
              onReset={handleReset}
            />
          )}
        </>
      )}

      {/* 이미지 확대 모달 */}
      {zoomedImage && (
        <ImageZoomModal
          image={zoomedImage}
          allImages={previewImages}
          selectedPages={selectedPages}
          onClose={() => setZoomedImage(null)}
          onToggleSelection={togglePageSelection}
          onNavigate={setZoomedImage}
        />
      )}

      {/* 플랜 상세 보기 모달 */}
      {viewingPlan && (
        <PlanDetailModal
          plan={viewingPlan}
          onClose={() => setViewingPlan(null)}
          onSave={handleSavePlan}
          selectedDays={selectedDays}
        />
      )}

      {/* 체험판 종료 모달 */}
      <TrialEndedModal
        isOpen={showTrialEndedModal}
        onClose={closeModal}
        featureName={attemptedFeature ?? undefined}
      />
    </>
  );
}
