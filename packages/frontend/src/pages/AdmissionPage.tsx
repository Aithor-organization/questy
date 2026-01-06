/**
 * AdmissionPage
 * 입학 상담 페이지 - 확장된 온보딩 플로우
 * - 기본 정보 수집 (이름, 학년, 과목, 목표)
 * - 레벨 테스트 (FR-051)
 * - 반 배정 (FR-052)
 * - 오리엔테이션 (FR-053)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookLayout } from '../components/notebook/NotebookLayout';
import { API_BASE_URL } from '../config';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface StudentInfo {
  name: string;
  grade: string;
  subjects: string[];
  goals: string[];
}

interface LevelTestQuestion {
  id: string;
  subject: string;
  difficulty: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface ClassOption {
  id: string;
  name: string;
  description: string;
  pace: string;
  features: string[];
}

interface OrientationStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

type Step =
  | 'intro' | 'name' | 'grade' | 'subjects' | 'goals' | 'registered'
  | 'level-test-intro' | 'level-test' | 'level-test-result'
  | 'class-select' | 'class-assigned'
  | 'orientation' | 'complete';

const GRADE_OPTIONS = ['고1', '고2', '고3', 'N수생', '중3', '중2', '중1'];
const SUBJECT_OPTIONS = [
  { id: 'MATH', label: '수학', emoji: '📐' },
  { id: 'KOREAN', label: '국어', emoji: '📚' },
  { id: 'ENGLISH', label: '영어', emoji: '🌍' },
  { id: 'SCIENCE', label: '과학', emoji: '🔬' },
  { id: 'SOCIAL', label: '사회', emoji: '🌏' },
];

const ORIENTATION_STEPS: OrientationStep[] = [
  { id: 'welcome', title: '환영해요!', description: 'QuestyBook은 AI 코치가 함께하는 학습 플래너예요.', icon: '👋' },
  { id: 'quest', title: '퀘스트란?', description: '매일 해야 할 학습을 퀘스트로 만들어 게임처럼 진행해요.', icon: '🎯' },
  { id: 'coach', title: 'AI 코치', description: '힘들 때, 막힐 때 언제든 코치에게 물어보세요!', icon: '🤖' },
  { id: 'report', title: '학습 리포트', description: '매주 학습 현황을 분석해서 알려드려요.', icon: '📊' },
  { id: 'start', title: '시작해볼까요?', description: '이제 첫 학습 플랜을 만들어봐요!', icon: '🚀' },
];

export function AdmissionPage() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [step, setStep] = useState<Step>('intro');
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
  const [levelTestResult, setLevelTestResult] = useState<{
    level: string;
    score: number;
    message: string;
  } | null>(null);

  // Class Selection State
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);

  // Orientation State
  const [orientationIndex, setOrientationIndex] = useState(0);

  // 초기 메시지
  useEffect(() => {
    addAssistantMessage(
      '안녕하세요! QuestyBook에 오신 것을 환영해요! 🎉\n\n저는 당신의 학습 여정을 함께할 AI 코치예요. 먼저 간단한 정보를 알려주시면, 딱 맞는 학습 계획을 세워드릴게요!\n\n이름이 어떻게 되세요?'
    );
    setStep('name');
  }, []);

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addAssistantMessage = (content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
    }, 500);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const value = inputValue.trim();
    addUserMessage(value);
    setInputValue('');

    switch (step) {
      case 'name':
        // AI API 호출하여 이름 추출 및 응답 생성
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
            // AI가 추출한 이름 사용
            const extractedName = data.data.extractedInfo?.name || extractNameFromMessage(value);
            setStudentInfo(prev => ({ ...prev, name: extractedName }));

            setTimeout(() => {
              addAssistantMessage(data.data.message);
              setStep('grade');
            }, 300);
          } else {
            throw new Error('API failed');
          }
        } catch (error) {
          // 폴백: 로컬에서 이름 추출
          const extractedName = extractNameFromMessage(value);
          setStudentInfo(prev => ({ ...prev, name: extractedName }));
          setTimeout(() => {
            addAssistantMessage(
              `반가워요, ${extractedName}님! 😊\n\n현재 학년이 어떻게 되세요?`
            );
            setStep('grade');
          }, 300);
        } finally {
          setIsTyping(false);
        }
        break;
      case 'goals':
        const newGoals = [...studentInfo.goals, value];
        setStudentInfo(prev => ({ ...prev, goals: newGoals }));
        setTimeout(() => {
          completeOnboarding({ ...studentInfo, goals: newGoals });
        }, 300);
        break;
      default:
        break;
    }
  };

  // 메시지에서 이름 추출 (폴백용)
  const extractNameFromMessage = (message: string): string => {
    // "나는 X이야", "제 이름은 X입니다", "X입니다", "X예요", "X이에요" 패턴 매칭
    const patterns = [
      /나는\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
      /제?\s*이름은?\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
      /(.+?)(?:입니다|이에요|예요|에요)$/,
      /^(.+?)라고\s*(?:해요|합니다|해)/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        // 추출된 이름에서 불필요한 부분 제거
        let name = match[1].trim();
        // "안녕 반가워 " 같은 인사말 제거
        name = name.replace(/^(안녕|반가워|반갑습니다|안녕하세요)[,\s]*/gi, '').trim();
        if (name.length > 0 && name.length <= 10) {
          return name;
        }
      }
    }

    // 패턴 매칭 실패시 마지막 단어 시도 (단, 짧은 경우만)
    const words = message.replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(w => w.length > 0);
    const lastWord = words[words.length - 1];
    if (lastWord && lastWord.length >= 2 && lastWord.length <= 10) {
      return lastWord;
    }

    // 최후의 폴백: 전체 메시지 (10자 이하인 경우만)
    if (message.length <= 10) {
      return message;
    }

    return '학생';
  };

  const handleGradeSelect = (grade: string) => {
    addUserMessage(grade);
    setStudentInfo(prev => ({ ...prev, grade }));
    setTimeout(() => {
      addAssistantMessage(
        `${grade}이시군요! 💪\n\n어떤 과목을 공부하고 싶으세요? (여러 개 선택 가능해요)`
      );
      setStep('subjects');
    }, 300);
  };

  const handleSubjectToggle = (subjectId: string) => {
    setStudentInfo(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subjectId)
        ? prev.subjects.filter(s => s !== subjectId)
        : [...prev.subjects, subjectId],
    }));
  };

  const handleSubjectsConfirm = () => {
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
  };

  const completeOnboarding = async (info: StudentInfo) => {
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
        handleOfflineMode(info);
      }
    } catch (error) {
      console.error('Registration error:', error);
      handleOfflineMode(info);
    }
  };

  const handleOfflineMode = (info: StudentInfo) => {
    const offlineId = `offline-${Date.now()}`;
    localStorage.setItem('questybook_student_id', offlineId);
    localStorage.setItem('questybook_student_name', info.name);
    setStudentId(offlineId);

    addAssistantMessage(
      `🎊 환영해요, ${info.name}님!\n\n(오프라인 모드) 입학 등록이 완료되었어요!\n\n실력을 파악하기 위해 간단한 레벨 테스트를 진행해볼까요?`
    );
    setStep('registered');
  };

  // ==================== Level Test Functions ====================

  const startLevelTest = async () => {
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
    } catch (error) {
      // 오프라인 폴백: 기본 문제
      const mockQuestions: LevelTestQuestion[] = [
        { id: '1', subject: 'MATH', difficulty: 'EASY', question: '2 + 3 = ?', options: ['4', '5', '6', '7'], correctAnswer: 1 },
        { id: '2', subject: 'MATH', difficulty: 'EASY', question: '5 × 4 = ?', options: ['15', '20', '25', '30'], correctAnswer: 1 },
        { id: '3', subject: 'MATH', difficulty: 'MEDIUM', question: '12 ÷ 4 = ?', options: ['2', '3', '4', '5'], correctAnswer: 1 },
      ];
      setLevelTestQuestions(mockQuestions);
      setCurrentQuestionIndex(0);
      setLevelTestAnswers([]);

      setTimeout(() => {
        addAssistantMessage(
          `좋아요! 📝 간단한 레벨 테스트를 시작할게요.\n\n총 3문제이고, 천천히 풀어도 괜찮아요!`
        );
        setStep('level-test');
      }, 500);
    }
  };

  const skipLevelTest = () => {
    addUserMessage('나중에 할게요');
    setTimeout(() => {
      addAssistantMessage('알겠어요! 나중에 언제든 테스트할 수 있어요. 😊\n\n그럼 학습 반을 선택해볼까요?');
      fetchClassOptions();
    }, 300);
  };

  const handleLevelTestAnswer = async (answerIndex: number) => {
    const newAnswers = [...levelTestAnswers, answerIndex];
    setLevelTestAnswers(newAnswers);

    if (currentQuestionIndex < levelTestQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // 테스트 완료
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
          throw new Error('Failed to submit');
        }
      } catch (error) {
        // 오프라인 결과 계산
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
  };

  // ==================== Class Selection Functions ====================

  const fetchClassOptions = async () => {
    setIsTyping(true);

    try {
      const subject = studentInfo.subjects[0] || 'MATH';
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/class-options?subject=${subject}`);
      const data = await response.json();

      if (data.success) {
        setClassOptions(data.data.classOptions);
      } else {
        throw new Error('Failed to fetch');
      }
    } catch (error) {
      // 오프라인 기본값
      setClassOptions([
        { id: 'slow', name: '천천히반', description: '기초부터 차근차근', pace: 'SLOW', features: ['기초 개념 강화', '반복 학습', '1:1 피드백'] },
        { id: 'medium', name: '꾸준히반', description: '균형 잡힌 학습', pace: 'MEDIUM', features: ['핵심 개념 정리', '문제 풀이 연습', '주간 테스트'] },
        { id: 'fast', name: '달리기반', description: '빠른 진도', pace: 'FAST', features: ['심화 학습', '고난도 문제', '자기주도 학습'] },
      ]);
    }

    setTimeout(() => {
      setStep('class-select');
      setIsTyping(false);
    }, 500);
  };

  const handleClassSelect = async (classOption: ClassOption) => {
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
    } catch (error) {
      console.log('Offline mode: class saved locally');
    }

    localStorage.setItem('questybook_class', classOption.id);

    setTimeout(() => {
      addAssistantMessage(
        `🎉 ${classOption.name}으로 배정되었어요!\n\n${classOption.description}\n\n이제 QuestyBook 사용법을 알려드릴게요!`
      );
      setStep('class-assigned');
    }, 500);
  };

  // ==================== Orientation Functions ====================

  const startOrientation = () => {
    addUserMessage('오리엔테이션 시작!');
    setOrientationIndex(0);
    setTimeout(() => {
      setStep('orientation');
    }, 300);
  };

  const skipOrientation = () => {
    addUserMessage('나중에 볼게요');
    setTimeout(() => {
      completeAdmission();
    }, 300);
  };

  const handleOrientationNext = () => {
    if (orientationIndex < ORIENTATION_STEPS.length - 1) {
      setOrientationIndex(prev => prev + 1);
    } else {
      completeAdmission();
    }
  };

  const completeAdmission = () => {
    addAssistantMessage(
      `🚀 모든 준비가 끝났어요, ${studentInfo.name}님!\n\n이제 첫 학습 플랜을 만들어볼까요? 아니면 코치와 대화해볼까요?`
    );
    localStorage.setItem('questybook_onboarding_complete', 'true');
    setStep('complete');
  };

  // ==================== Navigation ====================

  const handleGoToGenerate = () => navigate('/generate');
  const handleGoToChat = () => navigate('/chat');

  // ==================== Render ====================

  return (
    <NotebookLayout>
      <div className="notebook-page p-0 overflow-hidden" style={{ minHeight: '70vh' }}>
        {/* 채팅 헤더 */}
        <div className="bg-[var(--highlight-yellow)] px-4 py-3 border-b border-[var(--paper-lines)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
              🎓
            </div>
            <div>
              <h2 className="font-bold text-[var(--ink-black)]">입학 상담실</h2>
              <p className="text-xs text-[var(--pencil-gray)]">
                {step.includes('level-test') ? '📝 레벨 테스트' :
                  step.includes('class') ? '🏫 반 배정' :
                    step === 'orientation' ? '📖 오리엔테이션' : 'AI 코치와 함께하는 첫 만남'}
              </p>
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2 flex-shrink-0">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 whitespace-pre-wrap ${msg.role === 'user'
                    ? 'bg-[var(--highlight-yellow)] text-[var(--ink-black)]'
                    : 'bg-white border border-[var(--paper-lines)] text-[var(--ink-black)]'
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2">
                🤖
              </div>
              <div className="bg-white border border-[var(--paper-lines)] rounded-2xl px-4 py-2">
                <span className="animate-pulse">입력 중...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-[var(--paper-lines)] p-4 bg-[var(--paper-cream)]">
          {/* 학년 선택 */}
          {step === 'grade' && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--pencil-gray)] mb-2">학년을 선택해주세요:</p>
              <div className="flex flex-wrap gap-2">
                {GRADE_OPTIONS.map(grade => (
                  <button
                    key={grade}
                    onClick={() => handleGradeSelect(grade)}
                    className="px-4 py-2 rounded-full bg-white border border-[var(--paper-lines)] hover:bg-[var(--highlight-yellow)] transition-colors"
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 과목 선택 */}
          {step === 'subjects' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--pencil-gray)]">과목을 선택해주세요:</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map(subject => (
                  <button
                    key={subject.id}
                    onClick={() => handleSubjectToggle(subject.id)}
                    className={`px-4 py-2 rounded-full border transition-colors ${studentInfo.subjects.includes(subject.id)
                        ? 'bg-[var(--highlight-yellow)] border-[var(--sticker-gold)]'
                        : 'bg-white border-[var(--paper-lines)] hover:bg-gray-50'
                      }`}
                  >
                    {subject.emoji} {subject.label}
                  </button>
                ))}
              </div>
              {studentInfo.subjects.length > 0 && (
                <button
                  onClick={handleSubjectsConfirm}
                  className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  선택 완료 ({studentInfo.subjects.length}개)
                </button>
              )}
            </div>
          )}

          {/* 등록 완료 - 레벨테스트 선택 */}
          {step === 'registered' && (
            <div className="space-y-2">
              <button
                onClick={startLevelTest}
                className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                📝 레벨 테스트 시작하기
              </button>
              <button
                onClick={skipLevelTest}
                className="w-full py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                나중에 할게요
              </button>
            </div>
          )}

          {/* 레벨 테스트 진행 */}
          {step === 'level-test' && levelTestQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm text-[var(--pencil-gray)]">
                <span>문제 {currentQuestionIndex + 1} / {levelTestQuestions.length}</span>
                <span className="text-xs">
                  {levelTestQuestions[currentQuestionIndex].difficulty === 'EASY' ? '⭐' :
                    levelTestQuestions[currentQuestionIndex].difficulty === 'MEDIUM' ? '⭐⭐' : '⭐⭐⭐'}
                </span>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[var(--paper-lines)]">
                <p className="font-medium text-[var(--ink-black)] mb-4">
                  {levelTestQuestions[currentQuestionIndex].question}
                </p>
                <div className="space-y-2">
                  {levelTestQuestions[currentQuestionIndex].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLevelTestAnswer(idx)}
                      className="w-full py-3 px-4 text-left bg-[var(--paper-cream)] border border-[var(--paper-lines)] rounded-lg hover:bg-[var(--highlight-blue)] transition-colors"
                    >
                      {String.fromCharCode(65 + idx)}. {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full bg-[var(--paper-lines)] rounded-full h-2">
                <div
                  className="bg-[var(--ink-blue)] h-2 rounded-full transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / levelTestQuestions.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 레벨 테스트 결과 */}
          {step === 'level-test-result' && levelTestResult && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-[var(--paper-lines)] text-center">
                <div className="text-4xl mb-2">
                  {levelTestResult.level === 'ADVANCED' ? '🏆' :
                    levelTestResult.level === 'INTERMEDIATE' ? '🌟' : '💪'}
                </div>
                <h3 className="font-bold text-lg text-[var(--ink-black)]">
                  {levelTestResult.level === 'ADVANCED' ? '고급' :
                    levelTestResult.level === 'INTERMEDIATE' ? '중급' : '기초'} 레벨
                </h3>
                <p className="text-[var(--pencil-gray)] mt-1">{levelTestResult.message}</p>
                <div className="mt-3 text-2xl font-bold text-[var(--ink-blue)]">
                  {levelTestResult.score}점
                </div>
              </div>
              <button
                onClick={fetchClassOptions}
                className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                반 선택하러 가기 →
              </button>
            </div>
          )}

          {/* 반 선택 */}
          {step === 'class-select' && classOptions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--pencil-gray)] mb-2">나에게 맞는 반을 선택해주세요:</p>
              {classOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleClassSelect(option)}
                  className="w-full p-4 bg-white border border-[var(--paper-lines)] rounded-lg hover:border-[var(--ink-blue)] transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {option.pace === 'SLOW' ? '🐢' : option.pace === 'MEDIUM' ? '🚶' : '🏃'}
                    </span>
                    <span className="font-bold text-[var(--ink-black)]">{option.name}</span>
                    {levelTestResult && (
                      (levelTestResult.level === 'BEGINNER' && option.pace === 'SLOW') ||
                      (levelTestResult.level === 'INTERMEDIATE' && option.pace === 'MEDIUM') ||
                      (levelTestResult.level === 'ADVANCED' && option.pace === 'FAST')
                    ) && (
                        <span className="text-xs bg-[var(--highlight-yellow)] px-2 py-0.5 rounded-full">추천</span>
                      )}
                  </div>
                  <p className="text-sm text-[var(--pencil-gray)]">{option.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {option.features.map((feature, idx) => (
                      <span key={idx} className="text-xs bg-[var(--paper-cream)] px-2 py-0.5 rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 반 배정 완료 - 오리엔테이션 선택 */}
          {step === 'class-assigned' && (
            <div className="space-y-2">
              <button
                onClick={startOrientation}
                className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                📖 사용법 배우기
              </button>
              <button
                onClick={skipOrientation}
                className="w-full py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                바로 시작하기
              </button>
            </div>
          )}

          {/* 오리엔테이션 */}
          {step === 'orientation' && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-lg border border-[var(--paper-lines)] text-center">
                <div className="text-5xl mb-3">{ORIENTATION_STEPS[orientationIndex].icon}</div>
                <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                  {ORIENTATION_STEPS[orientationIndex].title}
                </h3>
                <p className="text-[var(--pencil-gray)]">
                  {ORIENTATION_STEPS[orientationIndex].description}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                {ORIENTATION_STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-colors ${idx === orientationIndex ? 'bg-[var(--ink-blue)]' : 'bg-[var(--paper-lines)]'
                      }`}
                  />
                ))}
              </div>
              <button
                onClick={handleOrientationNext}
                className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {orientationIndex < ORIENTATION_STEPS.length - 1 ? '다음 →' : '시작하기! 🚀'}
              </button>
            </div>
          )}

          {/* 최종 완료 */}
          {step === 'complete' && (
            <div className="space-y-2">
              <button
                onClick={handleGoToGenerate}
                className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                ✨ 첫 학습 플랜 만들기
              </button>
              <button
                onClick={handleGoToChat}
                className="w-full py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                💬 코치와 대화하기
              </button>
            </div>
          )}

          {/* 텍스트 입력 */}
          {(step === 'name' || step === 'goals') && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={step === 'name' ? '이름을 입력해주세요...' : '학습 목표를 입력해주세요...'}
                className="flex-1 px-4 py-3 rounded-full border border-[var(--paper-lines)] focus:outline-none focus:border-[var(--ink-blue)]"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="px-6 py-3 bg-[var(--ink-blue)] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                전송
              </button>
            </form>
          )}
        </div>
      </div>
    </NotebookLayout>
  );
}
