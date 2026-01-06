# AI 학습 코칭 시스템 - 구현 태스크

## 개요

- **총 태스크**: 40개
- **예상 기간**: 4주 (MVP) + 3주 (알림/개인화/Memory Lane)
- **우선순위**: P0 (필수) → P1 (중요) → P2 (선택)
- **LLM 모델**: Gemini 3 Flash, Claude 4.5 Haiku, GPT-5 Nano
- **다중 플랜**: MVP부터 여러 교재 동시 진행 지원 ⭐
- **개인화 에이전트**: 학습자별 맞춤형 AI 코치 ⭐
- **Memory Lane**: 학습 기억 시스템으로 맥락 있는 코칭 ⭐ NEW

---

## Phase 1: 기반 구축 (Week 1)

### Task 1.1: 프로젝트 초기 설정 [P0]
- [ ] packages/ai-coach 디렉토리 구조 생성
- [ ] package.json, tsconfig.json 설정
- [ ] 의존성 설치 (openai, @anthropic-ai/sdk, @google/generative-ai, zod, date-fns, bullmq)
- [ ] 환경변수 설정 (.env)
  - OPENAI_API_KEY
  - ANTHROPIC_API_KEY
  - GOOGLE_AI_API_KEY

**완료 조건**: `npm run typecheck` 통과

### Task 1.2: 타입 정의 [P0]
- [ ] types/student.ts - 학생 프로필 타입 (Badge 포함)
- [ ] types/plan.ts - 플랜, 퀘스트 타입 (subject, completedAt 포함)
- [ ] types/today-quests.ts - TodayQuests 타입 (다중 플랜 통합 뷰) ⭐
- [ ] types/record.ts - 학습 기록 타입
- [ ] types/agent.ts - Agent 입출력 타입
- [ ] types/admission.ts - 입학 상담, AdmissionRecord 타입
- [ ] types/llm.ts - LLM 모델 ID, 응답 타입

**완료 조건**: 모든 타입 export 및 import 확인

### Task 1.3: 멀티 LLM 클라이언트 [P0]
- [ ] llm/index.ts - LLM 클라이언트 팩토리
- [ ] llm/openai-client.ts - GPT-5 Nano 클라이언트
- [ ] llm/anthropic-client.ts - Claude 4.5 Haiku 클라이언트
- [ ] llm/google-client.ts - Gemini 3 Flash 클라이언트 (Vision 포함)
- [ ] llm/model-selector.ts - 컨텍스트 기반 모델 선택 로직
- [ ] 구조화된 출력 (JSON mode) 헬퍼
- [ ] 에러 핸들링 및 재시도 로직
- [ ] 토큰 사용량 로깅

**완료 조건**: 3개 모델 모두 간단한 프롬프트 테스트 통과

### Task 1.4: 메모리 인터페이스 [P0]
- [ ] memory/index.ts - 메모리 추상화
- [ ] memory/in-memory-store.ts - 개발용 인메모리 저장소
- [ ] 학생, 플랜, 기록, 입학상담 CRUD 메서드
- [ ] 다중 플랜 조회 (getActivePlans, getTodayQuests) ⭐

**완료 조건**: 인메모리로 CRUD 테스트 통과, 다중 플랜 조회 포함

---

## Phase 2: Agent 구현 (Week 2)

### Task 2.1: Base Agent [P0]
- [ ] agents/base-agent.ts - 공통 추상 클래스
- [ ] 프롬프트 템플릿 시스템
- [ ] 입출력 검증 (Zod)
- [ ] 로깅 및 에러 핸들링
- [ ] 동적 모델 선택 통합

**완료 조건**: 추상 클래스 정의 완료

### Task 2.2: Admission Agent (입학 상담사) [P0]
- [ ] agents/admission/index.ts - 메인 클래스
- [ ] agents/admission/prompts.ts - 프롬프트 정의
- [ ] welcome - 환영 상담 시작 액션
- [ ] consultGoals - 학습 목표 파악 액션
- [ ] levelTest - 레벨 테스트 (자가진단) 액션
- [ ] recommendIntensity - 학습 강도 추천 액션
- [ ] orientation - 오리엔테이션 액션
- [ ] handoffToPlanner - Planner Agent로 핸드오프

