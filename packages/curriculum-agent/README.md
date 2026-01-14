# Curriculum RAG Agent

> ACE Framework V5.2 - Memory Lane Edition
> 인강 강사 데이터 기반 맞춤형 커리큘럼 생성 에이전트

## 🎯 개요

학생 프로필을 기반으로 개인화된 학습 커리큘럼을 생성하는 AI 에이전트입니다.
Pinecone RAG를 활용하여 강사, 강좌, 성공 패턴 데이터를 검색하고,
Memory Lane 시스템으로 학습 이력을 관리합니다.

## 🏗️ 아키텍처

```
curriculum-rag-agent/
├── config/
│   ├── settings.yaml      # 설정 파일
│   └── loader.py          # 설정 로더
├── core/
│   ├── agent.py           # 메인 에이전트
│   ├── router.py          # Smart Router (복잡도 기반)
│   └── teacher.py         # Teacher Brain (평가/분류)
├── memory/
│   └── memory_lane.py     # Type-Aware Memory System
├── handlers/
│   ├── rag_handler.py     # Pinecone RAG 핸들러
│   └── curriculum_generator.py  # 커리큘럼 생성
├── skills/
│   ├── golden-rules.md    # 핵심 규칙
│   └── curriculum-expert.md  # 도메인 전문 스킬
├── main.py                # 진입점
└── requirements.txt       # 의존성
```

## 🧠 핵심 기능

### 1. Teacher-Student 모델 라우팅
- **Teacher (GPT-5.2)**: 복잡한 추론, 평가, 메모리 분류
- **Student Medium (GPT-5-mini)**: RAG 기반 답변, 일반 작업
- **Student Fast (GPT-5-nano)**: 라우팅, 단순 쿼리

### 2. Memory Lane System
- **6가지 메모리 유형**: correction, decision, insight, pattern, gap, learning
- **Query-Aware Boosting**: 쿼리 의도에 따른 15% 부스트
- **Re-Ranking**: 유사도 + 최신성 + 신뢰도 + 유형 부스트

### 3. RAG 기반 추천
- **Pinecone 네임스페이스**:
  - `lecturers`: 강사 정보 (이름, 과목, 특징)
  - `courses`: 강좌 정보 (목차, 커리큘럼, 교재)
  - `success_patterns`: 성공 사례
  - `exam_trends`: 시험 트렌드

### 4. 커리큘럼 생성
- 학생 수준별 맞춤 계획
- 약점 과목 시간 증가 (1.3배)
- 주간/일간 학습 루틴
- 마일스톤 및 진도 체크포인트

## 🚀 시작하기

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 API 키 설정
```

### 3. 실행
```bash
python main.py
```

## 📋 사용법

### 대화형 모드
```
👤 You: 수학 1등급을 위한 학습 전략을 알려줘

🤖 Agent: [RAG 기반 맞춤형 답변]
```

### 커리큘럼 생성
```
👤 You: /curriculum

📝 Curriculum Generation Mode
학생 프로필을 입력하세요:
  수준 (초급/중급/고급): 고급
  목표 등급 (예: 1등급): 1등급
  과목 (쉼표로 구분): 국어,수학,영어
  약점 과목: 수학
  일일 학습 시간: 8
  학습 기간 주: 16

⏳ 커리큘럼 생성 중...
```

### 명령어
| 명령어 | 설명 |
|--------|------|
| `/curriculum` | 커리큘럼 생성 모드 |
| `/status` | 에이전트 상태 확인 |
| `/help` | 도움말 표시 |
| `exit` | 종료 |

## ⚙️ 설정

### config/settings.yaml
```yaml
models:
  teacher: "openai/gpt-5.2"
  student_medium: "openai/gpt-5-mini"
  student_fast: "openai/gpt-5-nano"

rag:
  pinecone:
    index_name: "questy-rag"
    namespaces:
      lecturers: "lecturers"
      courses: "courses"
      success_patterns: "success_patterns"
      exam_trends: "exam_trends"

memory:
  reranking:
    vector_similarity: 0.55
    recency: 0.15
    confidence: 0.15
    type_boost: 0.15
```

## 📊 비용 최적화

| 구분 | 비율 | 용도 |
|------|------|------|
| Nano (라우팅 + 단순) | ~55% | 대부분의 요청 |
| Mini (중간 복잡도) | ~25% | RAG 답변, 일반 작업 |
| Teacher (복잡 + 평가) | ~20% | 복잡한 작업 + 모든 평가 |

**예상 절감**: Teacher-only 대비 **80-85% 비용 절감**

## 🔧 개발

### 테스트 실행
```bash
pytest tests/ -v
```

### 코드 포맷팅
```bash
black .
isort .
```

### 타입 체크
```bash
mypy .
```

## 📝 라이선스

MIT License

---

*ACE Framework V5.2 - Memory Lane Edition*
*Built with Teacher-Student Distillation Pattern*
