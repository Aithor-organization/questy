# 스마트 스케줄링 시스템 명세서

> 일일 학습량 제한, 기존 플랜 고려, AI 기반 재스케줄링을 통합한 지능형 학습 스케줄링 시스템

## 개요

| 항목 | 내용 |
|------|------|
| 기능명 | 스마트 스케줄링 시스템 (Smart Scheduling System) |
| 목적 | 실제 수험생의 학습 가능량을 고려한 현실적인 계획 생성 및 자동 조정 |
| 핵심 원칙 | 하루 학습량 제한 + 기존 플랜 고려 + 미완료 퀘스트 재배치 |

---

## 1. 현재 시스템 분석

### 1.1 기존 구현 현황

#### ✅ 이미 구현된 기능
| 기능 | 구현 위치 | 설명 |
|------|----------|------|
| 80% 버퍼 법칙 | `QuestManager.py` | 가용 시간의 80%만 계획 (20% 여유) |
| 과목별 일일 시간 제한 | `_calculate_subject_daily_minutes()` | 비율 기반 과목별 시간 배분 |
| 인강 시간 비율 제한 | `MAX_LECTURE_RATIO_*` | 단일 60%, 복수 45% 제한 |
| 자습 시간 최소 보장 | `MIN_SELF_STUDY_RATIO` | 최소 30% 자습 시간 확보 |
| 50:50 인강:자습 비율 | 자동 계산 | 인강 = 자습 + 복습 시간 |
| 순차적 강의 배분 | `_distribute_quests_by_ratio()` | 과목 내 강의 순서 보장 |

#### ⚠️ 미구현/개선 필요 기능
| 기능 | 현재 상태 | 개선 필요 |
|------|----------|----------|
| 기존 플랜 시간 고려 | 과목별 독립 관리 | 일일 총 가용 시간에서 기존 플랜 차감 필요 |
| 미완료 퀘스트 재배치 | 미구현 | 자정/사용자 설정 시간에 자동 재스케줄링 |
| 남은 일수 기반 조정 | 부분 구현 | D-day 기반 동적 학습량 조정 |
| 5일 단위 운영법 | Flag만 존재 | 실제 로직 미구현 |

### 1.2 핵심 스케줄링 알고리즘 (현재)

```
[입력]
- 선택된 강좌들 (course_contents)
- 과목별 시간 비율 (subject_ratio)
- 일일 총 학습 시간 (daily_total_minutes)
- 학습 기간 (total_days)

[처리]
1. 80% 버퍼 적용 → effective_minutes = daily_total_minutes × 0.80
2. 과목별 일일 시간 계산 → subject_daily_minutes
3. 인강 시간 제한 계산 → daily_lecture_limit
4. 순차적 퀘스트 배분 (인강 제한 내)
5. 복습 퀘스트 배치 (당일/다음날)
6. 자습 퀘스트 생성 (남은 시간)

[출력]
- 일별 퀘스트 목록 (순서 보장)
```

---

## 2. 향상된 스케줄링 시스템 설계

### 2.1 일일 학습 가능량 계산 모델

#### 2.1.1 기본 공식

```
실제_가용_시간 = 일일_총시간 × 0.80 - 기존_플랜_시간 - 휴식_시간

where:
- 일일_총시간: 사용자 설정 (기본 360분 = 6시간)
- 0.80: 버퍼 비율 (예비 시간 20%)
- 기존_플랜_시간: 이미 등록된 플랜들의 해당 날짜 퀘스트 시간 합계
- 휴식_시간: 50분 학습 당 10분 휴식 (포모도로 기반)
```

#### 2.1.2 휴식 시간 계산

```python
def calculate_rest_time(study_minutes: int) -> int:
    """포모도로 기반 휴식 시간 계산"""
    # 50분 학습 + 10분 휴식 = 60분 사이클
    cycles = study_minutes // 50
    short_breaks = cycles * 10  # 짧은 휴식

    # 4사이클마다 긴 휴식 (30분)
    long_breaks = (cycles // 4) * 20  # 추가 휴식 시간

    return short_breaks + long_breaks
```

#### 2.1.3 데이터베이스 스키마

```sql
-- 학생별 학습 설정
CREATE TABLE student_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,

  -- 일일 학습 설정
  daily_study_minutes INTEGER DEFAULT 360,  -- 기본 6시간
  max_study_minutes INTEGER DEFAULT 480,    -- 최대 8시간
  min_study_minutes INTEGER DEFAULT 120,    -- 최소 2시간

  -- 버퍼 및 휴식
  buffer_ratio DECIMAL(3,2) DEFAULT 0.80,   -- 80% 법칙
  pomodoro_enabled BOOLEAN DEFAULT true,
  pomodoro_work_minutes INTEGER DEFAULT 50,
  pomodoro_break_minutes INTEGER DEFAULT 10,

  -- 재스케줄링 설정
  reschedule_trigger_time TIME DEFAULT '00:00',  -- 자정
  reschedule_strategy VARCHAR(20) DEFAULT 'distribute',

  -- 과목별 설정 (JSON)
  subject_settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id)
);

-- 일일 가용 시간 캐시 (성능 최적화)
CREATE TABLE daily_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  date DATE NOT NULL,

  total_minutes INTEGER NOT NULL,        -- 일일 총 설정 시간
  existing_plan_minutes INTEGER DEFAULT 0, -- 기존 플랜 사용 시간
  available_minutes INTEGER NOT NULL,    -- 실제 가용 시간

  -- 과목별 사용량 (JSON)
  subject_usage JSONB DEFAULT '{}',

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id, date)
);
```

