# 과목별 시간 배분 시스템 구현 계획서

## 1. 개요

### 목표
수험생이 설정한 과목별 순공시간(예: 국어 4시간)을 **강의 + 복습 + 문제풀이**로 의미있게 채우는 퀘스트 생성 시스템 구현

### 현재 상태
- 강의 시청 퀘스트 ✅
- 복습 퀘스트 ✅ (강의 시간 비례 계산 완료)
- 문제풀이 퀘스트 ❌ (미구현)

### 목표 상태
```
국어 4시간 설정 시:
├── 📺 강의 시청: 50% (2시간)     ← 자동 생성
├── 📝 복습 정리: 15% (36분)      ← 자동 생성
└── ✏️ 문제 풀이: 35% (1시간 24분) ← 시간 블록 생성
```

---

## 2. 데이터 모델 변경

### 2.1 입력 스키마 변경

**현재 (subjectHours)**
```typescript
subjectHours: {
  "국어": 4,
  "수학": 4,
  "영어": 2
}
```

**변경 후 (subjectSettings)**
```typescript
subjectSettings: {
  "국어": {
    dailyHours: 4,
    ratio: {
      lecture: 50,    // 강의 비율 (%)
      review: 15,     // 복습 비율 (%)
      practice: 35    // 문제풀이 비율 (%)
    },
    practiceNote?: "수특 독서"  // 문제풀이 기본 메모 (선택)
  },
  "수학": {
    dailyHours: 4,
    ratio: { lecture: 40, review: 20, practice: 40 }
  },
  "영어": {
    dailyHours: 2,
    ratio: { lecture: 60, review: 20, practice: 20 }
  }
}
```

### 2.2 기본값 (과목별 권장 비율)

```python
DEFAULT_RATIOS = {
    "국어": {"lecture": 50, "review": 15, "practice": 35},
    "수학": {"lecture": 40, "review": 20, "practice": 40},  # 수학은 문제풀이 비중↑
    "영어": {"lecture": 50, "review": 20, "practice": 30},
    "탐구": {"lecture": 55, "review": 15, "practice": 30},
    "한국사": {"lecture": 60, "review": 20, "practice": 20},
    "default": {"lecture": 50, "review": 15, "practice": 35}
}
```

### 2.3 QuestType 확장

```python
class QuestType(Enum):
    LECTURE = "lecture"          # 인강 시청
    REVIEW = "review"            # 복습
    PRACTICE = "practice"        # 문제 풀이 (신규)
    PROBLEM_SET = "problem_set"  # 문제 세트 (기존)
    MOCK_EXAM = "mock_exam"      # 모의고사
    CONCEPT = "concept"          # 개념 정리
```

---

## 3. 퀘스트 생성 로직 변경

### 3.1 시간 계산 흐름

```
입력: 국어 4시간, ratio={lecture:50, review:15, practice:35}

1. 총 시간 계산
   - 4시간 × 60분 = 240분
   - 80% 버퍼 적용 → 192분

2. 활동별 시간 배분
   - 강의: 192 × 0.50 = 96분
   - 복습: 192 × 0.15 = 29분 (강의 비례로 자동 조정됨)
   - 문제풀이: 192 × 0.35 = 67분

3. 퀘스트 생성
   - 강의 퀘스트: 96분 내에서 강의 목차 순서대로 배치
   - 복습 퀘스트: 각 강의 후 비례 시간 배정
   - 문제풀이 퀘스트: 남은 시간을 하나의 블록으로 생성
```

### 3.2 문제풀이 퀘스트 생성 규칙

```python
def _create_practice_quest(
    subject: str,
    scheduled_date: str,
    duration_minutes: int,
    practice_note: str = None,
    related_lectures: List[str] = None
) -> Quest:
    """
    문제풀이 시간 블록 퀘스트 생성

    특징:
    - 구체적인 문제 내용은 사용자가 추가
    - 관련 강의 정보를 메타데이터로 포함
    - 5분 단위로 반올림
    """
    return Quest(
        title=f"{subject} 문제풀이",
        description=practice_note or f"오늘 학습한 {subject} 내용 관련 문제 풀이",
        quest_type=QuestType.PRACTICE,
        subject=subject,
        estimated_minutes=round(duration_minutes / 5) * 5,
        metadata={
            "editable": True,  # 사용자가 상세 내용 수정 가능
            "related_lectures": related_lectures,
            "practice_note": practice_note
        }
    )
```

### 3.3 일일 퀘스트 생성 순서

```
하루 퀘스트 생성 순서:

1. 강의 퀘스트들 (순서대로)
2. 각 강의 직후 복습 퀘스트
3. 문제풀이 퀘스트 (하루 마지막 또는 강의 2-3개마다)

예시 출력:
□ 📺 강민철 Code.1 (65분)
□ 📝 Code.1 복습 (15분)
□ 📺 강민철 Code.2 (55분)
□ 📝 Code.2 복습 (15분)
□ ✏️ 국어 문제풀이 (67분)   ← 마지막에 배치
```

---

## 4. API 변경사항

### 4.1 요청 스키마

