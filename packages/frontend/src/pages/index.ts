/**
 * Pages
 * 페이지 컴포넌트 re-export
 */

// 인증 페이지
export { LoginPage } from './LoginPage';
export { SignUpPage } from './SignUpPage';
export { OnboardingPage } from './OnboardingPage';
export { MyPage } from './MyPage';
export { InquiryPage } from './InquiryPage';

// 노트북 스타일 (V2)
export { TodayPage } from './TodayPage';
export { PlannerPage } from './PlannerPage';
export { GeneratePageV2 as GeneratePage } from './GeneratePageV2';
export { PlanDetailPageV2 as PlanDetailPage } from './PlanDetailPageV2';

// AI Coach 시스템
export { AdmissionPage } from './AdmissionPage';
export { ReportPage } from './ReportPage';

// 채팅 시스템 (카카오톡 스타일)
export { ChatListPage, ChatRoomPage } from './chat';
// 하위호환성 유지
export { ChatPage } from './ChatPage';

// 인강 커리큘럼 시스템
export { CurriculumPage } from './CurriculumPage';

// 학습 꿀팁
export { TipsPage } from './TipsPage';

// 관리자 페이지
export { AdminPage } from './AdminPage';

// 학습 타이머 페이지
export { TimerPage } from './TimerPage';