### 2.2 기존 플랜 고려 로직

#### 2.2.0 구현: 프론트엔드 → 백엔드 → Python 에이전트 데이터 흐름

현재 questStore에 저장된 기존 플랜 정보를 새 플랜 생성 시 Python 에이전트에 전달하는 구현입니다.

**Step 1: 프론트엔드 (useCurriculumGeneration.ts)**

```typescript
// packages/frontend/src/hooks/useCurriculumGeneration.ts

export function useCurriculumGeneration() {
  const addPlan = useQuestStore((state) => state.addPlan);
  const existingPlans = useQuestStore((state) => state.plans);  // 기존 플랜 조회

  const generateMutation = useMutation({
    mutationFn: async () => {
      // 기존 플랜의 일별 퀘스트 정보 추출 (가용 시간 계산용)
      const existingPlanData = existingPlans.map(plan => ({
        id: plan.id,
        materialName: plan.materialName,
        dailyQuests: plan.dailyQuests.map(q => ({
          date: q.date,
          estimatedMinutes: q.estimatedMinutes,
          completed: q.completed,
          unitTitle: q.unitTitle,
        })),
      }));

      const res = await fetch(`${API_BASE_URL}/api/curriculum/generate-quests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ... 기존 파라미터들
          existingPlans: existingPlanData,  // 기존 플랜 정보 전달
        }),
      });
      // ...
    },
  });
}
```

**Step 2: 백엔드 (curriculum.ts)**

```typescript
// packages/backend/src/routes/curriculum.ts

curriculumRoutes.post('/generate-quests', async (c) => {
  const {
    // ... 기존 파라미터들
    existingPlans,  // 프론트엔드에서 전달받은 기존 플랜
  } = body;

  console.log(`[curriculum] Existing plans: ${existingPlans?.length || 0} plans`);

  const result = await callPythonAgent('generate_quests', {
    // ... 기존 파라미터들
    existing_plans: existingPlans || [],  // Python 에이전트에 전달
  });
});
```

**Step 3: Python 에이전트 (main.py)**

```python
# packages/curriculum-agent/main.py

async def cli_generate_quests(params: dict) -> dict:
    # 기존 플랜 정보 받기
    existing_plans = params.get("existing_plans", [])

    # 일별 기존 사용 시간 계산
    daily_existing_usage = calculate_daily_usage(existing_plans)

    # 퀘스트 생성 시 기존 사용 시간 고려
    quests = quest_manager.generate_quests_from_curriculum(
        # ... 기존 파라미터들
        existing_plans=existing_plans,
        daily_existing_usage=daily_existing_usage,
    )

def calculate_daily_usage(existing_plans: list) -> dict:
    """기존 플랜들의 일별 사용 시간 계산"""
    daily_usage = {}

    for plan in existing_plans:
        for quest in plan.get("dailyQuests", []):
            date = quest.get("date")
            minutes = quest.get("estimatedMinutes", 0)

            if date:
                daily_usage[date] = daily_usage.get(date, 0) + minutes

    return daily_usage
```

**Step 4: QuestManager (quest_manager.py)**

```python
# packages/curriculum-agent/handlers/quest_manager.py

def generate_quests_from_curriculum(
    self,
    course_contents: List[Dict],
    existing_plans: Optional[List[Dict]] = None,
    daily_existing_usage: Optional[Dict[str, int]] = None,
    **kwargs
) -> List[Quest]:
    """기존 플랜을 고려한 퀘스트 생성"""

    # 일별 가용 시간 계산 (기존 사용량 차감)
    daily_available = {}
    base_minutes = kwargs.get("daily_study_hours", 6) * 60 * self.BUFFER_RATIO

    for day in range(total_days):
        date_str = (start_date + timedelta(days=day)).isoformat()
        existing_used = daily_existing_usage.get(date_str, 0) if daily_existing_usage else 0

        daily_available[date_str] = max(0, base_minutes - existing_used)

    # 가용 시간 내에서 퀘스트 배분
    return self._distribute_with_availability(
        course_contents, daily_available, **kwargs
    )
```

**데이터 흐름 요약**

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (questStore)                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ existingPlans = [                                           ││
│  │   { id, materialName, dailyQuests: [{date, minutes}...] }   ││
│  │ ]                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/curriculum/generate-quests
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (curriculum.ts)                                        │
│  - existingPlans 파라미터 추출                                   │
│  - callPythonAgent(..., existing_plans)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ --params JSON
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Python Agent (main.py)                                         │
│  - calculate_daily_usage(existing_plans)                        │
│  - daily_existing_usage = { "2026-01-17": 180, ... }            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  QuestManager (quest_manager.py)                                │
│  - 일별 가용시간 = base_minutes - daily_existing_usage[date]    │
│  - 가용 시간 내에서만 새 퀘스트 배분                              │
└─────────────────────────────────────────────────────────────────┘
```

---

#### 2.2.1 새 플랜 생성 시 가용 시간 계산