```typescript
// POST /api/curriculum/generate

interface CurriculumRequest {
  courseContents: Course[];
  targetDate: string;
  dailyStudyHours: number;

  // 기존 (하위호환 유지)
  subjectHours?: Record<string, number>;

  // 신규 (우선 적용)
  subjectSettings?: Record<string, SubjectSetting>;

  options: {
    includeOT: boolean;
    reviewSettings: ReviewSettings;
  };
  learningStrategies: LearningStrategies;
}

interface SubjectSetting {
  dailyHours: number;
  ratio: {
    lecture: number;   // 0-100
    review: number;    // 0-100
    practice: number;  // 0-100
  };
  practiceNote?: string;
}
```

### 4.2 응답 스키마 변경

```typescript
interface CurriculumQuest {
  id: string;
  title: string;
  description: string;
  questType: "lecture" | "review" | "practice";  // practice 추가
  subject: string;
  courseId?: string;
  courseName?: string;
  lecturer?: string;
  chapter?: string;
  scheduledDate: string;
  estimatedMinutes: number;
  status: string;
  priority: string;

  // 신규 필드
  editable?: boolean;        // 사용자 수정 가능 여부
  practiceNote?: string;     // 문제풀이 메모
  relatedLectures?: string[]; // 관련 강의 목록
}
```

---

## 5. 프론트엔드 변경사항

### 5.1 설정 UI 추가

```
과목 설정 화면:

┌─────────────────────────────────────┐
│ 국어 설정                            │
├─────────────────────────────────────┤
│ 일일 학습 시간: [4] 시간             │
│                                     │
│ 시간 배분:                          │
│ ├─ 강의 시청  [====50%====]         │
│ ├─ 복습      [==15%==]              │
│ └─ 문제풀이  [====35%====]          │
│                                     │
│ 문제풀이 기본 메모:                  │
│ [수능특강 독서                    ]  │
└─────────────────────────────────────┘
```

### 5.2 퀘스트 카드 UI

```
문제풀이 퀘스트 카드:

┌─────────────────────────────────────┐
│ ✏️ 국어 문제풀이              67분  │
├─────────────────────────────────────┤
│ 📋 오늘 학습: Code.1, Code.2 관련   │
│                                     │
│ 메모: [수특 독서 1강 문제 풀기    ]  │
│       (클릭하여 수정)               │
│                                     │
│ [완료] [건너뛰기] [시간 수정]       │
└─────────────────────────────────────┘
```

---

## 6. 구현 순서

### Phase 1: 백엔드 핵심 로직 (1차)
1. [ ] `QuestType.PRACTICE` 추가
2. [ ] `_create_practice_quest()` 메서드 구현
3. [ ] `generate_quests_from_curriculum()` 수정
   - subjectSettings 파라미터 추가
   - ratio 기반 시간 계산 로직
   - 문제풀이 퀘스트 생성 로직
4. [ ] 기존 subjectHours 하위호환 유지

### Phase 2: API 레이어 (2차)
5. [ ] main.py CLI 핸들러 수정
6. [ ] curriculum.ts 라우터 수정
7. [ ] 요청/응답 스키마 업데이트

### Phase 3: 프론트엔드 (3차)
8. [ ] 과목 설정 UI 컴포넌트
9. [ ] 비율 슬라이더 구현
10. [ ] 문제풀이 퀘스트 카드 UI
11. [ ] 메모 수정 기능

### Phase 4: 테스트 및 검증 (4차)
12. [ ] 단위 테스트 작성
13. [ ] API 통합 테스트
14. [ ] E2E 테스트

---

## 7. 예상 결과

### 입력
```json
{
  "subjectSettings": {
    "국어": {
      "dailyHours": 4,
      "ratio": { "lecture": 50, "review": 15, "practice": 35 },
      "practiceNote": "수특 독서"
    }
  }
}
```

### 출력 (하루 퀘스트)
```json
{
  "quests": [
    {
      "title": "강민철 기본편 Code.1 듣기",
      "questType": "lecture",
      "estimatedMinutes": 65
    },
    {
      "title": "Code.1 복습",
      "questType": "review",
      "estimatedMinutes": 15
    },
    {
      "title": "강민철 기본편 Code.2 듣기",
      "questType": "lecture",
      "estimatedMinutes": 55
    },
    {
      "title": "Code.2 복습",
      "questType": "review",
      "estimatedMinutes": 15
    },
    {
      "title": "국어 문제풀이",
      "questType": "practice",
      "estimatedMinutes": 70,
      "editable": true,
      "practiceNote": "수특 독서",
      "relatedLectures": ["Code.1", "Code.2"]
    }
  ],
  "summary": {
    "국어": {
      "lectureMinutes": 120,
      "reviewMinutes": 30,
      "practiceMinutes": 70,
      "totalMinutes": 220
    }
  }
}
```

---

## 8. 고려사항

### 8.1 엣지 케이스
- ratio 합이 100이 아닌 경우 → 자동 정규화
- 강의 시간이 배정 시간보다 긴 경우 → 복습/문제풀이 최소값 보장
- 강의가 없는 과목 → 문제풀이만 생성

### 8.2 하위호환
- 기존 `subjectHours`만 전달 시 → 기본 ratio 적용
- 기존 API 응답 형식 유지

### 8.3 확장 가능성
- 추후 문제집 DB 연동 시 practiceNote 자동 생성 가능
- 사용자 학습 패턴 분석하여 ratio 추천 기능