**완료 조건**: 입학 상담 → 플랜 생성 핸드오프 E2E 테스트

### Task 2.3: Planner Agent (커리큘럼 설계사) [P0]
- [ ] agents/planner/index.ts - 메인 클래스
- [ ] agents/planner/prompts.ts - 프롬프트 정의
- [ ] analyzeTOC - 목차 분석 액션 (Gemini Vision)
- [ ] generatePlan - 플랜 생성 액션
- [ ] reviewPlan - 플랜 리뷰 액션
- [ ] regeneratePlan - 플랜 재생성 액션

**완료 조건**: 목차 이미지 → 플랜 생성 E2E 테스트

### Task 2.4: Coach Agent (담임 선생님) [P0]
- [ ] agents/coach/index.ts - 메인 클래스
- [ ] agents/coach/prompts.ts - 프롬프트 정의
- [ ] morningBrief - 아침 브리핑 액션 (다중 플랜 TodayQuests 통합) ⭐
- [ ] studyPrompt - 학습 시작 유도 액션 (과목별 타겟팅)
- [ ] checkIn - 체크인 액션
- [ ] handleComplete - 완료 처리 액션 (플랜별 개별 완료 + 다음 과목 안내) ⭐
- [ ] handleSkip - 스킵 처리 액션
- [ ] eveningReview - 저녁 리뷰 액션 (전체 플랜 통합 요약)
- [ ] crisisIntervention - 위기 개입 액션 (모델 업그레이드)

**완료 조건**: 각 액션별 응답 테스트, 다중 플랜 시나리오 포함

### Task 2.5: Analyst Agent (학습 분석관) [P1]
- [ ] agents/analyst/index.ts - 메인 클래스
- [ ] agents/analyst/prompts.ts - 프롬프트 정의
- [ ] weeklyReport - 주간 리포트 액션
- [ ] patternAnalysis - 패턴 분석 액션
- [ ] progressStats - 진행률 통계 액션
- [ ] completionCelebration - 수료 축하 + 다음 플랜 유도 액션

**완료 조건**: 샘플 데이터로 리포트 생성 테스트, 수료 시 다음 플랜 추천 동작 확인

---

## Phase 3: Director 구현 (Week 3)

### Task 3.1: Intent Classifier [P0]
- [ ] director/intent-classifier.ts
- [ ] 의도 분류 프롬프트 (GPT-5 Nano 사용)
- [ ] 12개 Intent 분류 로직 (입학 Intent 추가)
  - ADMISSION_START, ADMISSION_CONTINUE
  - PLAN_CREATE, PLAN_REVIEW, PLAN_MODIFY
  - STUDY_START, STUDY_COMPLETE, STUDY_SKIP
  - REPORT_REQUEST, PROGRESS_CHECK
  - GENERAL_CHAT, CRISIS_SIGNAL
- [ ] confidence 점수 기반 처리

**완료 조건**: 테스트 메시지 25개 분류 정확도 90%+

### Task 3.2: Router [P0]
- [ ] director/router.ts
- [ ] Intent → Agent 매핑
- [ ] Agent 입력 변환 로직
- [ ] 멀티 Agent 조율 (Admission → Planner 핸드오프)
- [ ] 모델 업그레이드 로직 (위기 상황)

**완료 조건**: 모든 Intent 라우팅 테스트

### Task 3.3: Scheduler [P1]
- [ ] director/scheduler.ts
- [ ] BullMQ 큐 설정
- [ ] 시간 트리거 스케줄링
- [ ] 트리거 실행 및 Agent 호출

**완료 조건**: 시간 트리거 테스트 (1분 후 실행)

### Task 3.4: Director 통합 [P0]
- [ ] director/index.ts
- [ ] 전체 흐름 조율
- [ ] 입력 → 분류 → 라우팅 → 응답
- [ ] 학생 상태 기반 Agent 선택 (신입생 → Admission)

**완료 조건**: E2E 대화 테스트

