// Python Agent에서 반환하는 강좌 정보
export interface Course {
  id: string;
  courseName: string;
  lecturer: string;
  subject: string;
  chapters: Array<{
    num?: number;           // 강의 번호
    title: string;
    duration?: string;      // "21:30" 또는 "1:13:54" 형식
    sections?: string[];    // 하위 섹션 (있는 경우)
  }>;
  lectureCount?: number;    // 총 강의 수
  totalDuration?: string;   // 총 강의 시간
}

// 선택된 강좌 (이어듣기 정보 포함)
export interface SelectedCourse extends Course {
  startFromChapter?: number;  // 시작할 챕터 인덱스 (0부터 시작, undefined면 처음부터)
}

// 과목별 비중 (퍼센트)
export interface SubjectRatio {
  국어: number;
  영어: number;
  수학: number;
  한국사: number;
  탐구: number;
}

// 과목별 시간 설정 (시간 단위)
export interface SubjectHours {
  국어: number | null;      // null = 미입력
  영어: number | null;
  수학: number | null;
  한국사: number | null;
  탐구: number | null;
}

// 커리큘럼 생성 옵션
export interface CurriculumOptions {
  // OT/오리엔테이션 포함 여부
  includeOT: boolean;

  // 복습 설정
  reviewSettings: {
    enabled: boolean;           // 복습 활성화
    sameDayReview: boolean;     // 당일 복습 여부
    reviewDuration: number;     // 복습 시간 (분)
  };

  // 커스텀 스케줄 (사용자 추가 입력)
  customSchedule: CustomScheduleRule[];
}

// 커스텀 스케줄 규칙
export interface CustomScheduleRule {
  id: string;
  subject: string;              // 대상 과목
  type: 'daily' | 'alternate' | 'weekly';  // 매일 / 격일 / 주간
  hoursPerSession: number;      // 세션당 시간
  note?: string;                // 사용자 메모 (예: "탐구 2과목 격일로")
}

// 학습 팁 (수능 맞춤)
export interface StudyTips {
  importance: string;       // "중요도 높음", "기초 개념", "일반" 등
  keyPoints: string[];      // 핵심 포인트 (최대 3개)
  studyMethod: string;      // "인강 시청", "복습", "문제 풀이"
  commonMistakes?: string;  // 자주 하는 실수 (과목별)
}

// Python Agent에서 반환하는 퀘스트
export interface CurriculumQuest {
  id: string;
  title: string;
  description: string;
  questType: 'lecture' | 'problem_set' | 'review' | 'practice' | 'mock_exam' | 'concept';
  subject: string;
  courseId: string;
  courseName: string;
  lecturer: string;
  chapter: string;
  section: string | null;
  scheduledDate: string;
  estimatedMinutes: number;
  originalDuration?: string;  // 원본 강의 시간 (예: "21:30")
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'critical';
  studyTips?: StudyTips;      // 수능 맞춤 학습 팁

  // 문제풀이 퀘스트 전용 필드
  editable?: boolean;           // 사용자 수정 가능 여부
  practiceNote?: string;        // 문제풀이 메모 (사용자 입력)
  relatedLectures?: string[];   // 관련 강의 목록
}

// 퀘스트 생성 요청
export interface GenerateQuestsRequest {
  selectedCourseIds: string[];
  targetDate: string;
  dailyStudyHours: number;
  subjectRatio: SubjectRatio;
  // 새로운 옵션들
  subjectHours?: SubjectHours;
  options?: CurriculumOptions;
}

// 자동 필터링으로 제외된 과목 정보
export interface SkippedSubject {
  subject: string;
  hours: number;
  reason: string;
}

// 퀘스트 생성 응답
export interface GenerateQuestsResponse {
  quests: CurriculumQuest[];
  summary: {
    totalQuests: number;
    totalDays: number;
    averageMinutesPerDay: number;
    subjectDistribution: Record<string, number>;
    // 자동 필터링으로 제외된 과목 (경고)
    skippedSubjects?: SkippedSubject[] | null;
  };
}
