# Curriculum RAG Agent Integration Plan
> QuestyBook 프로젝트에 커리큘럼 에이전트 통합 계획서 (v2 - 데이터 통합)

---

## 📋 개요

### 목적
curriculum-rag-agent를 questyBook 프론트엔드에 통합하여, 사용자가 인강 강좌를 선택하고 과목별 비중에 맞춰 일일 퀘스트를 자동 생성할 수 있도록 한다.

### 핵심 변경점 (v2)
> ⚠️ **데이터 통합 방식**: curriculum에서 생성한 퀘스트를 **기존 questStore 형식으로 변환**하여 저장
> - 별도의 curriculumStore 불필요 (생성 과정 임시 상태만 관리)
> - TodayPage에서 교재 + 인강 퀘스트 **함께 표시**
> - 기존 questStore 구조 최대한 활용

### 핵심 기능
1. **강좌 검색**: RAG 기반 인강 강좌 검색 (강사, 과목, 목차)
2. **퀘스트 생성**: 과목별 비중에 따른 일일 퀘스트 자동 생성
3. **questStore 통합**: 생성된 퀘스트를 기존 플랜 형식으로 변환하여 저장
4. **스케줄 재조정**: 미완료 퀘스트 자동 재조정

### 기술 스택
| 레이어 | 기술 |
|--------|------|
| Frontend | React + Vite + TypeScript |
| State | Zustand (기존 questStore 활용) |
| API | TanStack Query (React Query) |
| Backend | Hono.js + Bun |
| Agent | Python (curriculum-rag-agent) |
| UI | 기존 NotebookLayout 컴포넌트 활용 |

---

## 🏗️ 아키텍처 (데이터 통합)

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend                               │
│                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     │
│  │CurriculumPage│     │  TodayPage  │     │ PlannerPage │     │
│  │ (생성 전용) │     │ (통합 표시) │     │ (통합 표시) │     │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     │
│         │                   │                   │             │
│         │    ┌──────────────┴───────────────────┘             │
│         │    │                                                │
│         │    ▼                                                │
│  ┌──────▼────────────────────────────────────────────────┐   │
│  │                 questStore (Zustand)                   │   │
│  │  plans: [                                              │   │
│  │    { materialName: "수학의 정석", ... },  // 교재      │   │
│  │    { materialName: "인강: 현우진 수학1", ... } // 인강 │   │
│  │  ]                                                     │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │         useCurriculumGeneration (Hook)                 │   │
│  │  - 임시 상태: selectedCourses, subjectRatio           │   │
│  │  - searchCourses(), generateQuests()                   │   │
│  │  - convertToQuestPlan() → questStore.addPlan()         │   │
│  └─────────────────────────┬─────────────────────────────┘   │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTP API
┌────────────────────────────▼─────────────────────────────────┐
│                        Backend (Hono.js)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 /api/curriculum routes                   │ │
│  │  POST /search-courses   - 강좌 검색                      │ │
│  │  POST /generate-quests  - 퀘스트 생성                    │ │
│  │  POST /reschedule       - 스케줄 재조정                   │ │
│  └─────────────────────────┬───────────────────────────────┘ │
│                            │ Child Process                    │
│  ┌─────────────────────────▼───────────────────────────────┐ │
│  │             curriculum-rag-agent (Python)                │ │
│  │  - RAGHandler: Pinecone 벡터 검색                        │ │
│  │  - QuestManager: 퀘스트 생성 + 과목별 분배               │ │
│  │  - ScheduleOptimizer: 스케줄 재조정                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 데이터 흐름 (통합)

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 흐름                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CurriculumPage 진입                                      │
│         │                                                    │
│         ▼                                                    │
│  2. 설정 입력 (목표일, 순공시간, 과목비중)                   │
│         │                                                    │
│         ▼                                                    │
│  3. 강좌 검색 & 선택                                         │
│         │                                                    │
│         ▼                                                    │
│  4. "퀘스트 생성" 클릭 → Python Agent 호출                   │
│         │                                                    │
│         ▼                                                    │
│  5. 생성된 퀘스트 미리보기                                   │
│         │                                                    │
│         ▼                                                    │
│  6. "플래너에 추가" 클릭                                     │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  convertToQuestPlan() 실행                            │   │
│  │  - curriculum 퀘스트 → questStore 형식 변환           │   │
│  │  - questStore.addPlan() 호출                          │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  7. 플래너 페이지로 이동 (또는 TodayPage)                    │
│         │                                                    │
│         ▼                                                    │
│  8. TodayPage에서 교재 + 인강 퀘스트 함께 표시 ✅           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 파일 구조 (간소화)

