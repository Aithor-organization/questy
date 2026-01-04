# QuestyBook MVP Task Breakdown

> TDD 워크플로우 기반 태스크 분해

## Overview

**Feature ID**: 001-mvp-quest-generator
**Plan Version**: 1.0.0
**Tasks Version**: 1.0.0
**Total Tasks**: 18
**Estimated Time**: 4-6시간

---

## Progress Tracking

| Phase | Status | Tasks | Completed |
|-------|--------|-------|-----------|
| Phase 1: Shared Types | ⬜ Pending | 3 | 0/3 |
| Phase 2: Backend Core | ⬜ Pending | 6 | 0/6 |
| Phase 3: Frontend UI | ⬜ Pending | 6 | 0/6 |
| Phase 4: Integration | ⬜ Pending | 3 | 0/3 |

---

## Phase 1: Shared Types & Validation

### Task 1.1: Write Type Tests (RED)
**File**: `packages/shared/src/__tests__/types.test.ts`
**Type**: Test
**Dependencies**: None
**Estimated**: 15분

**Test Cases**:
```typescript
describe('QuestGenerationRequest', () => {
  it('should validate valid request')
  it('should reject empty materialName')
  it('should reject invalid imageType')
  it('should reject startUnit > endUnit')
  it('should reject totalDays < 1')
})

describe('QuestGenerationResponse', () => {
  it('should validate success response')
  it('should validate error response')
})
```

**Validation (RED Phase)**:
- [ ] 테스트 파일 작성 완료
- [ ] 테스트 실행 → 모두 FAIL (타입 미존재)

---

### Task 1.2: Implement Types (GREEN)
**File**: `packages/shared/src/types.ts`
**Type**: Implementation
**Dependencies**: Task 1.1
**Estimated**: 20분

**Implementation**:
- `GenerateRequest` 인터페이스
- `GenerateResponse` 인터페이스
- `AnalyzedUnit` 인터페이스
- `DailyQuest` 인터페이스

**Constitutional Check**:
- [ ] 단일 타입 정의 (Entity/DTO 분리 없음)
- [ ] 프레임워크 직접 사용

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] TypeScript 컴파일 성공

---

### Task 1.3: Implement Validation Schemas (GREEN)
**File**: `packages/shared/src/validation.ts`
**Type**: Implementation
**Dependencies**: Task 1.2
**Estimated**: 15분

**Implementation**:
```typescript
export const GenerateRequestSchema = z.object({
  materialName: z.string().min(1).max(100),
  imageBase64: z.string().min(1),
  imageType: z.enum(['jpg', 'png']),
  startUnit: z.number().int().min(1),
  endUnit: z.number().int().min(1),
  totalDays: z.number().int().min(1),
}).refine(data => data.startUnit <= data.endUnit, {
  message: "startUnit must be <= endUnit"
});
```

**Validation**:
- [ ] 모든 테스트 통과
- [ ] Zod 스키마 내보내기 확인

---

## Phase 2: Backend Core

### Task 2.1: Write OpenRouter Client Tests (RED)
**File**: `packages/backend/src/lib/__tests__/openrouter-client.test.ts`
**Type**: Test
**Dependencies**: Phase 1 완료
**Estimated**: 15분

**Test Cases**:
```typescript
describe('OpenRouterClient', () => {
  it('should call vision API with image')
  it('should parse JSON response correctly')
  it('should handle API errors gracefully')
  it('should timeout after 60 seconds')
})
```

**⚠️ User Approval Required**:
- [ ] 테스트 시나리오 검토 완료
- [ ] 구현 진행 승인

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 2.2: Implement OpenRouter Client (GREEN)
**File**: `packages/backend/src/lib/openrouter-client.ts`
**Type**: Implementation
**Dependencies**: Task 2.1 승인 후
**Estimated**: 30분

**Implementation**:
```typescript
export class OpenRouterClient {
  constructor(apiKey: string)
  async analyzeImage(imageBase64: string, prompt: string): Promise<string>
  async generateJson<T>(messages: Message[]): Promise<T>
}
```

**Configuration**:
- Model: `google/gemini-3-flash-preview`
- Max Tokens: 8192
- Temperature: 0.3
- Vision: 지원 (이미지 분석용)

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] 실제 API 호출 성공 (통합 테스트)