```typescript
// packages/backend/src/services/availability-calculator.ts

interface DailyAvailability {
  date: string;
  totalMinutes: number;
  existingMinutes: number;
  availableMinutes: number;
  subjectUsage: Record<string, number>;
}

async function calculateAvailability(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<DailyAvailability[]> {
  // 1. 학생 설정 조회
  const settings = await getStudentSettings(studentId);
  const baseMinutes = settings.daily_study_minutes * settings.buffer_ratio;

  // 2. 기존 플랜의 퀘스트들 조회
  const existingQuests = await supabase
    .from('quests')
    .select('date, estimated_minutes, subject')
    .eq('student_id', studentId)
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled');

  // 3. 일별 사용량 집계
  const dailyUsage = new Map<string, { total: number; bySubject: Record<string, number> }>();

  for (const quest of existingQuests.data || []) {
    const current = dailyUsage.get(quest.date) || { total: 0, bySubject: {} };
    current.total += quest.estimated_minutes;
    current.bySubject[quest.subject] = (current.bySubject[quest.subject] || 0) + quest.estimated_minutes;
    dailyUsage.set(quest.date, current);
  }

  // 4. 일별 가용 시간 계산
  const availability: DailyAvailability[] = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const usage = dailyUsage.get(dateStr) || { total: 0, bySubject: {} };

    availability.push({
      date: dateStr,
      totalMinutes: Math.floor(baseMinutes),
      existingMinutes: usage.total,
      availableMinutes: Math.max(0, Math.floor(baseMinutes) - usage.total),
      subjectUsage: usage.bySubject
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availability;
}
```

#### 2.2.2 플랜 생성 API 수정

```typescript
// packages/backend/src/routes/curriculum.ts 수정

app.post('/api/curriculum/generate-quests', async (c) => {
  const { studentId, courses, settings, startDate, endDate } = await c.req.json();

  // 1. 기존 플랜 고려한 가용 시간 계산
  const availability = await calculateAvailability(studentId, startDate, endDate);

  // 2. 가용 시간이 부족한 날 경고
  const insufficientDays = availability.filter(d => d.availableMinutes < 60);
  if (insufficientDays.length > 0) {
    // 경고 반환 또는 자동 조정
  }

  // 3. 가용 시간을 Python 에이전트에 전달
  const result = await callPythonAgent({
    ...settings,
    daily_availability: availability,  // 일별 실제 가용 시간
    consider_existing_plans: true
  });

  return c.json(result);
});
```

#### 2.2.3 QuestManager 수정 (Python)

```python
# packages/curriculum-agent/handlers/quest_manager.py 수정

def generate_quests_from_curriculum(
    self,
    curriculum: Dict,
    daily_total_minutes: int = 360,
    subject_ratio: Optional[Dict[str, int]] = None,
    total_days: int = 30,
    start_date: Optional[date] = None,
    daily_availability: Optional[List[Dict]] = None,  # 새 파라미터
    **kwargs
) -> List[Quest]:
    """
    일별 가용 시간을 고려한 퀘스트 생성

    daily_availability: [
        {"date": "2026-01-17", "availableMinutes": 240, "subjectUsage": {...}},
        ...
    ]
    """

    if daily_availability:
        # 기존 플랜 고려 모드
        return self._distribute_with_availability(
            curriculum, daily_availability, subject_ratio, **kwargs
        )
    else:
        # 기존 로직 (신규 학생용)
        return self._distribute_quests_by_ratio(...)

def _distribute_with_availability(
    self,
    curriculum: Dict,
    daily_availability: List[Dict],
    subject_ratio: Dict[str, int],
    **kwargs
) -> List[Quest]:
    """기존 플랜 시간을 고려한 배분"""

    quests = []
    subject_queues = self._prepare_subject_queues(curriculum)

    for day_info in daily_availability:
        available = day_info["availableMinutes"]
        scheduled_date = date.fromisoformat(day_info["date"])

        if available < 30:
            # 가용 시간이 30분 미만이면 스킵
            continue

        # 과목별 비율에 따라 가용 시간 배분
        subject_minutes = self._calculate_subject_daily_minutes(
            available, subject_ratio, apply_buffer=False  # 이미 버퍼 적용됨
        )

        # 각 과목별 퀘스트 배치
        for subject, minutes in subject_minutes.items():
            placed = self._place_quests_for_subject(
                subject, minutes, scheduled_date, subject_queues
            )
            quests.extend(placed)

    return quests
```

### 2.3 남은 일수 기반 동적 조정

#### 2.3.1 D-day 기반 학습량 조정

```python
def calculate_adjusted_daily_load(
    remaining_quests: int,
    remaining_days: int,
    daily_available_minutes: int,
    avg_quest_minutes: int = 45
) -> Dict:
    """
    남은 일수와 퀘스트 양을 고려한 일일 학습량 조정

    Returns:
        {
            "required_daily_quests": int,  # 필요한 일일 퀘스트 수
            "required_daily_minutes": int,  # 필요한 일일 학습 시간
            "feasibility": str,  # "comfortable" | "tight" | "impossible"
            "recommendation": str  # 권장 조치
        }
    """

    if remaining_days <= 0:
        return {
            "required_daily_quests": remaining_quests,
            "required_daily_minutes": remaining_quests * avg_quest_minutes,
            "feasibility": "impossible",
            "recommendation": "목표일이 지났습니다. 새로운 목표일 설정이 필요합니다."
        }

    required_daily = remaining_quests / remaining_days
    required_minutes = required_daily * avg_quest_minutes

    # 여유도 계산
    load_ratio = required_minutes / daily_available_minutes

    if load_ratio <= 0.7:
        feasibility = "comfortable"
        recommendation = "현재 페이스로 충분히 완료 가능합니다."
    elif load_ratio <= 1.0:
        feasibility = "tight"
        recommendation = "빠듯하지만 완료 가능합니다. 꾸준히 학습하세요."
    elif load_ratio <= 1.3:
        feasibility = "challenging"
        recommendation = f"하루 {int((load_ratio - 1) * daily_available_minutes)}분 추가 학습이 필요합니다."
    else:
        feasibility = "impossible"
        overload_days = int(remaining_quests * avg_quest_minutes / daily_available_minutes) - remaining_days
        recommendation = f"현재 일정으로는 불가능합니다. 목표일을 {overload_days}일 연장하거나 일일 학습량을 늘려주세요."

    return {
        "required_daily_quests": round(required_daily, 1),
        "required_daily_minutes": int(required_minutes),
        "feasibility": feasibility,
        "load_ratio": round(load_ratio, 2),
        "recommendation": recommendation
    }
```

