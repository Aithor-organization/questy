/**
 * Cron Routes
 * 예약된 작업 실행 엔드포인트
 * - 매일 자정: 일일 요약 메시지 발송
 * - 매일 22시: 미완료 퀘스트 리마인더
 */

import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';

export const cronRoutes = new Hono();

// Cron Secret 검증 (보안)
const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(c: any): boolean {
  const authHeader = c.req.header('Authorization');
  const cronSecret = c.req.header('X-Cron-Secret');

  // Vercel Cron은 Authorization: Bearer <secret> 사용
  if (authHeader?.startsWith('Bearer ') && CRON_SECRET) {
    return authHeader.slice(7) === CRON_SECRET;
  }

  // 직접 호출 시 X-Cron-Secret 헤더 사용
  if (cronSecret && CRON_SECRET) {
    return cronSecret === CRON_SECRET;
  }

  // CRON_SECRET 미설정 시 개발 환경으로 간주
  if (!CRON_SECRET) {
    console.warn('[Cron] CRON_SECRET not set - allowing request in dev mode');
    return true;
  }

  return false;
}

/**
 * 자정 일일 요약 메시지 발송
 * POST /api/cron/daily-summary
 *
 * Vercel Cron: 매일 00:00 KST (15:00 UTC 전날)
 */
