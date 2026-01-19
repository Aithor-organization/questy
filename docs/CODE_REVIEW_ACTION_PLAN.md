# QuestyBook 코드 리뷰 액션 플랜

> **작성일**: 2026-01-20
> **기반**: 코드 리뷰 리포트 분석 결과
> **적용 패턴**: LP-003 (RBAC 미들웨어), LP-317 (Supabase 동기화), LP-320 (버그 수정)

---

## 📋 작업 우선순위 매트릭스

| 우선순위 | 카테고리 | 영향도 | 긴급도 | 예상 작업량 |
|---------|---------|-------|-------|-----------|
| 🔴 P0 | 보안 (RBAC) | 높음 | 높음 | 중간 |
| 🟠 P1 | 데이터 무결성 (크롤링) | 높음 | 중간 | 중간 |
| 🟡 P2 | 성능 최적화 (N+1) | 중간 | 낮음 | 낮음 |
| 🟢 P3 | 캐시 전략 (React Query) | 낮음 | 낮음 | 높음 |

---

## 🔴 Phase 1: 보안 강화 (P0) - RBAC 구현

### 1.1 문제 요약
- 프론트엔드에서 이메일 하드코딩으로 관리자 판단
- 백엔드와 프론트엔드 권한 체크 불일치

### 1.2 해결 방안

#### Step 1: Supabase profiles 테이블 role 컬럼 추가
```sql
-- Migration: add_role_to_profiles.sql
ALTER TABLE public.profiles
ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator'));

-- 기존 관리자 업데이트
UPDATE public.profiles
SET role = 'admin'
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@questybook.com');

-- 인덱스 추가
CREATE INDEX idx_profiles_role ON public.profiles(role);
```

#### Step 2: 백엔드 미들웨어 강화 (LP-003 패턴 적용)
```typescript
// packages/backend/src/middleware/auth.ts
export const authorize = (...allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    // profiles 테이블에서 role 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !allowedRoles.includes(profile.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    c.set('userRole', profile.role);
    await next();
  };
};

// 사용 예시
adminRoutes.use('/*', authenticate, authorize('admin'));
```

#### Step 3: 프론트엔드 권한 체크 수정
```typescript
// packages/frontend/src/stores/authStore.ts
// Before: isAdmin: supabaseUser.email === 'admin@questybook.com'
// After:
isAdmin: async () => {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return data?.role === 'admin';
}
```

### 1.3 작업 항목
- [ ] Supabase Migration 스크립트 작성 및 실행
- [ ] 백엔드 `authorize` 미들웨어 구현
- [ ] 모든 admin 라우트에 미들웨어 적용
- [ ] 프론트엔드 authStore 수정
- [ ] AdminRoute 컴포넌트 권한 체크 로직 수정

### 1.4 예상 소요: 2-3시간

---

## 🟠 Phase 2: 데이터 무결성 (P1) - 크롤링 저장 로직 이동

### 2.1 문제 요약
- 크롤링 결과를 프론트엔드에서 저장 → 브라우저 종료 시 데이터 손실 위험

### 2.2 해결 방안

#### Step 1: 백엔드 크롤링 API 개선
```typescript
// packages/backend/src/routes/admin.ts
adminRoutes.post('/crawl-and-save', async (c) => {
  const { url, platform } = await c.req.json();

  // 1. 크롤링 수행
  const crawler = getCrawler(platform);
  const courseData = await crawler.getCurriculumFromUrl(url);

  if (!courseData.success) {
    return c.json({ success: false, error: courseData.error }, 400);
  }

  // 2. 트랜잭션으로 저장 (백엔드에서 처리)
  const { data, error } = await supabase
    .from('courses')
    .upsert({
      platform,
      external_id: courseData.courseId,
      title: courseData.title,
      lecturer_name: courseData.lecturer,
      curriculum: courseData.curriculum,
      is_completed: courseData.isCompleted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform,external_id' })
    .select()
    .single();

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data });
});
```

#### Step 2: 프론트엔드 단순화
```typescript
// packages/frontend/src/hooks/useAdminCourses.ts
const crawlAndSave = async (url: string, platform: string) => {
  // 저장 로직 제거, 백엔드 API만 호출
  const response = await fetch('/api/admin/crawl-and-save', {
    method: 'POST',
    body: JSON.stringify({ url, platform }),
  });
  return response.json();
};
```

### 2.3 작업 항목
- [ ] 백엔드 `/crawl-and-save` 엔드포인트 구현
- [ ] Supabase Service Role Key 사용 설정
- [ ] 프론트엔드 크롤링 hook 단순화
- [ ] 에러 핸들링 및 재시도 로직 추가

### 2.4 예상 소요: 1-2시간

---

## 🟡 Phase 3: 성능 최적화 (P2) - N+1 쿼리 해결

### 3.1 문제 요약
- 사용자 조회 시 profiles, students, memberships 개별 쿼리
- auth.admin.listUsers 전체 루프 조회

### 3.2 해결 방안

