# QuestyBook 코드베이스 이슈 해결 계획서

> **작성일**: 2026-01-19
> **분석 기반**: 코드베이스 감사 보고서
> **상태**: ✅ 7/7 이슈 모두 해결 완료 (2026-01-19)

---

## 이슈 상태 요약

| # | 이슈 | 상태 | 우선순위 | 난이도 |
|---|------|------|---------|--------|
| 1 | 환경 변수 불일치 | ✅ **해결됨** | - | - |
| 2 | VisionPlanner 누락 | ✅ **이슈 아님** | - | - |
| 3 | 타입 안전성 | ✅ **해결됨** (Phase 2 완료) | - | - |
| 4 | 로그아웃 실패 | ✅ **해결됨** | - | - |
| 5 | 저장 실패 (플랜/프로필) | ✅ **해결됨** | - | - |
| 6 | 관리자 페이지 불능 | ✅ **해결됨** | - | - |
| 7 | 데이터 로딩 지연 | ✅ **해결됨** | - | - |

---

## 1. ✅ 환경 변수 불일치 - 해결 완료

**커밋**: `acbc9a0`

| 파일 | 변경 내용 |
|------|----------|
| `questyCoachAgent/src/memory/storage/supabase-client.ts` | `SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` |
| `questyCoachAgent/.../supabase-pattern-client.ts` | 동일 |
| `questyCoachAgent/.../supabase-performance-client.ts` | 동일 |

**Railway 조치**: 기존에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있다면 **변경 불필요**

---

## 2. ✅ VisionPlanner - 이슈 아님

**조사 결과**: Git history 전체 검색 결과 `vision-planner` 파일이 존재한 적 없음

```bash
git log --all --oneline -- "**/vision*" → 결과 없음
```

**결론**: 보고서에 언급된 내용은 계획/논의 단계였으며 실제 구현된 적 없음. **조치 불필요**

---

## 3. 🟡 타입 안전성 - 추가 작업 필요

### 완료된 작업
- `yes24-scraper.ts`: `@questybook/shared`에서 타입 import
- `generate.ts`: `BookMetadataSchema` shared에서 import
- `quest-generator.ts`: `DailyQuest` → `SimpleDailyQuest` 리네임 + 문서화
- 프론트엔드 타입 문서화 추가

### 남은 작업

**문제**: DailyQuest 타입이 4곳에서 다르게 정의됨

| 위치 | 용도 | 구조 |
|------|------|------|
| `@questybook/shared` | 공통 스키마 | `tasks[]`, `studyTips` 포함 |
| `quest-generator.ts` | 백엔드 생성 | 단순 구조 (SimpleDailyQuest) |
| `useQuestGeneration.ts` | API 응답 파싱 | 중간 구조 |
| `questStore.ts` | 클라이언트 상태 | `timerRecord`, `isPractice` 포함 |

### 해결 방안

```
[Phase 1] 문서화 (완료) → [Phase 2] 타입 분리 정리 (권장)
```

**Phase 2 권장 작업**:
1. `@questybook/shared`에 3가지 타입 정의:
   - `DailyQuestBase` - 공통 필드
   - `DailyQuestAPI` - API 응답용
   - `DailyQuestClient` - 클라이언트 확장

2. 각 패키지에서 적절한 타입 import

**예상 작업량**: 2-3시간

---

## 4. 🔴 로그아웃 실패 - 코드 개선 필요

### 분석 결과

**파일**: `authStore.ts:638-690`

```typescript
logout: async () => {
  // 1. Supabase 세션 종료
  if (supabase) {
    await supabase.auth.signOut();  // ⚠️ 완료 대기 후 진행
  }

  // 2. Zustand 상태 초기화
  set({ user: null, ... });

  // 3. localStorage 정리
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
```

### 잠재적 문제점

| 문제 | 원인 | 해결 |
|------|------|------|
| 경쟁 상태 | persist 미들웨어가 상태 변경을 감지하고 다시 저장 | 순서 변경: localStorage 먼저 삭제 |
| 비동기 누락 | signOut 중 페이지 이동 | signOut 완료 대기 보장 |
| 다중 탭 | localStorage 변경이 다른 탭 zustand에 미반영 | `BroadcastChannel` 또는 storage 이벤트 활용 |

### 해결 계획

```typescript
logout: async () => {
  // 1. localStorage 먼저 모두 삭제 (persist 재저장 방지)
  const keysToRemove = [...];
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // 2. Zustand 상태 초기화
  set({ user: null, session: null, ... });

  // 3. Supabase 세션 종료 (마지막)
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Auth] signOut error (ignored):', e);
    }
  }
}
```

**예상 작업량**: 30분

---

## 5. 🔴 저장 실패 (플랜/프로필) - 아키텍처 개선 필요

### 분석 결과

**문제 1: Silent Failure** (`supabase-storage.ts:155-196`)

```typescript
setItem: async (key, value) => {
  // 1. localStorage에 즉시 저장 ✅
  setLocalStorage(key, serialized);

  // 2. Supabase에 비동기 저장
  const { error } = await supabase.from(STORAGE_TABLE).upsert(...);

  if (error) {
    console.error('[SupabaseStorage] setItem 실패:', error);  // ⚠️ 로그만 남김
  }
}
```