### 추가될 파일

```
questyBook/
├── packages/
│   ├── curriculum-agent/           # ✅ 복사 완료
│   │   └── ... (기존 Python 코드)
│   │
│   ├── backend/src/
│   │   └── routes/
│   │       └── curriculum.ts       # 🆕 생성 필요
│   │
│   └── frontend/src/
│       ├── hooks/
│       │   └── useCurriculumGeneration.ts  # 🆕 생성 (임시상태 + 변환 로직)
│       ├── pages/
│       │   └── CurriculumPage.tsx  # 🆕 생성 (3단계 UI)
│       └── types/
│           └── curriculum.ts       # 🆕 타입 정의
│
└── docs/
    └── CURRICULUM_AGENT_INTEGRATION_PLAN.md  # ✅ 현재 파일
```

> ⚠️ **curriculumStore 불필요** - Hook 내부에서 useState로 임시 상태 관리

---

## 📝 상세 구현 계획

### 1. 타입 정의 (`types/curriculum.ts`)

```typescript
// packages/frontend/src/types/curriculum.ts

// Python Agent에서 반환하는 강좌 정보
export interface Course {
  id: string;
  courseName: string;
  lecturer: string;
  subject: string;
  chapters: Array<{
    title: string;
    sections: string[];
  }>;
}

// 과목별 비중
export interface SubjectRatio {
  국어: number;
  영어: number;
  수학: number;
  한국사: number;
  탐구: number;
}

// Python Agent에서 반환하는 퀘스트
export interface CurriculumQuest {
  id: string;
  title: string;
  description: string;
  questType: 'lecture' | 'problem_set' | 'review' | 'mock_exam' | 'concept';
  subject: string;
  courseId: string;
  courseName: string;
  lecturer: string;
  chapter: string;
  section: string | null;
  scheduledDate: string;
  estimatedMinutes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// 퀘스트 생성 요청
export interface GenerateQuestsRequest {
  selectedCourseIds: string[];
  targetDate: string;
  dailyStudyHours: number;
  subjectRatio: SubjectRatio;
}

// 퀘스트 생성 응답
export interface GenerateQuestsResponse {
  quests: CurriculumQuest[];
  summary: {
    totalQuests: number;
    totalDays: number;
    averageMinutesPerDay: number;
    subjectDistribution: Record<string, number>;
  };
}
```

### 2. Backend Route (`curriculum.ts`)