---

## 3. 미완료 퀘스트 재스케줄링

### 3.1 재스케줄링 전략

| 전략 | 설명 | 적합한 상황 |
|------|------|------------|
| **push** | 미완료 퀘스트를 다음날로 밀기 | 소량 미완료, 여유 있는 일정 |
| **distribute** | 남은 기간에 균등 분배 | 다량 미완료, 충분한 여유 기간 |
| **priority** | 중요도 기반 우선순위 재배치 | 시간 부족, 선별 필요 |
| **ai_optimize** | AI가 최적 전략 선택 | 복잡한 상황, 맞춤 조언 필요 |

### 3.2 재스케줄링 서비스

```typescript
// packages/backend/src/services/reschedule-service.ts

interface RescheduleInput {
  studentId: string;
  targetDate: string;  // 재스케줄링 기준 날짜 (보통 어제)
  strategy: 'push' | 'distribute' | 'priority' | 'ai_optimize';
}

interface RescheduleResult {
  success: boolean;
  movedQuests: number;
  newSchedule: Quest[];
  aiSuggestion?: string;
  warnings?: string[];
}

async function rescheduleIncompleteQuests(
  input: RescheduleInput
): Promise<RescheduleResult> {
  const { studentId, targetDate, strategy } = input;

  // 1. 미완료 퀘스트 조회
  const incompleteQuests = await supabase
    .from('quests')
    .select('*')
    .eq('student_id', studentId)
    .eq('date', targetDate)
    .eq('status', 'pending')
    .order('priority', { ascending: false });

  if (!incompleteQuests.data?.length) {
    return { success: true, movedQuests: 0, newSchedule: [] };
  }

  // 2. 플랜별 종료일 조회
  const planIds = [...new Set(incompleteQuests.data.map(q => q.plan_id))];
  const plans = await supabase
    .from('plans')
    .select('id, end_date')
    .in('id', planIds);

  const planEndDates = new Map(plans.data?.map(p => [p.id, p.end_date]) || []);

  // 3. 가용 시간 계산 (내일부터 각 플랜 종료일까지)
  const tomorrow = new Date(targetDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 4. 전략별 재배치
  switch (strategy) {
    case 'push':
      return pushStrategy(incompleteQuests.data, tomorrow);
    case 'distribute':
      return distributeStrategy(incompleteQuests.data, planEndDates, studentId);
    case 'priority':
      return priorityStrategy(incompleteQuests.data, planEndDates, studentId);
    case 'ai_optimize':
      return aiOptimizeStrategy(incompleteQuests.data, planEndDates, studentId);
    default:
      return distributeStrategy(incompleteQuests.data, planEndDates, studentId);
  }
}
```

### 3.3 분배 전략 구현

```typescript
async function distributeStrategy(
  quests: Quest[],
  planEndDates: Map<string, string>,
  studentId: string
): Promise<RescheduleResult> {
  const movedQuests: Quest[] = [];
  const warnings: string[] = [];

  // 플랜별로 그룹화
  const questsByPlan = groupBy(quests, 'plan_id');

  for (const [planId, planQuests] of Object.entries(questsByPlan)) {
    const endDate = planEndDates.get(planId);
    if (!endDate) continue;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = new Date(endDate);

    // 남은 일수 계산
    const remainingDays = Math.ceil((end.getTime() - tomorrow.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      warnings.push(`${planId} 플랜의 종료일이 지났습니다. 목표일 연장이 필요합니다.`);
      continue;
    }

    // 가용 시간 조회
    const availability = await calculateAvailability(
      studentId,
      tomorrow.toISOString().split('T')[0],
      endDate
    );

    // 균등 분배
    const questsPerDay = Math.ceil(planQuests.length / remainingDays);
    let questIndex = 0;

    for (const day of availability) {
      if (questIndex >= planQuests.length) break;

      const todayQuests = planQuests.slice(questIndex, questIndex + questsPerDay);
      const totalMinutes = todayQuests.reduce((sum, q) => sum + q.estimated_minutes, 0);

      if (totalMinutes > day.availableMinutes) {
        warnings.push(`${day.date}에 학습량이 ${totalMinutes - day.availableMinutes}분 초과됩니다.`);
      }

      // 날짜 업데이트
      for (const quest of todayQuests) {
        await supabase
          .from('quests')
          .update({ date: day.date, rescheduled_from: quest.date })
          .eq('id', quest.id);

        movedQuests.push({ ...quest, date: day.date });
      }

      questIndex += questsPerDay;
    }
  }

  return {
    success: true,
    movedQuests: movedQuests.length,
    newSchedule: movedQuests,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
```

### 3.4 AI 최적화 전략

