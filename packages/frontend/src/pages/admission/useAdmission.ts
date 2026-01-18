/**
 * useAdmission Hook
 * 입학 상담 페이지의 상태 관리 및 비즈니스 로직
 */

import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import type {
  Message,
  StudentInfo,
  LevelTestQuestion,
  LevelTestResult,
  ClassOption,
  AdmissionStep,
} from './types';
import {
  SUBJECT_OPTIONS,
  DEFAULT_CLASS_OPTIONS,
  DEFAULT_LEVEL_TEST_QUESTIONS,
} from './constants';

// 메시지에서 이름 추출 (폴백용)
function extractNameFromMessage(message: string): string {
  const patterns = [
    /나는\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
    /제?\s*이름은?\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
    /(.+?)(?:입니다|이에요|예요|에요)$/,
    /^(.+?)라고\s*(?:해요|합니다|해)/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      name = name.replace(/^(안녕|반가워|반갑습니다|안녕하세요)[,\s]*/gi, '').trim();
      if (name.length > 0 && name.length <= 10) {
        return name;
      }
    }
  }

  const words = message.replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(w => w.length > 0);
  const lastWord = words[words.length - 1];
  if (lastWord && lastWord.length >= 2 && lastWord.length <= 10) {
    return lastWord;
  }

  if (message.length <= 10) {
    return message;
  }

  return '학생';
}

