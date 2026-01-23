/**
 * Questy 사용자 활동 리포트 - Google Apps Script
 *
 * 구조:
 * - Row 1: 이름, 이메일, 날짜 헤더 (1월22일, 1월23일, ...)
 * - Row 2: (빈칸), (빈칸), 시간 헤더 (오전10시, 오후10시, ...)
 * - Row 3+: 유저 데이터
 * - 마지막 행: 합계
 *
 * 타임스탬프 형식: YYYYMMDDHHmm (예: 202601230932)
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === 'user_activity_report') {
      return handleUserActivityReport(spreadsheet, data);
    }

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
 */
function handleUserActivityReport(spreadsheet, data) {
  const now = new Date();
  const reportType = data.reportType || 'manual'; // 'morning' or 'evening'

  // 메인 시트 가져오기 또는 생성
  let mainSheet = spreadsheet.getSheetByName('사용자활동');
  if (!mainSheet) {
    mainSheet = spreadsheet.insertSheet('사용자활동', 0);
    initializeMainSheet(mainSheet);
  }

  // 데이터 추적 시트 (숨김) - 이전 last_active_at 저장용
  let dataSheet = spreadsheet.getSheetByName('_UserData');
  if (!dataSheet) {
    dataSheet = spreadsheet.insertSheet('_UserData');
    dataSheet.hideSheet();
    dataSheet.appendRow(['user_id', 'email', 'last_active_at']);
  }

  // 날짜/시간 라벨 생성
  const dateStr = Utilities.formatDate(now, 'Asia/Seoul', 'M월d일');
  const timeLabel = reportType === 'morning' ? '오전10시' : (reportType === 'evening' ? '오후10시' : '수동');

  // 해당 날짜/시간 열 찾기 또는 생성
  const colIndex = findOrCreateColumn(mainSheet, dateStr, timeLabel);

  // 저장된 last_active 데이터 가져오기
  const storedData = getStoredUserData(dataSheet);

  // 사용자 처리
  const users = data.users || [];
  let activeCount = 0;

  for (const user of users) {
    // 유저 행 찾기 또는 생성
    const rowIndex = findOrCreateUserRow(mainSheet, user);

    const currentLastActive = user.last_active_at;
    const storedLastActive = storedData[user.id];

    let cellValue = '-';

    // 활동 변동 체크: 저장된 값과 다르면 변동 있음
    if (currentLastActive && currentLastActive !== storedLastActive) {
      const activeTime = new Date(currentLastActive);
      // 타임스탬프 형식: YYYYMMDDHHmm
      cellValue = Utilities.formatDate(activeTime, 'Asia/Seoul', 'yyyyMMddHHmm');
      activeCount++;

      // 저장값 업데이트
      updateStoredUserData(dataSheet, user.id, user.email, currentLastActive);
    }

    mainSheet.getRange(rowIndex, colIndex).setValue(cellValue).setHorizontalAlignment('center');
  }

  // 합계 행 업데이트
  const totalRowIndex = findTotalRow(mainSheet);
  mainSheet.getRange(totalRowIndex, colIndex).setValue(activeCount + '명').setHorizontalAlignment('center');

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      date: dateStr,
      reportType: timeLabel,
      activeCount: activeCount,
      totalUsers: users.length
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 메인 시트 초기화 (2행 헤더)
 */
function initializeMainSheet(sheet) {
  // Row 1: 날짜 헤더
  sheet.getRange(1, 1).setValue('이름');
  sheet.getRange(1, 2).setValue('이메일');
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');

  // Row 2: 시간 헤더 (이름/이메일 칸은 빈칸)
  sheet.getRange(2, 1).setValue('');
  sheet.getRange(2, 2).setValue('');
  sheet.getRange(2, 1, 1, 2).setBackground('#4285f4');

  // Row 3: 합계 행
  sheet.getRange(3, 1).setValue('합계');
  sheet.getRange(3, 2).setValue('');
  sheet.getRange(3, 1, 1, 2).setFontWeight('bold').setBackground('#f3f3f3');

  // 고정 설정 (2행 고정)
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2);
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 180);
}

/**
 * 열 찾기 또는 생성 (날짜: Row1, 시간: Row2)
 */