```typescript
async function aiOptimizeStrategy(
  quests: Quest[],
  planEndDates: Map<string, string>,
  studentId: string
): Promise<RescheduleResult> {
  // 1. 학생 컨텍스트 수집
  const context = await gatherStudentContext(studentId, quests, planEndDates);

  // 2. AI 분석 요청
  const aiResponse = await generateRescheduleAdvice(context);

  // 3. AI 권장 전략 실행
  const result = await executeStrategy(aiResponse.recommendedStrategy, quests, planEndDates, studentId);

  return {
    ...result,
    aiSuggestion: aiResponse.suggestion
  };
}

async function generateRescheduleAdvice(context: StudentContext): Promise<AIAdvice> {
  const prompt = buildReschedulePrompt(context);

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-5-nano',
      messages: [
        { role: 'system', content: RESCHEDULE_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  return response.json();
}
```

---

## 4. AI 프롬프트 설계

### 4.1 재스케줄링 시스템 프롬프트

```
너는 수험생 학습 스케줄 최적화 전문가야. 미완료 퀘스트를 분석하고 최적의 재배치 전략을 추천해.

## 분석 원칙
1. 학습 순서 유지: 강좌 내 강의 순서는 반드시 지켜야 함
2. 과목 균형: 특정 과목에 치우치지 않게 분배
3. 피로 관리: 연속 학습 시간 2시간 초과 지양
4. 복습 우선: 지연된 복습은 빨리 완료해야 효과적
5. 현실성: 하루 가용 시간을 초과하는 계획은 의미 없음

## 전략 선택 기준
- push: 미완료 1-2개, 다음날 여유 있음
- distribute: 미완료 3개 이상, 남은 기간 충분
- priority: 시간 부족, 일부 포기 필요
- extend: 목표일 연장 권장

## 출력 형식
{
  "analysis": "현재 상황 분석",
  "recommendedStrategy": "push | distribute | priority | extend",
  "reason": "전략 선택 이유",
  "suggestion": "학생에게 전할 조언 (친근한 톤)",
  "warnings": ["주의사항들"],
  "priorityOrder": ["quest_id1", "quest_id2", ...]  // priority 전략 시
}
```

### 4.2 재스케줄링 사용자 프롬프트 템플릿

```
학생: {studentName}
재스케줄링 대상 날짜: {targetDate}

📊 미완료 퀘스트
{incompleteQuests.map(q => `
- [${q.subject}] ${q.title}
  예상 시간: ${q.estimatedMinutes}분
  플랜: ${q.planName}
  플랜 종료일: ${q.planEndDate}
`).join('\n')}

📅 남은 기간 가용 시간
{availability.map(d => `
- ${d.date}: ${d.availableMinutes}분 가용 (기존 ${d.existingMinutes}분 예약)
`).join('\n')}

📈 최근 학습 패턴
- 평균 일일 완료율: {avgCompletionRate}%
- 연속 학습일: {currentStreak}일
- 주로 미완료되는 시간대: {commonMissTime}
- 자주 미완료되는 과목: {frequentlyMissedSubject}

위 정보를 분석하여 최적의 재스케줄링 전략을 JSON 형식으로 추천해줘.
```

### 4.3 새 플랜 생성 시 기존 플랜 고려 프롬프트

```
너는 수험생 학습 계획 생성 전문가야. 새로운 학습 계획을 기존 계획들과 조화롭게 배치해야 해.

## 핵심 원칙
1. 시간 충돌 방지: 하루 가용 시간을 초과하면 안 됨
2. 과목 균형: 기존 플랜의 과목과 새 플랜의 과목이 하루에 골고루 분배
3. 피로 누적 방지: 같은 과목 연속 학습 지양 (특히 수학)
4. 복습 주기 유지: 스페이스드 리피티션 원칙 적용
5. 인강:자습 비율: 50:50 유지

## 배치 전략
1. 먼저 기존 플랜의 일별 시간 사용량 파악
2. 남은 가용 시간 내에서 새 플랜 배치
3. 가용 시간 부족 시:
   - 옵션 A: 일일 학습 시간 증가 권장
   - 옵션 B: 목표 기간 연장 권장
   - 옵션 C: 기존 플랜 조정 권장

## 출력 형식
{
  "feasibility": "possible | tight | needs_adjustment",
  "dailySchedule": [
    {
      "date": "2026-01-17",
      "existingMinutes": 180,
      "newPlanMinutes": 120,
      "totalMinutes": 300,
      "availableMinutes": 288,
      "overload": 12,
      "subjects": ["수학", "영어", "국어"]
    }
  ],
  "conflicts": ["날짜별 충돌 상세"],
  "recommendations": ["조정 권장사항"],
  "adjustedPlan": { /* 조정된 계획 (필요시) */ }
}
```

---

## 5. 스페이스드 리피티션 통합

### 5.1 FSRS 알고리즘 적용

> 연구에 따르면 FSRS(Free Spaced Repetition Scheduler)는 기존 SM-2 대비 20-30% 적은 복습으로 동일한 기억 유지율 달성

