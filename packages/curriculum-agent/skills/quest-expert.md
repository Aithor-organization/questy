# Quest Expert Skill

> 퀘스트 생성 및 스케줄 재조정 전문 스킬
> ACE Framework V5.2 - Memory Lane Edition

---

## 🎯 역할 정의

퀘스트 전문가로서 다음을 수행:
- 강좌 목차를 일별 퀘스트로 변환
- 목표일까지 학습 스케줄 배치
- 미완료 퀘스트 감지 및 재조정
- 학습 부하 균형 최적화

---

## 📋 퀘스트 유형

| 유형 | 설명 | 기본 소요 시간 |
|------|------|---------------|
| `lecture` | 인강 시청 | 45분 |
| `problem_set` | 문제 풀이 | 60분 |
| `review` | 복습 | 30분 |
| `mock_exam` | 모의고사 | 90분 |
| `concept` | 개념 정리 | 20분 |

---

## 🔄 퀘스트 생성 플로우

### 입력
```yaml
# 사용자 입력
target_date: "2026-11-12"      # 목표일 (수능일)
daily_study_hours: 6            # 일일 순공시간

# 과목별 비중 (%)
subject_ratio:
  수학: 35
  영어: 25
  국어: 20
  탐구: 15
  한국사: 5

# 선택한 강좌 ID (RAG에서 목차 조회)
selected_course_ids:
  - "course-001"  # 현우진 수학1 개념완성
  - "course-002"  # 이지영 영어독해 기본

# RAG에서 조회한 강좌 목차
course_contents:
  - id: "course-001"
    courseName: "수학1 개념완성"
    lecturer: "현우진"
    subject: "수학"
    chapters:
      - title: "함수의 극한"
        sections:
          - "극한의 정의"
          - "극한의 성질"
      - title: "미분법"
        sections:
          - "미분계수"
          - "도함수"
  - id: "course-002"
    courseName: "영어독해 기본"
    lecturer: "이지영"
    subject: "영어"
    chapters:
      - title: "주제 찾기"
        sections:
          - "주제문 파악"
      - title: "빈칸 추론"
        sections:
          - "논리적 추론"
```

### 과목별 일일 시간 계산
```yaml
# 순공시간 6시간 = 360분
일일_가용_시간:
  수학: 360 × 35% = 126분
  영어: 360 × 25% = 90분
  국어: 360 × 20% = 72분
  탐구: 360 × 15% = 54분
  한국사: 360 × 5% = 18분
```

### 변환 규칙
1. **섹션 → 인강 퀘스트**: 각 섹션 = 1개 lecture 퀘스트
2. **챕터 끝 → 복습 퀘스트**: 챕터 완료 후 review 퀘스트
3. **주간 끝 → 문제풀이 퀘스트**: 주 마무리 problem_set 퀘스트
4. **월간 끝 → 모의고사 퀘스트**: 월 마무리 mock_exam 퀘스트

### 출력
```yaml
quests:
  - id: "quest-001"
    title: "[수학] 함수의 극한 - 극한의 정의"
    description: "현우진 선생님의 수학1 개념완성 강의를 시청하세요."
    quest_type: "lecture"
    subject: "수학"
    chapter: "함수의 극한"
    section: "극한의 정의"
    scheduled_date: "2026-01-12"
    estimated_minutes: 45
    status: "pending"
    priority: 2
```

---

## ⚡ 스케줄 재조정

### 재조정 전략

| 전략 | 설명 | 적합한 상황 |
|------|------|------------|
| `smart` | 과목 균형 + 우선순위 | 기본 추천 |
| `spread` | 균등 분배 | 여유 시간 많을 때 |
| `priority` | 우선순위 순 | 중요 과목 집중 |
| `front_load` | 앞쪽 집중 | 여유 시간 확보 |
| `back_load` | 뒤쪽 집중 | 마감 직전 몰아치기 |

### 재조정 트리거
```python
# 미완료 퀘스트 발생 시
overdue_quests = agent.get_overdue_quests()
if overdue_quests:
    result = await agent.reschedule_quests(
        target_date="2026-06-15",
        daily_study_hours=6,
        strategy="smart"
    )
```

