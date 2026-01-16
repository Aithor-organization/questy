/**
 * Admin Page - Admin Content Component
 * 관리자 메인 콘텐츠 (로그인 후 표시)
 */

import { useState, useEffect } from 'react';
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
  LogOut,
  PlayCircle,
  Clock,
  Pencil,
  MessageSquare,
} from 'lucide-react';
import { useAdminCourses } from '../../hooks/useAdminCourses';
import { CourseCard } from './CourseCard';
import { InquiriesView } from './InquiriesView';
import {
  AddTeacherModal,
  AddCourseModal,
  EditTeacherModal,
  EditCourseModal,
  BatchUpdateModal,
} from './modals';
import {
  type ModalType,
  type ViewTab,
  type BatchUpdateProgress,
  type Teacher,
  type Course,
  isOutdated,
  initialBatchProgress,
} from './types';

interface AdminContentProps {
  logout: () => void;
  adminName: string;
}

export function AdminContent({ logout, adminName }: AdminContentProps) {
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
    getAllCourses,
    batchUpdateCourses,
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
  const [batchProgress, setBatchProgress] = useState<BatchUpdateProgress>(initialBatchProgress);
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
      const allCoursesData = await getAllCourses();
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

  // 배치 업데이트 시작
  const startBatchUpdate = async (options: {
    skipCompleted: boolean;
    onlyOutdated: boolean;
    maxCourses: number;
  }) => {
    setBatchProgress({
      ...initialBatchProgress,
      status: 'running',
    });

    await batchUpdateCourses(options, (data: any) => {
      if (data.type === 'start') {
        setBatchProgress(prev => ({
          ...prev,
          total: data.total,
          skipped: data.skipped || 0,
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
        setModalType('batch-update');
      } else if (data.type === 'error') {
        console.error('Batch update error:', data.error);
        setBatchProgress(prev => ({
          ...prev,
          status: 'complete',
          logs: [...prev.logs, { name: 'Error', success: false, error: data.error }],
        }));
        setModalType('batch-update');
      }
    });
  };

  // 배치 모달 닫기 핸들러
  const handleCloseBatchModal = () => {
    setModalType('none');
    if (batchProgress.status === 'complete') {
      handleBatchComplete();
      setBatchProgress(initialBatchProgress);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 pb-24 max-w-3xl mx-auto">
        {/* 헤더 */}
        <Header
          adminName={adminName}
          logout={logout}
          onAddTeacher={() => setModalType('add-teacher')}
          onAddCourse={() => setModalType('add-course')}
          onBatchUpdate={() => setModalType('batch-update')}
        />

        {/* 에러 메시지 */}
        {error && (
          <ErrorBanner error={error} onClear={clearError} />
        )}

        {/* 뷰 탭 */}
        <ViewTabs
          viewTab={viewTab}
          setViewTab={setViewTab}
          outdatedCount={outdatedCourses.length}
          showInquiries
        />

        {/* 강사별 탭 내용 */}
        {viewTab === 'by-teacher' && (
          <TeacherView
            teachers={teachers}
            courses={courses}
            loading={loading}
            selectedTeacher={selectedTeacher}
            setSelectedTeacher={setSelectedTeacher}
            onEditTeacher={(teacher) => {
              setEditingTeacher(teacher);
              setModalType('edit-teacher');
            }}
            onEditCourse={(course) => {
              setEditingCourse(course);
              setModalType('edit-course');
            }}
            onUpdateCourse={handleUpdateCourse}
            updateResult={updateResult}
          />
        )}

        {/* 업데이트 필요 탭 내용 */}
        {viewTab === 'outdated' && (
          <OutdatedView
            courses={outdatedCourses}
            loading={loadingAllCourses || loading}
            onRefresh={fetchAllCoursesForOutdated}
            onEditCourse={(course) => {
              setEditingCourse(course);
              setModalType('edit-course');
            }}
            onUpdateCourse={handleUpdateCourse}
            updateResult={updateResult}
          />
        )}

        {/* 문의 관리 탭 내용 */}
        {viewTab === 'inquiries' && (
          <InquiriesView />
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
            onClose={handleCloseBatchModal}
            progress={batchProgress}
            onStartBatchUpdate={startBatchUpdate}
          />
        )}

        {/* 백그라운드 진행 상태 표시 */}
        {modalType !== 'batch-update' && batchProgress.status === 'running' && (
          <BackgroundProgressButton
            progress={batchProgress}
            onClick={() => setModalType('batch-update')}
          />
        )}
      </div>
    </div>
  );
}

// 헤더 컴포넌트
function Header({
  adminName,
  logout,
  onAddTeacher,
  onAddCourse,
  onBatchUpdate,
}: {
  adminName: string;
  logout: () => void;
  onAddTeacher: () => void;
  onAddCourse: () => void;
  onBatchUpdate: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Users size={24} className="text-blue-600" />
        <h1 className="text-xl font-bold text-gray-800">강좌 관리</h1>
      </div>
      <div className="flex gap-2 flex-wrap justify-end">
        <button
          onClick={onBatchUpdate}
          className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
        >
          <PlayCircle size={16} />
          전체 업데이트
        </button>
        <button
          onClick={onAddTeacher}
          className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} />
          강사 추가
        </button>
        <button
          onClick={onAddCourse}
          className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
        >
          <BookOpen size={16} />
          강좌 추가
        </button>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <span className="text-sm text-gray-600">{adminName}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors"
            title="로그아웃"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// 에러 배너
function ErrorBanner({ error, onClear }: { error: string; onClear: () => void }) {
  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
      <AlertCircle size={18} />
      <span className="text-sm">{error}</span>
      <button onClick={onClear} className="ml-auto">
        <X size={16} />
      </button>
    </div>
  );
}

// 뷰 탭
function ViewTabs({
  viewTab,
  setViewTab,
  outdatedCount,
  showInquiries,
}: {
  viewTab: ViewTab;
  setViewTab: (tab: ViewTab) => void;
  outdatedCount: number;
  showInquiries?: boolean;
}) {
  return (
    <div className="mb-4 flex gap-2 flex-wrap">
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
        {outdatedCount > 0 && (
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            viewTab === 'outdated' ? 'bg-white/20' : 'bg-orange-500 text-white'
          }`}>
            {outdatedCount}
          </span>
        )}
      </button>
      {showInquiries && (
        <button
          onClick={() => setViewTab('inquiries')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            viewTab === 'inquiries'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <MessageSquare size={16} />
          문의 관리
        </button>
      )}
    </div>
  );
}

// 강사별 뷰
function TeacherView({
  teachers,
  courses,
  loading,
  selectedTeacher,
  setSelectedTeacher,
  onEditTeacher,
  onEditCourse,
  onUpdateCourse,
  updateResult,
}: {
  teachers: Teacher[];
  courses: Course[];
  loading: boolean;
  selectedTeacher: string | null;
  setSelectedTeacher: (name: string) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onEditCourse: (course: Course) => void;
  onUpdateCourse: (courseId: string) => void;
  updateResult: { courseId: string; diff: number } | null;
}) {
  return (
    <>
      {/* 강사 탭 */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {teachers.map((teacher) => (
            <div
              key={teacher.name}
              className={`flex items-center gap-1 rounded-lg ${
                selectedTeacher === teacher.name ? 'bg-blue-500' : 'bg-gray-100'
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
                  onEditTeacher(teacher);
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
                onUpdate={() => onUpdateCourse(course.id)}
                onEdit={() => onEditCourse(course)}
                updateResult={updateResult?.courseId === course.id ? updateResult.diff : null}
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
  );
}

// 업데이트 필요 뷰
function OutdatedView({
  courses,
  loading,
  onRefresh,
  onEditCourse,
  onUpdateCourse,
  updateResult,
}: {
  courses: Course[];
  loading: boolean;
  onRefresh: () => void;
  onEditCourse: (course: Course) => void;
  onUpdateCourse: (courseId: string) => void;
  updateResult: { courseId: string; diff: number } | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Clock size={20} className="text-orange-500" />
          업데이트 필요한 강좌 ({courses.length}개)
        </h2>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        7일 이상 업데이트되지 않은 강좌 목록입니다. (완강 제외)
      </p>

      {courses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
          <p>업데이트가 필요한 강좌가 없습니다!</p>
        </div>
      ) : (
        courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onUpdate={() => onUpdateCourse(course.id)}
            onEdit={() => onEditCourse(course)}
            updateResult={updateResult?.courseId === course.id ? updateResult.diff : null}
            loading={false}
            showTeacher
          />
        ))
      )}
    </div>
  );
}

// 백그라운드 진행 버튼
function BackgroundProgressButton({
  progress,
  onClick,
}: {
  progress: BatchUpdateProgress;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 bg-purple-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 hover:bg-purple-600 transition-colors z-50"
    >
      <Loader2 size={20} className="animate-spin" />
      <div className="text-left">
        <div className="text-sm font-medium">업데이트 진행 중...</div>
        <div className="text-xs opacity-80">
          {progress.completed} / {progress.total}
        </div>
      </div>
    </button>
  );
}
