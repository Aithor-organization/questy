# QuestyBook MVP Implementation Plan

> 기술 설계 및 구현 계획

## Overview

**Feature ID**: 001-mvp-quest-generator
**Spec Version**: 1.0.0
**Plan Version**: 1.0.0
**Status**: Draft

---

## Constitutional Pre-Flight Check

### Article I: Library-First Principle ✅
- 퀘스트 생성 로직을 `packages/backend/src/lib/quest-generator.ts`에 분리
- API 라우트는 라이브러리 호출만 담당

### Article II: CLI Interface Mandate ⏭️
- MVP에서는 CLI 미구현 (웹 UI 우선)
- 향후 `packages/backend/src/cli/generate-quest.ts` 추가 예정

### Article III: Test-First Imperative ✅ (NON-NEGOTIABLE)
- 모든 구현 전 테스트 작성
- RED → GREEN → REFACTOR 순서 엄수

### Article VII: Simplicity Gate ✅
- 프로젝트 수: 3개 (frontend, backend, shared) ≤ 3
- 미래 기능 예측 금지 (DB, 인증 미구현)

### Article VIII: Anti-Abstraction Gate ✅
- 프레임워크 직접 사용 (Hono, React)
- DTO/Entity 분리 없음, 단일 타입 정의

### Article IX: Integration-First Testing ✅
- OpenRouter API 실제 호출 테스트 (mock 최소화)
- E2E 테스트로 전체 플로우 검증

---

## Technology Stack

### Frontend
| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | React 19 | 이미 설정됨, Hooks 기반 |
| Build | Vite 7 | 빠른 HMR, 간단한 설정 |
| Styling | Tailwind CSS 4 | 유틸리티 클래스, 빠른 UI 개발 |
| State | React useState | MVP 단순성, 외부 상태 관리 불필요 |
| HTTP Client | fetch API | 네이티브, 추가 의존성 없음 |

### Backend
| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | Hono | 경량, TypeScript 네이티브, 빠름 |
| Runtime | Node.js 20+ | LTS, 안정성 |
| AI | OpenRouter API | Gemini 3 Flash (vision 지원, 1M 컨텍스트) |
| Validation | Zod | 타입 안전 검증, 이미 설정됨 |

