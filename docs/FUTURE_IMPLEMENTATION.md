# QuestyBook 향후 구현 계획

> 작성일: 2025-01-14
> 목적: Supabase 마이그레이션 + 자동화 시스템 구축

---

## 목차

1. [Supabase DB 마이그레이션](#1-supabase-db-마이그레이션)
2. [GitHub Actions 커리큘럼 자동 업데이트](#2-github-actions-커리큘럼-자동-업데이트)
3. [푸시 알림 시스템 (Supabase + FCM)](#3-푸시-알림-시스템-supabase--fcm)
4. [미완료 퀘스트 처리 전략](#4-미완료-퀘스트-처리-전략)
5. [주말 제외 커리큘럼 생성](#5-주말-제외-커리큘럼-생성)
6. [일일 학습량 제한 시스템](#6-일일-학습량-제한-시스템)
7. [구현 우선순위 및 일정](#7-구현-우선순위-및-일정)

---

## 1. Supabase DB 마이그레이션

### 1.1 현재 상태
- **계정**: SQLite DB (백엔드) ✅
- **퀘스트**: localStorage (프론트엔드) ⚠️ 기기별 분리

### 1.2 목표
- 모든 데이터를 Supabase PostgreSQL로 통합
- 계정별 퀘스트 동기화 (다른 기기에서도 접근 가능)

### 1.3 Supabase 스키마

```sql
-- 강사 테이블
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL,  -- 'megastudy', 'daesung', 'etoos'
  subjects TEXT[] DEFAULT '{}',
  profile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, platform)
);

-- 강좌 테이블
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  platform TEXT NOT NULL,
  url TEXT,
  lecture_count INTEGER DEFAULT 0,
  total_duration INTERVAL,
  is_completed BOOLEAN DEFAULT FALSE,
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url)
);

-- 챕터(강의) 테이블
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  num TEXT NOT NULL,
  title TEXT NOT NULL,
  duration INTERVAL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  fcm_token TEXT,  -- 푸시 알림용
  timezone TEXT DEFAULT 'Asia/Seoul',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 사용자별 퀘스트 테이블
CREATE TABLE user_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  plan_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_courses_platform ON courses(platform);
CREATE INDEX idx_chapters_course ON chapters(course_id);
CREATE INDEX idx_user_quests_user ON user_quests(user_id);

-- RLS 정책
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can manage own quests" ON user_quests
  FOR ALL USING (auth.uid() = user_id);
```

### 1.4 환경 변수

```bash
# GitHub Secrets
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...  # service_role key

# Vercel 환경 변수
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...  # anon key
```

### 1.5 프론트엔드 연동 코드

```typescript
// packages/frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 강좌 목록 조회
export async function getCoursesByTeacher(teacherName: string) {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      teachers!inner(name, platform),
      chapters(num, title, duration)
    `)
    .eq('teachers.name', teacherName)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// 사용자 퀘스트 저장
export async function saveUserQuest(userId: string, courseId: string, planData: object) {
  const { data, error } = await supabase
    .from('user_quests')
    .upsert({
      user_id: userId,
      course_id: courseId,
      plan_data: planData,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 사용자 퀘스트 조회
export async function getUserQuests(userId: string) {
  const { data, error } = await supabase
    .from('user_quests')
    .select(`
      *,
      courses(name, teacher_id, teachers(name))
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### 1.6 비용 분석 (Free Tier)

| 리소스 | 무료 한도 | 100명 예상 | 상태 |
|--------|----------|-----------|------|
| Database | 500MB | ~10MB | ✅ 2% |
| Auth MAU | 50,000 | 100명 | ✅ 0.2% |
| API 요청 | 무제한 | - | ✅ |
| Bandwidth | 5GB/월 | ~500MB | ✅ 10% |
| Edge Functions | 500K/월 | ~10K | ✅ 2% |

---

## 2. GitHub Actions 커리큘럼 자동 업데이트

### 2.1 개요
- 주 1회 (매주 월요일 03:00 KST) 자동 실행
- 등록된 강좌의 챕터 정보 업데이트
- 새 강의 추가 감지

### 2.2 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                            │
│                    (주 1회 cron: 매주 월요일 03:00)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ 1. 트리거
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Curriculum Agent (Python)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 메가스터디   │  │ 대성마이맥   │  │  이투스     │              │
│  │  크롤러     │  │   크롤러    │  │   크롤러    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         └────────────────┼────────────────┘                     │
│                          ▼                                       │
│              2. 강좌 목록 & 챕터 정보 수집                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │ 3. Upsert
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (PostgreSQL)                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 워크플로우 파일

```yaml
# .github/workflows/curriculum-update.yml
name: Weekly Curriculum Update

on:
  schedule:
    # 매주 월요일 03:00 KST (일요일 18:00 UTC)
    - cron: '0 18 * * 0'
  workflow_dispatch:  # 수동 실행 가능

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

jobs:
  update-curriculum:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r packages/curriculum-agent/requirements.txt
          pip install supabase playwright
          playwright install chromium

      - name: Run curriculum crawler
        run: |
          python packages/curriculum-agent/crawlers/run_all.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Upload crawl logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: crawl-logs-${{ github.run_number }}
          path: packages/curriculum-agent/logs/
          retention-days: 7

      - name: Notify on failure
        if: failure()
        run: |
          echo "Curriculum update failed! Check logs."
          # Slack/Discord webhook 알림 추가 가능
```

### 2.4 크롤러 메인 스크립트

```python
# packages/curriculum-agent/crawlers/run_all.py
import asyncio
import os
from datetime import datetime
from supabase import create_client, Client

from megastudy_crawler import MegastudyCrawler
from daesung_crawler import DaesungCrawler
from etoos_crawler import EtoosCrawler

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"]
)

async def update_all_courses():
    """모든 플랫폼의 강좌 업데이트"""

    # 1. DB에서 등록된 강좌 목록 조회
    response = supabase.table("courses") \
        .select("*, teachers(name, platform)") \
        .eq("is_completed", False) \
        .execute()

    courses = response.data
    print(f"📚 업데이트할 강좌: {len(courses)}개")

    # 2. 플랫폼별 크롤러 매핑
    crawlers = {
        "megastudy": MegastudyCrawler(),
        "daesung": DaesungCrawler(),
        "etoos": EtoosCrawler(),
    }

    # 3. 각 강좌 업데이트
    updated = 0
    failed = 0

    for course in courses:
        platform = course["platform"]
        crawler = crawlers.get(platform)

        if not crawler:
            print(f"⚠️ 지원하지 않는 플랫폼: {platform}")
            continue

        try:
            result = await crawler.fetch_course(course["url"])

            if result:
                await update_chapters(course["id"], result["chapters"])

                supabase.table("courses").update({
                    "lecture_count": len(result["chapters"]),
                    "is_completed": result.get("is_completed", False),
                    "last_crawled_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }).eq("id", course["id"]).execute()

                updated += 1
                print(f"✅ {course['name']}: {len(result['chapters'])}강")

        except Exception as e:
            failed += 1
            print(f"❌ {course['name']}: {str(e)}")

    print(f"\n📊 결과: 성공 {updated}, 실패 {failed}")
    return {"updated": updated, "failed": failed}


async def update_chapters(course_id: str, chapters: list):
    """챕터 정보 Upsert"""
    supabase.table("chapters").delete().eq("course_id", course_id).execute()

    for i, chapter in enumerate(chapters):
        supabase.table("chapters").insert({
            "course_id": course_id,
            "num": chapter["num"],
            "title": chapter["title"],
            "duration": chapter.get("duration"),
            "sort_order": i,
        }).execute()


if __name__ == "__main__":
    asyncio.run(update_all_courses())
```

---

## 3. 푸시 알림 시스템 (Supabase + FCM)

### 3.1 현재 상태
- 프론트엔드 전용 (앱 실행 중에만 동작)
- 10시 리마인더, 자정 요약 메시지 구현됨
- 앱 종료 시 알림 불가 ❌

### 3.2 목표
- 앱 종료 상태에서도 푸시 알림 수신
- Supabase pg_cron + Edge Functions + FCM 조합

### 3.3 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │     pg_cron      │────▶│  Edge Function   │                  │
│  │  (22시, 00시)    │     │ (send-notification)│                 │
│  └──────────────────┘     └────────┬─────────┘                  │
│                                    │                             │
│  ┌──────────────────┐              │                             │
│  │   users 테이블    │◀─────────────┘                             │
│  │  (fcm_token)     │   사용자 조회                               │
│  └──────────────────┘                                            │
└────────────────────────────────────┬────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   Firebase Cloud Messaging     │
                    │          (무료)                │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                              📱 사용자 기기
                           (앱 종료 상태에서도 수신)
```

### 3.4 pg_cron 스케줄 설정

```sql
-- Supabase SQL Editor에서 실행

-- 1. pg_cron 확장 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 매일 22시 (KST) 리마인더
SELECT cron.schedule(
  'evening-reminder',
  '0 13 * * *',  -- UTC 13:00 = KST 22:00
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-notification',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"type": "evening_reminder"}'::jsonb
  );
  $$
);

-- 3. 매일 자정 (KST) 요약
SELECT cron.schedule(
  'midnight-summary',
  '0 15 * * *',  -- UTC 15:00 = KST 00:00
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-notification',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"type": "midnight_summary"}'::jsonb
  );
  $$
);

-- 스케줄 확인
SELECT * FROM cron.job;
```

### 3.5 Edge Function 코드

```typescript
// supabase/functions/send-notification/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')!;

interface NotificationPayload {
  type: 'evening_reminder' | 'midnight_summary';
}

Deno.serve(async (req) => {
  try {
    const { type }: NotificationPayload = await req.json();

    // FCM 토큰이 있는 사용자 조회
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, fcm_token')
      .not('fcm_token', 'is', null);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const user of users || []) {
      // 사용자별 퀘스트 통계 조회
      const stats = await getUserQuestStats(user.id, type);

      // 메시지 생성
      const message = generateMessage(type, user.name, stats);

      // FCM 발송
      const success = await sendFCM(user.fcm_token, message);

      if (success) sent++;
      else failed++;
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function getUserQuestStats(userId: string, type: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('user_quests')
    .select('plan_data')
    .eq('user_id', userId);

  // plan_data에서 오늘 퀘스트 통계 계산
  let total = 0;
  let completed = 0;

  for (const quest of data || []) {
    const planData = quest.plan_data;
    // ... 통계 계산 로직
  }

  return { total, completed };
}

function generateMessage(
  type: string,
  userName: string,
  stats: { total: number; completed: number }
) {
  const remaining = stats.total - stats.completed;

  if (type === 'evening_reminder') {
    return {
      title: '⏰ 오늘의 학습 리마인더',
      body: remaining > 0
        ? `${userName}님, 오늘 ${remaining}개의 퀘스트가 남았어요!`
        : `${userName}님, 오늘 퀘스트를 모두 완료했어요! 🎉`,
    };
  } else {
    return {
      title: '✨ 하루 학습 정리',
      body: `${userName}님, 오늘 ${stats.completed}/${stats.total}개 완료! ${
        stats.completed === stats.total ? '완벽해요! 🌟' : '내일도 화이팅!'
      }`,
    };
  }
}

async function sendFCM(token: string, message: { title: string; body: string }) {
  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: message.title,
          body: message.body,
          icon: '/icon-192.png',
          click_action: 'https://questybook.vercel.app',
        },
        data: {
          url: '/',
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
```

### 3.6 프론트엔드 FCM 토큰 등록

```typescript
// packages/frontend/src/lib/fcm.ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function requestNotificationPermission(userId: string) {
  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      // Supabase에 토큰 저장
      await supabase
        .from('users')
        .update({ fcm_token: token })
        .eq('id', userId);

      console.log('FCM 토큰 등록 완료');
      return token;
    }
  } catch (error) {
    console.error('FCM 토큰 등록 실패:', error);
  }
  return null;
}

// 포그라운드 메시지 처리
onMessage(messaging, (payload) => {
  console.log('포그라운드 메시지 수신:', payload);

  // 토스트 알림 표시
  if (payload.notification) {
    new Notification(payload.notification.title || '알림', {
      body: payload.notification.body,
      icon: '/icon-192.png',
    });
  }
});
```

### 3.7 Service Worker (백그라운드 메시지)

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

// 백그라운드 메시지 처리
messaging.onBackgroundMessage((payload) => {
  console.log('백그라운드 메시지 수신:', payload);

  const notificationTitle = payload.notification?.title || '알림';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

### 3.8 Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 사용)
3. Cloud Messaging 활성화
4. 웹 앱 등록 → 설정 값 복사
5. 프로젝트 설정 → Cloud Messaging → 서버 키 복사

### 3.9 환경 변수 추가

```bash
# Supabase Edge Functions 환경 변수
FCM_SERVER_KEY=AAAA...  # Firebase 서버 키

# Vercel 환경 변수
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BPq...
```

### 3.10 비용

| 서비스 | 비용 |
|--------|------|
| Supabase Edge Functions | 무료 (500K/월) |
| Supabase pg_cron | 무료 |
| Firebase Cloud Messaging | **무료 (무제한)** |

---

## 4. 미완료 퀘스트 처리 전략

### 4.1 개요

자정에 퀘스트 완료 여부를 확인하고, 미완료 퀘스트가 있을 경우 자동/수동으로 처리하는 시스템.

### 4.2 처리 전략 비교

| 전략 | 장점 | 단점 |
|------|------|------|
| 다음날로 미루기 | 단순함 | 계속 밀리면 눈덩이 효과 |
| 전체 일정 뒤로 밀기 | 진도 유지 | 종료일 지연, 사용자 혼란 |
| 주말 몰아서 하기 | 평일 부담 감소 | 주말 폭탄, 번아웃 위험 |
| 재스케줄링 요청 | 유연함 | 매번 귀찮음, 이탈 위험 |
| **스마트 자동 흡수 (권장)** | UX 최적 | 구현 복잡 |

### 4.3 스마트 자동 흡수 시스템 (권장)

```
미완료 퀘스트 발생
        │
        ▼
┌───────────────────┐
│  양이 적음? (≤2개) │
└────────┬──────────┘
         │
    ┌────┴────┐
   YES        NO
    │          │
    ▼          ▼
┌─────────┐  ┌─────────────────┐
│ 자동 분산 │  │ 사용자 선택 요청 │
│ (다음 3일)│  │                 │
└─────────┘  └─────────────────┘
```

### 4.4 Case별 처리 로직

#### Case 1: 미완료 1~2개 (자동 처리)

```typescript
// 다음 3일에 자동 분산 (여유 있는 날 우선)
const redistributeMissedQuests = (missedQuests: Quest[]) => {
  const next3Days = getNext3Days();

  // 각 날의 여유 시간 계산
  const daysWithCapacity = next3Days.map(day => ({
    date: day,
    freeTime: day.availableTime - day.scheduledTime,
  })).sort((a, b) => b.freeTime - a.freeTime);

  // 여유 있는 날에 배치
  missedQuests.forEach(quest => {
    const targetDay = daysWithCapacity.find(d => d.freeTime >= quest.duration);
    if (targetDay) {
      assignQuest(quest, targetDay.date);
      targetDay.freeTime -= quest.duration;
    }
  });
};
```

**코치 메시지**:
```
😊 어제 못 끝낸 "미적분 3강"은 내일로 옮겨뒀어요.
무리하지 말고 오늘 할 것만 집중해요!
```

#### Case 2: 미완료 3개 이상 (사용자 선택)

```typescript
interface RescheduleOption {
  id: string;
  label: string;
  description: string;
  action: () => void;
}

const options: RescheduleOption[] = [
  {
    id: 'extend',
    label: '📅 일정 연장',
    description: '전체 플랜을 3일 뒤로 미룹니다',
    action: () => extendPlanByDays(3),
  },
  {
    id: 'weekend',
    label: '🗓️ 주말에 몰아서',
    description: '이번 주말에 밀린 퀘스트를 처리합니다',
    action: () => moveToWeekend(missedQuests),
  },
  {
    id: 'reduce',
    label: '✂️ 분량 조정',
    description: '하루 학습량을 줄이고 재배치합니다',
    action: () => reduceDailyLoad(),
  },
  {
    id: 'skip',
    label: '⏭️ 건너뛰기',
    description: '해당 퀘스트를 삭제합니다',
    action: () => skipQuests(missedQuests),
  },
];
```

**코치 메시지**:
```
🤔 밀린 퀘스트가 좀 많네요 (5개).
어떻게 할까요?

[📅 일정 연장] [🗓️ 주말에] [✂️ 분량 조정] [⏭️ 건너뛰기]
```

#### Case 3: 연속 3일 미완료 (위기 개입)

```typescript
if (consecutiveMissedDays >= 3) {
  // 위기 개입 모드
  triggerCrisisIntervention({
    message: `
      💙 ${studentName}님, 요즘 힘드신가요?

      3일 연속 학습이 어려웠던 것 같아요.
      괜찮아요, 누구나 그런 날이 있어요.

      잠시 쉬어가도 좋고, 플랜을 조정해도 괜찮아요.
      어떻게 하면 좋을까요?
    `,
    options: [
      { label: '😴 1주일 휴식', action: () => pausePlan(7) },
      { label: '📉 분량 50% 감소', action: () => reduceDailyLoad(0.5) },
      { label: '🔄 플랜 재생성', action: () => regeneratePlan() },
      { label: '💪 다시 시작할게요', action: () => resetStreak() },
    ],
  });
}
```

### 4.5 전체 플로우차트

```
                    ┌─────────────────┐
                    │   자정 체크      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ 미완료 퀘스트    │
                    │    있음?        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         0개 (완료)      1~2개         3개 이상
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐   ┌───────────┐   ┌───────────┐
        │ 축하     │   │ 자동 분산  │   │ 선택 요청  │
        │ 메시지   │   │ (다음3일)  │   │           │
        └─────────┘   └───────────┘   └─────┬─────┘
                                            │
                                   ┌────────┼────────┐
                                   │        │        │
                              연장    주말몰아서   건너뛰기
                                   │        │        │
                                   ▼        ▼        ▼
                              ┌─────────────────────────┐
                              │    플랜 업데이트         │
                              └─────────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────┐
                    │                       │               │
               연속 1~2일              연속 3일+         정상
                    │                       │               │
                    ▼                       ▼               ▼
              ┌──────────┐          ┌────────────┐    ┌─────────┐
              │ 격려     │          │ 위기 개입   │    │ 일반    │
              │ 메시지   │          │ (휴식 제안) │    │ 메시지  │
              └──────────┘          └────────────┘    └─────────┘
```

### 4.6 데이터 모델 추가

```typescript
interface QuestPlan {
  // 기존 필드...

  // 미완료 처리 관련 추가
  missedQuests: MissedQuest[];
  rescheduleHistory: RescheduleEvent[];
  consecutiveMissedDays: number;
  lastCompletedDate: string | null;
}

interface MissedQuest {
  questId: string;
  originalDate: string;
  rescheduledTo: string | null;
  status: 'pending' | 'rescheduled' | 'skipped';
  missedAt: string;
}

interface RescheduleEvent {
  date: string;
  type: 'auto_distribute' | 'extend' | 'weekend' | 'reduce' | 'skip';
  questIds: string[];
  reason: string;
}
```

### 4.7 DB 스키마 추가 (Supabase)

```sql
-- 미완료 퀘스트 히스토리 테이블
CREATE TABLE missed_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  original_date DATE NOT NULL,
  rescheduled_to DATE,
  status TEXT DEFAULT 'pending',  -- 'pending', 'rescheduled', 'skipped'
  missed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 재스케줄 이벤트 테이블
CREATE TABLE reschedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,  -- 'auto_distribute', 'extend', 'weekend', 'reduce', 'skip'
  quest_ids TEXT[] NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_missed_quests_user ON missed_quests(user_id);
CREATE INDEX idx_missed_quests_status ON missed_quests(status);
CREATE INDEX idx_reschedule_events_user ON reschedule_events(user_id);
```

### 4.8 요약

| 상황 | 처리 방식 | UX |
|------|----------|-----|
| 미완료 1~2개 | **자동 분산** (다음 3일, 주말 포함) | 알림만 |
| 미완료 3개+ | **사용자 선택** | 버튼 선택 |
| 연속 3일 미완료 | **위기 개입** | 공감 + 휴식 제안 |

---

## 5. 주말 제외 커리큘럼 생성

### 5.1 개요

커리큘럼(퀘스트) 생성 시 **주말(토/일)은 학습 일정에서 제외**하고, 주말은 **복습 및 밀린 퀘스트 처리일**로 활용.

### 5.2 주간 일정 구조

```
월 ─ 화 ─ 수 ─ 목 ─ 금 ─ [토] ─ [일]
 │    │    │    │    │     │      │
 └────┴────┴────┴────┘     └──────┘
      평일 학습              주말 버퍼
   (새 퀘스트 배정)      (복습 + 밀린 것)
```

### 5.3 구현 로직

#### 5.3.1 퀘스트 생성 시 주말 제외

```typescript
// 평일만 필터링
const isWeekday = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6;  // 0=일요일, 6=토요일
};

// 퀘스트 배정 가능한 날짜 생성
const getAvailableDates = (startDate: Date, totalDays: number): Date[] => {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  while (dates.length < totalDays) {
    if (isWeekday(currentDate)) {
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

// 사용 예시
const questDates = getAvailableDates(new Date(), 20);  // 20일치 평일
// 결과: [월, 화, 수, 목, 금, 월, 화, 수, 목, 금, ...]
```

#### 5.3.2 주말 자동 예약 (복습일)

```typescript
interface WeekendSchedule {
  saturday: {
    type: 'review' | 'catchup' | 'free';
    quests: Quest[];
  };
  sunday: {
    type: 'review' | 'catchup' | 'free';
    quests: Quest[];
  };
}

const generateWeekendSchedule = (
  weekQuests: Quest[],
  missedQuests: Quest[]
): WeekendSchedule => {
  // 토요일: 밀린 퀘스트 처리
  const saturday = {
    type: missedQuests.length > 0 ? 'catchup' : 'free',
    quests: missedQuests.slice(0, 3),  // 최대 3개
  };

  // 일요일: 주간 복습
  const reviewQuests = weekQuests
    .filter(q => q.needsReview)
    .slice(0, 2);  // 최대 2개

  const sunday = {
    type: reviewQuests.length > 0 ? 'review' : 'free',
    quests: reviewQuests,
  };

  return { saturday, sunday };
};
```

#### 5.3.3 Python 커리큘럼 에이전트 수정

```python
# packages/curriculum-agent/handlers/quest_manager.py

from datetime import datetime, timedelta

def is_weekday(date: datetime) -> bool:
    """주말 여부 확인 (0=월요일, 6=일요일)"""
    return date.weekday() < 5  # 월~금만 True

def get_available_dates(start_date: datetime, total_days: int) -> list[datetime]:
    """평일만 포함된 날짜 리스트 생성"""
    dates = []
    current = start_date

    while len(dates) < total_days:
        if is_weekday(current):
            dates.append(current)
        current += timedelta(days=1)

    return dates

def distribute_quests_to_weekdays(
    quests: list[dict],
    start_date: datetime,
    daily_limit_minutes: int = 180  # 하루 3시간 제한
) -> dict[str, list[dict]]:
    """퀘스트를 평일에만 배분"""

    # 필요한 평일 수 계산
    total_minutes = sum(q['duration_minutes'] for q in quests)
    estimated_days = (total_minutes // daily_limit_minutes) + 1

    # 평일 날짜 리스트 생성
    available_dates = get_available_dates(start_date, estimated_days * 2)

    # 날짜별 퀘스트 배분
    schedule = {}
    date_index = 0
    daily_minutes = 0

    for quest in quests:
        current_date = available_dates[date_index]
        date_key = current_date.strftime('%Y-%m-%d')

        # 해당 날짜 초기화
        if date_key not in schedule:
            schedule[date_key] = []

        # 하루 제한 초과 시 다음 날로
        if daily_minutes + quest['duration_minutes'] > daily_limit_minutes:
            date_index += 1
            if date_index >= len(available_dates):
                # 추가 날짜 필요
                available_dates.extend(
                    get_available_dates(available_dates[-1] + timedelta(days=1), 5)
                )
            current_date = available_dates[date_index]
            date_key = current_date.strftime('%Y-%m-%d')
            schedule[date_key] = []
            daily_minutes = 0

        # 퀘스트 배정
        schedule[date_key].append(quest)
        daily_minutes += quest['duration_minutes']

    return schedule
```

### 5.4 UI 표시

```typescript
// 캘린더 뷰에서 주말 표시
const CalendarDay = ({ date, quests, isWeekend }: CalendarDayProps) => {
  if (isWeekend) {
    return (
      <div className="calendar-day weekend">
        <div className="day-header">
          <span className="date">{date.getDate()}</span>
          <span className="label">
            {date.getDay() === 6 ? '📚 복습/보충' : '🌟 자유 학습'}
          </span>
        </div>
        {quests.length > 0 ? (
          <div className="weekend-quests">
            {quests.map(q => (
              <div key={q.id} className="quest-chip missed">
                {q.name}
              </div>
            ))}
          </div>
        ) : (
          <div className="free-day">
            쉬어가는 날 😊
          </div>
        )}
      </div>
    );
  }

  // 평일 렌더링...
};
```

### 5.5 주말 활용 시나리오

| 상황 | 토요일 | 일요일 |
|------|--------|--------|
| 평일 모두 완료 | 자유 학습 or 선행 | 완전 휴식 |
| 1~2개 미완료 | 밀린 퀘스트 처리 | 휴식 |
| 3개+ 미완료 | 밀린 퀘스트 처리 | 밀린 퀘스트 처리 |
| 시험 기간 | 집중 복습 | 집중 복습 |

### 5.6 사용자 설정 옵션

```typescript
interface StudyPreferences {
  // 주말 학습 설정
  weekendStudy: {
    enabled: boolean;  // 주말에도 학습할지
    saturdayHours: number;  // 토요일 학습 시간 (0 = 안 함)
    sundayHours: number;    // 일요일 학습 시간 (0 = 안 함)
  };

  // 평일 학습 설정
  weekdayStudy: {
    dailyHours: number;  // 하루 학습 시간 (기본 3시간)
    preferredTime: 'morning' | 'afternoon' | 'evening';
  };
}

// 기본값
const defaultPreferences: StudyPreferences = {
  weekendStudy: {
    enabled: false,  // 기본: 주말 학습 안 함
    saturdayHours: 0,
    sundayHours: 0,
  },
  weekdayStudy: {
    dailyHours: 3,
    preferredTime: 'evening',
  },
};
```

### 5.7 요약

| 항목 | 평일 (월~금) | 주말 (토~일) |
|------|-------------|-------------|
| **새 퀘스트** | ✅ 배정됨 | ❌ 배정 안 됨 |
| **밀린 퀘스트** | 자동 분산 | 📌 우선 처리 |
| **복습** | 선택적 | 📌 권장 |
| **휴식** | - | ✅ 기본값 |

---

## 6. 일일 학습량 제한 시스템

### 6.1 개요

하루 최대 학습 시간을 **14시간**으로 제한하여 과도한 학습 계획을 방지하고, 커리큘럼 생성 시 기존 플랜과의 충돌을 검증.

### 6.2 시간 계산 규칙

| 퀘스트 유형 | 표시 시간 | 실제 계산 시간 |
|------------|----------|---------------|
| 강의 시청 | 강의 길이 | 강의 길이 |
| 자습/복습 | 표시 안 함 | **1시간** (고정) |
| 문제 풀이 | 예상 시간 | 예상 시간 |
| 실습 | 예상 시간 | 예상 시간 |

### 6.3 검증 플로우

```
커리큘럼 생성 요청
        │
        ▼
┌───────────────────────────┐
│ 기존 플랜의 일별 시간 조회  │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│ 새 커리큘럼 예상 시간 계산  │
│ (강의 + 자습 1시간 포함)   │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│  일별 총합 = 기존 + 신규   │
└───────────┬───────────────┘
            │
     ┌──────┴──────┐
     │             │
 ≤14시간        >14시간
     │             │
     ▼             ▼
┌─────────┐  ┌─────────────────┐
│ 생성    │  │ 경고 & 차단     │
│ 진행    │  │ 또는 자동 조정   │
└─────────┘  └─────────────────┘
```

### 6.4 구현 로직

#### 6.4.1 일일 학습 시간 계산

```typescript
interface Quest {
  id: string;
  type: 'lecture' | 'self_study' | 'practice' | 'review';
  durationMinutes: number;  // 강의는 실제 길이, 자습은 0으로 저장
}

// 실제 학습 시간 계산 (자습 = 60분으로 계산)
const calculateActualDuration = (quest: Quest): number => {
  if (quest.type === 'self_study' || quest.type === 'review') {
    return 60;  // 자습/복습은 1시간으로 고정 계산
  }
  return quest.durationMinutes;
};

// 특정 날짜의 총 학습 시간 계산
const getDailyTotalMinutes = (date: string, quests: Quest[]): number => {
  const dayQuests = quests.filter(q => q.date === date);
  return dayQuests.reduce((sum, q) => sum + calculateActualDuration(q), 0);
};

// 시간을 읽기 쉽게 변환
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};
```

#### 6.4.2 커리큘럼 생성 전 검증

```typescript
const MAX_DAILY_MINUTES = 14 * 60;  // 14시간 = 840분

interface ValidationResult {
  canCreate: boolean;
  warnings: string[];
  overloadedDays: {
    date: string;
    existingMinutes: number;
    newMinutes: number;
    totalMinutes: number;
  }[];
  suggestion?: string;
}

const validateNewCurriculum = async (
  userId: string,
  newQuests: Quest[],
  startDate: Date
): Promise<ValidationResult> => {
  // 1. 기존 플랜의 일별 시간 조회
  const existingQuests = await getUserQuests(userId);

  // 2. 새 커리큘럼이 배정될 날짜들 확인
  const newQuestsByDate = groupByDate(newQuests);

  // 3. 각 날짜별 총 시간 검증
  const overloadedDays: ValidationResult['overloadedDays'] = [];
  const warnings: string[] = [];

  for (const [date, dayQuests] of Object.entries(newQuestsByDate)) {
    const existingMinutes = getDailyTotalMinutes(date, existingQuests);
    const newMinutes = dayQuests.reduce(
      (sum, q) => sum + calculateActualDuration(q), 0
    );
    const totalMinutes = existingMinutes + newMinutes;

    if (totalMinutes > MAX_DAILY_MINUTES) {
      overloadedDays.push({
        date,
        existingMinutes,
        newMinutes,
        totalMinutes,
      });
    }
  }

  // 4. 결과 생성
  if (overloadedDays.length > 0) {
    const worstDay = overloadedDays.reduce(
      (max, d) => d.totalMinutes > max.totalMinutes ? d : max
    );

    warnings.push(
      `⚠️ ${overloadedDays.length}일이 14시간을 초과합니다.`
    );
    warnings.push(
      `가장 많은 날: ${worstDay.date} (${formatDuration(worstDay.totalMinutes)})`
    );

    return {
      canCreate: false,
      warnings,
      overloadedDays,
      suggestion: '기존 플랜을 조정하거나 시작일을 변경해주세요.',
    };
  }

  return {
    canCreate: true,
    warnings: [],
    overloadedDays: [],
  };
};
```

#### 6.4.3 자동 조정 옵션

```typescript
interface AdjustmentOption {
  id: string;
  label: string;
  description: string;
  action: () => Promise<Quest[]>;
}

const getAdjustmentOptions = (
  overloadedDays: ValidationResult['overloadedDays'],
  newQuests: Quest[]
): AdjustmentOption[] => {
  return [
    {
      id: 'extend',
      label: '📅 기간 늘리기',
      description: '일일 학습량을 줄이고 기간을 늘립니다',
      action: async () => redistributeQuests(newQuests, { maxDaily: 10 * 60 }),
    },
    {
      id: 'reduce_self_study',
      label: '📝 자습 시간 줄이기',
      description: '자습 시간을 30분으로 줄입니다',
      action: async () => adjustSelfStudyTime(newQuests, 30),
    },
    {
      id: 'skip_days',
      label: '⏭️ 과부하 날 건너뛰기',
      description: '이미 바쁜 날은 건너뛰고 배정합니다',
      action: async () => skipOverloadedDays(newQuests, overloadedDays),
    },
    {
      id: 'force',
      label: '⚠️ 무시하고 생성',
      description: '경고를 무시하고 그대로 생성합니다 (권장하지 않음)',
      action: async () => newQuests,
    },
  ];
};
```

### 6.5 UI 경고 메시지

```typescript
// 경고 모달 컴포넌트
const OverloadWarningModal = ({
  validation,
  onAdjust,
  onCancel,
}: {
  validation: ValidationResult;
  onAdjust: (option: AdjustmentOption) => void;
  onCancel: () => void;
}) => {
  return (
    <Modal>
      <div className="warning-header">
        <span className="icon">⚠️</span>
        <h2>학습량 초과 경고</h2>
      </div>

      <div className="warning-content">
        <p>
          생성하려는 커리큘럼이 기존 플랜과 합쳐지면
          <strong> 하루 14시간</strong>을 초과하는 날이 있습니다.
        </p>

        <div className="overloaded-days">
          <h3>초과 일자:</h3>
          {validation.overloadedDays.map(day => (
            <div key={day.date} className="day-item">
              <span className="date">{day.date}</span>
              <span className="time">
                기존 {formatDuration(day.existingMinutes)} +
                신규 {formatDuration(day.newMinutes)} =
                <strong className="danger">
                  {formatDuration(day.totalMinutes)}
                </strong>
              </span>
            </div>
          ))}
        </div>

        <p className="suggestion">
          💡 {validation.suggestion}
        </p>
      </div>

      <div className="actions">
        {getAdjustmentOptions(validation.overloadedDays, []).map(opt => (
          <button
            key={opt.id}
            onClick={() => onAdjust(opt)}
            className={opt.id === 'force' ? 'btn-danger' : 'btn-primary'}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={onCancel} className="btn-secondary">
          취소
        </button>
      </div>
    </Modal>
  );
};
```

### 6.6 플랜 현황 표시

```typescript
// 플랜 현황 페이지에서 일별 시간 표시
const DailyPlanSummary = ({ date, quests }: { date: string; quests: Quest[] }) => {
  const totalMinutes = quests.reduce(
    (sum, q) => sum + calculateActualDuration(q), 0
  );

  const getStatusColor = (minutes: number) => {
    if (minutes > 14 * 60) return 'danger';   // 14시간 초과: 빨강
    if (minutes > 10 * 60) return 'warning';  // 10시간 초과: 노랑
    return 'normal';                           // 정상: 초록
  };

  return (
    <div className={`daily-summary ${getStatusColor(totalMinutes)}`}>
      <div className="date">{date}</div>
      <div className="time-bar">
        <div
          className="filled"
          style={{ width: `${Math.min(totalMinutes / (14 * 60) * 100, 100)}%` }}
        />
      </div>
      <div className="time-text">
        {formatDuration(totalMinutes)}
        {totalMinutes > 14 * 60 && (
          <span className="warning-badge">⚠️ 초과</span>
        )}
      </div>
      <div className="quest-breakdown">
        {quests.map(q => (
          <div key={q.id} className="quest-item">
            <span className="type">{getQuestTypeIcon(q.type)}</span>
            <span className="name">{q.name}</span>
            <span className="duration">
              {q.type === 'self_study' ? '(자습 1시간)' : formatDuration(q.durationMinutes)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const getQuestTypeIcon = (type: Quest['type']) => {
  switch (type) {
    case 'lecture': return '📺';
    case 'self_study': return '📝';
    case 'practice': return '✏️';
    case 'review': return '🔄';
    default: return '📋';
  }
};
```

### 6.7 Python 에이전트 검증

```python
# packages/curriculum-agent/handlers/quest_manager.py

MAX_DAILY_MINUTES = 14 * 60  # 14시간
SELF_STUDY_DURATION = 60     # 자습 1시간

def calculate_actual_duration(quest: dict) -> int:
    """실제 학습 시간 계산 (자습은 60분 고정)"""
    if quest.get('type') in ['self_study', 'review']:
        return SELF_STUDY_DURATION
    return quest.get('duration_minutes', 0)

def validate_daily_load(
    existing_quests: list[dict],
    new_quests: list[dict]
) -> dict:
    """일별 학습량 검증"""

    # 날짜별로 그룹화
    daily_totals = {}

    # 기존 퀘스트 집계
    for quest in existing_quests:
        date = quest['date']
        if date not in daily_totals:
            daily_totals[date] = {'existing': 0, 'new': 0}
        daily_totals[date]['existing'] += calculate_actual_duration(quest)

    # 새 퀘스트 집계
    for quest in new_quests:
        date = quest['date']
        if date not in daily_totals:
            daily_totals[date] = {'existing': 0, 'new': 0}
        daily_totals[date]['new'] += calculate_actual_duration(quest)

    # 초과 일자 확인
    overloaded = []
    for date, times in daily_totals.items():
        total = times['existing'] + times['new']
        if total > MAX_DAILY_MINUTES:
            overloaded.append({
                'date': date,
                'existing_minutes': times['existing'],
                'new_minutes': times['new'],
                'total_minutes': total,
                'excess_minutes': total - MAX_DAILY_MINUTES,
            })

    return {
        'valid': len(overloaded) == 0,
        'overloaded_days': overloaded,
        'message': f"{len(overloaded)}일이 14시간을 초과합니다" if overloaded else "OK",
    }

def auto_adjust_curriculum(
    quests: list[dict],
    max_daily: int = 10 * 60  # 기본 10시간 제한으로 조정
) -> list[dict]:
    """자동으로 일일 학습량 조정"""

    adjusted = []
    daily_totals = {}
    current_date = quests[0]['date'] if quests else None

    for quest in quests:
        duration = calculate_actual_duration(quest)

        # 해당 날짜의 현재 총 시간
        if quest['date'] not in daily_totals:
            daily_totals[quest['date']] = 0

        # 제한 초과 시 다음 날로 이동
        while daily_totals.get(current_date, 0) + duration > max_daily:
            current_date = get_next_weekday(current_date)
            if current_date not in daily_totals:
                daily_totals[current_date] = 0

        # 퀘스트 배정
        quest['date'] = current_date
        daily_totals[current_date] += duration
        adjusted.append(quest)

    return adjusted
```

### 6.8 요약

| 상황 | 동작 |
|------|------|
| 일일 ≤ 10시간 | ✅ 정상 생성 |
| 일일 10~14시간 | ⚠️ 경고 표시, 생성 가능 |
| 일일 > 14시간 | 🚫 차단 + 조정 옵션 제공 |

**핵심 규칙:**
- 자습/복습은 **1시간**으로 계산
- 하루 최대 **14시간** 제한
- 초과 시 자동 조정 옵션 제공

---

## 7. 구현 우선순위 및 일정

### Phase 1: Supabase 마이그레이션 (1주)
| 작업 | 예상 시간 |
|------|----------|
| Supabase 프로젝트 생성 & 스키마 적용 | 30분 |
| 기존 SQLite 데이터 마이그레이션 | 1시간 |
| 프론트엔드 Supabase 클라이언트 연동 | 2시간 |
| 퀘스트 저장 로직 변경 (localStorage → Supabase) | 3시간 |
| 테스트 & 디버깅 | 2시간 |

### Phase 2: GitHub Actions 자동화 (2-3일)
| 작업 | 예상 시간 |
|------|----------|
| 워크플로우 파일 작성 | 30분 |
| 크롤러 Supabase 연동 수정 | 2시간 |
| 테스트 실행 & 로그 확인 | 1시간 |

### Phase 3: 푸시 알림 (3-4일)
| 작업 | 예상 시간 |
|------|----------|
| Firebase 프로젝트 설정 | 30분 |
| Edge Function 작성 & 배포 | 2시간 |
| pg_cron 스케줄 설정 | 30분 |
| 프론트엔드 FCM 연동 | 2시간 |
| Service Worker 설정 | 1시간 |
| 테스트 & 디버깅 | 2시간 |

### Phase 4: 미완료 퀘스트 처리 (2-3일)
| 작업 | 예상 시간 |
|------|----------|
| 자정 체크 로직 구현 (Edge Function) | 1시간 |
| 미완료 퀘스트 자동 분산 로직 | 2시간 |
| 사용자 선택 UI (모달/버튼) | 2시간 |
| 위기 개입 메시지 시스템 | 1시간 |
| DB 스키마 추가 (missed_quests, reschedule_events) | 30분 |
| 테스트 & 디버깅 | 1시간 |

### Phase 5: 주말 제외 커리큘럼 (1-2일)
| 작업 | 예상 시간 |
|------|----------|
| Python 커리큘럼 에이전트 수정 (주말 제외 로직) | 2시간 |
| 프론트엔드 퀘스트 생성 로직 수정 | 1시간 |
| 캘린더 UI 주말 표시 변경 | 1시간 |
| 사용자 설정 옵션 추가 (주말 학습 여부) | 1시간 |
| 테스트 & 디버깅 | 1시간 |

### Phase 6: 일일 학습량 제한 (1-2일)
| 작업 | 예상 시간 |
|------|----------|
| 일일 학습 시간 계산 로직 (자습 1시간 포함) | 1시간 |
| 커리큘럼 생성 전 검증 로직 | 2시간 |
| 경고 모달 UI 구현 | 1시간 |
| 자동 조정 옵션 구현 (기간 늘리기, 건너뛰기 등) | 2시간 |
| 플랜 현황 페이지 시간 표시 추가 | 1시간 |
| 테스트 & 디버깅 | 1시간 |

### 전체 일정 요약

| Phase | 기능 | 예상 기간 | 우선순위 |
|-------|------|----------|----------|
| 1 | Supabase 마이그레이션 | 1주 | 🔴 높음 |
| 2 | GitHub Actions 자동화 | 2-3일 | 🟡 중간 |
| 3 | 푸시 알림 | 3-4일 | 🟡 중간 |
| 4 | 미완료 퀘스트 처리 | 2-3일 | 🟡 중간 |
| 5 | 주말 제외 커리큘럼 | 1-2일 | 🟢 낮음 |
| 6 | 일일 학습량 제한 | 1-2일 | 🟡 중간 |

**총 예상 기간: 2-3주**

---

## 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase Push Notifications Guide](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [GitHub Actions Cron Syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
