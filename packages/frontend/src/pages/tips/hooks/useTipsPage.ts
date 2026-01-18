/**
 * useTipsPage Hook
 * TipsPage의 상태 관리 로직
 */

import { useState } from 'react';
import {
  allInstructors,
  subjectTips,
} from '../../../data/instructors';
import { studyTips } from '../../../data/studyTips';
import type { TabType, CategoryType } from '../types';

export function useTipsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appguide');
  const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');

  // 필터링된 강사 목록
  const filteredInstructors = selectedSubject === 'all'
    ? allInstructors
    : allInstructors.filter(i => i.subject === selectedSubject);

  // 필터링된 전략 목록
  const filteredTips = selectedCategory === 'all'
    ? studyTips
    : studyTips.filter(t => t.category === selectedCategory);

  // 선택된 과목의 팁
  const selectedSubjectTips = selectedSubject !== 'all'
    ? subjectTips.filter(s => s.subject === selectedSubject)
    : [];

  const toggleInstructor = (id: string) => {
    setExpandedInstructor(expandedInstructor === id ? null : id);
  };

  const toggleTip = (id: string) => {
    setExpandedTip(expandedTip === id ? null : id);
  };

  return {
    // 상태
    activeTab, expandedInstructor, expandedTip, selectedSubject, selectedCategory,
    // 데이터
    filteredInstructors, filteredTips, selectedSubjectTips,
    // 액션
    setActiveTab, setSelectedSubject, setSelectedCategory, toggleInstructor, toggleTip,
  };
}