function findOrCreateColumn(sheet, dateStr, timeLabel) {
  const lastCol = Math.max(sheet.getLastColumn(), 2);

  // Row 1 (날짜), Row 2 (시간) 읽기
  const row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row2 = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

  // 기존 열 찾기 (날짜 + 시간 매칭)
  for (let i = 2; i < row1.length; i++) {
    if (row1[i] === dateStr && row2[i] === timeLabel) {
      return i + 1;
    }
  }

  // 새 열 생성
  const newColIndex = lastCol + 1;

  // Row 1: 날짜 헤더
  sheet.getRange(1, newColIndex)
    .setValue(dateStr)
    .setFontWeight('bold')
    .setBackground('#e8f0fe')
    .setHorizontalAlignment('center');

  // Row 2: 시간 헤더
  sheet.getRange(2, newColIndex)
    .setValue(timeLabel)
    .setFontWeight('bold')
    .setBackground('#d0e0fc')
    .setHorizontalAlignment('center');

  sheet.setColumnWidth(newColIndex, 110);

  // 기존 유저 행들에 '-' 초기화 (Row 3부터)
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    for (let row = 3; row <= lastRow; row++) {
      const nameValue = sheet.getRange(row, 1).getValue();
      if (nameValue && nameValue !== '합계') {
        sheet.getRange(row, newColIndex).setValue('-').setHorizontalAlignment('center');
      }
    }
  }

  return newColIndex;
}

/**
 * 유저 행 찾기 또는 생성
 */
function findOrCreateUserRow(sheet, user) {
  const lastRow = sheet.getLastRow();
  const displayName = user.display_name || '(이름없음)';

  // 기존 유저 찾기 (이메일로 매칭) - Row 3부터 검색
  if (lastRow > 2) {
    const emailCol = sheet.getRange(3, 2, lastRow - 2, 1).getValues();
    for (let i = 0; i < emailCol.length; i++) {
      if (emailCol[i][0] === user.email) {
        // 이름 업데이트 (변경되었을 수 있음)
        sheet.getRange(i + 3, 1).setValue(displayName);
        return i + 3;
      }
    }
  }

  // 새 유저 - 합계 행 위에 삽입
  const totalRowIndex = findTotalRow(sheet);
  sheet.insertRowBefore(totalRowIndex);

  // 새 유저 정보 입력
  sheet.getRange(totalRowIndex, 1).setValue(displayName);
  sheet.getRange(totalRowIndex, 2).setValue(user.email || '');

  // 기존 날짜 열들에 '-' 입력
  const lastCol = sheet.getLastColumn();
  for (let col = 3; col <= lastCol; col++) {
    sheet.getRange(totalRowIndex, col).setValue('-').setHorizontalAlignment('center');
  }

  return totalRowIndex;
}

/**
 * 합계 행 인덱스 찾기
 */
function findTotalRow(sheet) {
  const lastRow = sheet.getLastRow();
  const nameCol = sheet.getRange(1, 1, lastRow, 1).getValues();

  for (let i = 0; i < nameCol.length; i++) {
    if (nameCol[i][0] === '합계') {
      return i + 1;
    }
  }

  // 합계 행이 없으면 생성 (Row 3에)
  const newRow = Math.max(lastRow + 1, 3);
  sheet.getRange(newRow, 1).setValue('합계');
  sheet.getRange(newRow, 1, 1, 2).setFontWeight('bold').setBackground('#f3f3f3');
  return newRow;
}

/**
 * 저장된 유저 데이터 가져오기
 */
function getStoredUserData(dataSheet) {
  const lastRow = dataSheet.getLastRow();
  if (lastRow <= 1) return {};

  const data = dataSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const result = {};

  for (let i = 0; i < data.length; i++) {
    const userId = data[i][0];
    const lastActive = data[i][2];
    if (userId) {
      result[userId] = lastActive;
    }
  }

  return result;
}

/**
 * 저장된 유저 데이터 업데이트
 */
function updateStoredUserData(dataSheet, userId, email, lastActiveAt) {
  const lastRow = dataSheet.getLastRow();

  // 기존 데이터 찾기
  if (lastRow > 1) {
    const userIds = dataSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < userIds.length; i++) {
      if (userIds[i][0] === userId) {
        dataSheet.getRange(i + 2, 3).setValue(lastActiveAt);
        return;
      }
    }
  }

  // 새 유저 추가
  dataSheet.appendRow([userId, email, lastActiveAt]);
}

/**
 * 테스트용 함수
 */
function testReport() {
  const testData = {
    type: 'user_activity_report',
    reportType: 'morning',
    users: [
      { id: 'user1', display_name: '테스트유저1', email: 'test1@test.com', last_active_at: new Date().toISOString() },
      { id: 'user2', display_name: '테스트유저2', email: 'test2@test.com', last_active_at: new Date(Date.now() - 3600000).toISOString() }
    ]
  };

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const result = handleUserActivityReport(spreadsheet, testData);
  Logger.log(result.getContent());
}

/**
 * 시트 초기화 (테스트용)
 */
function resetSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const mainSheet = spreadsheet.getSheetByName('사용자활동');
  if (mainSheet) spreadsheet.deleteSheet(mainSheet);

  const dataSheet = spreadsheet.getSheetByName('_UserData');
  if (dataSheet) spreadsheet.deleteSheet(dataSheet);

  Logger.log('시트 초기화 완료');
}