```typescript
// packages/backend/src/routes/curriculum.ts
import { Hono } from 'hono';
import { spawn } from 'child_process';
import path from 'path';

export const curriculumRoutes = new Hono();

// Python 에이전트 호출 헬퍼
async function callPythonAgent(action: string, params: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const agentDir = path.resolve(__dirname, '../../../curriculum-agent');
    const agentScript = path.join(agentDir, 'main.py');

    const proc = spawn(pythonPath, [
      agentScript,
      '--action', action,
      '--params', JSON.stringify(params)
    ], {
      cwd: agentDir,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve({ raw: stdout });
        }
      } else {
        console.error('[curriculum] Python error:', stderr);
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error('[curriculum] Spawn error:', err);
      reject(err);
    });
  });
}

// 1. 강좌 검색 API
curriculumRoutes.post('/search-courses', async (c) => {
  try {
    const body = await c.req.json();
    const { query, subject, limit = 20 } = body;

    const result = await callPythonAgent('search_courses', {
      query: query || '',
      subject,
      limit
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[curriculum] search-courses error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. 퀘스트 생성 API
curriculumRoutes.post('/generate-quests', async (c) => {
  try {
    const body = await c.req.json();
    const {
      selectedCourseIds,
      targetDate,
      dailyStudyHours,
      subjectRatio
    } = body;

    // 입력 검증
    if (!selectedCourseIds?.length) {
      return c.json({ success: false, error: '강좌를 선택해주세요' }, 400);
    }
    if (!targetDate) {
      return c.json({ success: false, error: '목표일을 설정해주세요' }, 400);
    }

    const result = await callPythonAgent('generate_quests', {
      course_ids: selectedCourseIds,
      target_date: targetDate,
      daily_study_hours: dailyStudyHours || 6,
      subject_ratio: subjectRatio || {
        국어: 20, 영어: 25, 수학: 35, 한국사: 5, 탐구: 15
      }
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[curriculum] generate-quests error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. 스케줄 재조정 API
curriculumRoutes.post('/reschedule', async (c) => {
  try {
    const body = await c.req.json();
    const {
      questIds,
      targetDate,
      dailyStudyHours,
      strategy = 'smart'
    } = body;

    const result = await callPythonAgent('reschedule_quests', {
      quest_ids: questIds,
      target_date: targetDate,
      daily_study_hours: dailyStudyHours,
      strategy
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[curriculum] reschedule error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});
```

### 3. API Hook (`useCurriculumGeneration.ts`) - 핵심!

