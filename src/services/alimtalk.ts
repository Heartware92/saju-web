/**
 * 카카오 알림톡 발송 (Solapi)
 *
 * 설계 원칙:
 *   - 환경변수(KAKAO_PF_ID / 템플릿 ID)가 없으면 발송하지 않고 'skipped' 반환
 *     → 카카오 채널·템플릿 승인 전에도 배포·동작 안전 (no-op)
 *   - 절대 throw 하지 않음 — 호출부(어드민 답변 저장 / 가입 완료 등)를 막지 않도록 결과 객체로만 반환
 *   - 자격증명은 기존 SMS(Solapi)와 동일한 SOLAPI_* 재사용
 *
 * 준비물 (카카오 채널/템플릿 승인 후 환경변수 설정):
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_PHONE   (기존 SMS용 재사용)
 *   KAKAO_PF_ID                          = Solapi 에 연동한 카카오 채널 pfId
 *                                          (2000-saju 채널: KA01PF260615160235416ighvkkioxAb)
 *   KAKAO_TEMPLATE_INQUIRY_ANSWERED      = '문의 답변완료' 알림톡 템플릿 ID
 *   KAKAO_TEMPLATE_SIGNUP_WELCOME        = '회원가입 환영' 알림톡 템플릿 ID
 *   KAKAO_TEMPLATE_CREDIT_GRANTED        = '무료 달 크레딧 지급' 알림톡 템플릿 ID
 *                                          (검수 중: KA01TP260618064933112DaRnWBlzjc1)
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
 * 알림톡 발송 공통 코어 — 자격증명·pfId·템플릿ID 검증 후 Solapi 호출.
 * 모든 발송 함수가 이 함수를 통해 동일한 안전 규칙(미설정 시 skipped, throw 금지)을 따른다.
 */
