# Questy 사용자 활동 리포트 - Google Sheets 설정

GitHub Actions를 통해 매일 오전 10시, 오후 10시(KST)에 사용자 활동을 Google Sheets에 자동 기록합니다.

## 시트 구조

단일 시트에서 가로/세로로 확장됩니다:

```
|  이름  |      이메일       |   1월22일   |   1월23일   |   1월24일   |
|        |                   | 오전 | 오후 | 오전 | 오후 | 오전 | 오후 |
|--------|-------------------|------|------|------|------|------|------|
| 김철수 | kim@example.com   | 9:32 |21:47 |10:15 |  -   |  -   |  -   |
| 이영희 | lee@example.com   |  -   |18:30 | 9:45 |22:10 | 8:20 |  -   |
| 박민수 | park@example.com  |10:05 |  -   |  -   |  -   |  -   |  -   |
|--------|-------------------|------|------|------|------|------|------|
|  합계  |                   | 2명  | 2명  | 2명  | 1명  | 1명  | 0명  |
```

### 확장 방식
- **가로 확장**: 새 날짜 → 오른쪽으로 2열 추가 (오전/오후)
- **세로 확장**: 새 유저 → 합계 행 위에 새 행 추가

### 값 표시
- **시간 (예: 9:32)**: 해당 시간대에 활동 변동 있음 (마지막 활동 시간)
- **`-`**: 해당 시간대에 활동 변동 없음
- **합계**: 해당 시간대에 활동이 있었던 사람 수

## 설정 방법

### 1단계: Google Sheets 생성

1. [Google Sheets](https://sheets.google.com)에서 새 스프레드시트 생성
2. 이름 설정 (예: "Questy 사용자 활동 리포트")

### 2단계: Apps Script 배포

1. **확장 프로그램 → Apps Script** 클릭
2. `google-apps-script.js` 전체 코드 복사해서 붙여넣기
3. **저장** (Ctrl+S)
4. **배포 → 새 배포** 클릭
5. 설정:
   - 유형: **웹 앱**
   - 실행 사용자: **나 자신**
   - 액세스 권한: **모든 사용자**
6. **배포** → 권한 허용
7. 생성된 URL 복사: `https://script.google.com/macros/s/.../exec`

### 3단계: GitHub Secrets 설정

GitHub 저장소 → **Settings → Secrets and variables → Actions**

| Secret 이름 | 값 |
|------------|-----|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (anon key 아님!) |
| `GOOGLE_SHEETS_API_URL` | Apps Script 웹앱 URL |

### 4단계: 테스트

1. GitHub → **Actions** 탭
2. "User Activity Report to Google Sheets" 선택
3. **Run workflow** 클릭
4. Google Sheets에서 결과 확인

## 실행 스케줄

| 시간 (KST) | cron (UTC) | 설명 |
|-----------|------------|------|
| 매일 오전 10시 | `0 1 * * *` | 오전 리포트 |
| 매일 오후 10시 | `0 13 * * *` | 오후 리포트 |

## 시트 설명

### 사용자활동 (메인 시트)
- 모든 사용자 활동 데이터가 기록됨
- 이름/이메일 열은 고정 (스크롤해도 보임)
- 헤더 행도 고정

### _UserData (숨겨진 시트)
- 이전 `last_active_at` 값 저장
- 활동 변동 감지에 사용
- 삭제하면 모든 활동이 "변동 있음"으로 표시됨

## 문제 해결

### 사용자가 0명으로 나옴
- `SUPABASE_SERVICE_KEY`가 service_role key인지 확인 (anon key 아님)
- RLS 정책 때문에 anon key로는 조회 불가

### Google Sheets에 기록 안 됨
- Apps Script URL이 `/exec`로 끝나는지 확인
- 코드 수정 후 **반드시 새 버전으로 배포** 필요
- GitHub Secrets URL 앞뒤 공백 확인

### 권한 오류
- Apps Script 배포 시 "모든 사용자" 설정 확인
- 권한 허용 팝업에서 모두 허용했는지 확인

### 시트 초기화하고 싶을 때
- Apps Script 에디터에서 `resetSheets` 함수 실행
- 모든 데이터가 삭제되고 처음부터 다시 시작