```typescript
// packages/frontend/src/hooks/useCurriculumGeneration.ts
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useQuestStore, type QuestPlan } from '../stores/questStore';
import { API_BASE_URL } from '../config';
import type {
  Course,
  SubjectRatio,
  CurriculumQuest,
  GenerateQuestsResponse
} from '../types/curriculum';

const DEFAULT_SUBJECT_RATIO: SubjectRatio = {
  국어: 20,
  영어: 25,
  수학: 35,
  한국사: 5,
  탐구: 15,
};

export function useCurriculumGeneration() {
  const navigate = useNavigate();
  const addPlan = useQuestStore((state) => state.addPlan);

  // 임시 상태 (Hook 내부에서 관리)
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [subjectRatio, setSubjectRatio] = useState<SubjectRatio>(DEFAULT_SUBJECT_RATIO);
  const [targetDate, setTargetDate] = useState<string>('');
  const [dailyStudyHours, setDailyStudyHours] = useState<number>(6);
  const [generatedQuests, setGeneratedQuests] = useState<CurriculumQuest[]>([]);
  const [questSummary, setQuestSummary] = useState<GenerateQuestsResponse['summary'] | null>(null);

  // 강좌 검색
  const searchMutation = useMutation({
    mutationFn: async (params: { query?: string; subject?: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/curriculum/search-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('강좌 검색 실패');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.courses as Course[];
    },
    onSuccess: (courses) => setSearchResults(courses),
  });

  // 퀘스트 생성
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/curriculum/generate-quests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCourseIds: selectedCourses.map(c => c.id),
          targetDate,
          dailyStudyHours,
          subjectRatio,
        }),
      });
      if (!res.ok) throw new Error('퀘스트 생성 실패');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as GenerateQuestsResponse;
    },
    onSuccess: (data) => {
      setGeneratedQuests(data.quests);
      setQuestSummary(data.summary);
    },
  });

  // 강좌 선택/해제
  const selectCourse = useCallback((course: Course) => {
    setSelectedCourses(prev => {
      if (prev.find(c => c.id === course.id)) return prev;
      return [...prev, course];
    });
  }, []);

  const deselectCourse = useCallback((courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId));
  }, []);

  // ⭐ 핵심: curriculum 퀘스트 → questStore 형식 변환
  const convertToQuestPlan = useCallback((): Omit<QuestPlan, 'id' | 'createdAt'> => {
    // 강좌 이름 조합
    const courseNames = selectedCourses.map(c => c.courseName).join(', ');
    const lecturers = [...new Set(selectedCourses.map(c => c.lecturer))].join(', ');

    // 날짜별로 그룹화하여 day 번호 계산
    const dateSet = [...new Set(generatedQuests.map(q => q.scheduledDate))].sort();
    const dateToDay = new Map(dateSet.map((date, idx) => [date, idx + 1]));

    // questStore의 DailyQuest 형식으로 변환
    const dailyQuests = generatedQuests.map((quest, idx) => ({
      day: dateToDay.get(quest.scheduledDate) || idx + 1,
      date: quest.scheduledDate,
      unitNumber: idx + 1,
      unitTitle: quest.title,
      range: quest.section || quest.chapter,
      estimatedMinutes: quest.estimatedMinutes,
      completed: false,
      // 인강 전용 확장 필드
      topics: [quest.chapter, quest.section].filter(Boolean) as string[],
      objectives: [quest.description],
      studyTips: {
        importance: quest.priority === 'high' ? '중요도 높음' : '일반',
        keyPoints: [`${quest.subject} - ${quest.chapter}`],
        studyMethod: quest.questType === 'lecture' ? '인강 시청' :
                     quest.questType === 'review' ? '복습' : '문제 풀이',
      },
      // 메타데이터 (UI에서 인강/교재 구분용)
      _meta: {
        source: 'curriculum' as const,
        questType: quest.questType,
        subject: quest.subject,
        courseId: quest.courseId,
        courseName: quest.courseName,
        lecturer: quest.lecturer,
      },
    }));

    return {
      materialName: `📚 인강: ${courseNames}`,
      dailyQuests,
      summary: {
        totalDays: dateSet.length,
        totalUnits: generatedQuests.length,
        averageMinutesPerDay: questSummary?.averageMinutesPerDay ||
          Math.round(generatedQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0) / dateSet.length),
        totalEstimatedHours: Math.round(
          generatedQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0) / 60
        ),
      },
      aiMessage: `${lecturers} 선생님의 강좌를 기반으로 ${dateSet.length}일간의 학습 계획이 생성되었습니다.`,
    };
  }, [selectedCourses, generatedQuests, questSummary]);

  // ⭐ 플래너에 추가 (questStore로 변환 후 저장)
  const addToPlannerAndNavigate = useCallback(() => {
    const plan = convertToQuestPlan();
    addPlan(plan);

    // 상태 초기화
    setSelectedCourses([]);
    setGeneratedQuests([]);
    setQuestSummary(null);

    // 플래너 페이지로 이동
    navigate('/planner');
  }, [convertToQuestPlan, addPlan, navigate]);

  // 초기화
  const reset = useCallback(() => {
    setSearchResults([]);
    setSelectedCourses([]);
    setSubjectRatio(DEFAULT_SUBJECT_RATIO);
    setTargetDate('');
    setDailyStudyHours(6);
    setGeneratedQuests([]);
    setQuestSummary(null);
  }, []);

  return {
    // 상태
    searchResults,
    selectedCourses,
    subjectRatio,
    targetDate,
    dailyStudyHours,
    generatedQuests,
    questSummary,

    // 상태 변경
    setSubjectRatio,
    setTargetDate,
    setDailyStudyHours,
    selectCourse,
    deselectCourse,

    // 액션
    searchCourses: searchMutation.mutate,
    generateQuests: generateMutation.mutate,
    addToPlannerAndNavigate,
    reset,

    // 로딩 상태
    isSearching: searchMutation.isPending,
    isGenerating: generateMutation.isPending,
    searchError: searchMutation.error,
    generateError: generateMutation.error,
  };
}
```

