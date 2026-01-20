// Curriculum Agent Types
// Python curriculum-agent의 TypeScript 타입 정의

export enum QuestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  RESCHEDULED = 'rescheduled',
}

export enum QuestType {
  LECTURE = 'lecture',
  PROBLEM_SET = 'problem_set',
  REVIEW = 'review',
  PRACTICE = 'practice',
  MOCK_EXAM = 'mock_exam',
  CONCEPT = 'concept',
}

export enum QuestPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export enum RescheduleStrategy {
  SPREAD = 'spread',
  FRONT_LOAD = 'front_load',
  BACK_LOAD = 'back_load',
  PRIORITY_FIRST = 'priority',
  SMART = 'smart',
}

export interface StudyTips {
  importance: string;
  keyPoints: string[];
  studyMethod: string;
  commonMistakes?: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  questType: QuestType;
  subject: string;
  courseId?: string;
  chapter: string;
  section?: string;
  scheduledDate: string; // YYYY-MM-DD
  estimatedMinutes: number;
  status: QuestStatus;
  priority: QuestPriority;
  startedAt?: string;
  completedAt?: string;
  actualMinutes?: number;
  lecturer?: string;
  lectureUrl?: string;
  dependencies: string[];
  metadata: Record<string, any>;
}

export interface QuestSchedule {
  date: string;
  quests: Quest[];
  totalMinutes: number;
  availableMinutes: number;
  utilizationRate: number;
  isOverloaded: boolean;
}

export interface CourseContent {
  id: string;
  courseName?: string;
  title?: string;
  lecturer?: string;
  lecturerName?: string;
  subject: string;
  chapters?: ChapterData[];
  tableOfContents?: ChapterData[];
  platform?: string;
  category?: string;
  url?: string;
  startFromChapter?: number;
}

export interface ChapterData {
  num?: number;
  title?: string;
  name?: string;
  duration?: string;
  sections?: SectionData[];
  lectures?: SectionData[];
}

export interface SectionData {
  title?: string;
  duration?: number;
}

export interface QuestItem {
  courseId: string;
  courseName: string;
  lecturer?: string;
  subject: string;
  chapter: string;
  chapterIndex: number;
  section?: string;
  sectionIndex?: number;
  questType: QuestType;
  estimatedMinutes: number;
  isOt: boolean;
  totalChapters?: number;
  originalDuration?: string;
  isReviewOfIndex?: number;
}

export interface SubjectHours {
  [subject: string]: number | null;
}

export interface SubjectRatio {
  [subject: string]: number;
}

// 과목별 요일 설정 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
export interface SubjectDays {
  [subject: string]: number[];
}

export interface ReviewSettings {
  enabled: boolean;
  sameDayReview: boolean;
  reviewDuration: number;
}

export interface LearningStrategies {
  applyBuffer: boolean;
  fiveDayCycle: boolean;
}

export interface CustomScheduleRule {
  subject: string;
  type: 'daily' | 'alternate' | 'weekly';
  hoursPerSession: number;
}

export interface GenerateQuestsParams {
  courseContents: CourseContent[];
  targetDate: string;
  dailyStudyHours?: number;
  subjectRatio?: SubjectRatio;
  subjectHours?: SubjectHours;
  subjectDays?: SubjectDays;
  includeOt?: boolean;
  reviewSettings?: ReviewSettings;
  customSchedule?: CustomScheduleRule[];
  learningStrategies?: LearningStrategies;
  dailyExistingUsage?: Record<string, number>;
}

export interface RescheduleResult {
  success: boolean;
  strategyUsed: RescheduleStrategy;
  rescheduledQuests: Quest[];
  originalDates: Record<string, string>;
  newSchedules: Record<string, QuestSchedule>;
  warnings: string[];
  dailyOverload: string[];
  metadata: Record<string, any>;
}

export interface ExistingPlan {
  quests: Array<{
    scheduledDate: string;
    estimatedMinutes: number;
  }>;
}

// ===== 커리큘럼 검증 관련 타입 =====

export enum ValidationSeverity {
  VALID = 'valid',
  WARNING = 'warning',
  INVALID = 'invalid',
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  details?: {
    date?: string;
    count?: number;
    expected?: number;
    actual?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  severity: ValidationSeverity;
  issues: ValidationIssue[];
  summary: {
    totalIssues: number;
    warnings: number;
    errors: number;
  };
  suggestions: string[];
}

export interface ValidationConfig {
  // 일별 강의 수 제한
  maxLecturesPerDayWarning: number;   // 기본 8
  maxLecturesPerDayError: number;     // 기본 15
  // 일별 학습 시간 제한 (분)
  maxMinutesPerDayWarningRatio: number;  // 순공시간의 1.2배
  maxMinutesPerDayErrorRatio: number;    // 순공시간의 2배
  // 특정 날 과부하 (평균 대비)
  overloadRatioWarning: number;       // 평균의 2배
  overloadRatioError: number;         // 평균의 4배
  // 전체 대비 집중도
  concentrationWarning: number;       // 전체의 30%
  concentrationError: number;         // 전체의 50%
}