```python
# packages/curriculum-agent/lib/fsrs.py

from dataclasses import dataclass
from datetime import date, timedelta
from math import exp, pow

@dataclass
class FSRSParams:
    """FSRS 알고리즘 파라미터"""
    w: list  # 가중치 벡터 (17개)
    request_retention: float = 0.9  # 목표 기억률 90%
    maximum_interval: int = 365  # 최대 복습 간격

class FSRS:
    """Free Spaced Repetition Scheduler"""

    DEFAULT_W = [
        0.4, 0.6, 2.4, 5.8,  # 초기 안정성 파라미터
        4.93, 0.94, 0.86, 0.01,  # 난이도 파라미터
        1.49, 0.14, 0.94,  # 성공 파라미터
        2.18, 0.05, 0.34, 1.26,  # 실패 파라미터
        0.29, 2.61  # 단기 기억 파라미터
    ]

    def __init__(self, params: FSRSParams = None):
        self.params = params or FSRSParams(w=self.DEFAULT_W)

    def calculate_next_review(
        self,
        stability: float,
        difficulty: float,
        rating: int,  # 1=Again, 2=Hard, 3=Good, 4=Easy
        elapsed_days: int
    ) -> tuple[date, float, float]:
        """
        다음 복습일 계산

        Returns:
            (next_review_date, new_stability, new_difficulty)
        """
        # 기억 검색 확률
        retrievability = exp(-elapsed_days / stability)

        # 난이도 업데이트
        new_difficulty = self._update_difficulty(difficulty, rating)

        # 안정성 업데이트
        if rating == 1:  # Again
            new_stability = self._stability_after_failure(stability, difficulty)
        else:
            new_stability = self._stability_after_success(
                stability, difficulty, retrievability, rating
            )

        # 다음 복습 간격 계산
        interval = self._calculate_interval(new_stability)
        next_date = date.today() + timedelta(days=interval)

        return next_date, new_stability, new_difficulty

    def _calculate_interval(self, stability: float) -> int:
        """목표 기억률을 달성하는 최적 간격 계산"""
        interval = stability * (-log(self.params.request_retention))
        return min(round(interval), self.params.maximum_interval)
```

### 5.2 복습 스케줄링 통합

```python
# packages/curriculum-agent/handlers/quest_manager.py 수정

from lib.fsrs import FSRS

class QuestManager:
    def __init__(self):
        self.fsrs = FSRS()

    def schedule_reviews(
        self,
        completed_quests: List[Quest],
        student_history: Dict
    ) -> List[Quest]:
        """FSRS 기반 복습 스케줄링"""

        review_quests = []

        for quest in completed_quests:
            # 학생의 해당 주제 학습 이력 조회
            topic_history = student_history.get(quest.topic_id, {
                "stability": 1.0,
                "difficulty": 5.0,
                "last_rating": 3
            })

            # 다음 복습일 계산
            next_date, new_stability, new_difficulty = self.fsrs.calculate_next_review(
                stability=topic_history["stability"],
                difficulty=topic_history["difficulty"],
                rating=topic_history["last_rating"],
                elapsed_days=(date.today() - quest.completed_date).days
            )

            # 복습 퀘스트 생성
            review_quest = Quest(
                type="review",
                title=f"[복습] {quest.title}",
                date=next_date,
                parent_quest_id=quest.id,
                estimated_minutes=quest.estimated_minutes * 0.3,  # 원본의 30%
                metadata={
                    "stability": new_stability,
                    "difficulty": new_difficulty,
                    "review_count": topic_history.get("review_count", 0) + 1
                }
            )
            review_quests.append(review_quest)

        return review_quests
```

---

## 6. 워크로드 밸런싱

### 6.1 일일 워크로드 점수 계산

```typescript
interface WorkloadScore {
  date: string;
  score: number;  // 0-100
  factors: {
    timeLoad: number;      // 시간 기반 부하
    cognitiveLoad: number; // 인지 부하 (과목 난이도)
    varietyScore: number;  // 다양성 점수
    fatigueRisk: number;   // 피로 위험도
  };
  recommendation: string;
}

function calculateWorkloadScore(
  quests: Quest[],
  dailyAvailableMinutes: number
): WorkloadScore {
  const totalMinutes = quests.reduce((sum, q) => sum + q.estimatedMinutes, 0);

  // 1. 시간 기반 부하 (0-40점)
  const timeLoad = Math.min(40, (totalMinutes / dailyAvailableMinutes) * 40);

  // 2. 인지 부하 (0-30점)
  const cognitiveWeights: Record<string, number> = {
    '수학': 1.3,
    '과학탐구': 1.2,
    '영어': 1.0,
    '국어': 0.9,
    '한국사': 0.8
  };
  const weightedMinutes = quests.reduce((sum, q) =>
    sum + q.estimatedMinutes * (cognitiveWeights[q.subject] || 1.0), 0
  );
  const cognitiveLoad = Math.min(30, (weightedMinutes / dailyAvailableMinutes) * 25);

  // 3. 다양성 점수 (0-15점, 높을수록 좋음)
  const subjects = new Set(quests.map(q => q.subject));
  const varietyScore = Math.min(15, subjects.size * 3);

  // 4. 피로 위험도 (0-15점)
  // 연속 같은 과목, 긴 강의 연속 등
  const maxConsecutiveSameSubject = calculateMaxConsecutive(quests);
  const fatigueRisk = Math.min(15, maxConsecutiveSameSubject * 3);

  const score = timeLoad + cognitiveLoad + (15 - varietyScore) + fatigueRisk;

  let recommendation = '';
  if (score < 30) {
    recommendation = '여유로운 하루예요. 추가 학습을 고려해보세요.';
  } else if (score < 50) {
    recommendation = '적절한 학습량이에요. 꾸준히 하면 됩니다!';
  } else if (score < 70) {
    recommendation = '빠듯한 하루예요. 집중해서 완료해보세요.';
  } else if (score < 85) {
    recommendation = '부담이 큰 하루예요. 우선순위를 정해서 진행하세요.';
  } else {
    recommendation = '과부하 상태예요. 일부 퀘스트를 다른 날로 옮기는 것을 권장해요.';
  }

  return {
    date: quests[0]?.date || '',
    score,
    factors: { timeLoad, cognitiveLoad, varietyScore, fatigueRisk },
    recommendation
  };
}
```

