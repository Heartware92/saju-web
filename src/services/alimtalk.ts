/**
 * 카카오 알림톡 발송 (Solapi)
 *
 * 설계 원칙:
 *   - 환경변수(KAKAO_PF_ID / 템플릿 ID)가 없으면 발송하지 않고 'skipped' 반환
 *     → 카카오 채널·템플릿 승인 전에도 배포·동작 안전 (no-op)
 *   - 절대 throw 하지 않음 — 호출부(어드민 답변 저장 등)를 막지 않도록 결과 객체로만 반환
 *   - 자격증명은 기존 SMS(Solapi)와 동일한 SOLAPI_* 재사용
 *
 * 준비물 (카카오 채널/템플릿 승인 후 환경변수 설정):
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_PHONE   (기존 SMS용 재사용)
 *   KAKAO_PF_ID                          = Solapi 에 연동한 카카오 채널 pfId
 *   KAKAO_TEMPLATE_INQUIRY_ANSWERED      = '문의 답변완료' 알림톡 템플릿 ID
 */
import { SolapiMessageService } from 'solapi';

export type AlimtalkResult = {
  status: 'sent' | 'failed' | 'skipped';
  recipient: string | null;
  providerResponse?: unknown;
  error?: string;
};

/** 휴대폰 번호 정규화 — 숫자만 추출. 유효하지 않으면 null */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

/**
 * 문의 답변완료 알림톡 발송.
 * @param phone   수신 휴대폰 (정규화 전 원문 허용)
 * @param variables 템플릿 치환 변수 (카카오에 등록한 템플릿의 #{변수}와 키 일치 필요)
 */
export async function sendInquiryAnsweredAlimtalk(
  phone: string | null | undefined,
  variables: Record<string, string>,
): Promise<AlimtalkResult> {
  const to = normalizePhone(phone);
  if (!to) {
    return { status: 'skipped', recipient: null, error: 'no_valid_phone' };
  }

  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  const senderPhone = process.env.SOLAPI_SENDER_PHONE?.trim();
  const pfId = process.env.KAKAO_PF_ID?.trim();
  const templateId = process.env.KAKAO_TEMPLATE_INQUIRY_ANSWERED?.trim();

  // 카카오 채널·템플릿 미설정 시 발송하지 않음 (승인 전 안전)
  if (!apiKey || !apiSecret || !senderPhone || !pfId || !templateId) {
    return { status: 'skipped', recipient: to, error: 'alimtalk_not_configured' };
  }

  try {
    const solapi = new SolapiMessageService(apiKey, apiSecret);
    const res = await solapi.send({
      to,
      from: senderPhone,
      kakaoOptions: {
        pfId,
        templateId,
        variables,
        // 알림톡 실패 시 SMS 대체발송 안 함 — 비용·스팸 통제 (필요 시 별도 정책)
        disableSms: true,
      },
    });
    return { status: 'sent', recipient: to, providerResponse: res };
  } catch (e: any) {
    return {
      status: 'failed',
      recipient: to,
      error: e?.message ?? 'solapi_send_error',
      providerResponse: e?.response?.data ?? null,
    };
  }
}
