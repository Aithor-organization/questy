# Golden Rules (정제된 지침)

> project_brain.yaml에서 추출한 핵심 지침
> 마지막 업데이트: 2026-01-11

---

## 🔴 최우선 원칙: 현실적이고 실제적인 작업

> **이 원칙은 모든 다른 규칙보다 우선합니다.**

### 가상/상상 작업 금지

```
❌ 절대 하지 마라:
- "~하면 될 것 같습니다" → 실제로 해야 함
- "~를 구현할 수 있습니다" → 실제로 구현해야 함
- 코드 예시만 보여주기 → 실제 파일에 작성해야 함
- 가상의 테스트 결과 → 실제로 테스트 실행해야 함

✅ 반드시 이렇게:
- 코드는 실제 파일에 작성
- 테스트는 실제로 실행하고 결과 확인
- 수정은 실제 파일을 Edit/Write로 변경
- 명령어는 실제로 Bash로 실행
```

---

## 🚫 절대 하지 마라 (FAILURE_PATTERN)

### 1. API 타임아웃 누락 금지
```
axios/fetch 요청에 타임아웃 미설정 → 무한 로딩

✅ 필수 설정:
- 일반 API: 5초
- 파일 업로드: 30초
- RAG 검색: 10초
```

### 2. 단일 파일에 모든 코드 금지
```
에이전트 구축 시 agent.py 600줄+ 금지

✅ 올바른 구조:
agent-name/
├── config/settings.yaml
├── core/agent.py
├── handlers/
└── utils/
```

### 3. RAG 결과 무조건 신뢰 금지
```
❌ Pinecone 결과를 그대로 사용
✅ relevanceScore 검증 후 필터링
✅ min_score threshold 적용
```

### 4. Memory 오염 금지
```
❌ 저렴한 모델로 메모리 유형 분류
✅ Teacher(GPT-5.2)로 모든 평가 수행
✅ 즉시 저장으로 안정성 확보
```

---

## ✅ 반드시 이렇게 하라 (SUCCESS_PATTERN)

### 1. Teacher-Student 패턴 적용 (confidence: 0.95)
```
✅ 복잡한 추론/평가 → Teacher (GPT-5.2)
✅ 일반 작업 → Student (GPT-5-mini/nano)
✅ 비용 80-85% 절감 + 품질 유지
```

### 2. Memory Lane 즉시 저장 (confidence: 0.9)
```
✅ 작업 완료 즉시 메모리 저장
✅ Teacher가 유형 분류 (6가지)
✅ Query-Aware Boosting 적용
```

### 3. Complexity 기반 라우팅 (confidence: 0.9)
```
✅ 키워드 가중치로 복잡도 계산
✅ simple → nano, medium → mini, complex → teacher
✅ 예측 가능하고 디버깅 용이
```

### 4. RAG 최적화 (confidence: 0.85)
```
✅ 네임스페이스별 top_k 조정
✅ 중복 제거 후 반환
✅ Token budget 관리
```

---

## 📊 에이전트 특화 규칙

### 커리큘럼 생성 시
```
✅ 학생 프로필 기반 개인화
✅ 약점 과목 시간 1.3배 증가
✅ 성공 패턴 참조하여 추천
```

### 강사/강좌 추천 시
```
✅ 학생 수준 매칭 (초급/중급/고급)
✅ relevanceScore 0.7 이상만 추천
✅ 중복 강사/강좌 제거
```

---

*이 문서는 프로젝트 진행에 따라 자동 업데이트됩니다.*