---

## Phase 4: 트리거 및 이벤트 (Week 3-4)

### Task 4.1: Time Triggers [P1]
- [ ] triggers/time-triggers.ts
- [ ] 아침 브리핑 트리거
- [ ] 학습 시작 알림 트리거
- [ ] 저녁 리뷰 트리거
- [ ] 재알림 로직

**완료 조건**: 각 트리거 타입 실행 테스트

### Task 4.2: Event Triggers [P1]
- [ ] triggers/event-triggers.ts
- [ ] 학습 시작 이벤트
- [ ] 학습 완료 이벤트
- [ ] 스트릭 마일스톤 이벤트
- [ ] 위기 감지 이벤트
- [ ] 입학 완료 이벤트

**완료 조건**: 이벤트 발생 → 핸들러 실행 테스트

### Task 4.3: 위기 감지 시스템 [P1]
- [ ] 연속 미학습일 카운팅
- [ ] 위기 임계값 설정 (기본 3일)
- [ ] 위기 개입 자동 트리거
- [ ] 모델 업그레이드 (Haiku → Gemini Flash)

**완료 조건**: 3일 미학습 시 위기 메시지 발송

---

## Phase 5: API 및 통합 (Week 4)

### Task 5.1: API 엔드포인트 [P0]
- [ ] 메인 대화 엔드포인트 (POST /api/chat)
- [ ] 입학 상담 엔드포인트 (POST /api/admission)
- [ ] 플랜 생성/조회 엔드포인트
- [ ] 학습 기록 엔드포인트
- [ ] 리포트 엔드포인트

**완료 조건**: Postman/cURL 테스트

### Task 5.2: 기존 백엔드 통합 [P0]
- [ ] questyBook 백엔드와 연동
- [ ] 기존 플랜 생성 로직 마이그레이션
- [ ] API 경로 정리
- [ ] 학생 상태 (onboarding/active/paused/idle) 관리

**완료 조건**: 기존 기능 동작 유지

### Task 5.3: 프론트엔드 연동 [P1]
- [ ] 채팅 UI 컴포넌트
- [ ] 입학 상담 UI 플로우
- [ ] 브리핑/알림 표시 (다중 플랜 통합 아침 브리핑) ⭐
- [ ] 학습 완료 버튼 (과목별 개별 완료)
- [ ] 리포트 뷰 (전체/과목별 진행률)
- [ ] 수료 축하 + 다음 플랜 선택 화면
- [ ] 다중 플랜 대시보드 (활성 플랜 목록, 과목별 진행률 표시) ⭐

**완료 조건**: 기본 UI 플로우 동작, 다중 플랜 대시보드, 수료 후 다음 플랜 연결 UI 확인

---

## Phase 6: 테스트 및 최적화 (Week 4)

### Task 6.1: 통합 테스트 [P0]
- [ ] **입학 시나리오**: 신규 학생 → 상담 → 플랜 생성
- [ ] 플랜 생성 시나리오 테스트
- [ ] 일일 코칭 시나리오 테스트
- [ ] 위기 개입 시나리오 테스트 (모델 업그레이드 확인)
- [ ] 주간 리포트 시나리오 테스트
- [ ] **수료 + 리텐션 시나리오**: 플랜 완료 → 축하 → 다음 플랜 유도 → 새 플랜 시작
- [ ] **다중 플랜 시나리오**: 2개 과목 동시 진행 → 통합 브리핑 → 과목별 완료 → 남은 과목 안내 ⭐

**완료 조건**: 주요 시나리오 7개 통과, 다중 플랜 브리핑/완료 동작, 수료 후 앱 이탈 없이 다음 플랜 연결 확인

### Task 6.2: 프롬프트 최적화 [P1]
- [ ] 응답 품질 검토
- [ ] 톤앤매너 일관성 확인 (학원 컨셉)
- [ ] 토큰 사용량 최적화
- [ ] 모델별 프롬프트 튜닝

**완료 조건**: QA 리뷰 통과