#### Step 1: Join Query 활용
```typescript
// Before (N+1)
const profiles = await supabase.from('profiles').select('*');
const students = await supabase.from('students').select('*');
const memberships = await supabase.from('user_memberships').select('*');

// After (Single Query with Join)
const { data } = await supabase
  .from('profiles')
  .select(`
    *,
    students!inner(*),
    user_memberships(*)
  `)
  .limit(50)
  .range(offset, offset + limit);
```

#### Step 2: 사용자 목록 API 페이지네이션
```typescript
// packages/backend/src/routes/admin-users.ts
adminRoutes.get('/users', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;

  // 전체 루프 대신 페이지네이션
  const { data, count } = await supabase
    .from('profiles')
    .select('*, students(*), user_memberships(*)', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  return c.json({
    users: data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
});
```

### 3.3 작업 항목
- [ ] 사용자 조회 쿼리 Join으로 변경
- [ ] 페이지네이션 파라미터 추가
- [ ] 프론트엔드 무한스크롤 또는 페이지네이션 UI 추가

### 3.4 예상 소요: 1-2시간

---

## 🟢 Phase 4: 캐시 전략 (P3) - React Query 도입 (선택적)

### 4.1 문제 요약
- zustand persist의 수동 캐싱은 stale data 감지 어려움
- 데이터 동기화 로직 직접 구현 필요

### 4.2 해결 방안 (장기 로드맵)

> **주의**: React Query 도입은 대규모 리팩토링이 필요하므로 장기 계획으로 분류

#### 단기 개선안 (현재 아키텍처 유지)
```typescript
// packages/frontend/src/stores/questStore.ts
// staleTime 기반 재검증 로직 추가
const STALE_TIME = 5 * 60 * 1000; // 5분

const shouldRefetch = () => {
  const lastFetched = localStorage.getItem('plans_last_fetched');
  if (!lastFetched) return true;
  return Date.now() - parseInt(lastFetched) > STALE_TIME;
};

const fetchPlans = async () => {
  if (!shouldRefetch()) return get().plans;

  const { data } = await supabase.from('quest_plans').select('*');
  localStorage.setItem('plans_last_fetched', Date.now().toString());
  return data;
};
```

#### 장기 개선안 (React Query 마이그레이션)
```typescript
// packages/frontend/src/queries/usePlans.ts
export const usePlans = () => {
  return useQuery({
    queryKey: ['plans', userId],
    queryFn: () => supabase.from('quest_plans').select('*'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};
```

### 4.3 작업 항목 (장기)
- [ ] TanStack Query 설치 및 Provider 설정
- [ ] 주요 데이터 조회 훅을 Query 기반으로 마이그레이션
- [ ] zustand는 로컬 UI 상태만 관리하도록 역할 분리

### 4.4 예상 소요: 1-2일 (전체 마이그레이션)

---

## 📊 실행 순서 요약

```
Phase 1 (P0) ──→ Phase 2 (P1) ──→ Phase 3 (P2) ──→ Phase 4 (P3)
   보안           데이터무결성       성능최적화        캐시전략
  [필수]           [필수]           [권장]           [선택]
  2-3시간          1-2시간          1-2시간          1-2일
```

### 즉시 실행 권장 (P0 + P1)
총 예상 소요: **3-5시간**

### 점진적 개선 (P2 + P3)
총 예상 소요: **1-3일**

---

## ✅ 체크리스트

### 보안 (P0)
- [ ] profiles.role 컬럼 추가 마이그레이션
- [ ] authorize 미들웨어 구현
- [ ] admin 라우트 미들웨어 적용
- [ ] authStore.isAdmin 로직 수정
- [ ] AdminRoute 컴포넌트 수정

### 데이터 무결성 (P1)
- [ ] /crawl-and-save 백엔드 엔드포인트
- [ ] 프론트엔드 hook 단순화
- [ ] 에러 핸들링 추가

### 성능 (P2)
- [ ] Join Query 적용
- [ ] 페이지네이션 구현
- [ ] 프론트엔드 UI 수정

### 캐시 (P3)
- [ ] staleTime 기반 재검증 (단기)
- [ ] React Query 마이그레이션 (장기)

---

## 🔗 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `packages/backend/src/middleware/auth.ts` | authorize 미들웨어 추가 |
| `packages/backend/src/routes/admin.ts` | crawl-and-save 엔드포인트 |
| `packages/backend/src/routes/admin-users.ts` | 페이지네이션 적용 |
| `packages/frontend/src/stores/authStore.ts` | isAdmin 로직 수정 |
| `packages/frontend/src/components/AdminRoute.tsx` | 권한 체크 수정 |
| `packages/frontend/src/hooks/useAdminCourses.ts` | 크롤링 로직 단순화 |
| `supabase/migrations/xxx_add_role.sql` | role 컬럼 마이그레이션 |

---

## 📝 Notes

1. **보안은 타협 불가**: P0 작업은 프로덕션 배포 전 필수 완료
2. **점진적 개선**: P2, P3는 서비스 운영 중 점진적으로 적용 가능
3. **테스트 필수**: 각 Phase 완료 후 관련 기능 통합 테스트 수행
4. **롤백 계획**: 각 마이그레이션에 대한 롤백 스크립트 준비
