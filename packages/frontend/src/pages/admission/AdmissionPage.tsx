/**
 * AdmissionPage
 * 입학 상담 페이지 - 확장된 온보딩 플로우
 * - 기본 정보 수집 (이름, 학년, 과목, 목표)
 * - 레벨 테스트 (FR-051)
 * - 반 배정 (FR-052)
 * - 오리엔테이션 (FR-053)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookLayout } from '../../components/notebook/NotebookLayout';
import { AdmissionChat } from './AdmissionChat';
import { useAdmission } from './useAdmission';
import {
  GradeSelect,
  SubjectSelect,
  LevelTestButtons,
  LevelTest,
  LevelTestResultView,
  ClassSelect,
  OrientationButtons,
  OrientationView,
  CompletionButtons,
  TextInput,
} from './AdmissionSteps';

export function AdmissionPage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');

  const {
    messages,
    step,
    studentInfo,
    isTyping,
    levelTestQuestions,
    currentQuestionIndex,
    levelTestResult,
    classOptions,
    orientationIndex,
    handleNameSubmit,
    handleGradeSelect,
    handleSubjectToggle,
    handleSubjectsConfirm,
    handleGoalSubmit,
    completeOnboarding,
    startLevelTest,
    skipLevelTest,
    handleLevelTestAnswer,
    fetchClassOptions,
    handleClassSelect,
    startOrientation,
    skipOrientation,
    handleOrientationNext,
  } = useAdmission();

  const handleTextSubmit = () => {
    if (!inputValue.trim()) return;

    const value = inputValue.trim();
    setInputValue('');

    if (step === 'name') {
      handleNameSubmit(value);
    } else if (step === 'goals') {
      const updatedInfo = handleGoalSubmit(value);
      setTimeout(() => {
        completeOnboarding(updatedInfo);
      }, 300);
    }
  };

  const getStepDescription = () => {
    if (step.includes('level-test')) return '📝 레벨 테스트';
    if (step.includes('class')) return '🏫 반 배정';
    if (step === 'orientation') return '📖 오리엔테이션';
    return 'AI 코치와 함께하는 첫 만남';
  };

  return (
    <NotebookLayout>
      <div className="notebook-page p-0 overflow-hidden" style={{ minHeight: '70vh' }}>
        {/* 채팅 헤더 */}
        <div className="bg-[var(--highlight-yellow)] px-4 py-3 border-b border-[var(--paper-lines)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
              🎓
            </div>
            <div>
              <h2 className="font-bold text-[var(--ink-black)]">입학 상담실</h2>
              <p className="text-xs text-[var(--pencil-gray)]">{getStepDescription()}</p>
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <AdmissionChat messages={messages} isTyping={isTyping} />

        {/* 입력 영역 */}
        <div className="border-t border-[var(--paper-lines)] p-4 bg-[var(--paper-cream)]">
          {step === 'grade' && (
            <GradeSelect onSelect={handleGradeSelect} />
          )}

          {step === 'subjects' && (
            <SubjectSelect
              selectedSubjects={studentInfo.subjects}
              onToggle={handleSubjectToggle}
              onConfirm={handleSubjectsConfirm}
            />
          )}

          {step === 'registered' && (
            <LevelTestButtons onStart={startLevelTest} onSkip={skipLevelTest} />
          )}

          {step === 'level-test' && levelTestQuestions.length > 0 && (
            <LevelTest
              questions={levelTestQuestions}
              currentIndex={currentQuestionIndex}
              onAnswer={handleLevelTestAnswer}
            />
          )}

          {step === 'level-test-result' && levelTestResult && (
            <LevelTestResultView result={levelTestResult} onContinue={fetchClassOptions} />
          )}

          {step === 'class-select' && classOptions.length > 0 && (
            <ClassSelect
              options={classOptions}
              levelTestResult={levelTestResult}
              onSelect={handleClassSelect}
            />
          )}

          {step === 'class-assigned' && (
            <OrientationButtons onStart={startOrientation} onSkip={skipOrientation} />
          )}

          {step === 'orientation' && (
            <OrientationView currentIndex={orientationIndex} onNext={handleOrientationNext} />
          )}

          {step === 'complete' && (
            <CompletionButtons
              onGoToGenerate={() => navigate('/generate')}
              onGoToChat={() => navigate('/chat')}
            />
          )}

          {(step === 'name' || step === 'goals') && (
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleTextSubmit}
              placeholder={step === 'name' ? '이름을 입력해주세요...' : '학습 목표를 입력해주세요...'}
            />
          )}
        </div>
      </div>
    </NotebookLayout>
  );
}