cronRoutes.post('/daily-summary', async (c) => {
  // 보안 검증
  if (!verifyCronSecret(c)) {
    console.log('[Cron] Unauthorized daily-summary request');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!supabase) {
    return c.json({ success: false, error: 'Supabase not available' }, 500);
  }

  console.log('[Cron] Starting daily-summary job...');

  try {
    // 어제 날짜 (KST 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000; // KST = UTC+9
    const kstNow = new Date(now.getTime() + kstOffset);
    const yesterday = new Date(kstNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`[Cron] Processing daily summary for: ${yesterdayStr}`);

    // 1. 모든 학생과 기본 채팅방 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        user_id,
        name,
        chat_rooms!inner (
          id,
          is_default
        )
      `)
      .eq('chat_rooms.is_default', true);

    if (studentsError) {
      console.error('[Cron] Failed to fetch students:', studentsError);
      return c.json({ success: false, error: 'Failed to fetch students' }, 500);
    }

    if (!students || students.length === 0) {
      console.log('[Cron] No students found');
      return c.json({ success: true, message: 'No students to process', processed: 0 });
    }

    console.log(`[Cron] Found ${students.length} students with default chat rooms`);

    // 2. 각 학생별 처리
    let processedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        const defaultRoom = Array.isArray(student.chat_rooms)
          ? student.chat_rooms.find((r: any) => r.is_default)
          : student.chat_rooms;

        if (!defaultRoom) {
          skippedCount++;
          continue;
        }

        // 이미 오늘 요약 메시지가 발송되었는지 확인
        const todayStart = new Date(kstNow);
        todayStart.setHours(0, 0, 0, 0);
        const todayStartUTC = new Date(todayStart.getTime() - kstOffset);

        const { data: existingMsg } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('room_id', defaultRoom.id)
          .eq('role', 'assistant')
          .gte('created_at', todayStartUTC.toISOString())
          .ilike('content', '%오늘 하루 정리%')
          .limit(1);

        if (existingMsg && existingMsg.length > 0) {
          console.log(`[Cron] Skipping student ${student.id} - already sent today`);
          skippedCount++;
          continue;
        }

        // 3. 어제 퀘스트 완료율 조회 (quests 테이블에서)
        const { data: quests, error: questsError } = await supabase
          .from('quests')
          .select('id, completed')
          .eq('student_id', student.id)
          .eq('date', yesterdayStr);

        if (questsError) {
          console.warn(`[Cron] Failed to fetch quests for student ${student.id}:`, questsError);
          errors.push(`student ${student.id}: quest fetch failed`);
          continue;
        }

        // 퀘스트가 없으면 스킵
        if (!quests || quests.length === 0) {
          skippedCount++;
          continue;
        }

        const totalQuests = quests.length;
        const completedQuests = quests.filter(q => q.completed).length;

        // 4. 메시지 생성
        const message = generateDailySummaryMessage(
          completedQuests === totalQuests,
          completedQuests,
          totalQuests
        );

        // 5. 메시지 저장
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            room_id: defaultRoom.id,
            role: 'assistant',
            content: message,
            agent_role: 'coach',
            is_read: false,
          });

        if (insertError) {
          console.error(`[Cron] Failed to insert message for student ${student.id}:`, insertError);
          errors.push(`student ${student.id}: insert failed`);
          continue;
        }

        processedCount++;
        console.log(`[Cron] Sent daily summary to student ${student.id} (${completedQuests}/${totalQuests})`);

      } catch (err: any) {
        console.error(`[Cron] Error processing student ${student.id}:`, err);
        errors.push(`student ${student.id}: ${err.message}`);
      }
    }

    console.log(`[Cron] Daily summary completed: ${processedCount} sent, ${skippedCount} skipped, ${errors.length} errors`);

    return c.json({
      success: true,
      date: yesterdayStr,
      processed: processedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[Cron] Daily summary job failed:', error);
    return c.json({ success: false, error: error.message || 'Internal error' }, 500);
  }
});

/**
 * 22시 리마인더 발송
 * POST /api/cron/evening-reminder
 *
 * Vercel Cron: 매일 22:00 KST (13:00 UTC)
 */
cronRoutes.post('/evening-reminder', async (c) => {
  // 보안 검증
  if (!verifyCronSecret(c)) {
    console.log('[Cron] Unauthorized evening-reminder request');
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!supabase) {
    return c.json({ success: false, error: 'Supabase not available' }, 500);
  }

  console.log('[Cron] Starting evening-reminder job...');

  try {
    // 오늘 날짜 (KST 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStr = kstNow.toISOString().split('T')[0];

    console.log(`[Cron] Processing evening reminder for: ${todayStr}`);

    // 1. 모든 학생과 기본 채팅방 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        user_id,
        name,
        chat_rooms!inner (
          id,
          is_default
        )
      `)
      .eq('chat_rooms.is_default', true);

    if (studentsError) {
      console.error('[Cron] Failed to fetch students:', studentsError);
      return c.json({ success: false, error: 'Failed to fetch students' }, 500);
    }

    if (!students || students.length === 0) {
      console.log('[Cron] No students found');
      return c.json({ success: true, message: 'No students to process', processed: 0 });
    }

    console.log(`[Cron] Found ${students.length} students`);

    let processedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        const defaultRoom = Array.isArray(student.chat_rooms)
          ? student.chat_rooms.find((r: any) => r.is_default)
          : student.chat_rooms;

        if (!defaultRoom) {
          skippedCount++;
          continue;
        }

        // 오늘 미완료 퀘스트 조회
        const { data: quests, error: questsError } = await supabase
          .from('quests')
          .select('id, completed')
          .eq('student_id', student.id)
          .eq('date', todayStr);

        if (questsError) {
          errors.push(`student ${student.id}: quest fetch failed`);
          continue;
        }

        // 퀘스트가 없거나 모두 완료면 스킵
        if (!quests || quests.length === 0) {
          skippedCount++;
          continue;
        }

        const totalQuests = quests.length;
        const completedQuests = quests.filter(q => q.completed).length;
        const remainingQuests = totalQuests - completedQuests;

        if (remainingQuests === 0) {
          skippedCount++;
          continue;
        }

        // 오늘 이미 리마인더가 발송되었는지 확인
        const todayStart = new Date(kstNow);
        todayStart.setHours(0, 0, 0, 0);
        const todayStartUTC = new Date(todayStart.getTime() - kstOffset);

        const { data: existingMsg } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('room_id', defaultRoom.id)
          .eq('role', 'assistant')
          .gte('created_at', todayStartUTC.toISOString())
          .ilike('content', '%밤 10시 알림%')
          .limit(1);

        if (existingMsg && existingMsg.length > 0) {
          skippedCount++;
          continue;
        }

        // 메시지 생성
        const message = generateReminderMessage(remainingQuests, totalQuests);

        // 메시지 저장
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            room_id: defaultRoom.id,
            role: 'assistant',
            content: message,
            agent_role: 'coach',
            is_read: false,
          });

        if (insertError) {
          errors.push(`student ${student.id}: insert failed`);
          continue;
        }

        processedCount++;
        console.log(`[Cron] Sent reminder to student ${student.id} (${remainingQuests} remaining)`);

      } catch (err: any) {
        errors.push(`student ${student.id}: ${err.message}`);
      }
    }

    console.log(`[Cron] Evening reminder completed: ${processedCount} sent, ${skippedCount} skipped, ${errors.length} errors`);

    return c.json({
      success: true,
      date: todayStr,
      processed: processedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[Cron] Evening reminder job failed:', error);
    return c.json({ success: false, error: error.message || 'Internal error' }, 500);
  }
});