### 6.2 주간 밸런싱 최적화

```typescript
async function optimizeWeeklyBalance(
  studentId: string,
  weekStartDate: string
): Promise<OptimizationResult> {
  // 1. 주간 퀘스트 조회
  const weekQuests = await getWeekQuests(studentId, weekStartDate);

  // 2. 일별 워크로드 점수 계산
  const dailyScores = weekQuests.map(day => calculateWorkloadScore(day.quests, day.availableMinutes));

  // 3. 불균형 감지
  const avgScore = dailyScores.reduce((sum, d) => sum + d.score, 0) / 7;
  const variance = dailyScores.reduce((sum, d) => sum + Math.pow(d.score - avgScore, 2), 0) / 7;

  if (variance > 200) {  // 불균형 임계값
    // 4. 재배치 제안
    return suggestRebalancing(weekQuests, dailyScores);
  }

  return { balanced: true, suggestions: [] };
}
```

---

## 7. 스케줄러 구현

### 7.1 GitHub Actions 워크플로우

```yaml
# .github/workflows/smart-scheduler.yml

name: Smart Scheduler

on:
  schedule:
    # 매시간 5분에 실행 (사용자별 트리거 시간 체크)
    - cron: '5 * * * *'
  workflow_dispatch:
    inputs:
      student_id:
        description: '특정 학생 ID (선택)'
        required: false
      force_run:
        description: '강제 실행 여부'
        type: boolean
        default: false

jobs:
  reschedule:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --filter @questybook/backend

      - name: Run Smart Scheduler
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          TZ: Asia/Seoul
        run: |
          cd packages/backend
          npx tsx scripts/smart-scheduler.ts \
            ${{ github.event.inputs.student_id && format('--student-id {0}', github.event.inputs.student_id) || '' }} \
            ${{ github.event.inputs.force_run && '--force' || '' }}
```

### 7.2 스케줄러 스크립트

```typescript
// packages/backend/scripts/smart-scheduler.ts

import { createClient } from '@supabase/supabase-js';
import { rescheduleIncompleteQuests } from '../src/services/reschedule-service';

async function main() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  console.log(`🕐 스마트 스케줄러 실행: ${now.toISOString()}`);

  // 1. 현재 시간에 트리거되어야 하는 학생들 조회
  // (트리거 시간이 현재 시간과 같은 학생들)
  const targetStudents = await supabase
    .from('student_settings')
    .select('student_id, reschedule_strategy')
    .eq('reschedule_trigger_hour', currentHour);

  if (!targetStudents.data?.length) {
    console.log('📭 이 시간에 재스케줄링 대상 학생 없음');
    return;
  }

  console.log(`👥 대상 학생 수: ${targetStudents.data.length}명`);

  // 2. 어제 날짜 계산
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 3. 각 학생별 재스케줄링
  let successCount = 0;
  let failCount = 0;

  for (const student of targetStudents.data) {
    try {
      const result = await rescheduleIncompleteQuests({
        studentId: student.student_id,
        targetDate: yesterdayStr,
        strategy: student.reschedule_strategy || 'distribute'
      });

      if (result.success) {
        successCount++;
        console.log(`✅ ${student.student_id}: ${result.movedQuests}개 퀘스트 재배치`);

        if (result.aiSuggestion) {
          // 알림 저장 (학생이 앱에서 확인)
          await saveNotification(student.student_id, {
            type: 'reschedule',
            message: result.aiSuggestion,
            movedQuests: result.movedQuests
          });
        }
      } else {
        failCount++;
        console.error(`❌ ${student.student_id}: 재스케줄링 실패`);
      }
    } catch (error) {
      failCount++;
      console.error(`❌ ${student.student_id}: 오류 발생`, error);
    }

    // Rate limiting
    await sleep(500);
  }

  console.log(`\n📋 완료: 성공 ${successCount}, 실패 ${failCount}`);
}

main();
```

---

## 8. 프론트엔드 통합

### 8.1 가용 시간 표시 컴포넌트

```tsx
// packages/frontend/src/components/planner/DailyCapacityIndicator.tsx

interface DailyCapacityIndicatorProps {
  date: string;
  totalMinutes: number;
  usedMinutes: number;
  plannedMinutes: number;  // 새 플랜 추가 예정 시간
}

export function DailyCapacityIndicator({
  date,
  totalMinutes,
  usedMinutes,
  plannedMinutes
}: DailyCapacityIndicatorProps) {
  const availableMinutes = totalMinutes - usedMinutes;
  const afterPlanning = availableMinutes - plannedMinutes;
  const usagePercent = ((usedMinutes + plannedMinutes) / totalMinutes) * 100;

  const getStatusColor = () => {
    if (usagePercent <= 70) return 'bg-green-500';
    if (usagePercent <= 90) return 'bg-yellow-500';
    if (usagePercent <= 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (afterPlanning > 60) return '여유';
    if (afterPlanning > 0) return '적정';
    if (afterPlanning > -30) return '빠듯';
    return '초과';
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm">
      <div className="flex-1">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{formatDateKorean(date)}</span>
          <span>{Math.floor(availableMinutes / 60)}시간 {availableMinutes % 60}분 가용</span>
        </div>

        {/* 용량 바 */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full flex">
            {/* 기존 사용량 */}
            <div
              className="bg-blue-400"
              style={{ width: `${(usedMinutes / totalMinutes) * 100}%` }}
            />
            {/* 새 계획 */}
            <div
              className={plannedMinutes > availableMinutes ? 'bg-red-400' : 'bg-green-400'}
              style={{ width: `${(Math.min(plannedMinutes, availableMinutes) / totalMinutes) * 100}%` }}
            />
            {/* 초과분 */}
            {plannedMinutes > availableMinutes && (
              <div
                className="bg-red-600 animate-pulse"
                style={{ width: `${((plannedMinutes - availableMinutes) / totalMinutes) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 상태 뱃지 */}
      <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getStatusColor()}`}>
        {getStatusText()}
      </span>
    </div>
  );
}
```