---

### Task 2.3: Write Image Analyzer Tests (RED)
**File**: `packages/backend/src/lib/__tests__/image-analyzer.test.ts`
**Type**: Test
**Dependencies**: Task 2.2
**Estimated**: 15분

**Test Cases**:
```typescript
describe('ImageAnalyzer', () => {
  it('should extract units from table of contents image')
  it('should estimate difficulty based on content')
  it('should handle poor image quality')
  it('should return structured AnalyzedUnit[]')
})
```

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 2.4: Implement Image Analyzer (GREEN)
**File**: `packages/backend/src/lib/image-analyzer.ts`
**Type**: Implementation
**Dependencies**: Task 2.3
**Estimated**: 25분

**Implementation**:
```typescript
export async function analyzeTableOfContents(
  client: OpenRouterClient,
  imageBase64: string,
  materialName: string
): Promise<AnalyzedUnit[]>
```

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] Vision API로 실제 이미지 분석 성공

---

### Task 2.5: Write Quest Generator Tests (RED)
**File**: `packages/backend/src/lib/__tests__/quest-generator.test.ts`
**Type**: Test
**Dependencies**: Task 2.4
**Estimated**: 20분

**Test Cases**:
```typescript
describe('QuestGenerator', () => {
  it('should distribute units across days based on difficulty')
  it('should generate correct day numbers')
  it('should calculate estimated minutes')
  it('should handle single unit case')
  it('should handle more days than units')
})
```

**⚠️ User Approval Required**:
- [ ] 퀘스트 분배 알고리즘 검토
- [ ] 구현 진행 승인

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 2.6: Implement Quest Generator (GREEN)
**File**: `packages/backend/src/lib/quest-generator.ts`
**Type**: Implementation
**Dependencies**: Task 2.5 승인 후
**Estimated**: 30분

**Implementation**:
```typescript
export async function generateDailyQuests(
  client: OpenRouterClient,
  analyzedUnits: AnalyzedUnit[],
  totalDays: number
): Promise<DailyQuest[]>
```

**Algorithm**:
1. 난이도별 가중치 계산 (easy:1, medium:1.5, hard:2)
2. 총 가중치 합계 산출
3. 일자별 학습량 배분
4. 단원 경계에서 자연스러운 전환

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] 100일 계획 생성 성공

---

## Phase 3: Frontend UI

### Task 3.1: Write QuestForm Component Tests (RED)
**File**: `packages/frontend/src/components/__tests__/QuestForm.test.tsx`
**Type**: Test
**Dependencies**: Phase 2 완료
**Estimated**: 15분

**Test Cases**:
```typescript
describe('QuestForm', () => {
  it('should render all input fields')
  it('should disable submit without image')
  it('should show validation errors')
  it('should call onSubmit with form data')
})
```

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 3.2: Implement QuestForm Component (GREEN)
**File**: `packages/frontend/src/components/QuestForm.tsx`
**Type**: Implementation
**Dependencies**: Task 3.1
**Estimated**: 40분

**Implementation**:
- 교재 이름 입력 필드
- 이미지 업로드 영역
- 시작/끝 단원 입력
- 목표 기간 입력
- 제출 버튼

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] Tailwind 스타일 적용

---

### Task 3.3: Write ImageUploader Component Tests (RED)
**File**: `packages/frontend/src/components/__tests__/ImageUploader.test.tsx`
**Type**: Test
**Dependencies**: Task 3.2
**Estimated**: 15분

**Test Cases**:
```typescript
describe('ImageUploader', () => {
  it('should accept jpg and png files')
  it('should reject files over 10MB')
  it('should show preview after upload')
  it('should allow removing uploaded image')
})
```

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 3.4: Implement ImageUploader Component (GREEN)
**File**: `packages/frontend/src/components/ImageUploader.tsx`
**Type**: Implementation
**Dependencies**: Task 3.3
**Estimated**: 30분

**Implementation**:
- 드래그 앤 드롭 영역
- 파일 선택 버튼
- 이미지 미리보기
- 파일 크기/형식 검증
- Base64 변환

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] 실제 이미지 업로드 동작

---

