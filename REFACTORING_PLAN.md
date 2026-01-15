# QuestyBook 리팩토링 계획

> 생성일: 2026-01-15
> 목표: 각 파일 150줄 내외로 모듈화

## 📊 현황 분석

### 대상 파일 (150줄 초과)

| 순위 | 파일 | 줄수 | 초과량 | 우선순위 |
|------|------|------|--------|----------|
| 1 | `backend/src/routes/coach.ts` | 1996 | +1846 | 🔴 HIGH |
| 2 | `frontend/src/pages/AdminPage.tsx` | 1631 | +1481 | 🔴 HIGH |
| 3 | `frontend/src/pages/CurriculumPage.tsx` | 797 | +647 | 🟡 MEDIUM |
| 4 | `backend/src/db/index.ts` | 688 | +538 | 🟡 MEDIUM |
| 5 | `frontend/src/hooks/useAdminCourses.ts` | 618 | +468 | 🟡 MEDIUM |
| 6 | `frontend/src/pages/TodayPage.tsx` | 603 | +453 | 🟡 MEDIUM |

---

## 🔴 1. coach.ts 리팩토링 (1996줄 → 7개 파일)

### 현재 구조
```
routes/coach.ts (1996줄)
├── 학생 관리 API
├── 일일 코칭 API
├── 저녁 리뷰 API
├── 리마인더/개입 API
├── 퀘스트 CRUD
├── 일정 조정 API
└── 유틸리티 함수
```

### 분리 계획
```
routes/coach/
├── index.ts          (~50줄)  - 라우터 통합 export
├── students.ts       (~146줄) - 학생 등록/조회/프로필
├── daily.ts          (~150줄) - 일일 메시지, 코칭 팁
├── reviews.ts        (~150줄) - 저녁 리뷰 생성
├── interventions.ts  (~150줄) - 리마인더, 위기 개입, 미학습
├── quests.ts         (~150줄) - 퀘스트 CRUD
├── scheduler.ts      (~150줄) - 자동 일정 변경
└── utils.ts          (~100줄) - 공유 헬퍼, 검증 함수
```

### 의존성
- **imports**: hono, zod, @questy/coach-agent, ../db/index.js
- **importedBy**: backend/src/index.ts

### 마이그레이션 단계
1. `routes/coach/` 디렉토리 생성
2. 각 함수 그룹을 개별 파일로 이동
3. 공통 타입/유틸 추출
4. index.ts에서 통합 export
5. backend/src/index.ts 수정

---

## 🔴 2. AdminPage.tsx 리팩토링 (1631줄 → 6개 파일)

### 현재 구조
```
pages/AdminPage.tsx (1631줄)
├── 인증 관리 (로그인/권한)
├── 강사 관리 UI
├── 강좌 관리 UI
├── 배치 업데이트 모달
├── 상세 강좌 모달
└── 필터/검색 로직
```

### 분리 계획
```
pages/admin/
├── index.tsx              (~80줄)  - 메인 페이지 컨테이너
├── AdminAuth.tsx          (~120줄) - 로그인, 권한 확인
├── TeacherManagement.tsx  (~150줄) - 강사 목록/추가/수정
├── CourseManagement.tsx   (~150줄) - 강좌 목록/추가/수정
├── BatchUpdateModal.tsx   (~150줄) - 배치 업데이트 진행
├── CourseDetailModal.tsx  (~120줄) - 강좌 상세 보기
└── types.ts               (~50줄)  - 공유 타입
```

### 의존성
- **imports**: react, lucide-react, ../lib/supabase, ../hooks/useAdminCourses
- **importedBy**: App.tsx (라우팅)

### 상태 관리 개선
```typescript
// 현재: 20+ useState 변수
// 개선: useReducer 또는 컴포넌트별 로컬 상태
```

---

## 🟡 3. CurriculumPage.tsx 리팩토링 (797줄 → 4개 파일)

### 분리 계획
```
pages/curriculum/
├── index.tsx               (~100줄) - 3단계 플로우 컨테이너
├── SettingsStep.tsx        (~150줄) - Step 1: 목표일/시간 설정
├── CourseSelectionStep.tsx (~150줄) - Step 2: 강좌 검색/선택
└── PreviewStep.tsx         (~150줄) - Step 3: 퀘스트 미리보기
```