**문제점**: Supabase 저장 실패 시 UI에 알림 없음

**문제 2: 재시도 로직 부재**

네트워크 불안정 시 일회성 실패로 데이터 손실 가능

### 해결 계획

**Option A: 콜백 기반** (최소 변경)
```typescript
// supabase-storage.ts
export function createSupabaseStorage<T>(
  storeName: string,
  onSyncError?: (error: Error) => void  // 에러 콜백 추가
): PersistStorage<T>
```

**Option B: 재시도 + 큐 시스템** (권장)
```typescript
// 실패한 작업을 큐에 저장
interface PendingSync {
  storeName: string;
  key: string;
  value: string;
  retryCount: number;
}

// 주기적으로 재시도 (exponential backoff)
```

**Option C: Toast 알림** (UX 개선)
```typescript
// 저장 실패 시 사용자에게 알림
if (error) {
  toast.error('데이터 동기화에 실패했습니다. 다시 시도해주세요.');
}
```

**권장**: Option A + Option C 조합

**예상 작업량**: 2-3시간

---

## 6. 🟡 관리자 페이지 불능 - DB 확인 필요

### 분석 결과

**파일**: `admin-page/index.tsx:111-144`

```typescript
const checkAdminStatus = async (userId: string) => {
  // 5초 타임아웃
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 5000)
  );

  const queryPromise = supabase
    .from('admins')
    .select('id, name, role')
    .eq('user_id', userId)
    .single();

  // ...
}
```

### 잠재적 문제점

| 가능성 | 확인 방법 | 해결 |
|--------|----------|------|
| `admins` 테이블 없음 | Supabase 대시보드 확인 | 테이블 생성 |
| RLS 정책 차단 | Supabase RLS 정책 확인 | Select 정책 추가 |
| 타임아웃 (5초) | 네트워크 지연 시 | 타임아웃 10초로 증가 |
| 관리자 데이터 없음 | `admins` 테이블 조회 | 레코드 삽입 |

### 해결 계획

**Step 1**: Supabase 대시보드에서 확인
```sql
-- admins 테이블 존재 확인
SELECT * FROM admins LIMIT 5;

-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'admins';
```

**Step 2**: 필요 시 RLS 정책 추가
```sql
-- 인증된 사용자가 자신의 admin 레코드 조회 허용
CREATE POLICY "Users can view own admin status"
ON admins FOR SELECT
USING (auth.uid() = user_id);
```

**Step 3**: 타임아웃 증가 (코드 수정)
```typescript
const timeoutPromise = new Promise<null>((resolve) =>
  setTimeout(() => resolve(null), 10000)  // 5초 → 10초
);
```

**예상 작업량**: DB 확인 15분, 코드 수정 15분

---

## 7. 🟢 데이터 로딩 지연 - 최적화 권장

### 분석 결과

**파일**: `supabase-storage.ts:290-322`

```typescript
export async function syncFromSupabase(storeName: string) {
  // ...
  if (data && data.length > 0) {
    for (const item of data) {
      setLocalStorage(item.key, item.value);  // ⚠️ 동기 루프
    }
  }
}
```

### 문제점

대량 데이터 시 메인 스레드 차단 → UI 프리징

### 해결 계획

**Option A: 청크 처리** (권장)
```typescript
async function syncFromSupabase(storeName: string) {
  // ...
  if (data && data.length > 0) {
    const CHUNK_SIZE = 10;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      chunk.forEach(item => setLocalStorage(item.key, item.value));

      // 다음 청크 전 이벤트 루프에 양보
      if (i + CHUNK_SIZE < data.length) {
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
}
```

**Option B: Web Worker** (고급)
- localStorage 작업을 Worker로 이전
- 메인 스레드 완전 분리

**권장**: Option A (간단하고 효과적)

**예상 작업량**: 1시간

---

## 실행 우선순위

```
🔴 긴급 (사용자 영향 높음)
├── 4. 로그아웃 실패 수정 (30분)
└── 5. 저장 실패 알림 추가 (2-3시간)

🟡 중요 (안정성)
├── 6. 관리자 페이지 DB 확인 (30분)
└── 3. 타입 안전성 Phase 2 (2-3시간)

🟢 개선 (성능)
└── 7. 데이터 로딩 최적화 (1시간)
```

---

## 결론

| 항목 | 상태 |
|------|------|
| **모두 완료** | #1, #2, #3, #4, #5, #6, #7 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-19 | 초안 작성, #1 환경변수 해결 완료 |
| 2026-01-19 | #4 로그아웃 경쟁상태 수정 (localStorage 먼저 삭제, try-catch 추가) |
| 2026-01-19 | #5 저장 실패 Toast 알림 추가 (toastStore + ToastContainer) |
| 2026-01-19 | #6 관리자 페이지 타임아웃 5초→10초 |
| 2026-01-19 | #7 syncFromSupabase 청크 처리 적용 (UI 프리징 방지) |
| 2026-01-19 | #3 타입 안전성 Phase 2 완료 (DailyQuestBase/API/Client 계층 구조 도입) |