### Task 6.3: 에러 핸들링 [P1]
- [ ] LLM 실패 시 폴백 (Gemini → Haiku → GPT)
- [ ] 네트워크 에러 처리
- [ ] 사용자 친화적 에러 메시지

**완료 조건**: 에러 상황 graceful 처리

---

## Phase 7: 알림 시스템 (Week 5) ⭐ NEW

### Task 7.1: 푸시 알림 인프라 [P0]
- [ ] FCM (Firebase Cloud Messaging) 설정
- [ ] 알림 토큰 관리 (디바이스별)
- [ ] 알림 발송 서비스 구현
- [ ] 알림 히스토리 저장

**완료 조건**: 테스트 푸시 알림 발송 성공

### Task 7.2: 카카오톡 스타일 알림 [P0]
- [ ] 알림 템플릿 시스템 (코치쌤 페르소나)
- [ ] 학생 이름 호칭 개인화 ("철수야~")
- [ ] 시나리오별 메시지 템플릿 (브리핑, 체크인, 축하 등)
- [ ] 이모지 사용 가이드라인 적용

**완료 조건**: 모든 시나리오 알림 테스트

### Task 7.3: 빠른 답장 기능 [P1]
- [ ] 알림에 빠른 답장 버튼 추가
- [ ] 답장 옵션 동적 생성 (상황별)
- [ ] 답장 처리 → Coach Agent 연결

**완료 조건**: 알림에서 바로 응답 가능

### Task 7.4: 알림 최적화 [P1]
- [ ] 방해금지 시간 설정
- [ ] 알림 빈도 조절 (적극/보통/조용)
- [ ] 알림 효과 측정 (오픈율, 반응률)

**완료 조건**: 알림 설정 UI 동작

---

## Phase 8: 개인화 엔진 (Week 5-6) ⭐ NEW

### Task 8.1: 개인화 프로파일 [P1]
- [ ] types/profile.ts - StudentProfile 타입 정의
- [ ] memory/profile-repository.ts - 프로파일 CRUD
- [ ] 프로파일 초기화 (입학 시 기본값)
- [ ] 프로파일 버전 관리

**완료 조건**: 프로파일 생성/조회/업데이트 동작

### Task 8.2: 대화 분석기 [P1]
- [ ] personalization/analyzer/conversation.ts
- [ ] 감정 분석 (sentiment analysis)
- [ ] 대화 스타일 분석 (길이, 이모지, 반응 속도)
- [ ] 코칭 효과 측정 (메시지 → 행동 변화)

**완료 조건**: 대화 기록 → 분석 결과 JSON 생성

### Task 8.3: 행동 패턴 분석기 [P1]
- [ ] personalization/analyzer/behavior.ts
- [ ] 시간 패턴 분석 (집중 시간대, 선호 요일)
- [ ] 학습 패턴 분석 (완료율, 스킵 패턴)
- [ ] 위기 전조 신호 감지

**완료 조건**: 학습 기록 → 패턴 분석 결과

### Task 8.4: 메시지 개인화기 [P1]
- [ ] personalization/personalizer/message.ts
- [ ] 프로파일 기반 메시지 톤 조절
- [ ] 동기부여 유형별 메시지 생성
- [ ] 이모지/길이/말투 자동 조절

**완료 조건**: 같은 상황 → 학생별 다른 메시지 생성

### Task 8.5: 프로파일 자동 업데이트 [P1]
- [ ] personalization/learning/scheduler.ts
- [ ] 실시간 업데이트 (감정, 컨텍스트)
- [ ] 일일 업데이트 (패턴, 스트릭)
- [ ] 주간 업데이트 (성격, 효과 분석)

**완료 조건**: 스케줄러 동작, 프로파일 자동 갱신

### Task 8.6: 개인화 인사이트 [P2]
- [ ] personalization/learning/insights.ts
- [ ] "너는 오전에 집중 잘 되더라!" 생성
- [ ] 학습 패턴 인사이트 리포트
- [ ] 코칭 효과 분석 리포트

**완료 조건**: 학생별 개인화 인사이트 생성

