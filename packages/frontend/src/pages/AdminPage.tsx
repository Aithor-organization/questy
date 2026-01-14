/**
 * AdminPage - 강좌/강사 관리 페이지
 * 강사별 탭으로 강좌 목록 관리 + 강사/강좌 추가 기능
 * 관리자 로그인 필요
 */

import { useState, useEffect, useRef } from 'react';
import {
  Users,
  BookOpen,
  Plus,
  RefreshCw,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
  LogOut,
  PlayCircle,
  XCircle,
  Clock,
  Pencil,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useAdminCourses, type Teacher, type Course } from '../hooks/useAdminCourses';
import { API_BASE_URL } from '../config';

// ngrok 무료 버전 경고 페이지 우회용 헤더
const defaultHeaders: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
};

type ModalType = 'none' | 'add-teacher' | 'add-course' | 'batch-update' | 'edit-teacher' | 'edit-course';
type ViewTab = 'by-teacher' | 'outdated';

// 7일 전 타임스탬프 계산 헬퍼
function isOutdated(lastCrawledAt: string | null | undefined): boolean {
  if (!lastCrawledAt) return true;
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return new Date(lastCrawledAt).getTime() < sevenDaysAgo;
}

// 배치 업데이트 진행 상태 타입
interface BatchUpdateProgress {
  status: 'idle' | 'running' | 'complete';
  total: number;
  completed: number;
  updated: number;
  failed: number;
  skipped: number;
  currentCourse: {
    id?: string;
    name?: string;
    teacher?: string;
    success?: boolean;
    diff?: number;
    error?: string;
  } | null;
  logs: Array<{
    name: string;
    success: boolean;
    diff?: number;
    error?: string;
  }>;
}

export function AdminPage() {
  const { user, isAuthenticated, login, logout, isLoading: authLoading, error: authError, clearError: clearAuthError } = useAuthStore();
  const isAdmin = user?.isAdmin === true;

  // 관리자가 아닌 경우 로그인 폼 표시
  if (!isAuthenticated || !isAdmin) {
    return <AdminLoginForm login={login} authLoading={authLoading} authError={authError} clearAuthError={clearAuthError} />;
  }

  // 관리자 로그인 완료 - 관리 콘텐츠 표시
  return <AdminContent logout={logout} />;
}

// 관리자 로그인 폼
function AdminLoginForm({
  login,
  authLoading,
  authError,
  clearAuthError,
}: {
  login: (email: string, password: string) => Promise<boolean>;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
}) {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!adminId.trim() || !password.trim()) {
      setLocalError('아이디와 비밀번호를 입력해주세요');
      return;
    }

    const success = await login(adminId.trim(), password);
    if (!success) {
      setLocalError('아이디 또는 비밀번호가 올바르지 않습니다');
    }
  };

  const error = localError || authError;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">관리자 로그인</h1>
          <p className="text-gray-500 text-sm mt-2">강좌 관리 페이지에 접근하려면 로그인하세요</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button onClick={() => { setLocalError(null); clearAuthError(); }} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              관리자 ID
            </label>
            <input
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="admin"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {authLoading && <Loader2 size={20} className="animate-spin" />}
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}

