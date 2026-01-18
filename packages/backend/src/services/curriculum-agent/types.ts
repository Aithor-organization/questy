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