async function sendAlimtalk(
  phone: string | null | undefined,
  templateId: string | undefined,
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
  const tplId = templateId?.trim();

  // 카카오 채널·템플릿 미설정 시 발송하지 않음 (승인 전 안전)
  if (!apiKey || !apiSecret || !senderPhone || !pfId || !tplId) {
    return { status: 'skipped', recipient: to, error: 'alimtalk_not_configured' };
  }

  try {
    const solapi = new SolapiMessageService(apiKey, apiSecret);
    const res = await solapi.send({
      to,
      from: senderPhone,
      kakaoOptions: {
        pfId,
        templateId: tplId,
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

/**
 * 문의 답변완료 알림톡 발송.
 * @param phone   수신 휴대폰 (정규화 전 원문 허용)
 * @param variables 템플릿 치환 변수 (카카오에 등록한 템플릿의 #{변수}와 키 일치 필요)
 */
export async function sendInquiryAnsweredAlimtalk(
  phone: string | null | undefined,
  variables: Record<string, string>,
): Promise<AlimtalkResult> {
  return sendAlimtalk(phone, process.env.KAKAO_TEMPLATE_INQUIRY_ANSWERED, variables);
}

/**
 * 회원가입 환영 알림톡 발송. 가입 완료(휴대폰 확정) 직후 1회.
 * 승인된 '회원가입 환영' 템플릿은 치환 변수가 없으므로 기본 빈 객체.
 * @param phone   수신 휴대폰 (정규화 전 원문 허용)
 * @param variables 템플릿에 변수가 있을 경우에만 전달
 */
export async function sendSignupWelcomeAlimtalk(
  phone: string | null | undefined,
  variables: Record<string, string> = {},
): Promise<AlimtalkResult> {
  return sendAlimtalk(phone, process.env.KAKAO_TEMPLATE_SIGNUP_WELCOME, variables);
}

/**
 * 무료 달 크레딧 지급 알림톡 발송. 이벤트성 크레딧 지급 시 발송.
 * 템플릿 검수 통과 + KAKAO_TEMPLATE_CREDIT_GRANTED env 설정 전까지는 자동 'skipped'.
 * @param phone   수신 휴대폰 (정규화 전 원문 허용)
 * @param variables 템플릿 치환 변수 (카카오에 등록한 #{이름}/#{지급크레딧}/#{잔여크레딧} 등과 키 일치 필요)
 */
export async function sendCreditGrantedAlimtalk(
  phone: string | null | undefined,
  variables: Record<string, string> = {},
): Promise<AlimtalkResult> {
  return sendAlimtalk(phone, process.env.KAKAO_TEMPLATE_CREDIT_GRANTED, variables);
}

/**
 * 브랜드 메시지(구 친구톡) 발송 대상 타겟팅.
 *   - 'I' : 발송요청 대상 중 채널 친구 (특정 번호로 보낼 때 — 기본값)
 *   - 'M' : 마케팅 수신동의 유저 대상 (확장발송, 카카오 별도 승인 필요)
 *   - 'N' : 마케팅 수신동의 + 채널 친구
 */
export type BrandMessageTargeting = 'I' | 'M' | 'N';

/**
 * 브랜드 메시지(자유형/템플릿형) 발송 공통 코어 — 광고성, 카카오 사전 검수 불필요.
 * 알림톡과 달리 kakaoOptions.bms(targeting/chatBubbleType)가 필요하다.
 * 미설정(자격증명·pfId·템플릿ID 없음) 시 발송하지 않고 'skipped' 반환(throw 금지).
 *
 * 주의(법):
 *   - 광고성이므로 채널 친구 또는 마케팅 수신 동의자에게만 발송 가능.
 *   - 템플릿 본문에 (광고) 표기·수신거부 안내가 포함돼 있어야 한다(카카오 정책).
 */
/** 브랜드 메시지 말풍선 타입. 등록 템플릿의 타입과 반드시 일치해야 함(불일치 시 카카오 3108 실패). */
export type BrandMessageChatBubbleType = 'TEXT' | 'IMAGE' | 'WIDE';

type BrandMessageOptions = {
  targeting?: BrandMessageTargeting;        // 기본 'I' (발송요청 대상 중 채널친구)
  chatBubbleType?: BrandMessageChatBubbleType; // 템플릿 타입과 일치 필요
  imageId?: string;                          // IMAGE/WIDE 타입은 SDK가 필수 검증
};

async function sendBrandMessage(
  phone: string | null | undefined,
  templateId: string | undefined,
  variables: Record<string, string>,
  options: BrandMessageOptions = {},
): Promise<AlimtalkResult> {
  const to = normalizePhone(phone);
  if (!to) {
    return { status: 'skipped', recipient: null, error: 'no_valid_phone' };
  }

  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  const senderPhone = process.env.SOLAPI_SENDER_PHONE?.trim();
  const pfId = process.env.KAKAO_PF_ID?.trim();
  const tplId = templateId?.trim();

  if (!apiKey || !apiSecret || !senderPhone || !pfId || !tplId) {
    return { status: 'skipped', recipient: to, error: 'brand_message_not_configured' };
  }

  const targeting = options.targeting ?? 'I';
  const chatBubbleType = options.chatBubbleType ?? 'IMAGE';

  try {
    const solapi = new SolapiMessageService(apiKey, apiSecret);
    const res = await solapi.send({
      to,
      from: senderPhone,
      kakaoOptions: {
        pfId,
        templateId: tplId,
        variables,
        bms: {
          targeting,
          chatBubbleType,
          // IMAGE/WIDE 타입은 imageId 필수 (템플릿에 등록된 이미지의 id)
          ...(options.imageId ? { imageId: options.imageId } : {}),
        },
        // 브랜드 메시지 실패 시 SMS 대체발송 안 함 — 비용·스팸 통제
        disableSms: true,
      },
    });
    return { status: 'sent', recipient: to, providerResponse: res };
  } catch (e: any) {
    return {
      status: 'failed',
      recipient: to,
      error: e?.message ?? 'solapi_send_error',
      providerResponse: e?.response?.data ?? e?.failedMessageList ?? null,
    };
  }
}

/**
 * 회원가입 보너스 브랜드 메시지 발송. (검수 불필요·광고성)
 * KAKAO_BMS_SIGNUP_BONUS 미설정 시 자동 'skipped'.
 * @param variables 템플릿 치환 변수 (#{이름}/#{잔여크레딧} 등 등록 템플릿과 키 일치 필요)
 */
export async function sendSignupBonusBrandMessage(
  phone: string | null | undefined,
  variables: Record<string, string> = {},
  options: BrandMessageOptions = {},
): Promise<AlimtalkResult> {
  return sendBrandMessage(phone, process.env.KAKAO_BMS_SIGNUP_BONUS, variables, options);
}

/**
 * 마케팅 동의 보너스 브랜드 메시지 발송. (검수 불필요·광고성)
 * 마케팅 수신 동의자에게만 발송할 것. KAKAO_BMS_MARKETING_BONUS 미설정 시 자동 'skipped'.
 * @param variables 템플릿 치환 변수 (#{이름}/#{잔여크레딧} 등 등록 템플릿과 키 일치 필요)
 */
export async function sendMarketingBonusBrandMessage(
  phone: string | null | undefined,
  variables: Record<string, string> = {},
  options: BrandMessageOptions = {},
): Promise<AlimtalkResult> {
  return sendBrandMessage(phone, process.env.KAKAO_BMS_MARKETING_BONUS, variables, options);
}