### Smart 전략 알고리즘
```
1. 미완료 퀘스트 수집
2. 우선순위로 정렬 (HIGH → LOW)
3. 과목별 그룹화
4. 라운드 로빈으로 일별 배치
   - 각 과목이 균등하게 분산되도록
   - 일일 가용 시간 초과 시 다음 날로
5. 남은 퀘스트는 가장 여유 있는 날에 강제 배치
```

---

## 📊 일일 용량 관리

### 계산 공식
```
daily_capacity = (daily_study_hours × 60) - (buffer × 0.1)
remaining_capacity = daily_capacity - existing_quests_minutes
```

### 과부하 처리
```yaml
case: 일일 퀘스트 > 가용 시간
actions:
  - 다음 날로 이동 (기본)
  - 경고 메시지 생성
  - daily_overload 목록에 추가
```

### 버퍼 시간 (10%)
- 예상치 못한 지연 대비
- 휴식 시간 확보
- 복습 여유 시간

---

## 🎓 우선순위 결정

### 자동 결정 규칙
| 조건 | 우선순위 |
|------|---------|
| 모의고사 | HIGH |
| 첫 번째 챕터 | HIGH |
| 복습 | MEDIUM |
| 일반 인강 | MEDIUM |
| 제2외국어 | LOW |

### 수동 조정
```python
quest.priority = QuestPriority.CRITICAL  # 긴급
```

---

## 📈 진행률 추적

### 통계 항목
```yaml
stats:
  total: 150          # 전체 퀘스트
  completed: 45       # 완료
  pending: 100        # 대기
  skipped: 3          # 건너뜀
  overdue: 2          # 기한 초과
  completion_rate: 0.30
  on_track: false     # 기한 초과 있으면 false
```

### 따라잡기 계획
```python
plan = agent.get_catch_up_plan(
    target_date="2026-06-15",
    extra_hours=2  # 하루 2시간 추가
)
# 결과:
# {
#   "overdue_count": 5,
#   "total_minutes_behind": 225,
#   "days_needed_with_extra": 2,
#   "feasible": true,
#   "recommendation": "하루 2시간 추가 학습 시 2일 내 완료 가능"
# }
```

---

## 🔗 Memory Lane 연동

### 저장되는 메모리 유형
| 이벤트 | 메모리 유형 | 예시 |
|--------|-----------|------|
| 퀘스트 생성 | DECISION | "퀘스트 120개 생성 완료" |
| 퀘스트 완료 | LEARNING | "수학 극한 인강 완료" |
| 스케줄 재조정 | CORRECTION | "15개 퀘스트 재조정" |
| 연속 미완료 | GAP | "3일 연속 미완료 감지" |

### Query Boosting
- "미완료", "못했어" → CORRECTION, GAP 부스트
- "완료", "끝냈어" → LEARNING 부스트
- "일정", "스케줄" → DECISION 부스트

---

## ⚠️ 주의사항

1. **목표일 검증**: 오늘 이전이면 에러
2. **일일 최대 시간**: 10시간 초과 경고
3. **의존성 체크**: 선행 퀘스트 미완료 시 알림
4. **과목 균형**: 한 과목에 편중되지 않도록

---

## 📝 API 사용 예시

### 퀘스트 생성
```python
# 1. 강좌 검색 및 선택 (RAG)
math_courses = await agent.rag_handler.search_courses(subject="수학")
english_courses = await agent.rag_handler.search_courses(subject="영어")

# 2. 선택한 강좌 목차 조회
selected_courses = [
    await agent.rag_handler.get_course_toc("course-001"),
    await agent.rag_handler.get_course_toc("course-002")
]

# 3. 퀘스트 생성 (과목별 비중 적용)
quests = await agent.generate_quests(
    course_contents=selected_courses,
    target_date="2026-11-12",
    daily_study_hours=6,
    subject_ratio={
        "수학": 35,
        "영어": 25,
        "국어": 20,
        "탐구": 15,
        "한국사": 5
    }
)
```

### 퀘스트 완료
```python
result = await agent.complete_quest(
    quest_id="quest-001",
    actual_minutes=50
)
```

### 스케줄 재조정
```python
result = await agent.reschedule_quests(
    target_date="2026-06-15",
    daily_study_hours=7,  # 1시간 추가
    strategy="smart"
)
```

### 오늘 퀘스트 조회
```python
today_quests = agent.get_today_quests()
```

---

*이 스킬은 Curriculum RAG Agent의 퀘스트 관리 기능을 정의합니다.*
