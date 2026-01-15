/**
 * Coach Routes - Chat & Admission
 * 채팅 및 입학상담 라우트
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getSupervisor } from './singletons.js';
import { ChatSchema, AdmissionChatSchema } from './types.js';
import { extractInfoFromMessage } from './utils.js';
import * as db from '../../db/index.js';
import type { AgentRequest, Subject } from '@questy/coach-agent';

export const chatRoutes = new Hono();

// 코치와 대화 - Supervisor.process() 사용
chatRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, message, conversationId, userName, metadata } = parsed.data;

    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    // studentId가 없으면 자동 생성
    const finalStudentId = studentId || `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // DB에서 학생 확인 또는 자동 생성
    let dbStudent = db.getStudent(finalStudentId);
    if (!dbStudent) {
      dbStudent = db.createStudent({
        id: finalStudentId,
        name: userName || '학생',
      });
      console.log(`[Coach/Chat] Created guest student in DB: ${finalStudentId}`);
    }

    // 메모리 StudentRegistry에도 동기화
    let student = registry.getStudent(finalStudentId);
    if (!student) {
      student = registry.createStudent({
        id: finalStudentId,
        name: dbStudent.name,
      });
    }

    // 대화 ID 생성
    const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log(`[Coach/Chat] conversationId received: ${conversationId}, using: ${convId}`);

    // 사용자 메시지 DB에 저장
    db.addConversation({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      studentId: finalStudentId,
      role: 'user',
      content: message,
    });

    // AgentRequest 생성
    const { questContext } = parsed.data;
    const request: AgentRequest = {
      studentId: finalStudentId,
      message,
      conversationId: convId,
      metadata: {
        currentSubject: metadata?.currentSubject as Subject | undefined,
        questContext: questContext ? {
          todayQuests: questContext.todayQuests || [],
          activePlans: questContext.activePlans || [],
          upcomingQuests: questContext.upcomingQuests || [],
          weeklyStats: questContext.weeklyStats,
          plansCount: questContext.plansCount || 0,
          completedToday: questContext.completedToday || 0,
          totalToday: questContext.totalToday || 0,
        } : undefined,
      },
    };

    console.log(`[Coach/Chat] Processing: "${message.slice(0, 50)}..." for ${student.name}`);

    // Supervisor를 통한 처리
    const response = await supervisor.process(request);

    // AI 응답 DB에 저장
    db.addConversation({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      studentId: finalStudentId,
      role: 'assistant',
      agentRole: response.agentRole,
      content: response.message,
    });

    console.log(`[Coach/Chat] Response from ${response.agentRole}: "${response.message.slice(0, 50)}..."`);

    return c.json({
      success: true,
      data: {
        studentId: finalStudentId,
        conversationId: convId,
        agentRole: response.agentRole,
        message: response.message,
        suggestedFollowUp: response.suggestedFollowUp || [],
        memoryExtracted: response.memoryExtracted,
        actions: response.actions || [],
        rescheduleOptions: response.rescheduleOptions || [],
        messageActions: response.messageActions || [],
      },
    });
  } catch (error) {
    console.error('[Coach/Chat] Error:', error);
    return c.json({
      success: false,
      error: { message: '채팅 처리에 실패했습니다' },
    }, 500);
  }
});

// 코치와 대화 (스트리밍) - SSE 방식
chatRoutes.post('/stream', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, message, conversationId, userName, metadata } = parsed.data;

    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    // studentId가 없으면 자동 생성
    const finalStudentId = studentId || `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // DB에서 학생 확인 또는 자동 생성
    let dbStudent = db.getStudent(finalStudentId);
    if (!dbStudent) {
      dbStudent = db.createStudent({
        id: finalStudentId,
        name: userName || '학생',
      });
    }

    // 메모리 StudentRegistry에도 동기화
    let student = registry.getStudent(finalStudentId);
    if (!student) {
      student = registry.createStudent({
        id: finalStudentId,
        name: dbStudent.name,
      });
    }

    // 대화 ID 생성
    const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 사용자 메시지 DB에 저장
    db.addConversation({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      studentId: finalStudentId,
      role: 'user',
      content: message,
    });

    // AgentRequest 생성
    const { questContext } = parsed.data;
    const request: AgentRequest = {
      studentId: finalStudentId,
      message,
      conversationId: convId,
      metadata: {
        currentSubject: metadata?.currentSubject as Subject | undefined,
        questContext: questContext ? {
          todayQuests: questContext.todayQuests || [],
          activePlans: questContext.activePlans || [],
          upcomingQuests: questContext.upcomingQuests || [],
          weeklyStats: questContext.weeklyStats,
          plansCount: questContext.plansCount || 0,
          completedToday: questContext.completedToday || 0,
          totalToday: questContext.totalToday || 0,
        } : undefined,
      },
    };

    console.log(`[Coach/Stream] Starting stream for: "${message.slice(0, 50)}..."`);

    // SSE 스트리밍 응답
    return streamSSE(c, async (stream) => {
      let fullMessage = '';
      let agentRole = 'COACH';

      try {
        // 메타데이터 먼저 전송
        await stream.writeSSE({
          event: 'meta',
          data: JSON.stringify({
            studentId: finalStudentId,
            conversationId: convId,
          }),
        });

        // 스트리밍 청크 전송
        for await (const chunk of supervisor.processStream(request)) {
          if (chunk.agentRole) {
            agentRole = chunk.agentRole;
          }

          if (chunk.content) {
            fullMessage += chunk.content;
            await stream.writeSSE({
              event: 'chunk',
              data: JSON.stringify({
                content: chunk.content,
                agentRole,
              }),
            });
          }

          if (chunk.done) {
            // AI 응답 DB에 저장
            db.addConversation({
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              studentId: finalStudentId,
              role: 'assistant',
              agentRole,
              content: fullMessage,
            });

            // 완료 이벤트 전송
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({
                agentRole,
                messageLength: fullMessage.length,
              }),
            });
          }
        }
      } catch (streamError) {
        console.error('[Coach/Stream] Stream error:', streamError);
        // 스트리밍 중 오류 발생 시 오류 이벤트 전송
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: '스트리밍 중 오류가 발생했습니다',
            agentRole,
          }),
        });
      }
    });
  } catch (error) {
    console.error('[Coach/Stream] Error:', error);
    return c.json({
      success: false,
      error: { message: '스트리밍 채팅 처리에 실패했습니다' },
    }, 500);
  }
});

// 입학 상담 채팅 - AdmissionAgent 직접 사용
chatRoutes.post('/admission', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = AdmissionChatSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { message, stage, context } = parsed.data;

    const supervisor = getSupervisor();
    const admissionAgent = supervisor.getAdmissionAgent();

    const extractedInfo = extractInfoFromMessage(message, stage);

    console.log(`[Admission/Chat] Stage: ${stage}, Message: "${message.slice(0, 30)}...", Extracted: ${JSON.stringify(extractedInfo)}`);

    const request: AgentRequest = {
      studentId: 'admission-temp',
      message,
      conversationId: `admission-${Date.now()}`,
      metadata: {
        stage,
        extractedInfo,
        currentInfo: context?.currentInfo,
      },
    };

    const response = await admissionAgent.process(request);

    return c.json({
      success: true,
      data: {
        message: response.message,
        extractedInfo,
        suggestedFollowUp: response.suggestedFollowUp || [],
      },
    });
  } catch (error) {
    console.error('[Admission/Chat] Error:', error);
    return c.json({
      success: false,
      error: { message: '입학 상담 처리에 실패했습니다' },
    }, 500);
  }
});
