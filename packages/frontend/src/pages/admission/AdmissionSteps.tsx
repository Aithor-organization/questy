/**
 * AdmissionSteps Component
 * 입학 상담 각 단계별 UI 컴포넌트
 */

import type {
  LevelTestQuestion,
  LevelTestResult,
  ClassOption,
} from './types';
import { GRADE_OPTIONS, SUBJECT_OPTIONS, ORIENTATION_STEPS } from './constants';

interface GradeSelectProps {
  onSelect: (grade: string) => void;
}

export function GradeSelect({ onSelect }: GradeSelectProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--pencil-gray)] mb-2">학년을 선택해주세요:</p>
      <div className="flex flex-wrap gap-2">
        {GRADE_OPTIONS.map(grade => (
          <button
            key={grade}
            onClick={() => onSelect(grade)}
            className="px-4 py-2 rounded-full bg-white border border-[var(--paper-lines)] hover:bg-[var(--highlight-yellow)] transition-colors"
          >
            {grade}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SubjectSelectProps {
  selectedSubjects: string[];
  onToggle: (subjectId: string) => void;
  onConfirm: () => void;
}

export function SubjectSelect({ selectedSubjects, onToggle, onConfirm }: SubjectSelectProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--pencil-gray)]">과목을 선택해주세요:</p>
      <div className="flex flex-wrap gap-2">
        {SUBJECT_OPTIONS.map(subject => (
          <button
            key={subject.id}
            onClick={() => onToggle(subject.id)}
            className={`px-4 py-2 rounded-full border transition-colors ${
              selectedSubjects.includes(subject.id)
                ? 'bg-[var(--highlight-yellow)] border-[var(--sticker-gold)]'
                : 'bg-white border-[var(--paper-lines)] hover:bg-gray-50'
            }`}
          >
            {subject.emoji} {subject.label}
          </button>
        ))}
      </div>
      {selectedSubjects.length > 0 && (
        <button
          onClick={onConfirm}
          className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          선택 완료 ({selectedSubjects.length}개)
        </button>
      )}
    </div>
  );
}

interface LevelTestButtonsProps {
  onStart: () => void;
  onSkip: () => void;
}

export function LevelTestButtons({ onStart, onSkip }: LevelTestButtonsProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onStart}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        📝 레벨 테스트 시작하기
      </button>
      <button
        onClick={onSkip}
        className="w-full py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors"
      >
        나중에 할게요
      </button>
    </div>
  );
}

interface LevelTestProps {
  questions: LevelTestQuestion[];
  currentIndex: number;
  onAnswer: (index: number) => void;
}

export function LevelTest({ questions, currentIndex, onAnswer }: LevelTestProps) {
  const question = questions[currentIndex];
  if (!question) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm text-[var(--pencil-gray)]">
        <span>문제 {currentIndex + 1} / {questions.length}</span>
        <span className="text-xs">
          {question.difficulty === 'EASY' ? '⭐' :
            question.difficulty === 'MEDIUM' ? '⭐⭐' : '⭐⭐⭐'}
        </span>
      </div>
      <div className="bg-white p-4 rounded-lg border border-[var(--paper-lines)]">
        <p className="font-medium text-[var(--ink-black)] mb-4">{question.question}</p>
        <div className="space-y-2">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => onAnswer(idx)}
              className="w-full py-3 px-4 text-left bg-[var(--paper-cream)] border border-[var(--paper-lines)] rounded-lg hover:bg-[var(--highlight-blue)] transition-colors"
            >
              {String.fromCharCode(65 + idx)}. {option}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full bg-[var(--paper-lines)] rounded-full h-2">
        <div
          className="bg-[var(--ink-blue)] h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface LevelTestResultViewProps {
  result: LevelTestResult;
  onContinue: () => void;
}

