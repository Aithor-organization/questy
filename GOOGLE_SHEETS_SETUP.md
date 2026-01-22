# Google Sheets 연동 설정 가이드

이 가이드는 사전예약 폼 데이터를 Google Sheets에 자동으로 저장하는 방법을 안내합니다.

## 1단계: Google Sheets 생성

1. [Google Sheets](https://sheets.google.com)에 접속
2. 새 스프레드시트 생성
3. 스프레드시트 이름 설정 (예: "맵맵맵 사전예약 명단")

## 2단계: Google Apps Script 설정

1. 생성한 스프레드시트에서 **확장 프로그램 > Apps Script** 메뉴 선택
2. `google-apps-script.js` 파일의 **전체 내용**을 복사하여 Apps Script 편집기에 붙여넣기
3. 기존 코드를 모두 삭제하고 새 코드로 교체 (중요!)
4. 저장 (Ctrl+S 또는 Cmd+S)

**중요**: CORS 문제를 방지하기 위해 클라이언트 코드에서 `Content-Type`을 `text/plain`으로 설정합니다. 이는 Google Apps Script의 제한사항 때문입니다.

## 3단계: 웹 앱 배포

1. Apps Script 편집기에서 **배포 > 새 배포** 클릭
2. 배포 유형 옆의 **설정(톱니바퀴 아이콘) > 웹 앱** 선택
3. 다음 설정 입력:
   - **설명**: 원하는 설명 (예: "맵맵맵 사전예약 폼")
   - **실행 사용자**: 나 자신
   - **액세스 권한**: 모든 사용자
4. **배포** 버튼 클릭
5. 권한 허용 창이 나타나면 **권한 확인** 클릭
6. Google 계정 선택 후 **고급 > (사이트 이름)(으)로 이동** 클릭
7. **허용** 클릭
8. 배포 후 나타나는 **웹 앱 URL**을 복사 (예: `https://script.google.com/macros/s/.../exec`)

## 4단계: 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가:

```env
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

**중요**:

- `.env` 파일은 Git에 커밋하지 마세요 (`.gitignore`에 추가되어 있어야 합니다)
- Vercel 등 배포 환경에서는 환경 변수를 별도로 설정해야 합니다

## 5단계: 스프레드시트 확인

스크립트가 정상적으로 작동하면 스프레드시트에 다음 헤더가 자동으로 생성됩니다:

| 타임스탬프 | 닉네임 | 전화번호 | 신청 경로 | 맵기 레벨 | 메이커 여부 |
| ---------- | ------ | -------- | --------- | --------- | ----------- |
| ...        | ...    | ...      | ...       | ...       | ...         |

## 문제 해결

### 데이터가 저장되지 않을 때

1. Apps Script의 실행 로그 확인: **실행 > 로그 보기**
2. 웹 앱 URL이 올바른지 확인
3. 환경 변수 `VITE_GOOGLE_SHEETS_API_URL`이 올바르게 설정되었는지 확인
4. 브라우저 개발자 도구의 네트워크 탭에서 에러 확인

### 권한 오류가 발생할 때

1. Apps Script에서 **배포 > 배포 관리** 메뉴로 이동
2. 최신 배포 버전을 선택하고 **수정** 클릭
3. 액세스 권한이 "모든 사용자"로 설정되어 있는지 확인
4. 새 버전으로 배포
5. **중요**: 코드를 수정했다면 반드시 새 버전으로 재배포해야 합니다

### 다른 스프레드시트 사용하기

다른 스프레드시트를 사용하려면:

1. Apps Script 편집기에서 `setupSpreadsheetId` 함수 수정
2. `YOUR_SPREADSHEET_ID_HERE`를 사용할 스프레드시트 ID로 변경
3. **실행 > 함수 실행 > setupSpreadsheetId** 선택하여 실행
4. 스프레드시트 ID는 URL에서 확인할 수 있습니다:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

## 참고사항

- 스프레드시트는 자동으로 헤더를 생성합니다 (첫 번째 행)
- 각 제출마다 타임스탬프가 자동으로 기록됩니다
- 메이커 여부는 "예" 또는 "아니오"로 저장됩니다
- 신청 경로는 한글로 변환되어 저장됩니다 (인스타그램, 쓰레드, 지인 추천, 기타)

---

## 사용자 활동 리포트 (GitHub Actions)

GitHub Actions를 통해 매일 오전 10시, 오후 10시, 매주 월요일 새벽 2시에 사용자 온라인 상태를 Google Sheets에 자동 기록합니다.

### 기능 설명

- **데이터 소스**: Supabase `user_profiles` 테이블의 `last_active_at` 컬럼
- **온라인 판별**: 마지막 활동 시간이 15분 이내면 "온라인", 아니면 "오프라인"
- **기록 시트**: "사용자 활동 리포트" 시트에 자동 저장

### GitHub Actions 설정

1. GitHub 저장소의 **Settings > Secrets and variables > Actions** 메뉴로 이동

2. 다음 Secrets 추가:

| Secret 이름 | 값 | 설명 |
|------------|-----|------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase anon key |
| `GOOGLE_SHEETS_API_URL` | `https://script.google.com/macros/s/.../exec` | Apps Script 웹앱 URL |

3. Workflow 파일 확인: `.github/workflows/user-activity-report.yml`

### 실행 스케줄

| 시간 (KST) | cron (UTC) | 설명 |
|-----------|------------|------|
| 매일 오전 10시 | `0 1 * * *` | 오전 리포트 |
| 매일 오후 10시 | `0 13 * * *` | 오후 리포트 |

### 수동 실행

GitHub 저장소 > Actions 탭 > "User Activity Report to Google Sheets" > "Run workflow" 버튼으로 수동 실행 가능

### Google Sheets 결과 형태

"사용자 활동 리포트" 시트에 다음 형식으로 저장됩니다:

| 기록시간 | 리포트시간 | 리포트타입 | 사용자ID | 이름 | 이메일 | 마지막활동 | 마지막로그인 | 가입일 | 온라인상태 |
|---------|-----------|-----------|---------|------|--------|-----------|-------------|-------|-----------|
| 2026-01-22 10:00 | 오전10시 | ... | uuid... | 김철수 | kim@... | 2026-01-22 09:45 | ... | ... | 온라인 |

### Apps Script 재배포 필요

`google-apps-script.js` 파일이 업데이트되었으므로:

1. Apps Script 편집기에서 코드 전체 교체
2. **배포 > 배포 관리 > 새 버전으로 수정** 또는 **새 배포**
3. 새로운 웹앱 URL이 생성되면 GitHub Secrets 업데이트