/**
 * 수동 테스트용 엔드포인트
 * GET /api/cron/test
 */
cronRoutes.get('/test', async (c) => {
  if (!verifyCronSecret(c)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  return c.json({
    success: true,
    message: 'Cron endpoint is working',
    time: new Date().toISOString(),
    kstTime: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
  });
});

// 메시지 생성 헬퍼 함수들
function generateDailySummaryMessage(
  allCompleted: boolean,
  completed: number,
  total: number
): string {
  if (allCompleted) {
    const congratulations = [
      '🎉 **완벽한 하루!**\n\n어제 모든 퀘스트를 완료했어요!\n공부하느라 정말 수고 많았어요. 오늘도 화이팅! 💪',
      '✨ **대단해요!**\n\n어제 목표를 모두 달성했네요!\n꾸준히 하는 모습이 정말 멋져요. 오늘 하루도 화이팅! 🌟',
      '🏆 **퀘스트 올클리어!**\n\n완벽하게 해냈어요!\n이런 하루가 쌓이면 분명 좋은 결과가 있을 거예요. 오늘도 힘내세요! 🌙',
    ];
    return congratulations[Math.floor(Math.random() * congratulations.length)];
  } else {
    const completionRate = Math.round((completed / total) * 100);

    if (completed === 0) {
      return `📝 **오늘 하루 정리**\n\n어제는 퀘스트를 진행하지 못했네요.\n괜찮아요, 오늘 다시 시작하면 돼요! 🌱\n\n무리하지 말고 조금씩 해봐요.`;
    } else if (completionRate >= 70) {
      return `📝 **오늘 하루 정리**\n\n${completed}/${total} 완료 (${completionRate}%)\n\n거의 다 했어요! 어제도 열심히 했네요. 🙌\n오늘도 이어서 화이팅!`;
    } else {
      return `📝 **오늘 하루 정리**\n\n${completed}/${total} 완료 (${completionRate}%)\n\n조금 아쉽지만, 한 것도 있으니 괜찮아요.\n오늘은 조금 더 할 수 있을 거예요! 화이팅 💪`;
    }
  }
}

function generateReminderMessage(remaining: number, total: number): string {
  const encouragements = [
    `아직 ${remaining}개의 퀘스트가 남아있어요! 🌙`,
    `오늘 ${remaining}개 퀘스트가 미완료예요!`,
    `${remaining}개 퀘스트가 기다리고 있어요! ✨`,
  ];

  const tips = [
    '자기 전에 조금만 더 힘내볼까요?',
    '10분만 투자해도 큰 차이가 생겨요!',
    '작은 진전도 쌓이면 큰 성과가 돼요.',
    '오늘 할 수 있는 만큼만 해봐요!',
  ];

  const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return `⏰ **밤 10시 알림**\n\n${randomEncouragement}\n\n${randomTip}\n\n📊 오늘 진행률: ${total - remaining}/${total} 완료`;
}