### AI Model Configuration
```typescript
// OpenRouter 설정
const MODEL = 'google/gemini-3-flash-preview';
const MAX_TOKENS = 8192;
const TEMPERATURE = 0.3; // 일관된 출력을 위해 낮게

// Gemini 3 Flash 장점:
// - 빠른 속도 (Pro급 추론, 낮은 레이턴시)
// - 저렴한 비용 ($0.50/1M input, $3.00/1M output)
// - 1M 토큰 컨텍스트
// - Vision 지원 (이미지 분석)
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  QuestForm  │───▶│  Loading    │───▶│    QuestResult      │  │
│  │  Component  │    │  Spinner    │    │    Component        │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│        │                                         ▲               │
│        │ POST /api/generate                      │               │
│        ▼                                         │               │
├─────────────────────────────────────────────────────────────────┤
│                        Backend (Hono)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Route     │───▶│   Quest     │───▶│   OpenRouter        │  │
│  │  Handler    │    │  Generator  │    │   Client            │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                           │                      │               │
│                           │                      │               │
│                           ▼                      ▼               │
│                    ┌─────────────────────────────────┐          │
│                    │   Claude 3.5 Haiku (Vision)     │          │
│                    │   - 이미지 분석                   │          │
│                    │   - 단원 구조 추출                │          │
│                    │   - 난이도 추정                   │          │
│                    │   - 퀘스트 생성                   │          │
│                    └─────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Contract

### POST /api/generate

**Request**:
```typescript
interface GenerateRequest {
  materialName: string;      // 교재 이름 (1-100자)
  imageBase64: string;       // Base64 인코딩된 이미지
  imageType: 'jpg' | 'png';  // 이미지 형식
  startUnit: number;         // 시작 단원 (1 이상)
  endUnit: number;           // 끝 단원 (startUnit 이상)
  totalDays: number;         // 목표 기간 (1 이상)
}
```

**Response (Success)**:
```typescript
interface GenerateResponse {
  success: true;
  data: {
    materialName: string;
    analyzedUnits: Array<{
      unitNumber: number;
      unitTitle: string;
      subSections: string[];
      difficulty: 'easy' | 'medium' | 'hard';
    }>;
    dailyQuests: Array<{
      day: number;
      date: string;           // YYYY-MM-DD
      unitNumber: number;
      unitTitle: string;
      range: string;          // "1.1 ~ 1.3"
      estimatedMinutes: number;
    }>;
    summary: {
      totalDays: number;
      totalUnits: number;
      averageMinutesPerDay: number;
    };
  };
}
```

**Response (Error)**:
```typescript
interface GenerateErrorResponse {
  success: false;
  error: {
    code: 'INVALID_IMAGE' | 'ANALYSIS_FAILED' | 'TIMEOUT' | 'INTERNAL_ERROR';
    message: string;
  };
}
```

---

## Implementation Sequence

### Phase 1: Shared Types (US-001, US-002, US-003)
1. `packages/shared/src/types.ts` - 공통 타입 정의
2. `packages/shared/src/validation.ts` - Zod 스키마

### Phase 2: Backend Core (US-003)
1. `packages/backend/src/lib/openrouter-client.ts` - OpenRouter 클라이언트
2. `packages/backend/src/lib/quest-generator.ts` - 퀘스트 생성 로직
3. `packages/backend/src/lib/image-analyzer.ts` - 이미지 분석 (Vision API)
4. `packages/backend/src/routes/generate.ts` - API 라우트

### Phase 3: Frontend UI (US-001, US-002, US-004)
1. `packages/frontend/src/components/QuestForm.tsx` - 입력 폼
2. `packages/frontend/src/components/ImageUploader.tsx` - 이미지 업로드
3. `packages/frontend/src/components/QuestResult.tsx` - 결과 표시
4. `packages/frontend/src/components/QuestCard.tsx` - 개별 퀘스트 카드
5. `packages/frontend/src/App.tsx` - 메인 페이지 통합

### Phase 4: Integration & Polish
1. E2E 플로우 테스트
2. 에러 핸들링 개선
3. 로딩 상태 UX

---

## AI Prompt Design

### Vision Analysis Prompt
```typescript
const ANALYSIS_PROMPT = `
당신은 교재 목차 분석 전문가입니다.
업로드된 이미지에서 교재의 단원 구조를 추출해주세요.

분석 규칙:
1. 각 단원의 번호와 제목을 추출
2. 하위 섹션(1.1, 1.2 등)도 가능하면 추출
3. 단원별 예상 난이도를 추정 (easy/medium/hard)
   - 기초 개념, 정의: easy
   - 응용, 문제풀이: medium
   - 심화, 통합: hard

JSON 형식으로 응답:
{
  "units": [
    {
      "unitNumber": 1,
      "unitTitle": "집합",
      "subSections": ["1.1 집합의 개념", "1.2 집합의 연산"],
      "difficulty": "easy"
    }
  ]
}
`;
```

### Quest Generation Prompt
```typescript
const GENERATION_PROMPT = `
분석된 단원 정보를 바탕으로 ${totalDays}일 동안의 학습 계획을 생성해주세요.

규칙:
1. 난이도가 높은 단원은 더 많은 일수 배정
2. 하루 평균 학습 시간은 60-120분
3. 각 날짜에 명확한 학습 범위 지정
4. 단원이 끝나면 다음 단원으로 자연스럽게 전환

JSON 형식으로 응답:
{
  "dailyQuests": [
    {
      "day": 1,
      "unitNumber": 1,
      "unitTitle": "집합",
      "range": "1.1 ~ 1.2",
      "estimatedMinutes": 90
    }
  ]
}
`;
```

---

## File Structure

```
packages/
├── shared/
│   └── src/
│       ├── types.ts          # 공통 타입 (이미 일부 존재, 확장)
│       ├── validation.ts     # Zod 스키마 (신규)
│       └── index.ts          # 내보내기
├── backend/
│   └── src/
│       ├── lib/
│       │   ├── openrouter-client.ts  # OpenRouter API 클라이언트
│       │   ├── image-analyzer.ts     # Vision API 이미지 분석
│       │   └── quest-generator.ts    # 퀘스트 생성 로직
│       ├── routes/
│       │   └── generate.ts           # POST /api/generate
│       └── index.ts                  # 서버 엔트리
└── frontend/
    └── src/
        ├── components/
        │   ├── QuestForm.tsx         # 메인 입력 폼
        │   ├── ImageUploader.tsx     # 이미지 업로드 컴포넌트
        │   ├── QuestResult.tsx       # 결과 컨테이너
        │   └── QuestCard.tsx         # 개별 퀘스트 카드
        ├── hooks/
        │   └── useQuestGeneration.ts # API 호출 훅
        ├── App.tsx                   # 메인 앱
        └── main.tsx                  # 엔트리
```

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Vision API 부정확한 OCR | High | Medium | 프롬프트 개선, 이미지 품질 가이드 제공 |
| API 타임아웃 (이미지 크기) | Medium | Medium | 이미지 리사이징, 최대 크기 제한 |
| OpenRouter 비용 | Low | Low | Haiku 모델 사용 (저비용) |
| 이미지 형식 호환성 | Low | Low | JPG/PNG만 허용, 클라이언트 검증 |

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API 응답 시간 (p95) | < 30초 | 서버 로그 |
| 프론트엔드 초기 로드 | < 2초 | Lighthouse |
| 이미지 업로드 시간 | < 3초 (10MB) | 클라이언트 측정 |
| 메모리 사용량 | < 512MB | Node.js 프로파일링 |

---

## Approval Checklist

- [x] Constitutional 모든 조항 통과 (CLI 제외, MVP)
- [x] 기술 스택 선정 완료
- [x] API 계약 정의 완료
- [x] 파일 구조 설계 완료
- [x] AI 프롬프트 설계 완료
- [ ] 사용자 승인 대기
