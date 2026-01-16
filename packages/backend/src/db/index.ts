/**
 * Database Module - 통합 Export
 * 모든 DB 함수와 스키마를 하나의 진입점으로 제공
 */

// Connection & DB instance
export { db, sqlite } from './connection.js';

// Initialization
export { initializeDatabase } from './init.js';

// Student queries
export { getStudent, createStudent, updateStudent } from './queries/students.js';

// Plan queries
export { getPlan, getStudentPlans, getActivePlans, createPlan, updatePlan } from './queries/plans.js';

// Quest queries
export {
  getQuest, getPlanQuests, getTodayQuests, getStudentQuests,
  createQuest, createQuests, updateQuest, completeQuest
} from './queries/quests.js';

// Task queries
export { getQuestTasks, createTask, createTasks, toggleTask } from './queries/tasks.js';

// Progress queries
export { getStudentProgress, getTodayProgress, upsertProgress } from './queries/progress.js';

// Conversation queries
export { getConversations, addConversation } from './queries/conversations.js';

// Course queries
export {
  searchCourses, getCourse, getCoursesByTeacher, getAllCourses,
  getCoursesCount, getIncompleteCourses, updateCourseCurriculum,
  upsertCourse, updateTeacherInfo, updateCourseMetadata
} from './queries/courses.js';

// Stats queries
export { getStudentStats } from './queries/stats.js';

// Inquiry queries
export {
  getAllInquiries, getInquiry, getUserInquiries,
  createInquiry, updateInquiryStatus, deleteInquiry
} from './queries/inquiries.js';

// Re-export schema
export * from './schema.js';

// Auto-initialize on import
import { initializeDatabase } from './init.js';
initializeDatabase();
