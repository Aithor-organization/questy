# QuestyCoachAgent

**자기진화형 AI 학습 코치 시스템**

ACE Framework V5.2 기반의 멀티 에이전트 학습 코칭 시스템입니다.

## 🌟 주요 기능

### Memory Lane System (학습/진화의 핵심)
- **12가지 Memory Types**: CORRECTION, DECISION, INSIGHT, PATTERN, GAP, LEARNING, MASTERY, STRUGGLE, WRONG_ANSWER, STRATEGY, PREFERENCE, EMOTION
- **6-Factor Query-Aware Re-Ranking**: semanticSimilarity(0.45), recency(0.10), confidence(0.10), typeBoost(0.15), subjectMatch(0.10), urgencyBoost(0.10)
- **SM-2 Spaced Repetition**: EMA α=0.3 기반 숙달도 업데이트
- **Burnout Monitoring**: 7일간 감정 추적 및 대응 전략

### Multi-Agent Architecture
| Agent | 역할 | 모델 |
|-------|------|------|
| **Director** | 오케스트레이터, 라우팅 | - |
| **Admission** | 신규 학생 온보딩 | Claude 4.5 Haiku |
| **Planner** | 학습 계획 수립 | Claude 4.5 Haiku |
| **Coach** | 학습 코칭, 감정 지원 | Claude 4.5 Haiku |
| **Analyst** | 진도/성취도 분석 | Gemini 3 Flash |

### 3-Level Smart Router
- **Simple (< 0.3)**: GPT-5-nano
- **Medium (0.3-0.6)**: Claude 4.5 Haiku
- **Complex (> 0.6)**: Gemini 3 Flash

## 📁 프로젝트 구조

```
questyCoachAgent/
├── src/
│   ├── core/
│   │   ├── agents/          # 5개 에이전트
│   │   ├── director/        # 오케스트레이터
│   │   └── router/          # 의도 분류
│   ├── memory/
│   │   ├── catcher/         # 메모리 추출
│   │   ├── storage/         # 저장 (ChromaDB)
│   │   ├── retrieval/       # 6-Factor 검색
│   │   ├── mastery/         # SM-2 숙달도
│   │   ├── monitor/         # 번아웃 모니터
│   │   └── injection/       # 컨텍스트 주입
│   ├── types/               # TypeScript 타입
│   └── index.ts             # 메인 진입점
├── skills/
│   ├── golden-rules.md      # 축적된 규칙
│   └── learnings.yaml       # 학습 기록
├── config/
└── tests/
```

## 🚀 시작하기

### 설치
```bash
cd questyCoachAgent
npm install
```

### 환경 설정
```bash
cp .env.example .env
# .env 파일에 API 키 설정
```

### 실행
```bash
# 개발 모드
npm run dev

# 테스트 실행
npm run test

# 타입 체크
npm run typecheck
```

## 💡 사용 예시

```typescript
import { Director } from '@questy/coach-agent';

const director = new Director({
  enableMemoryExtraction: true,
  enableBurnoutCheck: true,
});

// 학생 프로필 설정
director.setStudentProfile({
  id: 'student-001',
  name: '홍길동',
  grade: '고2',
  enrolledSubjects: ['MATH', 'KOREAN'],
  goals: ['수능 대비'],
  createdAt: new Date(),
  lastActiveAt: new Date(),
});

// 대화 처리
const response = await director.process({
  studentId: 'student-001',
  message: '수학 공부 계획 세워줘',
  conversationId: 'conv-001',
});

console.log(response.message);
// → Planner Agent가 학습 계획 생성
```

## 🧠 Memory Lane 활용

```typescript
const memoryLane = director.getMemoryLane();

// 컨텍스트 검색
const context = await memoryLane.retrieveContext({
  studentId: 'student-001',
  query: '내가 틀린 문제가 뭐야?',
  currentSubject: 'MATH',
});
// → WRONG_ANSWER, CORRECTION 유형 메모리 부스트

// 학습 결과 기록
memoryLane.recordLearningResult({
  studentId: 'student-001',
  topicId: '이차방정식',
  quality: 4,  // SM-2: 0-5
});

// 복습 권장
const recommendations = memoryLane.getReviewRecommendations('student-001');
```

## 📊 Self-Evolution

이 에이전트는 자기 진화 시스템을 내장하고 있습니다:

1. **지식 전이**: `skills/golden-rules.md`와 `learnings.yaml`에서 축적된 지식 활용
2. **메모리 축적**: 모든 대화에서 자동으로 학습 기억 추출
3. **적응적 학습**: 학생의 숙달도와 패턴에 따른 맞춤 대응
4. **번아웃 방지**: 감정 상태 모니터링 및 적극적 개입

## 🔧 설정 옵션

### Memory Lane
```typescript
const memoryLane = new MemoryLane({
  enableAutoExtraction: true,
  enableBurnoutMonitoring: true,
  enableSpacedRepetition: true,
  maxMemoriesPerStudent: 1000,
});
```

### Re-Ranking 가중치
```typescript
const retriever = new MemoryRetriever({
  weights: {
    semanticSimilarity: 0.45,
    recency: 0.10,
    confidence: 0.10,
    typeBoost: 0.15,
    subjectMatch: 0.10,
    urgencyBoost: 0.10,
  },
});
```

## 📝 라이선스

MIT

---

**Version**: 0.1.0 | **Architecture**: ACE V5.2 + Memory Lane | **Updated**: 2025-01-05