export function useAdmission() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<AdmissionStep>('intro');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    name: '',
    grade: '',
    subjects: [],
    goals: [],
  });
  const [isTyping, setIsTyping] = useState(false);

  // Level Test State
  const [levelTestQuestions, setLevelTestQuestions] = useState<LevelTestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [levelTestAnswers, setLevelTestAnswers] = useState<number[]>([]);
  const [levelTestResult, setLevelTestResult] = useState<LevelTestResult | null>(null);

  // Class Selection State
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);

  // Orientation State
  const [orientationIndex, setOrientationIndex] = useState(0);

  const addAssistantMessage = useCallback((content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: `msg-${Date.now()}`, role: 'assistant', content, timestamp: new Date() },
      ]);
      setIsTyping(false);
    }, 500);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages(prev => [
      ...prev,
      { id: `msg-${Date.now()}`, role: 'user', content, timestamp: new Date() },
    ]);
  }, []);

  // 초기 메시지
  useEffect(() => {
    addAssistantMessage(
      '안녕하세요! Questy에 오신 것을 환영해요! 🎉\n\n저는 당신의 학습 여정을 함께할 AI 코치예요. 먼저 간단한 정보를 알려주시면, 딱 맞는 학습 계획을 세워드릴게요!\n\n이름이 어떻게 되세요?'
    );
    setStep('name');
  }, [addAssistantMessage]);

  const handleNameSubmit = useCallback(async (value: string) => {
    addUserMessage(value);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/admission/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: value,
          stage: 'name',
          context: { currentInfo: studentInfo },
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const extractedName = data.data.extractedInfo?.name || extractNameFromMessage(value);
        setStudentInfo(prev => ({ ...prev, name: extractedName }));

        setTimeout(() => {
          addAssistantMessage(data.data.message);
          setStep('grade');
        }, 300);
      } else {
        throw new Error('API failed');
      }
    } catch {
      const extractedName = extractNameFromMessage(value);
      setStudentInfo(prev => ({ ...prev, name: extractedName }));
      setTimeout(() => {
        addAssistantMessage(`반가워요, ${extractedName}님! 😊\n\n현재 학년이 어떻게 되세요?`);
        setStep('grade');
      }, 300);
    } finally {
      setIsTyping(false);
    }
  }, [addUserMessage, addAssistantMessage, studentInfo]);

  const handleGradeSelect = useCallback((grade: string) => {
    addUserMessage(grade);
    setStudentInfo(prev => ({ ...prev, grade }));
    setTimeout(() => {
      addAssistantMessage(`${grade}이시군요! 💪\n\n어떤 과목을 공부하고 싶으세요? (여러 개 선택 가능해요)`);
      setStep('subjects');
    }, 300);
  }, [addUserMessage, addAssistantMessage]);

  const handleSubjectToggle = useCallback((subjectId: string) => {
    setStudentInfo(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subjectId)
        ? prev.subjects.filter(s => s !== subjectId)
        : [...prev.subjects, subjectId],
    }));
  }, []);

  const handleSubjectsConfirm = useCallback(() => {
    if (studentInfo.subjects.length === 0) return;

    const selectedLabels = studentInfo.subjects
      .map(id => SUBJECT_OPTIONS.find(s => s.id === id)?.label)
      .join(', ');
    addUserMessage(selectedLabels);

    setTimeout(() => {
      addAssistantMessage(
        `좋아요! ${selectedLabels}를 선택하셨네요! 📚\n\n마지막으로, 학습 목표가 있다면 알려주세요!\n(예: 수능 대비, 내신 1등급, 특정 개념 마스터 등)`
      );
      setStep('goals');
    }, 300);
  }, [studentInfo.subjects, addUserMessage, addAssistantMessage]);

  const handleGoalSubmit = useCallback((value: string) => {
    addUserMessage(value);
    const newGoals = [...studentInfo.goals, value];
    setStudentInfo(prev => ({ ...prev, goals: newGoals }));
    return { ...studentInfo, goals: newGoals };
  }, [addUserMessage, studentInfo]);

  const completeOnboarding = useCallback(async (info: StudentInfo) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: info.name,
          grade: info.grade,
          subjects: info.subjects,
          goals: info.goals,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('questybook_student_id', data.data.student.id);
        localStorage.setItem('questybook_student_name', data.data.student.name);
        setStudentId(data.data.student.id);

        addAssistantMessage(
          `🎊 환영해요, ${info.name}님!\n\n입학 등록이 완료되었어요! 이제부터 제가 ${info.name}님의 전담 코치가 될게요.\n\n실력을 파악하기 위해 간단한 레벨 테스트를 진행해볼까요?`
        );
        setStep('registered');
      } else {
        throw new Error('Registration failed');
      }
    } catch {
      // 오프라인 모드
      const offlineId = `offline-${Date.now()}`;
      localStorage.setItem('questybook_student_id', offlineId);
      localStorage.setItem('questybook_student_name', info.name);
      setStudentId(offlineId);

      addAssistantMessage(
        `🎊 환영해요, ${info.name}님!\n\n(오프라인 모드) 입학 등록이 완료되었어요!\n\n실력을 파악하기 위해 간단한 레벨 테스트를 진행해볼까요?`
      );
      setStep('registered');
    }
  }, [addAssistantMessage]);

  const startLevelTest = useCallback(async () => {
    addUserMessage('레벨 테스트 시작할게요!');
    setIsTyping(true);

    try {
      const subject = studentInfo.subjects[0] || 'MATH';
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/level-test/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, questionCount: 5 }),
      });

      const data = await response.json();

      if (data.success) {
        setLevelTestQuestions(data.data.questions);
        setCurrentQuestionIndex(0);
        setLevelTestAnswers([]);

        setTimeout(() => {
          addAssistantMessage(
            `좋아요! 📝 ${SUBJECT_OPTIONS.find(s => s.id === subject)?.label || subject} 레벨 테스트를 시작할게요.\n\n총 ${data.data.questions.length}문제이고, 천천히 풀어도 괜찮아요!`
          );
          setStep('level-test');
        }, 500);
      } else {
        throw new Error('Failed to start level test');
      }
    } catch {
      setLevelTestQuestions(DEFAULT_LEVEL_TEST_QUESTIONS);
      setCurrentQuestionIndex(0);
      setLevelTestAnswers([]);

      setTimeout(() => {
        addAssistantMessage(`좋아요! 📝 간단한 레벨 테스트를 시작할게요.\n\n총 3문제이고, 천천히 풀어도 괜찮아요!`);
        setStep('level-test');
      }, 500);
    }
  }, [addUserMessage, addAssistantMessage, studentInfo.subjects, studentId]);

  const skipLevelTest = useCallback(() => {
    addUserMessage('나중에 할게요');
    setTimeout(async () => {
      addAssistantMessage('알겠어요! 나중에 언제든 테스트할 수 있어요. 😊\n\n그럼 학습 반을 선택해볼까요?');
      // Fetch class options
      setIsTyping(true);
      try {
        const subject = studentInfo.subjects[0] || 'MATH';
        const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/class-options?subject=${subject}`);
        const data = await response.json();
        if (data.success) {
          setClassOptions(data.data.classOptions);
        } else {
          throw new Error('Failed');
        }
      } catch {
        setClassOptions(DEFAULT_CLASS_OPTIONS);
      }
      setTimeout(() => {
        setStep('class-select');
        setIsTyping(false);
      }, 500);
    }, 300);
  }, [addUserMessage, addAssistantMessage, studentInfo.subjects, studentId]);

  const handleLevelTestAnswer = useCallback(async (answerIndex: number) => {
    const newAnswers = [...levelTestAnswers, answerIndex];
    setLevelTestAnswers(newAnswers);

    if (currentQuestionIndex < levelTestQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsTyping(true);

      try {
        const subject = studentInfo.subjects[0] || 'MATH';
        const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/level-test/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            questions: levelTestQuestions,
            answers: newAnswers,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setLevelTestResult({
            level: data.data.result.level,
            score: data.data.result.score,
            message: data.data.message,
          });
        } else {
          throw new Error('Failed');
        }
      } catch {
        const correct = newAnswers.filter((a, i) => a === levelTestQuestions[i].correctAnswer).length;
        const score = Math.round((correct / levelTestQuestions.length) * 100);
        const level = score >= 80 ? 'ADVANCED' : score >= 50 ? 'INTERMEDIATE' : 'BEGINNER';

        setLevelTestResult({
          level,
          score,
          message: `${correct}/${levelTestQuestions.length}문제 정답! ${level === 'ADVANCED' ? '대단해요!' : level === 'INTERMEDIATE' ? '좋아요!' : '차근차근 가보자!'}`,
        });
      }

      setTimeout(() => {
        setStep('level-test-result');
        setIsTyping(false);
      }, 500);
    }
  }, [levelTestAnswers, currentQuestionIndex, levelTestQuestions, studentInfo.subjects, studentId]);

  const fetchClassOptions = useCallback(async () => {
    setIsTyping(true);

    try {
      const subject = studentInfo.subjects[0] || 'MATH';
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/class-options?subject=${subject}`);
      const data = await response.json();

      if (data.success) {
        setClassOptions(data.data.classOptions);
      } else {
        throw new Error('Failed');
      }
    } catch {
      setClassOptions(DEFAULT_CLASS_OPTIONS);
    }

    setTimeout(() => {
      setStep('class-select');
      setIsTyping(false);
    }, 500);
  }, [studentInfo.subjects, studentId]);

  const handleClassSelect = useCallback(async (classOption: ClassOption) => {
    addUserMessage(`${classOption.name} 선택!`);
    setIsTyping(true);

    try {
      await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/class-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classOption.id,
          levelTestResult: levelTestResult,
        }),
      });
    } catch {
      console.log('Offline mode: class saved locally');
    }

    localStorage.setItem('questybook_class', classOption.id);

    setTimeout(() => {
      addAssistantMessage(
        `🎉 ${classOption.name}으로 배정되었어요!\n\n${classOption.description}\n\n이제 Questy 사용법을 알려드릴게요!`
      );
      setStep('class-assigned');
    }, 500);
  }, [addUserMessage, addAssistantMessage, studentId, levelTestResult]);

  const startOrientation = useCallback(() => {
    addUserMessage('오리엔테이션 시작!');
    setOrientationIndex(0);
    setTimeout(() => {
      setStep('orientation');
    }, 300);
  }, [addUserMessage]);

  const skipOrientation = useCallback(() => {
    addUserMessage('나중에 볼게요');
    setTimeout(() => {
      addAssistantMessage(
        `🚀 모든 준비가 끝났어요, ${studentInfo.name}님!\n\n이제 첫 학습 플랜을 만들어볼까요? 아니면 코치와 대화해볼까요?`
      );
      localStorage.setItem('questybook_onboarding_complete', 'true');
      setStep('complete');
    }, 300);
  }, [addUserMessage, addAssistantMessage, studentInfo.name]);

  const handleOrientationNext = useCallback(() => {
    if (orientationIndex < 4) { // ORIENTATION_STEPS.length - 1
      setOrientationIndex(prev => prev + 1);
    } else {
      addAssistantMessage(
        `🚀 모든 준비가 끝났어요, ${studentInfo.name}님!\n\n이제 첫 학습 플랜을 만들어볼까요? 아니면 코치와 대화해볼까요?`
      );
      localStorage.setItem('questybook_onboarding_complete', 'true');
      setStep('complete');
    }
  }, [orientationIndex, addAssistantMessage, studentInfo.name]);

  return {
    // State
    messages,
    step,
    studentInfo,
    isTyping,
    levelTestQuestions,
    currentQuestionIndex,
    levelTestResult,
    classOptions,
    orientationIndex,

    // Actions
    handleNameSubmit,
    handleGradeSelect,
    handleSubjectToggle,
    handleSubjectsConfirm,
    handleGoalSubmit,
    completeOnboarding,
    startLevelTest,
    skipLevelTest,
    handleLevelTestAnswer,
    fetchClassOptions,
    handleClassSelect,
    startOrientation,
    skipOrientation,
    handleOrientationNext,
  };
}
