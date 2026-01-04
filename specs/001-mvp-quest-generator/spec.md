# QuestyBook MVP Specification

> 교재 이미지 기반 일일 학습 퀘스트 생성 서비스

## Overview

**Feature ID**: 001-mvp-quest-generator
**Version**: 1.0.0
**Status**: Draft
**Created**: 2025-01-04

### Problem Statement

수험생들이 교재를 구매하면 "언제까지 어디까지 공부해야 하는지" 계획을 세우는 것이 어렵다.
목차를 보고 단원별 난이도를 파악하여 현실적인 일일 학습 계획을 세우는 것은 시간이 많이 소요된다.

### Solution

교재 목차/계획표 사진을 업로드하면 AI가 자동으로 분석하여 목표 기간에 맞는 일일 퀘스트를 생성한다.

---

## User Scenarios & Testing

### P1: 핵심 시나리오 (Must-Have)

#### US-001: 교재 정보 입력 및 이미지 업로드

**As a** 수험생
**I want to** 교재 이름을 입력하고 목차 사진을 업로드하고 싶다
**So that** AI가 내 교재 구조를 파악할 수 있다

**Acceptance Criteria**:
```gherkin
Given 사용자가 메인 페이지에 접속한 상태
When 교재 이름을 입력하고 목차 이미지를 업로드한다
Then 이미지 미리보기가 표시된다
  And "분석 시작" 버튼이 활성화된다

Given 이미지가 업로드되지 않은 상태
When 분석 버튼을 클릭한다
Then 에러 메시지 "이미지를 업로드해주세요"가 표시된다
```

#### US-002: 학습 목표 설정

**As a** 수험생
**I want to** 몇 단원까지, 며칠 안에 끝낼지 설정하고 싶다
**So that** 내 상황에 맞는 계획을 받을 수 있다

**Acceptance Criteria**:
```gherkin
Given 이미지가 업로드된 상태
When 시작 단원(1), 끝 단원(15), 목표 기간(100일)을 입력한다
Then 입력값이 유효성 검사를 통과한다
  And 기간이 1일 이상이어야 한다
  And 시작 단원 ≤ 끝 단원이어야 한다
```

#### US-003: AI 퀘스트 생성

**As a** 수험생
**I want to** AI가 목차 이미지를 분석해서 일일 퀘스트를 생성해주길 원한다
**So that** 매일 무엇을 공부할지 명확히 알 수 있다

**Acceptance Criteria**:
```gherkin
Given 모든 정보가 입력된 상태
When "퀘스트 생성" 버튼을 클릭한다
Then 로딩 상태가 표시된다 (예상 15-30초)
  And AI가 이미지에서 단원 구조를 추출한다
  And 난이도를 추정하여 일자별 학습량을 조절한다
  And 100일치 퀘스트 목록이 표시된다

Given AI 분석 중 에러 발생
When 타임아웃(60초) 또는 API 에러
Then "분석에 실패했습니다. 다시 시도해주세요" 표시
  And 재시도 버튼 제공
```

### P2: 부가 시나리오 (Should-Have)

#### US-004: 퀘스트 결과 확인

**As a** 수험생
**I want to** 생성된 퀘스트 목록을 날짜별로 확인하고 싶다
**So that** 전체 계획을 한눈에 파악할 수 있다

**Acceptance Criteria**:
```gherkin
Given 퀘스트가 생성된 상태
When 결과 화면을 확인한다
Then 날짜별 퀘스트 카드가 목록으로 표시된다
  And 각 카드에는 날짜, 단원명, 학습 범위가 포함된다
  And 예상 학습 시간이 표시된다
```

### P3: 향후 기능 (Could-Have, MVP 제외)

