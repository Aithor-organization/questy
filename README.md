# QuestyBook

이미지 기반 학습 퀘스트 생성 서비스

교재 목차나 학습계획표 사진을 업로드하면 AI가 분석하여 맞춤형 일일 학습 퀘스트를 자동 생성합니다.

## 주요 기능

- **이미지 분석**: Vision AI로 교재 목차/학습계획표 자동 인식
- **듀얼 플랜 생성**: 원본 계획 vs 맞춤 계획 선택 가능
- **상세 정보 추출**: 학습 주제, 페이지 범위, 학습 목표 자동 추출
- **진행률 추적**: 날짜별 퀘스트 관리 및 완료 체크
- **로컬 저장**: 브라우저 localStorage에 플랜 저장

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Hono, TypeScript |
| AI | OpenRouter API (Gemini 3 Flash) |
| State | Zustand + localStorage |
| Monorepo | pnpm workspace |

## 시작하기

### 요구사항

- Node.js 18+
- pnpm 8+
- OpenRouter API Key

### 설치

```bash
# 저장소 클론
git clone https://github.com/Aithor-organization/questy.git
cd questy

# 의존성 설치
pnpm install
```

### 환경 변수 설정

```bash
# 백엔드 환경 변수
cp packages/backend/.env.example packages/backend/.env
```

`packages/backend/.env` 파일을 열고 OpenRouter API 키를 설정하세요:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 실행

```bash
# 프론트엔드 (http://localhost:5173)
pnpm --filter frontend dev

# 백엔드 (http://localhost:3001)
pnpm --filter backend dev
```

## 프로젝트 구조

```
questy/
├── packages/
│   ├── frontend/              # React 프론트엔드
│   │   ├── src/
│   │   │   ├── components/    # UI 컴포넌트
│   │   │   ├── pages/         # 페이지 컴포넌트
│   │   │   ├── hooks/         # 커스텀 훅
│   │   │   └── stores/        # Zustand 스토어
│   │   └── ...
│   │
│   ├── backend/               # Hono 백엔드
│   │   ├── src/
│   │   │   ├── lib/           # 핵심 로직
│   │   │   │   ├── image-analyzer.ts      # 이미지 분석
│   │   │   │   ├── ai-quest-generator.ts  # 퀘스트 생성
│   │   │   │   └── openrouter.ts          # API 클라이언트
│   │   │   └── routes/        # API 라우트
│   │   └── ...
│   │
│   └── shared/                # 공유 타입/유틸리티
│
├── specs/                     # 기획 문서
├── pnpm-workspace.yaml
└── package.json
```

## 사용 방법

1. **교재 정보 입력**: 교재 이름과 목표 학습 기간 입력
2. **이미지 업로드**: 교재 목차 또는 학습계획표 사진 업로드 (최대 4장)
3. **플랜 선택**: AI가 생성한 플랜 중 선택
   - 원본 플랜: 학습계획표가 있으면 원본 일정 그대로
   - 맞춤 플랜: 목표 기간에 맞춰 재분배
4. **퀘스트 수행**: 날짜별 퀘스트 확인 및 완료 체크

## API 엔드포인트

### POST /api/generate

학습 퀘스트 생성

**Request Body:**
```json
{
  "materialName": "수학의 정석",
  "images": [
    { "base64": "...", "type": "jpg" }
  ],
  "totalDays": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "materialName": "수학의 정석",
    "hasOriginalPlan": true,
    "plans": [
      {
        "planType": "original",
        "planName": "원본 30일 플랜",
        "dailyQuests": [...]
      },
      {
        "planType": "custom",
        "planName": "맞춤 50일 플랜",
        "dailyQuests": [...]
      }
    ],
    "recommendations": [...]
  }
}
```

## 라이선스

MIT License