### Task 8.7: A/B 테스트 시스템 [P2]
- [ ] personalization/learning/experiment.ts
- [ ] 메시지 스타일 A/B 테스트
- [ ] 타이밍 최적화 실험
- [ ] 효과 측정 및 자동 적용

**완료 조건**: 실험 생성 → 결과 수집 → 최적 설정 반영

---

## Phase 9: Memory Lane 학습 기억 시스템 (Week 6-7) ⭐ NEW

### Task 9.1: Memory Lane 타입 정의 [P1]
- [ ] types/memory-lane.ts - MemoryType enum (12가지 유형)
  - 핵심: CORRECTION, DECISION, INSIGHT, PATTERN, GAP, LEARNING
  - 교육 확장: MASTERY, STRUGGLE, WRONG_ANSWER, STRATEGY, PREFERENCE, EMOTION
- [ ] types/memory-lane.ts - LearningMemory 인터페이스
- [ ] types/memory-lane.ts - TopicMastery 인터페이스 (SM-2용)
- [ ] types/memory-lane.ts - BurnoutTracker 인터페이스
- [ ] types/memory-lane.ts - ScoredMemory 인터페이스

**완료 조건**: 모든 Memory Lane 타입 정의 및 export

### Task 9.2: ChromaDB 클라이언트 및 저장소 [P1]
- [ ] memory-lane/storage/chroma-client.ts - ChromaDB 클라이언트 설정
- [ ] memory-lane/storage/memory-repository.ts - 학습 기억 CRUD
- [ ] 벡터 임베딩 생성 (768차원)
- [ ] 메타데이터 필드 17개 저장
- [ ] 컬렉션 관리 (student별 분리)

**완료 조건**: 학습 기억 저장/조회/삭제 테스트 통과

### Task 9.3: LearningMemoryCatcher 구현 [P0]
- [ ] memory-lane/catcher/index.ts - 메인 클래스
- [ ] memory-lane/catcher/type-detector.ts - 12가지 타입 키워드 기반 감지
- [ ] memory-lane/catcher/subject-detector.ts - 과목 자동 분류
- [ ] memory-lane/catcher/confidence-calculator.ts - 신뢰도 계산
- [ ] 대화에서 자동 학습 기억 추출
- [ ] 학습 결과에서 기억 추출

**완료 조건**: 대화 → 학습 기억 추출 E2E 테스트

### Task 9.4: Query-Aware Retriever 구현 [P0]
- [ ] memory-lane/retrieval/index.ts - 메인 클래스
- [ ] memory-lane/retrieval/scorer.ts - 6-factor 가중치 점수 계산
  - semanticSimilarity: 0.45
  - recency: 0.10
  - confidence: 0.10
  - typeBoost: 0.15
  - subjectMatch: 0.10
  - urgencyBoost: 0.10
- [ ] memory-lane/retrieval/reranker.ts - 재순위화 로직
- [ ] D-Day 긴급도 부스트 로직

**완료 조건**: 쿼리 → 관련 기억 Top-3 검색 테스트

### Task 9.5: SM-2 간격 반복 학습 구현 [P1]
- [ ] memory-lane/mastery/sm2.ts - SuperMemo 2 알고리즘
  - easiness factor 조정 (1.3~2.5)
  - interval 계산 (1, 6, EF × prev)
  - quality 점수 처리 (0~5)
- [ ] memory-lane/mastery/ema.ts - EMA 숙달도 계산 (α=0.3)
- [ ] memory-lane/mastery/scheduler.ts - 복습 스케줄러
- [ ] getDueReviews - 오늘 복습할 토픽 조회

**완료 조건**: 학습 기록 → SM-2 복습 일정 생성 테스트

### Task 9.6: Burnout Monitor 구현 [P1]
- [ ] memory-lane/monitor/emotion-detector.ts - 감정 감지
  - HAPPY, MOTIVATED, NEUTRAL, TIRED, STRESSED, ANXIOUS, FRUSTRATED
- [ ] memory-lane/monitor/burnout-tracker.ts - 번아웃 추적기
  - 7일간 감정 기록
  - 연속 부정 일수 계산