### 의존성
- **imports**: ../components/notebook/*, ../hooks/useCurriculumGeneration
- **importedBy**: App.tsx

---

## 🟡 4. db/index.ts 리팩토링 (688줄 → 8개 파일)

### 분리 계획
```
db/
├── index.ts      (~50줄)  - 통합 export
├── init.ts       (~100줄) - DB 연결, 테이블 생성
├── students.ts   (~50줄)  - 학생 CRUD
├── plans.ts      (~60줄)  - 플랜 CRUD
├── quests.ts     (~80줄)  - 퀘스트 CRUD
├── tasks.ts      (~50줄)  - 태스크 CRUD
├── progress.ts   (~60줄)  - 진도 관리
├── courses.ts    (~150줄) - 강좌 CRUD (가장 큼)
└── stats.ts      (~50줄)  - 통계 조회
```

### 의존성
- **imports**: drizzle-orm, bun:sqlite, ./schema.js
- **importedBy**: 모든 backend routes

---

## 🟡 5. useAdminCourses.ts 리팩토링 (618줄 → 4개 파일)

### 분리 계획
```
hooks/admin/
├── index.ts               (~30줄)  - 통합 export
├── useTeachers.ts         (~120줄) - 강사 관련 함수
├── useCourseQueries.ts    (~100줄) - 강좌 조회 함수
├── useCourseOperations.ts (~150줄) - 강좌 생성/수정/삭제
└── useBatchUpdate.ts      (~120줄) - 배치 업데이트
```

### 타입 분리
```
types/admin.ts (~60줄) - Teacher, Course 인터페이스
```

---

## 🟡 6. TodayPage.tsx 리팩토링 (603줄 → 5개 파일)

### 분리 계획
```
pages/today/
├── index.tsx              (~100줄) - 메인 페이지
├── EmptyStateView.tsx     (~70줄)  - 플랜 없을 때 UI
├── TodayPageContent.tsx   (~150줄) - 메인 콘텐츠
├── TodayPageModals.tsx    (~100줄) - 모달들 (리뷰, 경고, 위기)
└── hooks/
    └── useCoachData.ts    (~80줄)  - 코치 데이터 로드
```

### API 함수 추출
```
services/coachApi.ts (~150줄) - 저녁 리뷰, 리마인더, 위기 개입 API
```

---

## 📋 실행 순서

### Phase 1: Backend (높은 영향도)
1. ✅ `db/index.ts` 분리 (다른 라우트들이 의존)
2. ✅ `coach.ts` 분리 (가장 큰 파일)

### Phase 2: Frontend Hooks
3. ✅ `useAdminCourses.ts` 분리

### Phase 3: Frontend Pages
4. ✅ `AdminPage.tsx` 분리
5. ✅ `CurriculumPage.tsx` 분리
6. ✅ `TodayPage.tsx` 분리

---

## 🔧 리팩토링 원칙

### 1. 단일 책임 원칙 (SRP)
- 각 파일은 하나의 명확한 책임만 가짐
- 파일명이 책임을 설명해야 함

### 2. 파일 크기 제한
- 목표: 150줄 내외
- 최대: 200줄 (예외적 경우)

### 3. 의존성 방향
```
pages → hooks → services → lib
         ↓
      components
```

### 4. 공유 코드 추출
- 타입: `types/` 디렉토리
- 유틸리티: `utils/` 디렉토리
- API 호출: `services/` 디렉토리

---

## ⚠️ 주의사항

### 테스트 필요 항목
- [ ] coach.ts 분리 후 모든 API 엔드포인트 동작 확인
- [ ] AdminPage 분리 후 관리자 기능 테스트
- [ ] Supabase 연동 코드 정상 작동 확인

### 브레이킹 체인지
- `coach.ts` → `coach/index.ts` 경로 변경
- `db/index.ts` export 변경 없음 (호환성 유지)

### 롤백 계획
- Git 브랜치: `refactor/modularize-large-files`
- 각 파일 분리 후 별도 커밋

---

## 📈 예상 결과

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| 최대 파일 크기 | 1996줄 | 150줄 |
| 평균 파일 크기 | 955줄 | 100줄 |
| 파일 수 | 6개 | 35개 |
| 유지보수성 | 낮음 | 높음 |

---

## 📝 다음 단계

1. **즉시**: 이 계획 검토 및 승인
2. **Phase 1**: db/index.ts → coach.ts 순서로 분리
3. **Phase 2**: Frontend hooks 분리
4. **Phase 3**: Frontend pages 분리
5. **완료**: 통합 테스트 및 코드 리뷰