### Task 3.5: Write QuestResult Component Tests (RED)
**File**: `packages/frontend/src/components/__tests__/QuestResult.test.tsx`
**Type**: Test
**Dependencies**: Task 3.4
**Estimated**: 15분

**Test Cases**:
```typescript
describe('QuestResult', () => {
  it('should render quest cards')
  it('should show summary stats')
  it('should handle empty quests')
  it('should display loading state')
})
```

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 3.6: Implement QuestResult & QuestCard Components (GREEN)
**File**: `packages/frontend/src/components/QuestResult.tsx`, `QuestCard.tsx`
**Type**: Implementation
**Dependencies**: Task 3.5
**Estimated**: 35분

**Implementation**:
- 퀘스트 카드 목록
- 날짜, 단원, 범위, 예상 시간 표시
- 요약 통계 (총 일수, 평균 시간)
- 스크롤 가능한 목록

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] 100개 카드 렌더링 성능 양호

---

## Phase 4: Integration & API Route

### Task 4.1: Write API Route Tests (RED)
**File**: `packages/backend/src/routes/__tests__/generate.test.ts`
**Type**: Test
**Dependencies**: Phase 3 완료
**Estimated**: 20분

**Test Cases**:
```typescript
describe('POST /api/generate', () => {
  it('should return quests for valid request')
  it('should return 400 for invalid request')
  it('should return 500 for API failures')
  it('should handle timeout gracefully')
})
```

**Validation (RED Phase)**:
- [ ] 테스트 작성 완료
- [ ] 테스트 실행 → FAIL

---

### Task 4.2: Implement API Route (GREEN)
**File**: `packages/backend/src/routes/generate.ts`
**Type**: Implementation
**Dependencies**: Task 4.1
**Estimated**: 25분

**Implementation**:
```typescript
generateRoutes.post('/', async (c) => {
  // 1. Request validation
  // 2. Image analysis
  // 3. Quest generation
  // 4. Response formatting
})
```

**Validation (GREEN Phase)**:
- [ ] 모든 테스트 통과
- [ ] curl로 실제 API 호출 성공

---

### Task 4.3: Integrate Frontend with Backend (GREEN)
**File**: `packages/frontend/src/App.tsx`, `hooks/useQuestGeneration.ts`
**Type**: Implementation
**Dependencies**: Task 4.2
**Estimated**: 30분

**Implementation**:
- `useQuestGeneration` 커스텀 훅
- 폼 → API → 결과 플로우 연결
- 로딩/에러 상태 처리
- 재시도 버튼

**E2E Test**:
```bash
# 수동 테스트
1. 교재 이름 입력
2. 목차 이미지 업로드
3. 기간 설정
4. 생성 버튼 클릭
5. 결과 확인
```

**Validation**:
- [ ] E2E 플로우 동작 확인
- [ ] 에러 케이스 처리 확인

---

## Checkpoints

### Checkpoint 1: After Phase 1
- [ ] `pnpm build` 성공 (shared 패키지)
- [ ] 타입 내보내기 확인

### Checkpoint 2: After Phase 2
- [ ] `pnpm test` 성공 (backend)
- [ ] OpenRouter API 연동 확인

### Checkpoint 3: After Phase 3
- [ ] `pnpm test` 성공 (frontend)
- [ ] UI 컴포넌트 렌더링 확인

### Checkpoint 4: After Phase 4 (MVP Complete)
- [ ] `pnpm dev` 실행
- [ ] E2E 플로우 완료
- [ ] 에러 핸들링 동작

---

## Parallel Work Tracks

```
Track A (Backend):           Track B (Frontend):
Task 2.1 ──────────────┐
Task 2.2               │
Task 2.3               │     Task 3.1
Task 2.4               │     Task 3.2
Task 2.5               │     Task 3.3
Task 2.6               │     Task 3.4
         └─────────────┴───▶ Task 3.5
                             Task 3.6
                                 │
                                 ▼
                             Task 4.1
                             Task 4.2
                             Task 4.3
```

---

## Definition of Done

MVP 완료 조건:
- [ ] 모든 P1 User Story 구현
- [ ] 모든 테스트 통과 (coverage > 70%)
- [ ] E2E 플로우 동작
- [ ] 에러 핸들링 완료
- [ ] README 업데이트