- [ ] memory-lane/monitor/coping-strategies.ts - 대처 전략
  - 감정별 맞춤 조언 (호흡법, 휴식, 음악 등)
- [ ] 번아웃 레벨 평가 (LOW/MEDIUM/HIGH)

**완료 조건**: 감정 분석 → 번아웃 레벨 → 대처 조언 E2E 테스트

### Task 9.7: LLM Context Injection 구현 [P0]
- [ ] memory-lane/injection/context-builder.ts - 컨텍스트 빌더
- [ ] memory-lane/injection/prompt-enhancer.ts - 프롬프트 강화
- [ ] Top-3 관련 기억 → LLM 프롬프트 삽입
- [ ] Coach Agent 통합 (기존 프롬프트에 기억 추가)
- [ ] 토큰 예산 관리 (기억당 최대 토큰)

**완료 조건**: 코칭 응답에 과거 학습 기억 반영 확인

---

## 태스크 의존성 그래프

```
Phase 1 (기반)
  1.1 → 1.2 → 1.3 → 1.4
          ↓
Phase 2 (Agent)
  2.1 → 2.2 (Admission) → 2.3 (Planner) → 2.4 (Coach)
                                            ↓
                                        2.5 (Analyst)
          ↓
Phase 3 (Director)
  3.1 → 3.2 → 3.4
        3.3 ↗
          ↓
Phase 4 (Trigger)
  4.1, 4.2 → 4.3
          ↓
Phase 5 (통합)
  5.1 → 5.2 → 5.3
          ↓
Phase 6 (테스트)
  6.1 → 6.2 → 6.3
          ↓
Phase 7 (알림) ⭐
  7.1 → 7.2 → 7.3
              7.4 ↗
          ↓
Phase 8 (개인화) ⭐
  8.1 → 8.2, 8.3 → 8.4 → 8.5
                    ↓
              8.6, 8.7 (독립)
          ↓
Phase 9 (Memory Lane) ⭐ NEW
  9.1 → 9.2 → 9.3 (Catcher)
              ↓
        9.4 (Retriever) → 9.7 (LLM Injection)
              ↓
        9.5 (SM-2), 9.6 (Burnout) [독립]
```

---

## 우선순위별 태스크 요약

### P0 (필수) - MVP 필수 기능
| 태스크 | 설명 |
|--------|------|
| 1.1-1.4 | 기반 구축 (멀티 LLM 포함) |
| 2.1-2.4 | 핵심 Agent (Admission, Planner, Coach) |
| 3.1, 3.2, 3.4 | Director 핵심 |
| 5.1, 5.2 | API 및 통합 |
| 6.1 | 통합 테스트 |
| 7.1, 7.2 | 푸시 알림 인프라 + 카카오톡 스타일 ⭐ |
| 9.3, 9.4, 9.7 | Memory Lane 핵심 (Catcher, Retriever, LLM Injection) ⭐ NEW |

### P1 (중요) - MVP 권장 기능
| 태스크 | 설명 |
|--------|------|
| 2.5 | Analyst Agent |
| 3.3 | Scheduler |
| 4.1-4.3 | 트리거 시스템 |
| 5.3 | 프론트엔드 연동 |
| 6.2, 6.3 | 최적화 |
| 7.3, 7.4 | 빠른 답장 + 알림 최적화 ⭐ |
| 8.1-8.5 | 개인화 프로파일 + 분석기 + 메시지 개인화 ⭐ |
| 9.1, 9.2, 9.5, 9.6 | Memory Lane 기반 (타입, 저장소, SM-2, Burnout) ⭐ NEW |

### P2 (선택) - 이후 확장
- 학부모 리포트
- 과목별 특화 Agent
- 휴식 학생 리텐션 캠페인 (7일 리마인더)
- 개인화 인사이트 (Task 8.6) ⭐
- A/B 테스트 시스템 (Task 8.7) ⭐

---

## LLM 모델별 사용처

