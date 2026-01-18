/**
 * MyPage 타입 정의
 */

export interface ProfileData {
  age: number | null;
  examYear: number;
  targetUniversity: string;
  targetGrades: Record<string, number>;
  currentGrades: Record<string, number>;
  selectedTamgu1: string;
  selectedTamgu2: string;
  subscribedPlatforms: string[];
  dailyStudyHours: number;
}
