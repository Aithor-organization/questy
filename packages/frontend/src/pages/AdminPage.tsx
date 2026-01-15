/**
 * AdminPage - 강좌/강사 관리 페이지
 * 강사별 탭으로 강좌 목록 관리 + 강사/강좌 추가 기능
 * 관리자 로그인 필요
 *
 * 모듈화된 구조 (admin-page/ 디렉토리):
 * - types.ts: 타입 정의 및 유틸리티
 * - AdminLoginForm.tsx: 로그인 폼
 * - AdminContent.tsx: 메인 관리 콘텐츠
 * - CourseCard.tsx: 강좌 카드
 * - modals/: 모달 컴포넌트들
 */

export { AdminPage, AdminPage as default } from './admin-page';
