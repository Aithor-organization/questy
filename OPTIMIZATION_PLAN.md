# QuestyBook 최적화 계획서

> 작성일: 2026-01-18
> 분석 대상: Backend (468K), Frontend (996K), CoachAgent (668K)
> 총 TypeScript 파일: 285개

---

## 1. Dead Code 분석 결과

### 1.1 Backend (`packages/backend/src`)

| 파일/모듈 | 상태 | 설명 | 조치 |
|----------|------|------|------|
| `crawlers/mimac/` | ⚠️ Dead Code | mimac 크롤러 - admin.ts에서만 참조, 실제 사용 여부 확인 필요 | 검토 후 제거 |
| `lib/yes24-scraper.ts` | ✅ 사용 중 | books.ts, generate.ts에서 사용 | 유지 |
| `lib/ai-plan-reviewer.ts` | ✅ 사용 중 | generate.ts에서 사용 | 유지 |
| `lib/image-analyzer.ts` | ✅ 사용 중 | quest-generator, generate.ts에서 사용 | 유지 |
| `lib/quest-generator.ts` | ✅ 사용 중 | plan.ts, generate.ts에서 사용 | 유지 |

### 1.2 Frontend (`packages/frontend/src`)

| 파일/모듈 | 상태 | 설명 | 조치 |
|----------|------|------|------|
| `pages/ChatPage.tsx` | ⚠️ Legacy | 하위 호환성용 리다이렉트만 수행 | 라우트 정리 후 제거 가능 |
| `pages/CurriculumPage.tsx` | 🔴 Dead Code | 946줄, App.tsx에서 사용 안 함 (`/curriculum` → `/generate?tab=curriculum` 리다이렉트) | **제거 권장** |
| `pages/AdmissionPage.tsx` | ✅ Re-export | admission/ 폴더로 리다이렉트 | 유지 (barrel export) |
| `pages/GeneratePageV2.tsx` | ✅ Re-export | generate/ 폴더로 리다이렉트 | 유지 (barrel export) |

### 1.3 CoachAgent (`questyCoachAgent/src`)

| 파일/모듈 | 상태 | 설명 | 조치 |
|----------|------|------|------|
| `memory/storage/chroma-client.ts` | ⚠️ 미사용 가능성 | 484줄, ChromaDB 클라이언트 - 환경변수만 설정, 실제 사용 확인 필요 | 검토 후 제거 |
| `core/agents/*-agent.ts` (루트) | ✅ Re-export | 모듈화된 폴더로 re-export | 유지 (barrel export) |

---

## 2. 최적화 대상 (Large Files)

### 2.1 Frontend 대형 파일 (분리 권장)

| 파일 | 줄 수 | 권장 조치 |
|------|-------|----------|
| `pages/CurriculumPage.tsx` | 946줄 | **삭제** (Dead Code) |
| `pages/TodayPage.tsx` | 892줄 | 컴포넌트 분리 (DailyQuests, ProgressSummary 등) |
| `pages/MyPage.tsx` | 785줄 | 섹션별 컴포넌트 분리 |
| `pages/OnboardingPage.tsx` | 562줄 | 스텝별 컴포넌트 분리 |
| `pages/TipsPage.tsx` | 529줄 | 팁 카드 컴포넌트 분리 |

### 2.2 CoachAgent 대형 파일

| 파일 | 줄 수 | 권장 조치 |
|------|-------|----------|
| `quest/quest-tracker.ts` | 535줄 | 핸들러 패턴으로 분리 |
| `quest/schedule-delay-handler.ts` | 534줄 | 유틸리티 분리 |
| `memory/storage/chroma-client.ts` | 484줄 | 사용 안 하면 제거 |
| `memory/memory-lane.ts` | 449줄 | 검색/저장 로직 분리 |

---

## 3. 최적화 실행 계획

### Phase 1: Dead Code 제거 (즉시 실행 가능)

```
우선순위: HIGH
예상 효과: 번들 사이즈 ~50KB 감소, 유지보수성 향상

1. pages/CurriculumPage.tsx 삭제 (946줄)
   - App.tsx에서 사용 안 함
   - /curriculum 라우트는 이미 /generate?tab=curriculum으로 리다이렉트

2. pages/index.ts에서 CurriculumPage export 제거

3. crawlers/mimac/ 사용 여부 확인 후 제거 검토
```

### Phase 2: 코드 분리 및 모듈화 (중기)

```
우선순위: MEDIUM
예상 효과: 코드 가독성 향상, 재사용성 증가

1. TodayPage.tsx 컴포넌트 분리
   - DailyQuestList 컴포넌트
   - ProgressSummary 컴포넌트
   - QuickActions 컴포넌트

2. MyPage.tsx 섹션 분리
   - ProfileSection
   - SettingsSection
   - StatsSection
```

### Phase 3: CoachAgent 정리 (장기)

```
우선순위: LOW
예상 효과: 메모리 사용량 감소, 시작 시간 단축

1. chroma-client.ts 사용 여부 확인
   - 현재 Supabase만 사용 중이면 제거
   - ChromaDB 계획 있으면 유지

2. quest-tracker.ts 모듈화
   - 핸들러별 분리
```

---

## 4. 번들 최적화 권장사항

### 4.1 Frontend

```typescript
// 현재 의존성 (적절함)
- react, react-dom: 필수
- react-router-dom: 필수
- @tanstack/react-query: 적절
- zustand: 적절 (경량 상태관리)
- date-fns: 적절 (tree-shaking 지원)
- lucide-react: 아이콘 (tree-shaking 지원)

// 권장 사항
- react-markdown: 필요 시에만 dynamic import 고려
- @supabase/supabase-js: 이미 필수
```

### 4.2 Backend

```typescript
// 현재 의존성 (적절함)
- hono: 경량 프레임워크 ✅
- drizzle-orm: 경량 ORM ✅
- openai: 필수

// 최적화 가능
- cheerio: 크롤링에만 사용 - lazy loading 고려
```

---

## 5. 실행 체크리스트

### 즉시 실행 (Phase 1)

- [ ] `pages/CurriculumPage.tsx` 삭제
- [ ] `pages/index.ts`에서 CurriculumPage export 제거
- [ ] 빌드 테스트
- [ ] 로컬 동작 확인

### 중기 실행 (Phase 2)

- [ ] TodayPage.tsx 컴포넌트 분리
- [ ] MyPage.tsx 섹션 분리
- [ ] 테스트 추가

### 장기 실행 (Phase 3)

- [ ] chroma-client.ts 사용 여부 최종 확인
- [ ] 미사용 시 제거
- [ ] CoachAgent 모듈 구조 개선

---

## 6. 예상 효과

| 항목 | 현재 | 최적화 후 | 개선율 |
|------|------|----------|--------|
| Dead Code | ~1,500줄 | 0줄 | 100% |
| Frontend 번들 | ~996KB | ~900KB | ~10% |
| 대형 파일 (500줄+) | 9개 | 5개 | 44% |
| 유지보수 복잡도 | HIGH | MEDIUM | - |

---

## 7. 결론

### 즉시 조치 필요 (HIGH)
1. **CurriculumPage.tsx 삭제** - 946줄 Dead Code

### 검토 필요 (MEDIUM)
1. mimac 크롤러 사용 여부 확인
2. chroma-client.ts 사용 여부 확인

### 장기 개선 (LOW)
1. 대형 컴포넌트 분리
2. 모듈 구조 개선