// 관리자 콘텐츠 (기존 AdminPage 내용)
function AdminContent({ logout }: { logout: () => void }) {
  const {
    teachers,
    courses,
    loading,
    error,
    fetchTeachers,
    addTeacher,
    editTeacher,
    fetchCoursesByTeacher,
    addCourse,
    editCourse,
    updateCourse,
    clearError,
  } = useAdminCourses();

  const [viewTab, setViewTab] = useState<ViewTab>('by-teacher');
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [modalType, setModalType] = useState<ModalType>('none');
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [updateResult, setUpdateResult] = useState<{
    courseId: string;
    diff: number;
  } | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchUpdateProgress>({
    status: 'idle',
    total: 0,
    completed: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    currentCourse: null,
    logs: [],
  });
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loadingAllCourses, setLoadingAllCourses] = useState(false);

  // 초기 로드
  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // 강사 선택 시 강좌 목록 조회
  useEffect(() => {
    if (selectedTeacher) {
      fetchCoursesByTeacher(selectedTeacher);
    }
  }, [selectedTeacher, fetchCoursesByTeacher]);

  // 업데이트 필요 탭 선택 시 모든 강좌 조회
  useEffect(() => {
    if (viewTab === 'outdated') {
      fetchAllCoursesForOutdated();
    }
  }, [viewTab]);

  // 모든 강좌 조회 (업데이트 필요 탭용)
  const fetchAllCoursesForOutdated = async () => {
    setLoadingAllCourses(true);
    try {
      // 모든 강사의 강좌를 가져와서 합침
      const allCoursesData: Course[] = [];
      for (const teacher of teachers) {
        const res = await fetch(`${API_BASE_URL}/api/admin/courses/${encodeURIComponent(teacher.name)}`, {
          headers: defaultHeaders,
        });
        const data = await res.json();
        if (data.success && data.data?.courses) {
          allCoursesData.push(...data.data.courses);
        }
      }
      setAllCourses(allCoursesData);
    } catch (err) {
      console.error('Failed to fetch all courses:', err);
    } finally {
      setLoadingAllCourses(false);
    }
  };

  // 업데이트 필요한 강좌 필터
  const outdatedCourses = allCourses.filter(course =>
    !course.isCompleted && isOutdated(course.lastCrawledAt)
  );

  // 강좌 업데이트 핸들러
  const handleUpdateCourse = async (courseId: string) => {
    setUpdateResult(null);
    const result = await updateCourse(courseId);
    if (result) {
      setUpdateResult({ courseId, diff: result.diff });
      // 3초 후 결과 메시지 제거
      setTimeout(() => setUpdateResult(null), 3000);
    }
  };

  // 배치 업데이트 완료 후 데이터 새로고침
  const handleBatchComplete = () => {
    fetchTeachers();
    if (selectedTeacher) {
      fetchCoursesByTeacher(selectedTeacher);
    }
    if (viewTab === 'outdated') {
      fetchAllCoursesForOutdated();
    }
  };

  // 배치 업데이트 시작 (AdminContent에서 관리하여 백그라운드 처리 가능)
  const startBatchUpdate = async (options: {
    skipCompleted: boolean;
    onlyOutdated: boolean;
    maxCourses: number;
  }) => {
    // 초기화
    setBatchProgress({
      status: 'running',
      total: 0,
      completed: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      currentCourse: null,
      logs: [],
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/courses/batch-update`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Stream not available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                setBatchProgress(prev => ({
                  ...prev,
                  total: data.total,
                  skipped: data.skipped,
                }));
              } else if (data.type === 'progress') {
                setBatchProgress(prev => ({
                  ...prev,
                  completed: data.completed,
                  updated: data.current.success ? prev.updated + 1 : prev.updated,
                  failed: !data.current.success ? prev.failed + 1 : prev.failed,
                  currentCourse: data.current,
                  logs: [...prev.logs, {
                    name: data.current.name || 'Unknown',
                    success: data.current.success,
                    diff: data.current.diff,
                    error: data.current.error,
                  }],
                }));
              } else if (data.type === 'complete') {
                setBatchProgress(prev => ({
                  ...prev,
                  status: 'complete',
                  updated: data.updated,
                  failed: data.failed,
                  currentCourse: null,
                }));
                // 완료 시 결과 모달 자동 표시
                setModalType('batch-update');
              }
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Batch update error:', error);
      setBatchProgress(prev => ({
        ...prev,
        status: 'complete',
        logs: [...prev.logs, { name: 'Error', success: false, error: error.message }],
      }));
      // 에러 시에도 결과 모달 표시
      setModalType('batch-update');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 pb-24 max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={24} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">강좌 관리</h1>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setModalType('batch-update')}
              className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
            >
              <PlayCircle size={16} />
              전체 업데이트
            </button>
            <button
              onClick={() => setModalType('add-teacher')}
              className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              <Plus size={16} />
              강사 추가
            </button>
            <button
              onClick={() => setModalType('add-course')}
              className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
            >
              <BookOpen size={16} />
              강좌 추가
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              title="로그아웃"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button onClick={clearError} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        {/* 뷰 탭 (강사별 / 업데이트 필요) */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setViewTab('by-teacher')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              viewTab === 'by-teacher'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users size={16} />
            강사별
          </button>
          <button
            onClick={() => setViewTab('outdated')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              viewTab === 'outdated'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock size={16} />
            업데이트 필요
            {outdatedCourses.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                viewTab === 'outdated' ? 'bg-white/20' : 'bg-orange-500 text-white'
              }`}>
                {outdatedCourses.length}
              </span>
            )}
          </button>
        </div>

        {/* 강사별 탭 내용 */}
        {viewTab === 'by-teacher' && (
          <>
            {/* 강사 탭 */}
            <div className="mb-4 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                {teachers.map((teacher) => (
                  <div
                    key={teacher.name}
                    className={`flex items-center gap-1 rounded-lg ${
                      selectedTeacher === teacher.name
                        ? 'bg-blue-500'
                        : 'bg-gray-100'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedTeacher(teacher.name)}
                      className={`px-3 py-2 rounded-l-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                        selectedTeacher === teacher.name
                          ? 'text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {teacher.name}
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        selectedTeacher === teacher.name ? 'bg-white/20' : 'bg-gray-200'
                      }`}>
                        {teacher.courseCount}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTeacher(teacher);
                        setModalType('edit-teacher');
                      }}
                      className={`p-2 rounded-r-lg transition-all ${
                        selectedTeacher === teacher.name
                          ? 'text-white/70 hover:text-white hover:bg-blue-600'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                      }`}
                      title="강사 정보 수정"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                ))}
                {teachers.length === 0 && !loading && (
                  <p className="text-gray-500 text-sm py-2">
                    등록된 강사가 없습니다. 강좌를 추가하면 강사가 자동으로 등록됩니다.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* 강사별 탭 - 로딩 및 콘텐츠 */}
        {viewTab === 'by-teacher' && (
          <>
            {/* 로딩 */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-blue-500" />
              </div>
            )}

            {/* 강좌 목록 */}
            {!loading && selectedTeacher && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <ChevronRight size={20} />
                  {selectedTeacher} 강좌 목록
                </h2>

                {courses.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">등록된 강좌가 없습니다.</p>
                ) : (
                  courses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onUpdate={() => handleUpdateCourse(course.id)}
                      onEdit={() => {
                        setEditingCourse(course);
                        setModalType('edit-course');
                      }}
                      updateResult={
                        updateResult?.courseId === course.id ? updateResult.diff : null
                      }
                      loading={loading}
                    />
                  ))
                )}
              </div>
            )}

            {/* 강사 선택 안내 */}
            {!loading && !selectedTeacher && teachers.length > 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-30" />
                <p>강사를 선택하여 강좌 목록을 확인하세요</p>
              </div>
            )}
          </>
        )}

        {/* 업데이트 필요 탭 - 콘텐츠 */}
        {viewTab === 'outdated' && (
          <>
            {loadingAllCourses && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-orange-500" />
              </div>
            )}

            {!loadingAllCourses && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <Clock size={20} className="text-orange-500" />
                    업데이트 필요한 강좌 ({outdatedCourses.length}개)
                  </h2>
                  <button
                    onClick={fetchAllCoursesForOutdated}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    <RefreshCw size={14} />
                    새로고침
                  </button>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                  7일 이상 업데이트되지 않은 강좌 목록입니다. (완강 제외)
                </p>

                {outdatedCourses.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
                    <p>업데이트가 필요한 강좌가 없습니다!</p>
                  </div>
                ) : (
                  outdatedCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onUpdate={() => handleUpdateCourse(course.id)}
                      onEdit={() => {
                        setEditingCourse(course);
                        setModalType('edit-course');
                      }}
                      updateResult={
                        updateResult?.courseId === course.id ? updateResult.diff : null
                      }
                      loading={loading}
                      showTeacher
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* 모달 */}
        {modalType === 'add-teacher' && (
          <AddTeacherModal
            onClose={() => setModalType('none')}
            onAdd={addTeacher}
            loading={loading}
          />
        )}
        {modalType === 'add-course' && (
          <AddCourseModal
            onClose={() => setModalType('none')}
            onAdd={addCourse}
            teachers={teachers}
            loading={loading}
          />
        )}
        {modalType === 'edit-teacher' && editingTeacher && (
          <EditTeacherModal
            onClose={() => {
              setModalType('none');
              setEditingTeacher(null);
            }}
            onEdit={editTeacher}
            teacher={editingTeacher}
            loading={loading}
          />
        )}
        {modalType === 'edit-course' && editingCourse && (
          <EditCourseModal
            onClose={() => {
              setModalType('none');
              setEditingCourse(null);
            }}
            onEdit={editCourse}
            course={editingCourse}
            teachers={teachers}
            loading={loading}
          />
        )}
        {modalType === 'batch-update' && (
          <BatchUpdateModal
            onClose={() => {
              setModalType('none');
              if (batchProgress.status === 'complete') {
                handleBatchComplete();
                // 결과 확인 후 상태 초기화
                setBatchProgress({
                  status: 'idle',
                  total: 0,
                  completed: 0,
                  updated: 0,
                  failed: 0,
                  skipped: 0,
                  currentCourse: null,
                  logs: [],
                });
              }
            }}
            progress={batchProgress}
            onStartBatchUpdate={startBatchUpdate}
          />
        )}

        {/* 백그라운드 진행 상태 표시 (모달 닫힌 상태에서 진행 중일 때) */}
        {modalType !== 'batch-update' && batchProgress.status === 'running' && (
          <button
            onClick={() => setModalType('batch-update')}
            className="fixed bottom-4 right-4 bg-purple-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 hover:bg-purple-600 transition-colors z-50"
          >
            <Loader2 size={20} className="animate-spin" />
            <div className="text-left">
              <div className="text-sm font-medium">업데이트 진행 중...</div>
              <div className="text-xs opacity-80">
                {batchProgress.completed} / {batchProgress.total}
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

// 강좌 카드 컴포넌트
function CourseCard({
  course,
  onUpdate,
  onEdit,
  updateResult,
  loading,
  showTeacher = false,
}: {
  course: Course;
  onUpdate: () => void;
  onEdit?: () => void;
  updateResult: number | null;
  loading: boolean;
  showTeacher?: boolean;
}) {
  const outdated = isOutdated(course.lastCrawledAt);

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm ${outdated && !course.isCompleted ? 'border-orange-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{course.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            {showTeacher && course.teacher && (
              <span className="text-blue-600 font-medium">{course.teacher}</span>
            )}
            <span>{course.platform}</span>
            {course.subject && <span>• {course.subject}</span>}
            <span>• {course.lectureCount}강</span>
            {course.isCompleted && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle size={14} />
                완강
              </span>
            )}
            {outdated && !course.isCompleted && (
              <span className="text-orange-600 flex items-center gap-1">
                <Clock size={14} />
                업데이트 필요
              </span>
            )}
          </div>
          {course.lastCrawledAt && (
            <p className="text-xs text-gray-400 mt-1">
              마지막 업데이트: {new Date(course.lastCrawledAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 업데이트 결과 표시 */}
          {updateResult !== null && (
            <span
              className={`text-sm font-medium ${
                updateResult > 0 ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              {updateResult > 0 ? `+${updateResult}강` : '변동 없음'}
            </span>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              title="강좌 정보 수정"
            >
              <Pencil size={14} />
              수정
            </button>
          )}

          <button
            onClick={onUpdate}
            disabled={loading || !course.url}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            업데이트
          </button>
        </div>
      </div>

      {/* 강의 목록 (축약) */}
      {course.chapters.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">최근 강의</p>
          <div className="space-y-1">
            {course.chapters.slice(-3).map((ch, idx) => (
              <div key={idx} className="text-sm text-gray-600 flex justify-between">
                <span className="truncate flex-1">{ch.title}</span>
                {ch.duration && (
                  <span className="text-gray-400 ml-2">{ch.duration}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 강사 추가 모달
function AddTeacherModal({
  onClose,
  onAdd,
  loading,
}: {
  onClose: () => void;
  onAdd: (name: string, platform: string, subject?: string) => Promise<boolean>;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('megastudy');
  const [subject, setSubject] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const success = await onAdd(name.trim(), platform, subject || undefined);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강사 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 현우진"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              플랫폼
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="megastudy">메가스터디</option>
              <option value="etoos">이투스</option>
              <option value="daesung">대성마이맥</option>
              <option value="ebsi">EBSi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목 (선택)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            추가하기
          </button>
        </form>
      </div>
    </div>
  );
}

// 강좌 추가 모달
function AddCourseModal({
  onClose,
  onAdd,
  teachers,
  loading,
}: {
  onClose: () => void;
  onAdd: (url: string, teacher?: string, subject?: string) => Promise<Course | null>;
  teachers: Teacher[];
  loading: boolean;
}) {
  const [url, setUrl] = useState('');
  const [teacher, setTeacher] = useState('');
  const [subject, setSubject] = useState('');

  // 강사 선택 시 해당 강사의 과목을 자동 설정
  const handleTeacherChange = (selectedTeacher: string) => {
    setTeacher(selectedTeacher);
    // 선택한 강사의 과목 자동 설정
    if (selectedTeacher) {
      const teacherData = teachers.find(t => t.name === selectedTeacher);
      if (teacherData && teacherData.subjects.length > 0) {
        setSubject(teacherData.subjects[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const result = await onAdd(url.trim(), teacher || undefined, subject || undefined);
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강좌 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강좌 URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.megastudy.net/teacher/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              메가스터디 강좌 페이지 URL을 입력하세요
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사 (선택)
            </label>
            <select
              value={teacher}
              onChange={(e) => handleTeacherChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">크롤링으로 자동 감지</option>
              {teachers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} {t.subjects.length > 0 ? `(${t.subjects[0]})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              강사를 선택하면 해당 강사의 과목이 자동 설정됩니다
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목 {teacher ? '' : '(선택)'}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            강좌 가져오기
          </button>
        </form>
      </div>
    </div>
  );
}

// 강사 수정 모달
function EditTeacherModal({
  onClose,
  onEdit,
  teacher,
  loading,
}: {
  onClose: () => void;
  onEdit: (oldName: string, newData: { name?: string; subject?: string; platform?: string }) => Promise<boolean>;
  teacher: Teacher;
  loading: boolean;
}) {
  const [name, setName] = useState(teacher.name);
  const [platform, setPlatform] = useState(teacher.platform || 'megastudy');
  const [subject, setSubject] = useState(teacher.subjects[0] || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const success = await onEdit(teacher.name, {
      name: name.trim(),
      platform,
      subject: subject || undefined,
    });
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강사 정보 수정</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 현우진"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              플랫폼
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="megastudy">메가스터디</option>
              <option value="mimac">대성마이맥</option>
              <option value="etoos">이투스</option>
              <option value="ebsi">EBSi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              수정하면 이 강사의 모든 강좌 과목이 변경됩니다
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            저장
          </button>
        </form>
      </div>
    </div>
  );
}

// 강좌 수정 모달
function EditCourseModal({
  onClose,
  onEdit,
  course,
  teachers,
  loading,
}: {
  onClose: () => void;
  onEdit: (courseId: string, data: {
    name?: string;
    teacher?: string;
    subject?: string;
    platform?: string;
    isCompleted?: boolean;
  }) => Promise<Course | null>;
  course: Course;
  teachers: Teacher[];
  loading: boolean;
}) {
  const [name, setName] = useState(course.name);
  const [teacher, setTeacher] = useState(course.teacher);
  const [subject, setSubject] = useState(course.subject || '');
  const [platform, setPlatform] = useState(course.platform || 'megastudy');
  const [isCompleted, setIsCompleted] = useState(course.isCompleted || false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await onEdit(course.id, {
      name: name.trim(),
      teacher,
      subject: subject || undefined,
      platform,
      isCompleted,
    });
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강좌 정보 수정</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강좌명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="강좌명 입력"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사
            </label>
            <select
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {teachers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
              <option value={teacher}>{teacher} (현재)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              플랫폼
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="megastudy">메가스터디</option>
              <option value="mimac">대성마이맥</option>
              <option value="etoos">이투스</option>
              <option value="ebsi">EBSi</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCompleted"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="isCompleted" className="text-sm text-gray-700">
              완강 처리 (업데이트 알림 제외)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            저장
          </button>
        </form>
      </div>
    </div>
  );
}

// 배치 업데이트 모달
function BatchUpdateModal({
  onClose,
  progress,
  onStartBatchUpdate,
}: {
  onClose: () => void;
  progress: BatchUpdateProgress;
  onStartBatchUpdate: (options: { skipCompleted: boolean; onlyOutdated: boolean; maxCourses: number }) => Promise<void>;
}) {
  const [skipCompleted, setSkipCompleted] = useState(true);
  const [onlyOutdated, setOnlyOutdated] = useState(false);
  const [maxCourses, setMaxCourses] = useState(50);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 로그 자동 스크롤
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress.logs]);

  const handleStart = () => {
    onStartBatchUpdate({ skipCompleted, onlyOutdated, maxCourses });
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {progress.status === 'complete' ? '업데이트 완료' : '전체 강좌 업데이트'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
            title={progress.status === 'running' ? '백그라운드에서 계속 진행됩니다' : '닫기'}
          >
            <X size={20} />
          </button>
        </div>

        {progress.status === 'idle' && (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                모든 강좌의 커리큘럼을 최신 상태로 업데이트합니다.
                배치 처리로 안전하게 진행됩니다.
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipCompleted}
                    onChange={(e) => setSkipCompleted(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">완강된 강좌 건너뛰기</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyOutdated}
                    onChange={(e) => setOnlyOutdated(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">7일 이상 업데이트 안 된 강좌만</span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">최대 처리 개수:</label>
                  <select
                    value={maxCourses}
                    onChange={(e) => setMaxCourses(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={10}>10개</option>
                    <option value={25}>25개</option>
                    <option value={50}>50개</option>
                    <option value={100}>100개</option>
                    <option value={200}>200개 (주의)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              <PlayCircle size={20} />
              업데이트 시작
            </button>
          </>
        )}

        {progress.status === 'running' && (
          <div className="flex-1 flex flex-col">
            {/* 진행률 바 */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>진행률</span>
                <span>{progress.completed} / {progress.total} ({progressPercent}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 현재 처리 중인 강좌 */}
            {progress.currentCourse && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">
                    {progress.currentCourse.name || '처리 중...'}
                  </span>
                </div>
              </div>
            )}

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-green-600">{progress.updated}</div>
                <div className="text-xs text-green-700">성공</div>
              </div>
              <div className="bg-red-50 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-red-700">실패</div>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-gray-600">{progress.skipped}</div>
                <div className="text-xs text-gray-700">스킵</div>
              </div>
            </div>

            {/* 로그 */}
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-3 min-h-[150px] max-h-[200px]">
              <div className="space-y-1 text-xs">
                {progress.logs.map((log, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-red-500 flex-shrink-0" />
                    )}
                    <span className={log.success ? 'text-gray-700' : 'text-red-600'}>
                      {log.name}
                      {log.success && log.diff !== undefined && (
                        <span className="text-green-600 ml-1">
                          {log.diff > 0 ? `+${log.diff}` : log.diff === 0 ? '변동없음' : log.diff}
                        </span>
                      )}
                      {!log.success && log.error && (
                        <span className="text-red-500 ml-1">- {log.error}</span>
                      )}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* 백그라운드 진행 버튼 */}
            <button
              onClick={onClose}
              className="mt-4 w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              백그라운드에서 계속 (창 닫기)
            </button>
          </div>
        )}

        {progress.status === 'complete' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">업데이트 완료</h3>

            {/* 최종 통계 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{progress.updated}</div>
                <div className="text-xs text-green-700">성공</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-red-700">실패</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{progress.skipped}</div>
                <div className="text-xs text-gray-700">스킵 (완강)</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
