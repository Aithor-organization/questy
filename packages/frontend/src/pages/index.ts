/**
 * Pages
 * 페이지 컴포넌트 re-export
 */

// 인증 페이지
export { LoginPage } from './LoginPage';
export { SignUpPage } from './SignUpPage';
export { MyPage } from './MyPage';

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