### 4. Page Component (`CurriculumPage.tsx`)

```tsx
// packages/frontend/src/pages/CurriculumPage.tsx
import { useState } from 'react';
import { NotebookLayout } from '../components/notebook/NotebookLayout';
import { NotebookPage } from '../components/notebook/NotebookPage';
import { useCurriculumGeneration } from '../hooks/useCurriculumGeneration';
import type { SubjectRatio } from '../types/curriculum';

type Step = 'settings' | 'courses' | 'preview';

export function CurriculumPage() {
  const [step, setStep] = useState<Step>('settings');
  const {
    // 상태
    searchResults,
    selectedCourses,
    subjectRatio,
    targetDate,
    dailyStudyHours,
    generatedQuests,
    questSummary,
    // 상태 변경
    setSubjectRatio,
    setTargetDate,
    setDailyStudyHours,
    selectCourse,
    deselectCourse,
    // 액션
    searchCourses,
    generateQuests,
    addToPlannerAndNavigate,
    // 로딩
    isSearching,
    isGenerating,
  } = useCurriculumGeneration();

  return (
    <NotebookLayout>
      <NotebookPage>
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
            📚 인강 커리큘럼 생성
          </h1>
          <p className="text-sm text-[var(--pencil-gray)] mt-1">
            인강 강좌를 선택하고 과목별 비중에 맞춰 일일 퀘스트를 생성합니다
          </p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex justify-center gap-2 mb-6">
          <StepIndicator step={1} current={step} target="settings" label="설정" />
          <div className="text-gray-300">→</div>
          <StepIndicator step={2} current={step} target="courses" label="강좌선택" />
          <div className="text-gray-300">→</div>
          <StepIndicator step={3} current={step} target="preview" label="확인" />
        </div>

        {/* Step 1: 설정 */}
        {step === 'settings' && (
          <SettingsStep
            targetDate={targetDate}
            dailyStudyHours={dailyStudyHours}
            subjectRatio={subjectRatio}
            onTargetDateChange={setTargetDate}
            onDailyHoursChange={setDailyStudyHours}
            onSubjectRatioChange={setSubjectRatio}
            onNext={() => setStep('courses')}
          />
        )}

        {/* Step 2: 강좌 선택 */}
        {step === 'courses' && (
          <CourseSelectionStep
            searchResults={searchResults}
            selectedCourses={selectedCourses}
            isSearching={isSearching}
            onSearch={(query) => searchCourses({ query })}
            onSelect={selectCourse}
            onDeselect={deselectCourse}
            onBack={() => setStep('settings')}
            onNext={() => {
              generateQuests();
              setStep('preview');
            }}
          />
        )}

        {/* Step 3: 프리뷰 & 확인 */}
        {step === 'preview' && (
          <PreviewStep
            quests={generatedQuests}
            summary={questSummary}
            isLoading={isGenerating}
            onBack={() => setStep('courses')}
            onConfirm={addToPlannerAndNavigate}
          />
        )}
      </NotebookPage>
    </NotebookLayout>
  );
}

// ===== 서브 컴포넌트 =====

function StepIndicator({
  step,
  current,
  target,
  label
}: {
  step: number;
  current: Step;
  target: Step;
  label: string;
}) {
  const isActive = current === target;
  const isPast =
    (target === 'settings') ||
    (target === 'courses' && current === 'preview');

  return (
    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[var(--ink-blue)] text-white'
        : isPast
          ? 'bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
          : 'bg-gray-100 text-gray-400'
    }`}>
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
        {step}
      </span>
      <span>{label}</span>
    </div>
  );
}

