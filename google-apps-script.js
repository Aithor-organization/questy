/**
 * Questy 사용자 활동 리포트 - Google Apps Script
 *
 * 매일 오전 10시, 오후 10시에 GitHub Actions에서 호출되어
 * 사용자들의 온라인 상태를 날짜별 시트에 기록합니다.
 *
 * 사용 방법:
 * 1. Google Sheets를 새로 생성하세요
 * 2. 확장 프로그램 > Apps Script 메뉴로 이동
 * 3. 아래 코드를 붙여넣으세요
 * 4. 저장 후 배포 > 새 배포 > 유형: 웹 앱 선택
 * 5. 실행 사용자: 나 자신, 액세스 권한: 모든 사용자로 설정
 * 6. 배포 후 생성되는 웹 앱 URL을 GitHub Secrets에 추가
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 스프레드시트 열기
    const properties = PropertiesService.getScriptProperties();
    let SPREADSHEET_ID = properties.getProperty('SPREADSHEET_ID');

    if (!SPREADSHEET_ID) {
      SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
      properties.setProperty('SPREADSHEET_ID', SPREADSHEET_ID);
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 사용자 활동 리포트 처리
    if (data.type === 'user_activity_report') {
      return handleUserActivityReport(spreadsheet, data);
    }

    // 알 수 없는 타입
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Unknown type: ' + data.type }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 사용자 활동 리포트 처리
 * 날짜별 시트에 오전/오후 리포트를 기록
 *
 * 시트 구조 (날짜별 시트: "2026-01-22"):
 * | 시간 | 이름 | 이메일 | 마지막활동 | 온라인상태 |
 */
function handleUserActivityReport(spreadsheet, data) {
  const now = new Date();
  const reportType = data.reportType || 'manual';
  const reportTypeKorean = {
    'morning': '오전10시',
    'evening': '오후10시',
    'manual': '수동'
  }[reportType] || reportType;

  // 오늘 날짜로 시트 이름 생성 (KST 기준)
  const dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  let sheet = spreadsheet.getSheetByName(dateStr);

  // 시트가 없으면 새로 생성
  if (!sheet) {
    sheet = spreadsheet.insertSheet(dateStr, 0); // 맨 앞에 추가
    sheet.appendRow(['시간', '이름', '이메일', '마지막활동', '온라인상태']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 80);
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 80);
  }

  // 구분선 추가 (오전/오후 리포트 구분)
  sheet.appendRow([reportTypeKorean, '---', '---', '---', '---']);
  const separatorRow = sheet.getLastRow();
  sheet.getRange(separatorRow, 1, 1, 5).setBackground('#e8f0fe').setFontWeight('bold');

  // 사용자 데이터가 없으면
  if (!data.users || data.users.length === 0) {
    sheet.appendRow([reportTypeKorean, '(사용자 없음)', '', '', '']);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: '사용자 없음', userCount: 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 온라인 판별 (15분 이내)
  const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;
  let onlineCount = 0;
  let offlineCount = 0;

  // 사용자 데이터 정렬 (온라인 먼저, 그 다음 마지막 활동 시간순)
  const sortedUsers = data.users.sort(function(a, b) {
    const aActive = a.last_active_at ? new Date(a.last_active_at) : new Date(0);
    const bActive = b.last_active_at ? new Date(b.last_active_at) : new Date(0);
    const aOnline = (now.getTime() - aActive.getTime()) < ONLINE_THRESHOLD_MS;
    const bOnline = (now.getTime() - bActive.getTime()) < ONLINE_THRESHOLD_MS;

    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return bActive.getTime() - aActive.getTime(); // 최근 활동순
  });

  // 행 데이터 생성
  const rows = sortedUsers.map(function(user) {
    const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
    const isOnline = lastActive && (now.getTime() - lastActive.getTime()) < ONLINE_THRESHOLD_MS;

    if (isOnline) onlineCount++;
    else offlineCount++;

    return [
      reportTypeKorean,
      user.display_name || '(이름없음)',
      user.email || '',
      lastActive ? Utilities.formatDate(lastActive, 'Asia/Seoul', 'MM-dd HH:mm') : '없음',
      isOnline ? '🟢' : '⚪'
    ];
  });

  // 일괄 추가
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }

  // 통계 행 추가
  sheet.appendRow(['', '합계', onlineCount + offlineCount + '명', '온라인: ' + onlineCount + '명', '']);
  const statsRow = sheet.getLastRow();
  sheet.getRange(statsRow, 1, 1, 5).setFontStyle('italic').setFontColor('#666666');

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: '리포트 저장 완료',
      date: dateStr,
      reportType: reportTypeKorean,
      userCount: data.users.length,
      onlineCount: onlineCount,
      offlineCount: offlineCount
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 스프레드시트 ID 설정 (선택사항)
 * 다른 스프레드시트를 사용하려면 이 함수를 실행하세요
 */
function setupSpreadsheetId() {
  const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', SPREADSHEET_ID);
  Logger.log('스프레드시트 ID 설정됨: ' + SPREADSHEET_ID);
}

/**
 * 테스트용 함수
 */
function testReport() {
  const testData = {
    type: 'user_activity_report',
    reportType: 'morning',
    users: [
      { display_name: '테스트유저1', email: 'test1@test.com', last_active_at: new Date().toISOString() },
      { display_name: '테스트유저2', email: 'test2@test.com', last_active_at: new Date(Date.now() - 3600000).toISOString() }
    ]
  };

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const result = handleUserActivityReport(spreadsheet, testData);
  Logger.log(result.getContent());
}
