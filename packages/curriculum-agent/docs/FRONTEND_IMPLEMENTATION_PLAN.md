# Curriculum RAG Agent 프론트엔드 구현 계획서

> ACE Framework V5.2 기반 커리큘럼 RAG 에이전트의 모든 기능을 프론트엔드에서 구현하기 위한 종합 계획서

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [아키텍처 설계](#3-아키텍처-설계)
4. [API 설계](#4-api-설계)
5. [화면 설계](#5-화면-설계)
6. [상태 관리](#6-상태-관리)
7. [컴포넌트 설계](#7-컴포넌트-설계)
8. [구현 단계](#8-구현-단계)
9. [테스트 전략](#9-테스트-전략)

---

## 1. 프로젝트 개요

### 1.1 목적
Curriculum RAG Agent의 모든 백엔드 기능을 웹 프론트엔드에서 사용할 수 있도록 구현

### 1.2 주요 기능 목록

| 카테고리 | 기능 | 우선순위 |
|---------|------|----------|
| **퀘스트 생성** | 일별 퀘스트 스케줄 생성 | P0 |
| **퀘스트 생성** | 과목별 비중 설정 (국영수 한국사 탐구) | P0 |
| **퀘스트 생성** | 강좌 선택 (RAG 검색) | P0 |
| **퀘스트** | 오늘의 퀘스트 조회 | P0 |
| **퀘스트** | 퀘스트 완료 처리 | P0 |
| **퀘스트** | 퀘스트 건너뛰기 | P1 |
| **스케줄** | 미완료 퀘스트 재조정 | P0 |
| **스케줄** | 따라잡기 계획 | P1 |
| **통계** | 진행률 대시보드 | P0 |
| **통계** | 과목별 완료 통계 | P1 |
| **RAG** | 강사 검색 | P1 |
| **RAG** | 강좌 검색 | P1 |
| **대화** | AI 채팅 | P2 |

### 1.3 핵심 플로우

```
┌─────────────────────────────────────────────────────────────┐
│  사용자 입력                                                 │
│  ├─ 목표일 (수능일 등)                                      │
│  ├─ 일일 순공시간                                           │
│  ├─ 과목별 비중 (국영수 한국사 탐구 %)                       │
│  └─ 수강할 강좌 선택                                        │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  RAG 조회                                                    │
│  └─ 선택 강좌 목차 조회 (챕터 → 섹션)                        │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  퀘스트 생성 & 배분                                          │
│  ├─ 목차 섹션 → 인강 퀘스트 변환                            │
│  ├─ 챕터 끝 → 복습 퀘스트 추가                              │
│  └─ 과목별 비중에 맞춰 일별 시간 배분                       │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  일별 스케줄                                                 │
│  └─ 목표일까지 매일 필수 퀘스트 목록                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 사용자 페르소나

```yaml
primary_users:
  - 수험생: 커리큘럼 생성 및 퀘스트 관리
  - 학부모: 자녀 진행률 모니터링

secondary_users:
  - 학원 관리자: 다수 학생 커리큘럼 관리
```

---

## 2. 기술 스택

### 2.1 프론트엔드 코어

```yaml
framework: Next.js 14+ (App Router)
language: TypeScript 5.x
styling: Tailwind CSS + shadcn/ui
state: Zustand (전역) + TanStack Query (서버)
forms: React Hook Form + Zod
charts: Recharts
calendar: react-big-calendar
animations: Framer Motion
```

### 2.2 개발 도구

```yaml
bundler: Turbopack (Next.js built-in)
testing: Vitest + React Testing Library + Playwright
linting: ESLint + Prettier
api_client: Axios + React Query
```

### 2.3 선택 근거

| 기술 | 선택 이유 |
|------|----------|
| Next.js 14 | App Router, Server Components, API Routes 통합 |
| Zustand | 간결한 API, 적은 보일러플레이트 |
| TanStack Query | 서버 상태 캐싱, 자동 리페치, 낙관적 업데이트 |
| shadcn/ui | 접근성, 커스터마이징, Tailwind 통합 |
| Zod | 런타임 타입 검증, TypeScript 통합 |

---

## 3. 아키텍처 설계

### 3.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pages/    │  │ Components/ │  │   Hooks/    │              │
│  │   Routes    │  │    UI       │  │   Custom    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│  ┌───────────────────────▼───────────────────────┐              │
│  │              State Management                  │              │
│  │  ┌─────────────┐  ┌─────────────────────┐     │              │
│  │  │   Zustand   │  │   TanStack Query    │     │              │
│  │  │  (Client)   │  │    (Server)         │     │              │
│  │  └─────────────┘  └─────────────────────┘     │              │
│  └───────────────────────┬───────────────────────┘              │
│                          │                                       │
│  ┌───────────────────────▼───────────────────────┐              │
│  │              API Layer (Axios)                 │              │
│  └───────────────────────┬───────────────────────┘              │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Backend API (FastAPI/Hono)                     │
├──────────────────────────────────────────────────────────────────┤
│  /api/curriculum  /api/quests  /api/schedule  /api/chat  /api/rag│
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Curriculum RAG Agent                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Router   │ │ Teacher  │ │   RAG    │ │ Memory   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 디렉토리 구조

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 관련 라우트
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # 대시보드 라우트
│   │   ├── layout.tsx
│   │   ├── page.tsx              # 메인 대시보드
│   │   ├── curriculum/
│   │   │   ├── page.tsx          # 커리큘럼 목록
│   │   │   ├── new/page.tsx      # 커리큘럼 생성
│   │   │   └── [id]/page.tsx     # 커리큘럼 상세
│   │   ├── quests/
│   │   │   ├── page.tsx          # 퀘스트 목록
│   │   │   ├── today/page.tsx    # 오늘의 퀘스트
│   │   │   └── calendar/page.tsx # 캘린더 뷰
│   │   ├── schedule/
│   │   │   ├── page.tsx          # 스케줄 관리
│   │   │   └── reschedule/page.tsx
│   │   ├── stats/
│   │   │   └── page.tsx          # 통계 대시보드
│   │   ├── search/
│   │   │   ├── lecturers/page.tsx
│   │   │   └── courses/page.tsx
│   │   └── chat/
│   │       └── page.tsx          # AI 채팅
│   ├── api/                      # API Routes (BFF)
│   │   ├── curriculum/
│   │   ├── quests/
│   │   ├── schedule/
│   │   └── chat/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui 컴포넌트
│   ├── curriculum/               # 커리큘럼 관련
│   │   ├── CurriculumForm.tsx
│   │   ├── CurriculumCard.tsx
│   │   ├── SubjectPlan.tsx
│   │   └── WeeklySchedule.tsx
│   ├── quests/                   # 퀘스트 관련
│   │   ├── QuestCard.tsx
│   │   ├── QuestList.tsx
│   │   ├── QuestCalendar.tsx
│   │   ├── QuestTimer.tsx
│   │   └── QuestProgress.tsx
│   ├── schedule/                 # 스케줄 관련
│   │   ├── ScheduleOptimizer.tsx
│   │   ├── RescheduleDialog.tsx
│   │   └── CatchUpPlan.tsx
│   ├── stats/                    # 통계 관련
│   │   ├── ProgressChart.tsx
│   │   ├── CompletionStats.tsx
│   │   └── SubjectBreakdown.tsx
│   ├── search/                   # 검색 관련
│   │   ├── LecturerSearch.tsx
│   │   ├── CourseSearch.tsx
│   │   └── SearchResults.tsx
│   ├── chat/                     # 채팅 관련
│   │   ├── ChatWindow.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   └── layout/                   # 레이아웃
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── MobileNav.tsx
├── hooks/                        # 커스텀 훅
│   ├── useCurriculum.ts
│   ├── useQuests.ts
│   ├── useSchedule.ts
│   ├── useStats.ts
│   ├── useSearch.ts
│   └── useChat.ts
├── stores/                       # Zustand 스토어
│   ├── userStore.ts
│   ├── curriculumStore.ts
│   ├── questStore.ts
│   └── uiStore.ts
├── lib/                          # 유틸리티
│   ├── api/
│   │   ├── client.ts             # Axios 클라이언트
│   │   ├── curriculum.ts
│   │   ├── quests.ts
│   │   ├── schedule.ts
│   │   └── chat.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── validation.ts
│   └── constants/
│       ├── questTypes.ts
│       └── scheduleStrategies.ts
├── types/                        # TypeScript 타입
│   ├── curriculum.ts
│   ├── quest.ts
│   ├── schedule.ts
│   ├── user.ts
│   └── api.ts
└── styles/
    └── components/
```

---

## 4. API 설계

### 4.1 RESTful API 엔드포인트

#### 퀘스트 생성 API

```typescript
// POST /api/quests/generate
interface GenerateQuestsRequest {
  targetDate: string;              // 목표일 (YYYY-MM-DD)
  dailyStudyHours: number;         // 일일 순공시간
  subjectRatio: {                  // 과목별 비중 (%)
    국어: number;
    영어: number;
    수학: number;
    한국사: number;
    탐구: number;
  };
  selectedCourseIds: string[];     // 선택한 강좌 ID 목록
}

interface GenerateQuestsResponse {
  success: boolean;
  data: {
    quests: Quest[];
    totalCount: number;
    scheduledDays: number;
  };
}

// GET /api/quests/today
interface TodayQuestsResponse {
  success: boolean;
  data: {
    date: string;
    quests: Quest[];
    totalMinutes: number;
    completedMinutes: number;
  };
}

// GET /api/quests/overdue
interface OverdueQuestsResponse {
  success: boolean;
  data: {
    quests: Quest[];
    totalOverdueMinutes: number;
    oldestOverdueDate: string;
  };
}

// POST /api/quests/:id/complete
interface CompleteQuestRequest {
  actualMinutes: number;
}

// POST /api/quests/:id/skip
// GET /api/quests/by-date?date=YYYY-MM-DD
// GET /api/quests/stats
```

#### 스케줄 API

```typescript
// POST /api/schedule/reschedule
interface RescheduleRequest {
  targetDate: string;
  dailyStudyHours: number;
  strategy: "smart" | "spread" | "priority" | "front_load" | "back_load";
}

interface RescheduleResponse {
  success: boolean;
  data: {
    rescheduledCount: number;
    rescheduledQuests: Quest[];
    dailyOverload: string[];
    warnings: string[];
  };
}

// GET /api/schedule/catch-up-plan
interface CatchUpPlanRequest {
  targetDate: string;
  extraHoursPerDay: number;
}

interface CatchUpPlanResponse {
  success: boolean;
  data: {
    overdueCount: number;
    totalMinutesBehind: number;
    daysNeededWithExtra: number;
    feasible: boolean;
    recommendation: string;
  };
}
```

#### 검색 API

```typescript
// GET /api/search/lecturers?subject=수학&level=중급
interface SearchLecturersResponse {
  success: boolean;
  data: {
    lecturers: Lecturer[];
    totalCount: number;
  };
}

// GET /api/search/courses?subject=수학&keyword=미적분
interface SearchCoursesResponse {
  success: boolean;
  data: {
    courses: Course[];
    totalCount: number;
  };
}
```

#### 채팅 API

```typescript
// POST /api/chat
interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ChatResponse {
  success: boolean;
  data: {
    response: string;
    sessionId: string;
    modelUsed: string;
    complexityLevel: "simple" | "medium" | "complex";
  };
}
```

### 4.2 WebSocket API (실시간)

```typescript
// 퀘스트 타이머 동기화
ws://api/ws/quest-timer
{
  type: "timer_update",
  questId: string,
  elapsedSeconds: number,
  status: "running" | "paused" | "completed"
}

// 실시간 채팅
ws://api/ws/chat
{
  type: "message" | "typing" | "thinking",
  content: string,
  timestamp: number
}
```

---

## 5. 화면 설계

### 5.1 화면 목록 및 와이어프레임

#### 5.1.1 메인 대시보드 (`/dashboard`)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: 로고 | 검색 | 알림 | 프로필                        │
├─────────┬───────────────────────────────────────────────────┤
│         │  📊 오늘의 학습                                   │
│ Sidebar │  ┌─────────────────────────────────────────────┐  │
│         │  │  진행률: ████████░░ 80%                      │  │
│ • 대시보드 │  │  완료: 4/5 퀘스트 | 남은 시간: 45분          │  │
│ • 커리큘럼 │  └─────────────────────────────────────────────┘  │
│ • 퀘스트  │                                                  │
│ • 스케줄  │  📋 오늘의 퀘스트                                │
│ • 통계   │  ┌─────────────────────────────────────────────┐  │
│ • 검색   │  │ ✅ [수학] 함수의 극한 - 극한의 정의 (45분)   │  │
│ • AI채팅 │  │ ✅ [수학] 함수의 극한 - 극한의 성질 (45분)   │  │
│         │  │ 🔄 [영어] 주제 찾기 - 주제문 파악 (30분)     │  │
│         │  │ ⏳ [국어] 비문학 독해 (40분)                 │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                  │
│         │  📈 주간 통계          📅 이번 주 일정           │
│         │  ┌──────────────┐    ┌──────────────────┐       │
│         │  │   그래프      │    │  월 화 수 목 금  │       │
│         │  │   (차트)      │    │  ■ ■ ▢ ▢ ▢     │       │
│         │  └──────────────┘    └──────────────────┘       │
└─────────┴───────────────────────────────────────────────────┘
```

#### 5.1.2 퀘스트 생성 (`/dashboard/quests/new`)

```
┌─────────────────────────────────────────────────────────────┐
│  ← 일별 퀘스트 생성                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: 학습 설정                           [1] [2] [3]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  📅 목표일 (수능일)                                  │   │
│  │  [2026-11-12]                                       │   │
│  │                                                      │   │
│  │  ⏰ 일일 순공시간                                    │   │
│  │  [====●====] 6시간                                   │   │
│  │                                                      │   │
│  │  📊 과목별 비중 (%)                                  │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  수학  [====●========] 35%                    │  │   │
│  │  │  영어  [====●====]     25%                    │  │   │
│  │  │  국어  [===●=====]     20%                    │  │   │
│  │  │  탐구  [==●======]     15%                    │  │   │
│  │  │  한국사 [●=========]    5%                    │  │   │
│  │  │                               합계: 100%      │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [취소] [다음: 강좌 선택 →]     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ← 일별 퀘스트 생성                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 2: 강좌 선택                           [1] [2] [3]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  🔍 강좌 검색 [수학 미적분                    ] [검색]│   │
│  │                                                      │   │
│  │  📚 수학 강좌                                        │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ [✓] 현우진 - 수학1 개념완성 (32강)          │    │   │
│  │  │ [ ] 정승제 - 미적분 기초 (28강)             │    │   │
│  │  │ [✓] 김민재 - 확률과 통계 (24강)             │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  📚 영어 강좌                                        │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ [✓] 이지영 - 영어독해 기본 (30강)           │    │   │
│  │  │ [ ] 조정식 - 빈칸추론 마스터 (20강)         │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  선택된 강좌: 3개                                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                        [← 이전] [다음: 확인 →]              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ← 일별 퀘스트 생성                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 3: 생성 확인                           [1] [2] [3]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  📋 생성 요약                                        │   │
│  │  ────────────────────────────────────────────────   │   │
│  │  • 목표일: 2026-11-12 (305일 후)                    │   │
│  │  • 일일 순공시간: 6시간                             │   │
│  │  • 선택 강좌: 3개                                   │   │
│  │                                                      │   │
│  │  📊 예상 퀘스트 수                                   │   │
│  │  ────────────────────────────────────────────────   │   │
│  │  • 수학: 약 50개 (일일 ~126분)                      │   │
│  │  • 영어: 약 35개 (일일 ~90분)                       │   │
│  │  • 국어: 약 28개 (일일 ~72분)                       │   │
│  │  • 탐구: 약 20개 (일일 ~54분)                       │   │
│  │  • 한국사: 약 8개 (일일 ~18분)                      │   │
│  │  ────────────────────────────────────────────────   │   │
│  │  총 퀘스트: 약 141개                                │   │
│  │                                                      │   │
│  │  ⚠️ 일부 날짜 과부하 예상 (자동 조정됨)             │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                        [← 이전] [🚀 퀘스트 생성]            │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.3 퀘스트 캘린더 (`/dashboard/quests/calendar`)

```
┌─────────────────────────────────────────────────────────────┐
│  퀘스트 캘린더                      [월간] [주간] [일간]    │
├─────────────────────────────────────────────────────────────┤
│  ◄  2026년 1월  ►                                          │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐               │
│  │ 일  │ 월  │ 화  │ 수  │ 목  │ 금  │ 토  │               │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │
│  │     │     │     │  1  │  2  │  3  │  4  │               │
│  │     │     │     │ 🟢3 │ 🟢4 │ 🟡2 │ 🔴1 │               │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │
│  │  5  │  6  │  7  │  8  │  9  │ 10  │ 11  │               │
│  │     │ 🟢5 │ 🟢4 │ 🟢5 │ 🟢4 │ 🟡3 │     │               │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │
│  │ ... │     │     │     │     │     │     │               │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘               │
│                                                             │
│  범례: 🟢 완료  🟡 진행중  🔴 미완료  ⚪ 예정              │
│                                                             │
│  선택된 날짜: 2026-01-11                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • [수학] 미분법 - 미분계수 (45분) ✅                 │   │
│  │ • [수학] 미분법 - 도함수 (45분) 🔄                  │   │
│  │ • [영어] 빈칸 추론 (30분) ⏳                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.4 스케줄 재조정 (`/dashboard/schedule/reschedule`)

```
┌─────────────────────────────────────────────────────────────┐
│  스케줄 재조정                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ 미완료 퀘스트 발견                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  미완료: 5개 퀘스트 (총 225분)                       │   │
│  │  가장 오래된 미완료: 2026-01-08                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  재조정 설정                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  목표일: [2026-06-15]                                │   │
│  │                                                      │   │
│  │  일일 학습 시간: [====●====] 6시간                   │   │
│  │                                                      │   │
│  │  재조정 전략                                         │   │
│  │  ● SMART (추천) - 과목 균형 + 우선순위               │   │
│  │  ○ SPREAD - 균등 분배                               │   │
│  │  ○ PRIORITY - 우선순위 순                           │   │
│  │  ○ FRONT_LOAD - 앞쪽 집중                           │   │
│  │  ○ BACK_LOAD - 뒤쪽 집중                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📊 재조정 미리보기                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1/12 (일): +2 퀘스트 (총 6시간)                     │   │
│  │  1/13 (월): +1 퀘스트 (총 5.5시간)                   │   │
│  │  1/14 (화): +2 퀘스트 (총 6시간)                     │   │
│  │  ⚠️ 일부 날짜 과부하 경고                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                         [취소]  [재조정 실행]              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.5 통계 대시보드 (`/dashboard/stats`)

```
┌─────────────────────────────────────────────────────────────┐
│  학습 통계                           기간: [이번 주 ▼]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  전체 진행률      │  │  완료율          │                │
│  │      67%         │  │     85%          │                │
│  │  ████████░░░     │  │  ██████████░     │                │
│  │  100/150 퀘스트   │  │  이번 주 기준     │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  📈 일별 학습 시간                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     6h │        ▄▄                                   │   │
│  │     4h │  ▄▄   ████  ▄▄                             │   │
│  │     2h │ ████  ████ ████  ▄▄                        │   │
│  │      0 │  월    화    수   목   금                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📊 과목별 분포                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  수학  ████████████████████  40%                    │   │
│  │  영어  ████████████          25%                    │   │
│  │  국어  ████████████          25%                    │   │
│  │  탐구  ████                  10%                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🏆 성취                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔥 5일 연속 학습  │  ⭐ 수학 마스터  │  📚 100퀘스트 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 반응형 설계

```yaml
breakpoints:
  mobile: 320px - 767px
  tablet: 768px - 1023px
  desktop: 1024px+

mobile_adaptations:
  - 사이드바 → 하단 네비게이션
  - 캘린더 → 리스트 뷰 기본
  - 차트 → 간소화된 버전
  - 퀘스트 카드 → 전체 너비
```

---

## 6. 상태 관리

### 6.1 Zustand 스토어 설계

#### User Store

```typescript
// stores/userStore.ts
interface UserState {
  user: User | null;
  profile: StudentProfile | null;
  isLoading: boolean;

  // Actions
  setUser: (user: User) => void;
  updateProfile: (profile: Partial<StudentProfile>) => void;
  logout: () => void;
}
```

#### Curriculum Store

```typescript
// stores/curriculumStore.ts
interface CurriculumState {
  currentCurriculum: CurriculumPlan | null;
  curriculumList: CurriculumPlan[];
  generationStep: number;
  formData: Partial<GenerateCurriculumRequest>;

  // Actions
  setCurrentCurriculum: (curriculum: CurriculumPlan) => void;
  updateFormData: (data: Partial<GenerateCurriculumRequest>) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetForm: () => void;
}
```

#### Quest Store

```typescript
// stores/questStore.ts
interface QuestState {
  todayQuests: Quest[];
  selectedDate: string;
  activeQuest: Quest | null;
  timerState: {
    isRunning: boolean;
    elapsedSeconds: number;
  };

  // Actions
  setTodayQuests: (quests: Quest[]) => void;
  setSelectedDate: (date: string) => void;
  startTimer: (questId: string) => void;
  pauseTimer: () => void;
  resetTimer: () => void;
}
```

#### UI Store

```typescript
// stores/uiStore.ts
interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  notifications: Notification[];

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark") => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}
```

### 6.2 TanStack Query 설정

```typescript
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5분
      gcTime: 30 * 60 * 1000,        // 30분
      retry: 3,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 6.3 Query Keys 구조

```typescript
// lib/queryKeys.ts
export const queryKeys = {
  curriculum: {
    all: ["curriculum"] as const,
    list: () => [...queryKeys.curriculum.all, "list"] as const,
    detail: (id: string) => [...queryKeys.curriculum.all, id] as const,
  },
  quests: {
    all: ["quests"] as const,
    today: () => [...queryKeys.quests.all, "today"] as const,
    byDate: (date: string) => [...queryKeys.quests.all, "date", date] as const,
    overdue: () => [...queryKeys.quests.all, "overdue"] as const,
    stats: () => [...queryKeys.quests.all, "stats"] as const,
  },
  schedule: {
    all: ["schedule"] as const,
    catchUpPlan: (params: CatchUpPlanRequest) =>
      [...queryKeys.schedule.all, "catchUp", params] as const,
  },
  search: {
    lecturers: (params: SearchParams) => ["search", "lecturers", params] as const,
    courses: (params: SearchParams) => ["search", "courses", params] as const,
  },
};
```

---

## 7. 컴포넌트 설계

### 7.1 핵심 컴포넌트

#### QuestCard

```typescript
// components/quests/QuestCard.tsx
interface QuestCardProps {
  quest: Quest;
  onComplete?: (actualMinutes: number) => void;
  onSkip?: () => void;
  onStart?: () => void;
  showTimer?: boolean;
}

export function QuestCard({
  quest,
  onComplete,
  onSkip,
  onStart,
  showTimer = false
}: QuestCardProps) {
  // 상태 아이콘 표시
  // 퀘스트 정보 (제목, 과목, 예상 시간)
  // 액션 버튼 (시작, 완료, 건너뛰기)
  // 타이머 (옵션)
}
```

#### CurriculumForm (멀티스텝 폼)

```typescript
// components/curriculum/CurriculumForm.tsx
interface CurriculumFormProps {
  onSubmit: (data: GenerateCurriculumRequest) => Promise<void>;
}

const STEPS = [
  { id: "profile", title: "학생 프로필" },
  { id: "subjects", title: "과목 선택" },
  { id: "schedule", title: "학습 일정" },
  { id: "review", title: "확인" },
];

export function CurriculumForm({ onSubmit }: CurriculumFormProps) {
  // 스텝 네비게이션
  // 각 스텝별 폼 컴포넌트
  // 유효성 검사
  // 로딩/에러 상태
}
```

#### ScheduleOptimizer

```typescript
// components/schedule/ScheduleOptimizer.tsx
interface ScheduleOptimizerProps {
  overdueQuests: Quest[];
  onReschedule: (params: RescheduleRequest) => Promise<void>;
}

export function ScheduleOptimizer({
  overdueQuests,
  onReschedule
}: ScheduleOptimizerProps) {
  // 미완료 퀘스트 요약
  // 재조정 설정 폼
  // 전략 선택
  // 미리보기
  // 실행 버튼
}
```

### 7.2 커스텀 훅

#### useCurriculum

```typescript
// hooks/useCurriculum.ts
export function useCurriculum() {
  const queryClient = useQueryClient();

  // 커리큘럼 목록 조회
  const listQuery = useQuery({
    queryKey: queryKeys.curriculum.list(),
    queryFn: () => curriculumApi.list(),
  });

  // 커리큘럼 생성
  const generateMutation = useMutation({
    mutationFn: curriculumApi.generate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.all });
    },
  });

  return {
    curriculums: listQuery.data,
    isLoading: listQuery.isLoading,
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
  };
}
```

#### useQuests

```typescript
// hooks/useQuests.ts
export function useQuests() {
  const queryClient = useQueryClient();
  const { selectedDate } = useQuestStore();

  // 오늘 퀘스트
  const todayQuery = useQuery({
    queryKey: queryKeys.quests.today(),
    queryFn: () => questsApi.getToday(),
  });

  // 날짜별 퀘스트
  const byDateQuery = useQuery({
    queryKey: queryKeys.quests.byDate(selectedDate),
    queryFn: () => questsApi.getByDate(selectedDate),
    enabled: !!selectedDate,
  });

  // 퀘스트 완료
  const completeMutation = useMutation({
    mutationFn: ({ questId, actualMinutes }: CompleteParams) =>
      questsApi.complete(questId, actualMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quests.all });
    },
  });

  // 낙관적 업데이트
  const completeOptimistic = async (questId: string, actualMinutes: number) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.quests.today() });

    const previousQuests = queryClient.getQueryData(queryKeys.quests.today());

    queryClient.setQueryData(queryKeys.quests.today(), (old: Quest[]) =>
      old.map(q => q.id === questId
        ? { ...q, status: "completed", actualMinutes }
        : q
      )
    );

    try {
      await completeMutation.mutateAsync({ questId, actualMinutes });
    } catch {
      queryClient.setQueryData(queryKeys.quests.today(), previousQuests);
    }
  };

  return {
    todayQuests: todayQuery.data?.quests ?? [],
    questsByDate: byDateQuery.data?.quests ?? [],
    isLoading: todayQuery.isLoading,
    complete: completeOptimistic,
    skip: skipMutation.mutate,
  };
}
```

#### useSchedule

```typescript
// hooks/useSchedule.ts
export function useSchedule() {
  const queryClient = useQueryClient();

  // 미완료 퀘스트
  const overdueQuery = useQuery({
    queryKey: queryKeys.quests.overdue(),
    queryFn: () => questsApi.getOverdue(),
  });

  // 재조정 실행
  const rescheduleMutation = useMutation({
    mutationFn: scheduleApi.reschedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quests.all });
      toast.success("스케줄이 재조정되었습니다.");
    },
    onError: (error) => {
      toast.error("재조정 실패: " + error.message);
    },
  });

  // 따라잡기 계획
  const getCatchUpPlan = async (params: CatchUpPlanRequest) => {
    return queryClient.fetchQuery({
      queryKey: queryKeys.schedule.catchUpPlan(params),
      queryFn: () => scheduleApi.getCatchUpPlan(params),
    });
  };

  return {
    overdueQuests: overdueQuery.data?.quests ?? [],
    overdueCount: overdueQuery.data?.quests?.length ?? 0,
    reschedule: rescheduleMutation.mutate,
    isRescheduling: rescheduleMutation.isPending,
    getCatchUpPlan,
  };
}
```

---

## 8. 구현 단계

### 8.1 Phase 1: 기반 구축 (2주)

```yaml
week_1:
  - Next.js 프로젝트 초기화
  - Tailwind CSS + shadcn/ui 설정
  - 디렉토리 구조 생성
  - TypeScript 타입 정의
  - Axios 클라이언트 설정
  - Zustand 스토어 기본 구조

week_2:
  - TanStack Query 설정
  - 인증 시스템 (NextAuth.js)
  - 레이아웃 컴포넌트 (Sidebar, Header)
  - 기본 라우팅 구조
  - API Routes (BFF) 기본 구조
```

### 8.2 Phase 2: 핵심 기능 (3주)

```yaml
week_3:
  - 커리큘럼 생성 폼 (멀티스텝)
  - 커리큘럼 목록/상세 페이지
  - useCurriculum 훅
  - 커리큘럼 API 연동

week_4:
  - 퀘스트 목록 컴포넌트
  - 오늘의 퀘스트 페이지
  - 퀘스트 완료/건너뛰기 기능
  - useQuests 훅
  - 퀘스트 타이머

week_5:
  - 퀘스트 캘린더 뷰
  - 스케줄 재조정 페이지
  - 재조정 전략 선택 UI
  - useSchedule 훅
  - 따라잡기 계획 표시
```

### 8.3 Phase 3: 부가 기능 (2주)

```yaml
week_6:
  - 통계 대시보드
  - 진행률 차트 (Recharts)
  - 과목별 분포 차트
  - 성취 배지 시스템
  - useStats 훅

week_7:
  - 강사/강좌 검색
  - 검색 결과 표시
  - AI 채팅 인터페이스
  - WebSocket 연결 (실시간)
  - useSearch, useChat 훅
```

### 8.4 Phase 4: 완성도 향상 (2주)

```yaml
week_8:
  - 반응형 최적화
  - 다크 모드
  - 애니메이션 (Framer Motion)
  - 에러 바운더리
  - 로딩 스켈레톤

week_9:
  - 성능 최적화
  - SEO 최적화
  - 접근성 (a11y) 검토
  - 단위 테스트 (Vitest)
  - E2E 테스트 (Playwright)
```

### 8.5 마일스톤 체크리스트

```markdown
## MVP (4주차 완료 시점)
- [ ] 커리큘럼 생성 가능
- [ ] 퀘스트 목록 표시
- [ ] 퀘스트 완료 처리
- [ ] 기본 대시보드

## Beta (7주차 완료 시점)
- [ ] 스케줄 재조정
- [ ] 통계 대시보드
- [ ] 검색 기능
- [ ] AI 채팅

## Release (9주차 완료 시점)
- [ ] 반응형 완료
- [ ] 성능 최적화
- [ ] 테스트 커버리지 80%+
- [ ] 접근성 검증
```

---

## 9. 테스트 전략

### 9.1 테스트 유형별 범위

```yaml
unit_tests:
  coverage_target: 80%
  targets:
    - 유틸리티 함수
    - Zustand 스토어
    - 커스텀 훅 (msw 모킹)
    - 순수 컴포넌트

integration_tests:
  coverage_target: 60%
  targets:
    - API 연동 흐름
    - 폼 제출 프로세스
    - 상태 변경 시나리오

e2e_tests:
  coverage_target: 주요 사용자 흐름
  targets:
    - 커리큘럼 생성 전체 흐름
    - 퀘스트 완료 흐름
    - 스케줄 재조정 흐름
```

### 9.2 테스트 예시

```typescript
// __tests__/hooks/useQuests.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useQuests } from "@/hooks/useQuests";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

describe("useQuests", () => {
  it("오늘의 퀘스트를 조회한다", async () => {
    const { result } = renderHook(() => useQuests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.todayQuests).toHaveLength(5);
    });
  });

  it("퀘스트를 완료 처리한다", async () => {
    const { result } = renderHook(() => useQuests(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.complete("quest-001", 45);
    });

    expect(result.current.todayQuests[0].status).toBe("completed");
  });
});
```

### 9.3 E2E 테스트 시나리오

```typescript
// e2e/curriculum-generation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("커리큘럼 생성", () => {
  test("학생이 커리큘럼을 생성할 수 있다", async ({ page }) => {
    await page.goto("/dashboard/curriculum/new");

    // Step 1: 학생 프로필
    await page.click('text="중급"');
    await page.selectOption('select[name="targetScore"]', "1등급");
    await page.check('input[value="수학"]');
    await page.click('text="다음"');

    // Step 2: 과목 선택
    await page.check('input[value="국어"]');
    await page.check('input[value="수학"]');
    await page.check('input[value="영어"]');
    await page.click('text="다음"');

    // Step 3: 학습 일정
    await page.fill('input[name="durationWeeks"]', "16");
    await page.click('text="다음"');

    // Step 4: 확인 및 생성
    await page.click('text="커리큘럼 생성"');

    // 결과 확인
    await expect(page.locator(".curriculum-result")).toBeVisible();
    await expect(page.locator("text=커리큘럼이 생성되었습니다")).toBeVisible();
  });
});
```

---

## 부록

### A. 환경 변수

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# Server-side only
API_SECRET_KEY=your-secret-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

### B. 의존성 목록

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.0",
    "tailwindcss": "^3.4.0",
    "framer-motion": "^10.16.0",
    "recharts": "^2.10.0",
    "react-big-calendar": "^1.8.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.303.0",
    "next-auth": "^4.24.0"
  },
  "devDependencies": {
    "vitest": "^1.1.0",
    "@testing-library/react": "^14.1.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0"
  }
}
```

### C. 참고 자료

- [Next.js App Router 문서](https://nextjs.org/docs/app)
- [TanStack Query 문서](https://tanstack.com/query/latest)
- [Zustand 문서](https://docs.pmnd.rs/zustand)
- [shadcn/ui 컴포넌트](https://ui.shadcn.com)
- [Recharts 차트 라이브러리](https://recharts.org)

---

*문서 버전: 1.0.0 | 작성일: 2026-01-11 | 작성자: Claude Code (ace-builder)*
