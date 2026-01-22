/**
 * Google Apps Script 코드
 * 
 * 사용 방법:
 * 1. Google Sheets를 새로 생성하세요
 * 2. 확장 프로그램 > Apps Script 메뉴로 이동
 * 3. 아래 코드를 붙여넣으세요
 * 4. 저장 후 배포 > 새 배포 > 유형: 웹 앱 선택
 * 5. 실행 사용자: 나 자신, 액세스 권한: 모든 사용자로 설정
 * 6. 배포 후 생성되는 웹 앱 URL을 복사하세요
 * 7. .env 파일에 VITE_GOOGLE_SHEETS_API_URL=웹앱URL 추가
 */

function doPost(e) {
  try {
    // 요청 데이터 파싱
    const data = JSON.parse(e.postData.contents);

    // 스프레드시트 열기
    // 방법 1: 스크립트 속성 사용 (권장)
    const properties = PropertiesService.getScriptProperties();
    let SPREADSHEET_ID = properties.getProperty('SPREADSHEET_ID');

    // 방법 2: 스크립트 속성이 없으면 현재 스프레드시트 사용
    if (!SPREADSHEET_ID) {
      SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
      properties.setProperty('SPREADSHEET_ID', SPREADSHEET_ID);
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 사용자 활동 리포트 기록 (GitHub Actions에서 호출)
    if (data.type === 'user_activity_report') {
      return handleUserActivityReport(spreadsheet, data);
    }

    // MAP-BTI 테스트 결과 기록인 경우 (별도 시트에 저장)
    if (data.type === 'mapbti_result') {
      let resultSheet = spreadsheet.getSheetByName('MAP-BTI 결과');

      // 시트가 없으면 새로 생성
      if (!resultSheet) {
        resultSheet = spreadsheet.insertSheet('MAP-BTI 결과');
        resultSheet.appendRow(['타임스탬프', 'MAP-BTI 결과']);
      }

      // 데이터 추가
      const timestamp = new Date();
      const row = [
        timestamp,
        data.resultCode || ''
      ];

      resultSheet.appendRow(row);

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: 'MAP-BTI 결과가 저장되었습니다.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 기존 사전예약 로직
    const sheet = spreadsheet.getActiveSheet();

    // 헤더가 없는 경우 헤더 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['타임스탬프', '닉네임', '전화번호', '신청 경로', '맵기 레벨', '메이커 여부', 'MapBTI 결과']);
    }

    // 신청 경로 한글 변환
    const sourceMap = {
      'instagram': '인스타그램',
      'threads': '쓰레드',
      'referral': '지인 추천',
      'mapbti': 'MAP-BTI 페이지',
      'other': '기타'
    };
    const sourceKorean = sourceMap[data.source] || data.source;

    // 데이터 추가
    const timestamp = new Date();
    const row = [
      timestamp,
      data.nickname || '',
      data.phone || '',
      sourceKorean || '',
      data.level || '',
      data.isMaker ? '예' : '아니오',
      data.mapBTI || ''
    ];

    sheet.appendRow(row);

    // 성공 응답
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: '데이터가 성공적으로 저장되었습니다.' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // 에러 응답
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 특정 스프레드시트 ID를 설정하는 함수 (선택사항)
 * 다른 스프레드시트를 사용하려면 이 함수를 실행하세요
 * 실행 > 함수 실행 > setupSpreadsheetId 선택하여 한 번만 실행
 */
function setupSpreadsheetId() {
  const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // 여기에 다른 스프레드시트 ID를 입력하세요
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', SPREADSHEET_ID);
  Logger.log('스프레드시트 ID가 설정되었습니다: ' + SPREADSHEET_ID);
}

/**
 * 사용자 활동 리포트 처리 함수
 * GitHub Actions에서 매일 오전 10시, 오후 10시, 매주 월요일 새벽 2시에 호출됨
 *
 * @param {Spreadsheet} spreadsheet - 스프레드시트 객체
 * @param {Object} data - 요청 데이터 { type, reportTime, reportType, users }
 */
function handleUserActivityReport(spreadsheet, data) {
  // 시트 이름 설정
  const sheetName = '사용자 활동 리포트';
  let sheet = spreadsheet.getSheetByName(sheetName);

  // 시트가 없으면 새로 생성하고 헤더 추가
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow([
      '기록시간',
      '리포트시간',
      '리포트타입',
      '사용자ID',
      '이름',
      '이메일',
      '마지막활동',
      '마지막로그인',
      '가입일',
      '온라인상태'
    ]);
    // 헤더 스타일 적용
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#f3f3f3');
    sheet.setFrozenRows(1);
  }

  const now = new Date();
  const reportTime = data.reportTime || now.toISOString();
  const reportType = data.reportType || 'manual';
  const reportTypeKorean = {
    'morning': '오전10시',
    'evening': '오후10시',
    'manual': '수동실행'
  }[reportType] || reportType;

  // 사용자 데이터가 없으면 빈 리포트 기록
  if (!data.users || data.users.length === 0) {
    sheet.appendRow([now, reportTime, reportTypeKorean, '-', '-', '-', '-', '-', '-', '데이터없음']);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: '사용자 데이터가 없습니다.',
        recordedAt: now.toISOString(),
        userCount: 0
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 온라인 상태 판별 (15분 이내 활동)
  const ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15분
  let onlineCount = 0;
  let offlineCount = 0;

  // 각 사용자 데이터를 행으로 추가
  const rows = data.users.map(function(user) {
    const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
    const createdAt = user.created_at ? new Date(user.created_at) : null;

    // 온라인 상태 판별
    let onlineStatus = '오프라인';
    if (lastActive && (now.getTime() - lastActive.getTime()) < ONLINE_THRESHOLD_MS) {
      onlineStatus = '온라인';
      onlineCount++;
    } else {
      offlineCount++;
    }

    return [
      now,
      reportTime,
      reportTypeKorean,
      user.id || '',
      user.name || '(이름없음)',
      user.email || '',
      lastActive ? formatDateKST(lastActive) : '없음',
      lastSignIn ? formatDateKST(lastSignIn) : '없음',
      createdAt ? formatDateKST(createdAt) : '없음',
      onlineStatus
    ];
  });

  // 일괄 추가 (성능 최적화)
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: '사용자 활동 리포트가 저장되었습니다.',
      recordedAt: now.toISOString(),
      userCount: data.users.length,
      onlineCount: onlineCount,
      offlineCount: offlineCount,
      reportType: reportTypeKorean
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 날짜를 KST 형식으로 포맷팅
 * @param {Date} date - 날짜 객체
 * @returns {string} 포맷팅된 날짜 문자열
 */
function formatDateKST(date) {
  // Google Apps Script는 서버 타임존 사용, 한국 시간으로 포맷팅
  return Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}
