# Golden Rules (정제된 지침)

> self-evolving-agent-system에서 상속받은 핵심 지침
> 마지막 업데이트: 2025-01-05

---

## 🔴 최우선 원칙: 현실적이고 실제적인 작업

> **이 원칙은 모든 다른 규칙보다 우선합니다.**

### 가상/상상 작업 금지

```
❌ 절대 하지 마라:
- "~하면 될 것 같습니다" → 실제로 해야 함
- "~를 구현할 수 있습니다" → 실제로 구현해야 함
- 코드 예시만 보여주기 → 실제 파일에 작성해야 함

✅ 반드시 이렇게:
- 코드는 실제 파일에 작성
- 테스트는 실제로 실행하고 결과 확인
- 결과는 실제 출력을 확인
```

---

## 🚫 절대 하지 마라 (FAILURE_PATTERN)

### 1. API 타임아웃 누락 금지
```
모든 외부 API 요청에 타임아웃 필수 설정
- 일반 API: 5초
- LLM 호출: 30초
- 파일 업로드: 60초
```

### 2. 단일 파일에 모든 코드 금지
```
에이전트 구축 시 agent.py 600줄+ 금지

✅ 올바른 구조:
agent-name/
├── config/
├── core/
├── memory/
├── handlers/
└── utils/
```

### 3. Memory Type 분류 오류 금지
```
Teacher 모델로 Memory Type 분류 필수
저렴한 모델로 분류 시 90%+ 정확도 불가능
메모리 오염은 전체 시스템 품질 저하로 이어짐
```

---

## ✅ 반드시 이렇게 하라 (SUCCESS_PATTERN)

### 1. 6-Factor Re-Ranking 적용 (confidence: 0.9)
```typescript
// 가중치 합계 = 1.0
{
  semanticSimilarity: 0.45,
  recency: 0.10,
  confidence: 0.10,
  typeBoost: 0.15,
  subjectMatch: 0.10,
  urgencyBoost: 0.10,
}
```

### 2. SM-2 기반 Spaced Repetition (confidence: 0.9)
```typescript
// EMA alpha = 0.3 for smooth mastery updates
masteryScore = alpha * newScore + (1 - alpha) * currentScore;

// Easiness Factor 조정
easinessFactor = max(1.3, EF + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
```

### 3. 12 Memory Types 분류 체계 (confidence: 0.95)
```
CORRECTION, DECISION, INSIGHT, PATTERN, GAP, LEARNING,
MASTERY, STRUGGLE, WRONG_ANSWER, STRATEGY, PREFERENCE, EMOTION
```

### 4. 번아웃 모니터링 통합 (confidence: 0.85)
```
- 7일간 감정 추적
- LOW/MEDIUM/HIGH 레벨 구분
- HIGH 시 학습 중단 권고
- 대처 전략 자동 제안
```

---

## 📊 메트릭

| 항목 | 값 |
|------|-----|
| Memory Types | 12개 |
| Re-Ranking Factors | 6개 |
| Agents | 5개 (Director, Admission, Planner, Coach, Analyst) |
| 정제된 규칙 | 8개 |

---

*이 파일은 self-evolving-agent-system에서 상속받았으며, 작업 중 발견된 패턴에 따라 자동 업데이트됩니다.*
