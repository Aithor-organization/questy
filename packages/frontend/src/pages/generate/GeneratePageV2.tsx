/**
 * GeneratePageV2
 * 퀘스트 생성 페이지 - 노트북 스타일 + YES24 검색
 */

import { NotebookLayout, NotebookPage } from '../../components/notebook';
import { useGeneratePage } from './useGeneratePage';
import {
  InputModeSelector,
  UploadForm,
  SearchForm,
  ImageZoomModal,
  DaysSelector,
  GenerateButton,
  GenerateResult,
  PlanDetailModal,
} from './components';

export function GeneratePageV2() {
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
    setInputMode,
    setImages,
    setMaterialName,
    setTotalDays,
    setExcludeWeekends,
    setZoomedImage,
    setViewingPlan,
    handleBookSelect,
    togglePageSelection,
    handleAnalyzeBook,
    handleGenerate,
    handleSavePlan,
    handleReset,
  } = useGeneratePage();

  // 생성 가능 여부 체크
  const canGenerate = inputMode === 'upload'
    ? images.length > 0
    : selectedBook !== null && selectedPages.length > 0;

  // 생성 핸들러
  const onGenerate = inputMode === 'upload' ? handleGenerate : handleAnalyzeBook;

  return (
    <>
      <NotebookLayout>
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
              ) : (
                <SearchForm
                  selectedBook={selectedBook}
                  previewImages={previewImages}
                  selectedPages={selectedPages}
                  loadingPreview={loadingPreview}
                  onBookSelect={handleBookSelect}
                  onPageClick={setZoomedImage}
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
              ) : (
                <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                  <li>• Yes24에서 교재를 검색해요</li>
                  <li>• 미리보기에서 목차를 선택해요</li>
                  <li>• 최대 5페이지까지 선택 가능!</li>
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
      </NotebookLayout>

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