### 8.2 플랜 생성 시 충돌 경고

```tsx
// packages/frontend/src/components/curriculum/ConflictWarning.tsx

interface ConflictWarningProps {
  conflicts: {
    date: string;
    overloadMinutes: number;
    suggestion: string;
  }[];
  onAdjust: () => void;
  onProceed: () => void;
}

export function ConflictWarning({ conflicts, onAdjust, onProceed }: ConflictWarningProps) {
  if (conflicts.length === 0) return null;

  const totalOverload = conflicts.reduce((sum, c) => sum + c.overloadMinutes, 0);

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-bold text-yellow-800 mb-2">
            {conflicts.length}일에 학습량 초과가 예상돼요
          </h3>

          <div className="space-y-2 mb-4">
            {conflicts.slice(0, 3).map(conflict => (
              <div key={conflict.date} className="text-sm text-yellow-700">
                <span className="font-medium">{formatDateKorean(conflict.date)}</span>
                : {conflict.overloadMinutes}분 초과
                <span className="text-yellow-600 ml-2">→ {conflict.suggestion}</span>
              </div>
            ))}
            {conflicts.length > 3 && (
              <div className="text-sm text-yellow-600">
                외 {conflicts.length - 3}일...
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onAdjust}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              자동 조정하기
            </button>
            <button
              onClick={onProceed}
              className="px-4 py-2 border border-yellow-500 text-yellow-700 rounded-lg hover:bg-yellow-100"
            >
              그대로 진행
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. 구현 체크리스트

### Phase 1: 기반 구축 (1-2일)
- [ ] `student_settings` 테이블 생성
- [ ] `daily_availability` 테이블 생성
- [ ] 가용 시간 계산 서비스 구현
- [ ] 기존 QuestManager에 daily_availability 파라미터 추가

### Phase 2: 기존 플랜 고려 (1-2일)
- [ ] `/api/curriculum/generate-quests` API 수정
- [ ] Python 에이전트 `_distribute_with_availability()` 구현
- [ ] 프론트엔드 DailyCapacityIndicator 컴포넌트
- [ ] 플랜 생성 시 충돌 경고 UI

### Phase 3: 재스케줄링 (2-3일)
- [ ] `reschedule-service.ts` 구현
- [ ] push, distribute, priority 전략 구현
- [ ] AI 최적화 전략 구현 (프롬프트 포함)
- [ ] GitHub Actions 워크플로우 설정

### Phase 4: 워크로드 밸런싱 (1일)
- [ ] 워크로드 점수 계산 함수
- [ ] 주간 밸런싱 최적화
- [ ] 프론트엔드 워크로드 시각화

### Phase 5: FSRS 통합 (1-2일)
- [ ] FSRS 알고리즘 Python 구현
- [ ] 복습 스케줄링 통합
- [ ] 학습 이력 기반 파라미터 자동 조정

### Phase 6: 테스트 및 배포 (1일)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 프로덕션 배포
- [ ] 모니터링 설정

---

## 10. 비용 추정

| 항목 | 계산 | 월간 비용 |
|------|------|----------|
| 재스케줄링 AI 분석 | 300 토큰 × 30일 × 100명 | ~$0.45 |
| 플랜 생성 시 충돌 분석 | 500 토큰 × 10회 × 100명 | ~$0.25 |
| **합계** | | **~$0.70/월** |

※ GPT-5 Nano 기준, 일일 요약과 합산 시 총 ~$1.14/월 (100명)

---

## 11. 참고 자료 및 연구

### 11.1 스페이스드 리피티션 연구
- **FSRS 알고리즘**: SM-2 대비 20-30% 효율 향상
- **MEMORIZE 알고리즘**: Duolingo 대규모 실험 검증
- **SSP-MMC**: 2.2억 행동 로그 기반 기억 모델링

### 11.2 AI 학습 플래너 트렌드 (2025-2026)
- **Voiset**: 일일 워크로드 추적, 과부하 방지
- **Trevor AI**: 시간 블로킹 + AI 태스크 분해
- **StudyWizardry**: 하이브리드 접근법 (사용자 우선순위 + AI 시간 배분)

### 11.3 한국 입시 시장 특성
- **포모도로 선호**: 50분 학습 + 10분 휴식
- **과목 균형 중시**: 하루에 3-4과목 분산
- **복습 중시**: 당일 또는 익일 복습 문화

---

## 12. 향후 확장 가능성

1. **개인화 학습 속도**: 학생별 학습 속도 측정 및 시간 추정 자동 조정
2. **피로 예측 모델**: 연속 학습 패턴 기반 피로도 예측
3. **시험 D-day 가속**: 시험일 임박 시 자동 학습량 증가
4. **그룹 스터디 연동**: 친구들과 진도 동기화
5. **학부모 리포트**: 주간 학습 달성률 및 예측 공유