export function LevelTestResultView({ result, onContinue }: LevelTestResultViewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-[var(--paper-lines)] text-center">
        <div className="text-4xl mb-2">
          {result.level === 'ADVANCED' ? '🏆' :
            result.level === 'INTERMEDIATE' ? '🌟' : '💪'}
        </div>
        <h3 className="font-bold text-lg text-[var(--ink-black)]">
          {result.level === 'ADVANCED' ? '고급' :
            result.level === 'INTERMEDIATE' ? '중급' : '기초'} 레벨
        </h3>
        <p className="text-[var(--pencil-gray)] mt-1">{result.message}</p>
        <div className="mt-3 text-2xl font-bold text-[var(--ink-blue)]">
          {result.score}점
        </div>
      </div>
      <button
        onClick={onContinue}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        반 선택하러 가기 →
      </button>
    </div>
  );
}

interface ClassSelectProps {
  options: ClassOption[];
  levelTestResult: LevelTestResult | null;
  onSelect: (option: ClassOption) => void;
}

export function ClassSelect({ options, levelTestResult, onSelect }: ClassSelectProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--pencil-gray)] mb-2">나에게 맞는 반을 선택해주세요:</p>
      {options.map(option => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          className="w-full p-4 bg-white border border-[var(--paper-lines)] rounded-lg hover:border-[var(--ink-blue)] transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">
              {option.pace === 'SLOW' ? '🐢' : option.pace === 'MEDIUM' ? '🚶' : '🏃'}
            </span>
            <span className="font-bold text-[var(--ink-black)]">{option.name}</span>
            {levelTestResult && (
              (levelTestResult.level === 'BEGINNER' && option.pace === 'SLOW') ||
              (levelTestResult.level === 'INTERMEDIATE' && option.pace === 'MEDIUM') ||
              (levelTestResult.level === 'ADVANCED' && option.pace === 'FAST')
            ) && (
              <span className="text-xs bg-[var(--highlight-yellow)] px-2 py-0.5 rounded-full">추천</span>
            )}
          </div>
          <p className="text-sm text-[var(--pencil-gray)]">{option.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {option.features.map((feature, idx) => (
              <span key={idx} className="text-xs bg-[var(--paper-cream)] px-2 py-0.5 rounded-full">
                {feature}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

interface OrientationButtonsProps {
  onStart: () => void;
  onSkip: () => void;
}

export function OrientationButtons({ onStart, onSkip }: OrientationButtonsProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onStart}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        📖 사용법 배우기
      </button>
      <button
        onClick={onSkip}
        className="w-full py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors"
      >
        바로 시작하기
      </button>
    </div>
  );
}

interface OrientationViewProps {
  currentIndex: number;
  onNext: () => void;
}

export function OrientationView({ currentIndex, onNext }: OrientationViewProps) {
  const step = ORIENTATION_STEPS[currentIndex];
  if (!step) return null;

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg border border-[var(--paper-lines)] text-center">
        <div className="text-5xl mb-3">{step.icon}</div>
        <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">{step.title}</h3>
        <p className="text-[var(--pencil-gray)]">{step.description}</p>
      </div>
      <div className="flex gap-2 justify-center">
        {ORIENTATION_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === currentIndex ? 'bg-[var(--ink-blue)]' : 'bg-[var(--paper-lines)]'
            }`}
          />
        ))}
      </div>
      <button
        onClick={onNext}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {currentIndex < ORIENTATION_STEPS.length - 1 ? '다음 →' : '시작하기! 🚀'}
      </button>
    </div>
  );
}

interface CompletionButtonsProps {
  onGoToGenerate: () => void;
  onGoToChat: () => void;
}

export function CompletionButtons({ onGoToGenerate, onGoToChat }: CompletionButtonsProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onGoToGenerate}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        ✨ 첫 학습 플랜 만들기
      </button>
      <button
        onClick={onGoToChat}
        className="w-full py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        💬 코치와 대화하기
      </button>
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
}

export function TextInput({ value, onChange, onSubmit, placeholder, disabled }: TextInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 rounded-full border border-[var(--paper-lines)] focus:outline-none focus:border-[var(--ink-blue)]"
        autoFocus
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="px-6 py-3 bg-[var(--ink-blue)] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
      >
        전송
      </button>
    </form>
  );
}
