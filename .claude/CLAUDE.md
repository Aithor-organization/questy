# QuestyBook 프로젝트 설정

## 프로젝트 개요
AI 기반 학습 퀘스트 생성 서비스
- 교재/인강 입력 → 목표 날짜 설정 → 일일 퀘스트 자동 생성

## 기술 스택
- **Frontend**: React 19 + Vite 7 + TypeScript + Tailwind CSS
- **Backend**: Hono + Node.js + TypeScript
- **AI**: OpenRouter API (Claude/GPT 등)
- **패키지 관리**: pnpm workspace (모노레포)

## 디렉토리 구조
```
questyBook/
├── packages/
│   ├── frontend/    # React 앱
│   ├── backend/     # API 서버
│   └── shared/      # 공통 타입/유틸
├── .opencode/       # Brain 시스템
└── .claude/         # Claude 설정
```

## 개발 명령어
```bash
# 전체 설치
pnpm install

# 개발 서버 (동시 실행)
pnpm dev

# 개별 실행
pnpm dev:frontend
pnpm dev:backend
```

## 핵심 기능
1. **학습 자료 등록**: 교재/인강 정보 입력
2. **기간 설정**: 시작일, 종료일, 쉬는 날 설정
3. **퀘스트 생성**: AI가 일일 학습 퀘스트 자동 생성
4. **진행 추적**: 완료 체크, 진도율 확인

## 코딩 규칙
- 파일당 150줄 이내 유지
- Zod로 모든 API 입출력 검증
- 공통 타입은 @questybook/shared에 정의

## OpenRouter 모델
- 기본: `anthropic/claude-3.5-sonnet`
- JSON 출력 시 temperature: 0.3
