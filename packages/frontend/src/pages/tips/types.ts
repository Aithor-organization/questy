/**
 * TipsPage 타입 정의
 */

export type TabType = 'instructors' | 'strategies' | 'appguide';
export type CategoryType = 'all' | 'planning' | 'method' | 'subject' | 'lifestyle' | 'mental';

export interface AppGuide {
  id: string;
  icon: string;
  title: string;
  description: string;
  tips: string[];
}