function SettingsStep(props: {
  targetDate: string;
  dailyStudyHours: number;
  subjectRatio: SubjectRatio;
  onTargetDateChange: (date: string) => void;
  onDailyHoursChange: (hours: number) => void;
  onSubjectRatioChange: (ratio: SubjectRatio) => void;
  onNext: () => void;
}) {
  const totalRatio = Object.values(props.subjectRatio).reduce((a, b) => a + b, 0);
  const isValidRatio = totalRatio === 100;

  return (
    <div className="space-y-6">
      {/* 목표일 */}
      <div className="notebook-card p-4">
        <label className="block text-sm font-medium mb-2">🎯 목표일 (수능일)</label>
        <input
          type="date"
          value={props.targetDate}
          onChange={(e) => props.onTargetDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
        />
      </div>

      {/* 일일 순공시간 */}
      <div className="notebook-card p-4">
        <label className="block text-sm font-medium mb-2">
          ⏰ 일일 순공시간: <span className="text-[var(--ink-blue)] font-bold">{props.dailyStudyHours}시간</span>
        </label>
        <input
          type="range"
          min={1}
          max={12}
          value={props.dailyStudyHours}
          onChange={(e) => props.onDailyHoursChange(Number(e.target.value))}
          className="w-full accent-[var(--ink-blue)]"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1시간</span>
          <span>12시간</span>
        </div>
      </div>

      {/* 과목별 비중 */}
      <div className="notebook-card p-4">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-medium">📊 과목별 비중</label>
          <span className={`text-sm font-bold ${isValidRatio ? 'text-green-600' : 'text-red-500'}`}>
            합계: {totalRatio}%
          </span>
        </div>

        {Object.entries(props.subjectRatio).map(([subject, ratio]) => (
          <div key={subject} className="flex items-center gap-3 mb-3">
            <span className="w-14 text-sm">{subject}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={ratio}
              onChange={(e) => props.onSubjectRatioChange({
                ...props.subjectRatio,
                [subject]: Number(e.target.value)
              })}
              className="flex-1 accent-[var(--ink-blue)]"
            />
            <span className="w-12 text-right text-sm font-medium">{ratio}%</span>
          </div>
        ))}

        {!isValidRatio && (
          <p className="text-xs text-red-500 mt-2">
            ⚠️ 과목별 비중의 합이 100%가 되어야 합니다
          </p>
        )}
      </div>

      <button
        onClick={props.onNext}
        disabled={!props.targetDate || !isValidRatio}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
      >
        다음: 강좌 선택 →
      </button>
    </div>
  );
}

function CourseSelectionStep(props: {
  searchResults: any[];
  selectedCourses: any[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onSelect: (course: any) => void;
  onDeselect: (courseId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      props.onSearch(searchQuery);
    }
  };

  return (
    <div className="space-y-4">
      {/* 검색 폼 */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="강좌명 또는 강사명 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
        />
        <button
          onClick={handleSearch}
          disabled={props.isSearching}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {props.isSearching ? '🔄' : '🔍'} 검색
        </button>
      </div>

      {/* 과목 필터 버튼 */}
      <div className="flex gap-2 flex-wrap">
        {['수학', '영어', '국어', '한국사', '탐구'].map((subject) => (
          <button
            key={subject}
            onClick={() => props.onSearch(subject)}
            className="px-3 py-1 text-sm bg-[var(--highlight-yellow)] rounded-full hover:bg-yellow-200 transition-colors"
          >
            {subject}
          </button>
        ))}
      </div>

      {/* 검색 결과 */}
      <div className="notebook-card p-2 max-h-48 overflow-y-auto">
        {props.searchResults.length === 0 ? (
          <p className="text-center text-gray-400 py-4 text-sm">
            강좌를 검색해주세요
          </p>
        ) : (
          props.searchResults.map((course) => {
            const isSelected = props.selectedCourses.some(c => c.id === course.id);
            return (
              <div
                key={course.id}
                className={`p-3 rounded-lg mb-2 flex justify-between items-center transition-colors ${
                  isSelected ? 'bg-[var(--highlight-blue)]' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{course.courseName}</div>
                  <div className="text-xs text-gray-500">
                    {course.lecturer} · {course.subject} · {course.chapters?.length || 0}강
                  </div>
                </div>
                <button
                  onClick={() => isSelected ? props.onDeselect(course.id) : props.onSelect(course)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    isSelected
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-[var(--ink-blue)] text-white hover:bg-[var(--ink-blue)]/90'
                  }`}
                >
                  {isSelected ? '제거' : '추가'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 선택된 강좌 */}
      {props.selectedCourses.length > 0 && (
        <div className="notebook-card p-3">
          <h3 className="text-sm font-medium mb-2">
            ✅ 선택한 강좌 ({props.selectedCourses.length}개)
          </h3>
          <div className="flex flex-wrap gap-2">
            {props.selectedCourses.map((course) => (
              <span
                key={course.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--highlight-blue)] text-[var(--ink-blue)] rounded text-sm"
              >
                {course.courseName}
                <button
                  onClick={() => props.onDeselect(course.id)}
                  className="hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 네비게이션 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={props.onBack}
          className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          ← 이전
        </button>
        <button
          onClick={props.onNext}
          disabled={props.selectedCourses.length === 0}
          className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
        >
          퀘스트 생성 ✨
        </button>
      </div>
    </div>
  );
}

function PreviewStep(props: {
  quests: any[];
  summary: any;
  isLoading: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  if (props.isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4 animate-bounce">✨</div>
        <p className="text-lg font-medium">퀘스트 생성 중...</p>
        <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>
      </div>
    );
  }

  if (props.quests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-lg font-medium">퀘스트 생성에 실패했습니다</p>
        <button
          onClick={props.onBack}
          className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 날짜별 그룹화
  const questsByDate = props.quests.reduce((acc, quest) => {
    const date = quest.scheduledDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(quest);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      {/* 요약 */}
      {props.summary && (
        <div className="notebook-card p-4 bg-[var(--highlight-blue)]">
          <h3 className="font-medium mb-2">📊 생성 결과 요약</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>총 퀘스트: <strong>{props.summary.totalQuests}개</strong></div>
            <div>학습 기간: <strong>{props.summary.totalDays}일</strong></div>
            <div>일평균: <strong>{props.summary.averageMinutesPerDay}분</strong></div>
            <div>총 시간: <strong>{Math.round(props.summary.totalQuests * 45 / 60)}시간</strong></div>
          </div>
        </div>
      )}

      {/* 퀘스트 목록 (날짜별) */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {Object.entries(questsByDate).slice(0, 5).map(([date, quests]) => (
          <div key={date} className="notebook-card p-3">
            <div className="text-xs text-gray-500 mb-2">{date}</div>
            {(quests as any[]).map((quest) => (
              <div key={quest.id} className="flex items-start gap-2 mb-2 last:mb-0">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  quest.questType === 'lecture' ? 'bg-blue-100 text-blue-700' :
                  quest.questType === 'review' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {quest.subject}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{quest.title}</div>
                  <div className="text-xs text-gray-500">{quest.estimatedMinutes}분</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {Object.keys(questsByDate).length > 5 && (
          <p className="text-center text-sm text-gray-400">
            ... 외 {Object.keys(questsByDate).length - 5}일
          </p>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={props.onBack}
          className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          ← 이전
        </button>
        <button
          onClick={props.onConfirm}
          className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-[var(--ink-blue)]/90 transition-colors"
        >
          플래너에 추가 📋
        </button>
      </div>
    </div>
  );
}
```

---

## 🔧 통합 수정 사항

### 5. App.tsx 라우터 추가

```tsx
// packages/frontend/src/App.tsx
// import 추가
import { CurriculumPage } from './pages';

// Routes 내부에 추가
<Route path="/curriculum" element={<ProtectedRoute><CurriculumPage /></ProtectedRoute>} />
```

### 6. pages/index.ts export 추가

```typescript
// packages/frontend/src/pages/index.ts
// 맨 아래 추가
export { CurriculumPage } from './CurriculumPage';
```

### 7. NotebookLayout.tsx 네비게이션 추가

```tsx
// 상단 NavTab 섹션 (line ~42)에 추가
<NavTab to="/curriculum" active={location.pathname === '/curriculum'}>
  📚 커리큘럼
</NavTab>

// 또는 "새 플랜" 탭을 "커리큘럼"으로 변경
// 기존: <NavTab to="/generate" ...>✨ 새 플랜</NavTab>
// 변경: <NavTab to="/curriculum" ...>📚 커리큘럼</NavTab>
```

### 8. Backend index.ts 라우트 등록

```typescript
// packages/backend/src/index.ts
// import 추가
import { curriculumRoutes } from './routes/curriculum';

// 라우트 등록 (line ~39 부근)
app.route('/api/curriculum', curriculumRoutes);
```

---

## ✅ questStore 타입 확장 (선택적)

기존 questStore에서 인강 퀘스트의 메타데이터를 활용하려면:

```typescript
// packages/frontend/src/stores/questStore.ts
// DailyQuest 인터페이스에 추가

interface DailyQuest {
  // ... 기존 필드들 ...

  // 인강 메타데이터 (선택적)
  _meta?: {
    source: 'book' | 'curriculum';
    questType?: string;
    subject?: string;
    courseId?: string;
    courseName?: string;
    lecturer?: string;
  };
}
```

이를 통해 TodayPage에서 교재/인강 퀘스트를 **구분하여 표시**할 수 있습니다.

---

## 🗓️ 구현 순서

| 단계 | 작업 | 예상 시간 |
|------|------|----------|
| 1 | `types/curriculum.ts` 타입 정의 | 5분 |
| 2 | `routes/curriculum.ts` 백엔드 라우트 | 15분 |
| 3 | Python agent CLI 인터페이스 추가 | 15분 |
| 4 | `useCurriculumGeneration.ts` 훅 (핵심!) | 20분 |
| 5 | `CurriculumPage.tsx` 페이지 컴포넌트 | 25분 |
| 6 | 라우터 및 네비게이션 업데이트 | 5분 |
| 7 | 테스트 및 디버깅 | 20분 |

**총 예상 시간**: ~1.5시간

---

## ✅ 체크리스트

### Backend
- [ ] `types/curriculum.ts` 생성
- [ ] `routes/curriculum.ts` 생성
- [ ] `index.ts`에 라우트 등록
- [ ] Python CLI 인터페이스 추가

### Frontend
- [ ] `hooks/useCurriculumGeneration.ts` 생성 (convertToQuestPlan 포함)
- [ ] `pages/CurriculumPage.tsx` 생성
- [ ] `pages/index.ts` export 추가
- [ ] `App.tsx` 라우트 추가
- [ ] `NotebookLayout.tsx` 네비게이션 추가

### 통합 테스트
- [ ] 강좌 검색 → 선택 → 퀘스트 생성 플로우
- [ ] questStore 변환 및 저장 확인
- [ ] TodayPage에서 인강 퀘스트 표시 확인
- [ ] PlannerPage에서 인강 플랜 표시 확인

---

## 💡 핵심 포인트

### v2 변경 사항 요약

1. **별도 curriculumStore 제거** → Hook 내부 useState로 임시 상태 관리
2. **convertToQuestPlan()** → 인강 퀘스트를 questStore 형식으로 변환
3. **questStore.addPlan()** → 기존 시스템에 통합 저장
4. **TodayPage 수정 불필요** → 자동으로 인강 퀘스트 표시

### 사용자 경험

```
CurriculumPage에서 생성 → 플래너에 추가 → TodayPage에서 확인 ✅
                                         ↓
                              교재 + 인강 퀘스트 통합 표시!
```

---

*생성일: 2026-01-12*
*버전: v2 (데이터 통합)*
*프로젝트: QuestyBook - Curriculum Agent Integration*
