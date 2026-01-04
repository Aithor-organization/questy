import { openrouter, DEFAULT_MODEL } from './openrouter';

// 분석된 단원 정보
export interface AnalyzedUnit {
  unitNumber: number;
  unitTitle: string;
  subSections: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

// 감지된 학습계획표 일정 (상세 정보 포함)
export interface DetectedScheduleItem {
  day: number;
  unitNumber: number;
  unitTitle: string;
  range: string;
  // 상세 정보
  topics?: string[];        // 구체적인 학습 주제/개념
  pages?: string;           // 페이지 범위 (예: "p.15~28")
  estimatedMinutes?: number; // 예상 학습 시간
  objectives?: string[];    // 학습 목표
  notes?: string;           // 추가 참고사항/팁
}

// 감지된 학습계획표 정보
export interface DetectedStudyPlan {
  hasSchedule: boolean;
  totalDays: number;
  scheduleItems: DetectedScheduleItem[];
  source: string;           // "30일 완성", "4주 플랜" 등
  weeklyStructure?: string; // "주 5일", "주 7일" 등
  dailyTimeGuide?: string;  // "하루 1시간", "30분~1시간" 등
}

// 이미지 분석 결과 타입
export interface AnalysisResult {
  units: AnalyzedUnit[];
  studyPlan: DetectedStudyPlan;
}

// 목차 이미지 분석 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 교재 목차/학습계획표 이미지를 분석하는 AI입니다.
이미지에서 단원 정보와 학습계획표(있는 경우)를 **최대한 상세하게** 추출하여 JSON 형식으로 반환하세요.

출력 형식:
{
  "units": [
    {
      "unitNumber": 1,
      "unitTitle": "단원 제목",
      "subSections": ["소단원1", "소단원2"],
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "studyPlan": {
    "hasSchedule": true/false,
    "totalDays": 30,
    "weeklyStructure": "주 5일",
    "dailyTimeGuide": "하루 1시간",
    "scheduleItems": [
      {
        "day": 1,
        "unitNumber": 1,
        "unitTitle": "단원명",
        "range": "학습 범위 (예: 1.1~1.3)",
        "topics": ["집합의 뜻", "집합의 표현", "부분집합"],
        "pages": "p.15~28",
        "estimatedMinutes": 60,
        "objectives": ["집합의 개념을 이해한다", "집합을 여러 방법으로 표현할 수 있다"],
        "notes": "기본 개념 정리 필수"
      }
    ],
    "source": "30일 완성"
  }
}

규칙:
1. unitNumber는 목차에 표시된 번호를 사용하세요
2. subSections는 해당 단원의 소단원/세부 항목입니다
3. difficulty는 단원 내용의 예상 난이도입니다:
   - easy: 기초 개념, 짧은 분량
   - medium: 중간 수준, 보통 분량
   - hard: 심화 개념, 많은 분량
4. 목차에서 식별할 수 없는 경우 빈 배열을 반환하세요

## 학습계획표 감지 규칙 (상세 추출 필수):
1. "N일 완성", "N주 플랜", "Day 1~N", "1주차~N주차" 등의 학습 스케줄이 보이면 hasSchedule: true
2. 날짜별/일차별 학습 범위가 명시되어 있으면 scheduleItems에 **상세하게** 추출
3. **반드시 추출할 정보**:
   - day: 일차 번호
   - unitNumber, unitTitle: 해당 일차의 단원
   - range: 소단원 범위 (예: "1.1~1.3", "2장 1절~3절")
   - topics: 이미지에 보이는 구체적인 학습 주제/개념 목록
   - pages: 페이지 범위가 있으면 추출 (예: "p.15~28")
   - estimatedMinutes: 학습 시간이 명시되어 있으면 추출
   - objectives: 학습 목표가 있으면 추출
   - notes: 참고사항, 팁, 주의점 등이 있으면 추출
4. weeklyStructure: "주 5일", "주 6일", "주 7일" 등 주간 학습 구조
5. dailyTimeGuide: "하루 30분", "1시간~1시간 30분" 등 일일 학습 시간 가이드
6. 학습계획표가 없으면 hasSchedule: false, scheduleItems: []
7. source는 "30일 완성", "4주 플랜", "60일 마스터" 등 계획표의 제목/출처

**중요: 학습계획표에 보이는 모든 정보를 빠짐없이 추출하세요!**`;

// 기본 학습계획표 (없을 때)
const DEFAULT_STUDY_PLAN: DetectedStudyPlan = {
  hasSchedule: false,
  totalDays: 0,
  scheduleItems: [],
  source: '',
};

/**
 * 목차/학습계획표 이미지를 분석하여 단원 정보와 학습계획표를 추출합니다
 */
export async function analyzeTableOfContents(
  imageBase64: string,
  imageType: 'jpg' | 'png',
  materialName: string
): Promise<AnalysisResult> {
  const mimeType = imageType === 'png' ? 'image/png' : 'image/jpeg';

  const response = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `"${materialName}" 교재의 목차/학습계획표 이미지입니다. 단원 정보와 학습계획표(있는 경우)를 추출해주세요.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content || '{"units":[],"studyPlan":null}';

  try {
    const result = JSON.parse(content);
    return {
      units: result.units || [],
      studyPlan: result.studyPlan || DEFAULT_STUDY_PLAN,
    };
  } catch {
    console.error('Failed to parse image analysis result:', content);
    return {
      units: [],
      studyPlan: DEFAULT_STUDY_PLAN,
    };
  }
}