| 모델 | 용도 | 사용 Agent/기능 |
|------|------|-----------------|
| **GPT-5 Nano** | 의도 분류, 빠른 응답 | Director Intent Classifier |
| **Claude 4.5 Haiku** | 실시간 대화, 공감 | Coach Agent (일반 코칭) |
| **Gemini 3 Flash** | 복잡한 분석, Vision | Admission, Planner, Analyst, Coach (위기) |

### 동적 모델 선택 기준
```
위기 상황 (3일+ 미학습) → Gemini 3 Flash
이미지 분석 필요 → Gemini 3 Flash (Vision)
입학 상담 → Gemini 3 Flash (첫인상 중요)
플랜 생성/분석 → Gemini 3 Flash
일반 대화/코칭 → Claude 4.5 Haiku
의도 분류 → GPT-5 Nano (<500ms)
```

---

## 체크포인트

| 주차 | 마일스톤 | 확인 항목 |
|------|----------|-----------|
| Week 1 | 기반 완료 | 타입, 멀티 LLM 클라이언트, 메모리 동작 |
| Week 2 | Agent 완료 | 4개 Agent 독립 테스트 통과 (Admission 핸드오프 포함) |
| Week 3 | Director 완료 | E2E 대화 테스트 통과, 입학 플로우 동작 |
| Week 4 | MVP 완료 | 전체 시나리오 통과 (입학 → 수업 → 수료 → 다음 플랜), 다중 플랜 브리핑/완료 동작 |
| Week 5 | 알림 완료 ⭐ | 카카오톡 스타일 푸시 알림 동작, "철수야~" 개인화 호칭, 빠른 답장 기능 |
| Week 5-6 | 개인화 완료 ⭐ | 학생 프로파일 자동 학습, 대화/행동 패턴 분석, 메시지 개인화 동작 |
| Week 6-7 | Memory Lane 완료 ⭐ NEW | 학습 기억 자동 추출, 6-factor 검색, SM-2 복습 스케줄, 번아웃 감지, LLM 컨텍스트 주입 |

---

## 학원 컨셉 체크리스트

### 입학 플로우
- [ ] 신규 학생 첫 진입 시 "입학 상담" 시작
- [ ] 입학 상담에서 학습 목표/고민 파악
- [ ] 레벨 테스트 (자가진단) 실시
- [ ] 학습 강도 추천 (여유/보통/집중)
- [ ] 시스템 오리엔테이션 제공
- [ ] Planner로 자연스러운 핸드오프
- [ ] 담임(Coach) 배정 안내

### 다중 플랜 지원 ⭐ NEW
- [ ] 여러 교재/과목 동시 등록 가능
- [ ] 아침 브리핑: 오늘의 모든 퀘스트 통합 안내
- [ ] 과목별 완료 처리 + 다음 과목 안내
- [ ] 위기 감지: 전체 미학습 3일 기준 (과목별 아님)
- [ ] 각 플랜별 개별 수료 + 배지 수여
- [ ] 대시보드: 활성 플랜 목록 + 과목별 진행률

### 수료 + 리텐션 플로우 (⚠️ 핵심)
- [ ] 플랜 완료 시 "수료 축하" (졸업 아님!)
- [ ] 성취 리포트 + 배지 수여
- [ ] **즉시 다음 플랜 추천** (필수)
- [ ] "다음 목표는 뭐야?" 질문으로 연결
- [ ] 휴식 선택 시 "준비되면 언제든!" 메시지
- [ ] 휴식 학생 7일 후 부드러운 리마인더

### Memory Lane 학습 기억 ⭐ NEW
- [ ] 대화에서 학습 기억 자동 추출 (12가지 유형)
- [ ] "전에 이차방정식 어려워했잖아" 맥락 있는 코칭
- [ ] SM-2 알고리즘으로 복습 타이밍 최적화
- [ ] 번아웃 징후 감지 및 대처 전략 제공
- [ ] D-Day 기반 시험 과목 우선순위 부스트
- [ ] 숙달도 기반 격려 메시지 ("이제 삼각함수 마스터했네!")

### ⛔ 금지 사항
- [ ] "졸업" 단어 사용 금지
- [ ] 앱 종료/이탈 암시 금지
- [ ] 완료 = 끝이라는 표현 금지