- US-005: 퀘스트 다운로드 (PDF/이미지)
- US-006: 퀘스트 완료 체크 기능
- US-007: 사용자 계정 및 저장 기능

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 교재 이름 텍스트 입력 (최대 100자) | P1 | US-001 |
| FR-002 | 이미지 업로드 (JPG/PNG, 최대 10MB) | P1 | US-001 |
| FR-003 | 이미지 미리보기 표시 | P1 | US-001 |
| FR-004 | 시작/끝 단원 번호 입력 | P1 | US-002 |
| FR-005 | 목표 기간(일수) 입력 | P1 | US-002 |
| FR-006 | Vision API로 이미지 분석 | P1 | US-003 |
| FR-007 | 단원별 난이도 추정 | P1 | US-003 |
| FR-008 | 일일 퀘스트 목록 생성 | P1 | US-003 |
| FR-009 | 퀘스트 카드 리스트 표시 | P2 | US-004 |
| FR-010 | 에러 핸들링 및 재시도 | P1 | US-003 |

### Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-001 | 이미지 분석 응답 시간 | < 30초 (p95) | API 응답 시간 측정 |
| NFR-002 | 최대 이미지 크기 | 10MB | 클라이언트 검증 |
| NFR-003 | 지원 이미지 형식 | JPG, PNG | 클라이언트 검증 |
| NFR-004 | 모바일 반응형 UI | 320px ~ 1920px | 브라우저 테스트 |
| NFR-005 | API 타임아웃 | 60초 | 서버 설정 |

---

## Success Criteria

### Business Metrics
- 사용자가 퀘스트 생성 완료까지 도달하는 비율 > 70%
- 평균 폼 작성 시간 < 2분

### Technical Metrics
- API 성공률 > 95%
- Vision API 분석 정확도 (단원 추출) > 80%
- 에러 발생 시 사용자에게 명확한 피드백 제공

### UX Metrics
- 폼 필드 3개 이하 (교재명, 이미지, 기간)
- 로딩 중 진행 상태 표시
- 결과 화면에서 스크롤 가능한 목록 제공

---

## Core Entities

### Material (교재)
```typescript
interface Material {
  name: string;           // 교재 이름
  imageBase64: string;    // 업로드된 이미지 (Base64)
  imageType: 'jpg' | 'png';
}
```

### StudyGoal (학습 목표)
```typescript
interface StudyGoal {
  startUnit: number;      // 시작 단원
  endUnit: number;        // 끝 단원
  totalDays: number;      // 목표 기간 (일)
}
```

### DailyQuest (일일 퀘스트)
```typescript
interface DailyQuest {
  day: number;            // D-day (1, 2, 3...)
  date: string;           // YYYY-MM-DD (오늘 기준)
  unitNumber: number;     // 단원 번호
  unitTitle: string;      // 단원 제목
  range: string;          // 학습 범위 (예: "1.1 ~ 1.3")
  estimatedMinutes: number; // 예상 학습 시간
}
```

### QuestGenerationRequest (API 요청)
```typescript
interface QuestGenerationRequest {
  materialName: string;
  imageBase64: string;
  startUnit: number;
  endUnit: number;
  totalDays: number;
}
```

### QuestGenerationResponse (API 응답)
```typescript
interface QuestGenerationResponse {
  success: boolean;
  data?: {
    analyzedUnits: AnalyzedUnit[];
    dailyQuests: DailyQuest[];
  };
  error?: string;
}

interface AnalyzedUnit {
  unitNumber: number;
  unitTitle: string;
  subSections: string[];
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
}
```

---

## Validation Checklist

- [x] 모든 P1 시나리오에 Acceptance Criteria 정의됨
- [x] 모든 요구사항에 측정 가능한 기준 존재
- [x] 핵심 엔티티 정의 완료
- [x] MVP 범위 명확 (인증 없음, DB 없음, 단일 페이지)
- [x] AI 모델 지정됨 (Gemini 3 Flash via OpenRouter)
- [ ] 사용자 승인 대기

---

## Open Questions

1. ~~이미지 형식~~ → JPG/PNG만 지원 (확정)
2. ~~AI 모델~~ → Claude 3.5 Haiku (확정)
3. 복습 일정 포함 여부 → MVP에서는 제외, 향후 추가
