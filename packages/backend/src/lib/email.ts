/**
 * Email Service
 * Resend를 사용한 이메일 발송
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// 발신자 이메일 (도메인 인증 전에는 onboarding@resend.dev 사용)
const FROM_EMAIL = process.env.FROM_EMAIL || 'Questy <onboarding@resend.dev>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Send error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('[Email] Exception:', err);
    return { success: false, error: err.message };
  }
}

// 멤버십 승인 이메일 템플릿
export function getMembershipApprovalEmail(userName: string, membershipType: string) {
  const typeKorean = membershipType === 'beta_tester' ? '베타테스터' : '실험단';

  return {
    subject: `[Questy] ${typeKorean} 멤버십이 승인되었습니다! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 축하합니다!</h1>
          </div>
          <div class="content">
            <p>안녕하세요, <strong>${userName}</strong>님!</p>
            <p>Questy <strong>${typeKorean}</strong> 멤버십이 승인되었습니다.</p>
            <p>이제 AI 학습 코치와 함께 효과적인 학습 여정을 시작할 수 있습니다.</p>
            <ul>
              <li>📚 맞춤형 학습 플랜 생성</li>
              <li>🤖 AI 코치와 실시간 대화</li>
              <li>📊 학습 진도 분석 및 리포트</li>
            </ul>
            <a href="${process.env.APP_URL || 'http://questy-beta.vercel.app'}" class="button">Questy 시작하기</a>
          </div>
          <div class="footer">
            <p>Questy - AI 학습 코치</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}
