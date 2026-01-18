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

type TabType = 'plan' | 'curriculum';

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
    } else {
      setActiveTab('plan');
    }
  }, [tabFromUrl]);

  // 탭 변경 핸들러
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'curriculum') {
      setSearchParams({ tab: 'curriculum' });
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
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'plan' ? (
        <NewPlanContent />
      ) : (
        <CurriculumContent />
      )}
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
    excludeWeekends,
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
    setInputMode,
    setImages,
    setMaterialName,
    setTotalDays,
    setExcludeWeekends,
    setZoomedImage,
    setViewingPlan,
    setManualUnits,
    handleBookSelect,
    togglePageSelection,
    handleAnalyzeBook,
    handleGenerate,
    handleManualGenerate,
    handleSavePlan,
    handleReset,
  } = useGeneratePage();

  // 생성 가능 여부 체크
  const canGenerate = inputMode === 'upload'
    ? images.length > 0
    : inputMode === 'search'
    ? selectedBook !== null && selectedPages.length > 0
    : manualUnits.length > 0 && materialName.trim().length > 0;

  // 생성 핸들러
  const onGenerate = inputMode === 'upload'
    ? handleGenerate
    : inputMode === 'search'
    ? handleAnalyzeBook
    : handleManualGenerate;

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
              />
            )}

            {/* 목표 일수 */}
            <DaysSelector
              totalDays={totalDays}
              excludeWeekends={excludeWeekends}
              onTotalDaysChange={setTotalDays}
              onExcludeWeekendsChange={setExcludeWeekends}
            />

            {/* 에러 */}
            {error && (
              <div className="postit text-sm text-[var(--ink-red)] mb-4">
                ⚠️ {error}
              </div>
            )}

            {/* 생성 버튼 */}
            <GenerateButton
              canGenerate={canGenerate}
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
                <li>• 플랜 이름과 단원을 입력해요</li>
                <li>• 단원별 예상 시간을 설정해요</li>
                <li>• 순서는 드래그로 조정 가능!</li>
              </ul>
            )}
          </div>
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
        />
      )}
    </>
  );
}
