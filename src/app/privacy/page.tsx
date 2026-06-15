import { BackButton } from '@/components/ui/BackButton';
import Layout from '@/components/Layout';

export const metadata = {
  title: '개인정보처리방침 — 이천점',
};

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const { embed } = await searchParams;
  const isEmbed = embed === '1';

  const inner = (
    <div className={`px-4 pb-12 ${isEmbed ? 'pt-2' : 'pt-4'}`}>
      {!isEmbed && (
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              개인정보처리방침
            </h1>
          </div>
        </div>
      )}

      <div className="rounded-2xl p-6 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[13px] text-text-tertiary mb-4">
          시행일: 2026-05-01 / 최종 개정일: 2026-06-15 / 버전 1.4
        </p>

        <section className="space-y-6 text-[14px] text-text-secondary leading-relaxed">

          <p>
            (주)하트웨어(이하 &quot;회사&quot;)는 「개인정보 보호법」 제30조에 따라 이용자(정보주체)의
            개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여
            다음과 같이 개인정보 처리방침을 수립·공개합니다. 회사는 이천점 서비스(이하 &quot;서비스&quot;)를
            운영함에 있어 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등
            관련 법령을 준수하며, 본 개인정보처리방침을 통하여 이용자가 제공한 개인정보가 어떠한
            용도와 방식으로 이용되고 있으며 어떠한 보호 조치가 취해지고 있는지 알려드립니다.
          </p>

          {/* ── 제1조 ── */}
          <Article title="제1조 (수집하는 개인정보 항목)">
            <p>회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.</p>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">1. 회원가입 시</h4>
            <table className="w-full text-[13px] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[rgba(124,92,252,0.08)]">
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">가입 방식</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">필수 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">이메일 가입</td>
                  <td className="px-3 py-2">이메일, 비밀번호(암호화 저장), 휴대폰 번호</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Google 로그인</td>
                  <td className="px-3 py-2">이메일, 이름, Google 회원번호, 휴대폰 번호</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">카카오 로그인</td>
                  <td className="px-3 py-2">이메일, 닉네임, 카카오 회원번호, 휴대폰 번호</td>
                </tr>
              </tbody>
            </table>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">2. 서비스 이용 시 (이용자가 직접 입력)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>이름(프로필명), 생년월일, 태어난 시간, 성별, (선택) 직업 상태·연애 상태</li>
              <li>궁합 서비스: 상대방 이름, 생년월일, 태어난 시간, 성별</li>
              <li>이름풀이 서비스: 풀이할 이름(한글·한자)</li>
              <li>꿈해몽 서비스: 꿈 내용(텍스트)</li>
              <li>상담소: 이용자가 입력한 대화 내용</li>
            </ul>
            <p className="text-[12px] text-text-tertiary mt-1">* (선택) 마케팅 정보 수신 동의 여부 — 동의 시 이벤트·혜택 안내에 이용</p>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">3. 결제 시</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>결제 수단 종류(신용카드·간편결제 등), 결제 승인·거래번호, 주문번호, 결제 금액, 결제 일시, 결제 상태</li>
              <li className="text-text-tertiary">* 결제는 결제대행사(PG)를 통해 처리되며, 카드번호·계좌번호 등 결제수단 상세정보는 회사가 직접 수집·저장하지 않습니다.</li>
            </ul>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">4. 서비스 이용 중 자동 수집</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스 이용 기록(방문한 페이지 경로, 페이지 이동·이탈 경로, 기능 이용 내역)</li>
              <li>접속 로그, 접속 일시, 접속 IP 주소, 기기 및 브라우저 정보(OS·기기 유형 등)</li>
              <li>쿠키 및 유사 기술로 생성되는 세션 식별자·방문자 식별자(localStorage·sessionStorage 기반)</li>
              <li>유입 경로(referrer) 및 마케팅 유입 파라미터(UTM 등)</li>
            </ul>
            <p className="text-[12px] text-text-tertiary mt-1">* 위 자동 수집 정보는 서비스 개선과 이용 통계·유입/이탈 분석 목적으로 이용되며, 특정 개인을 식별하기 위한 용도로 사용하지 않습니다.</p>
          </Article>

          {/* ── 제2조 ── */}
          <Article title="제2조 (개인정보의 수집 및 이용 목적)">
            <p>회사는 수집한 개인정보를 다음의 목적으로 이용합니다.</p>
            <table className="w-full text-[13px] border border-[var(--border-subtle)] rounded-lg overflow-hidden mt-2">
              <thead>
                <tr className="bg-[rgba(124,92,252,0.08)]">
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">목적</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">상세</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">서비스 제공</td>
                  <td className="px-3 py-2">만세력 계산, 사주명리 풀이, AI 운세 결과 생성</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">회원 관리</td>
                  <td className="px-3 py-2">회원 식별, 본인 확인(SMS 인증), 불량회원 부정 이용 방지</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">결제·정산</td>
                  <td className="px-3 py-2">크레딧 충전·소모 내역 관리, 환불 처리</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">고객 지원</td>
                  <td className="px-3 py-2">문의·불만 접수 및 처리, 공지사항 전달</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">서비스 개선</td>
                  <td className="px-3 py-2">접속 빈도 파악, 이용 통계 분석</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">마케팅 (선택 동의 시)</td>
                  <td className="px-3 py-2">이벤트·혜택 등 정보 안내</td>
                </tr>
              </tbody>
            </table>
          </Article>

          {/* ── 제3조 ── */}
          <Article title="제3조 (개인정보의 보유 및 이용 기간)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>회원의 개인정보는 원칙적으로 회원 탈퇴 시까지 보유하며, 탈퇴 즉시 지체 없이 파기합니다.</li>
              <li>다만 관계 법령에 의하여 보존이 필요한 경우 다음 기간 동안 보관합니다.</li>
            </ol>
            <table className="w-full text-[13px] border border-[var(--border-subtle)] rounded-lg overflow-hidden mt-2">
              <thead>
                <tr className="bg-[rgba(124,92,252,0.08)]">
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">보관 항목</th>
                  <th className="text-center px-3 py-2 text-text-tertiary font-medium whitespace-nowrap" style={{ width: 72 }}>기간</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">근거 법령</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)] align-top">
                  <td className="px-3 py-2">계약 또는 청약철회 기록</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">5년</td>
                  <td className="px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)] align-top">
                  <td className="px-3 py-2">대금결제 및 재화 공급 기록</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">5년</td>
                  <td className="px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)] align-top">
                  <td className="px-3 py-2">소비자 불만 또는 분쟁처리 기록</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">3년</td>
                  <td className="px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)] align-top">
                  <td className="px-3 py-2">표시·광고에 관한 기록</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">6개월</td>
                  <td className="px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)] align-top">
                  <td className="px-3 py-2">세법상 거래에 관한 장부 및 증빙서류</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">5년</td>
                  <td className="px-3 py-2">국세기본법</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)] align-top">
                  <td className="px-3 py-2">웹사이트 방문 기록</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">3개월</td>
                  <td className="px-3 py-2">통신비밀보호법</td>
                </tr>
              </tbody>
            </table>
          </Article>

          {/* ── 제4조 ── */}
          <Article title="제4조 (개인정보의 파기 절차 및 방법)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>회원 탈퇴 또는 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</li>
              <li>전자적 파일 형태의 개인정보는 복구 불가능한 방법으로 영구 삭제합니다.</li>
              <li>관계 법령에 의해 보존이 필요한 정보는 별도 분리하여 보관한 후 기간 경과 시 파기합니다.</li>
            </ol>
          </Article>

          {/* ── 제5조 ── */}
          <Article title="제5조 (개인정보의 제3자 제공)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.</li>
              <li>다만 다음의 경우에는 예외로 합니다.
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>이용자가 사전에 동의한 경우</li>
                  <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                </ul>
              </li>
            </ol>
          </Article>

          {/* ── 제6조 ── */}
          <Article title="제6조 (개인정보 처리 위탁)">
            <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
            <table className="w-full text-[13px] border border-[var(--border-subtle)] rounded-lg overflow-hidden mt-2">
              <thead>
                <tr className="bg-[rgba(124,92,252,0.08)]">
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">위탁 업체</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">위탁 업무</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">PortOne (포트원)</td>
                  <td className="px-3 py-2">결제 연동 및 처리</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">KG이니시스, 토스페이먼츠, 한국결제네트웍스(KPN)</td>
                  <td className="px-3 py-2">신용카드·간편결제 등 결제대행(PG)</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">주식회사 누리고 (솔라피)</td>
                  <td className="px-3 py-2">휴대폰 본인인증(SMS)·카카오 알림톡 발송</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Supabase</td>
                  <td className="px-3 py-2">데이터 저장 및 인증 처리 (AWS 서울 리전)</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Google (Gemini), OpenAI</td>
                  <td className="px-3 py-2">AI 풀이·상담 결과 생성</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Vercel</td>
                  <td className="px-3 py-2">웹 서비스 호스팅</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2">
              회사는 위탁 계약 시 개인정보보호 관련 법규의 준수, 개인정보 비밀 유지, 제3자 제공 금지,
              사고 시 책임 부담 등을 명확히 규정합니다.
            </p>
          </Article>

          {/* ── 제6조의2 ── */}
          <Article title="제6조의2 (개인정보의 국외 이전)">
            <p>
              회사는 서비스 제공을 위해 다음과 같이 개인정보를 국외로 이전(처리위탁)하고 있습니다.
              회사가 국외로 이전하는 정보는 AI 풀이·웹 서비스 제공에 필수적이어서 부분적인 거부가 어렵습니다. 이용자는 회원 탈퇴를 통해 개인정보의 국외 이전을 거부할 수 있으며, 이 경우 서비스 이용이 종료됩니다.
              (데이터 저장·인증을 담당하는 Supabase는 국내 리전(AWS 서울)에 보관되어 국외 이전 대상이 아닙니다.)
            </p>
            <table className="w-full text-[13px] border border-[var(--border-subtle)] rounded-lg overflow-hidden mt-2">
              <thead>
                <tr className="bg-[rgba(124,92,252,0.08)]">
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">이전받는 자</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">국가</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">이전 항목 / 목적</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">이전 일시·방법 / 보유기간</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Google LLC (Gemini)<br /><span className="text-text-tertiary text-[11px]">연락처 googlekrsupport@google.com</span></td>
                  <td className="px-3 py-2">미국</td>
                  <td className="px-3 py-2">풀이 입력정보(생년월일·태어난 시간·성별 등) / AI 풀이 결과 생성</td>
                  <td className="px-3 py-2">풀이 요청 시 네트워크 전송 / 결과 생성 후 별도 보관하지 않음(제공사 정책상 단기 보관될 수 있음)</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">OpenAI, L.L.C.<br /><span className="text-text-tertiary text-[11px]">연락처 privacy@openai.com</span></td>
                  <td className="px-3 py-2">미국</td>
                  <td className="px-3 py-2">풀이·상담 입력정보 / AI 풀이·상담 결과 생성(보조)</td>
                  <td className="px-3 py-2">요청 시 네트워크 전송 / 결과 생성 후 별도 보관하지 않음(제공사 정책상 단기 보관될 수 있음)</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Vercel Inc.<br /><span className="text-text-tertiary text-[11px]">연락처 privacy@vercel.com</span></td>
                  <td className="px-3 py-2">미국</td>
                  <td className="px-3 py-2">서비스 이용·접속 정보 / 웹 서비스 호스팅</td>
                  <td className="px-3 py-2">서비스 접속 시 / 처리 목적 달성 시까지</td>
                </tr>
              </tbody>
            </table>
          </Article>

          {/* ── 제7조 ── */}
          <Article title="제7조 (정보주체의 권리와 행사 방법)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>개인정보 열람 요구</li>
                  <li>오류 등이 있을 경우 정정 요구</li>
                  <li>삭제 요구</li>
                  <li>처리 정지 요구</li>
                </ul>
              </li>
              <li>개인정보 조회·수정은 마이페이지에서 직접 가능하며, 회원 탈퇴(동의 철회)도 마이페이지를 통해 처리할 수 있습니다.</li>
              <li>개인정보보호책임자에게 서면, 이메일로 연락하시면 지체 없이 조치하겠습니다.</li>
              <li>회사는 이용자의 열람·정정·삭제·처리정지 요구를 받은 경우 정당한 사유가 없는 한 10일 이내에 조치합니다.</li>
              <li>이용자가 개인정보의 오류에 대한 정정을 요청한 경우, 정정을 완료하기 전까지 해당 개인정보를 이용 또는 제공하지 않습니다.</li>
              <li>이용자의 법정대리인이나 위임을 받은 자는 위임장을 제출하여 위 권리를 대리 행사할 수 있으며, 회사는 정당한 대리인인지 여부를 확인합니다.</li>
              <li>다만 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우 등에는 삭제·처리정지 요구가 제한될 수 있습니다.</li>
            </ol>
          </Article>

          {/* ── 제8조 ── */}
          <Article title="제8조 (만 14세 미만 아동의 개인정보)">
            <p>
              회사는 만 14세 미만 아동의 개인정보를 수집하지 않습니다.
              만 14세 미만의 아동이 서비스에 가입한 것으로 확인되는 경우, 해당 아동의 개인정보를
              즉시 삭제하고 회원 자격을 제한합니다.
            </p>
          </Article>

          {/* ── 제8조의2 ── */}
          <Article title="제8조의2 (민감정보의 처리)">
            <p>
              회사는 이용자의 민감한 개인정보를 수집하지 않습니다.
            </p>
            <p className="mt-2">
              회사는 민감정보를 별도로 요구·수집하지 않으나, 이용자가 상담소·꿈해몽 등 자유입력란에
              입력한 내용은 풀이·상담 결과 제공 목적으로만 이용됩니다. 이용자는 자유입력란에 건강·정치적
              견해 등 불필요한 민감정보를 입력하지 않도록 권고드립니다.
            </p>
          </Article>

          {/* ── 제9조 ── */}
          <Article title="제9조 (자동화된 결정에 대한 정보주체의 권리)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>서비스에서 제공하는 사주명리·운세 풀이 결과는 AI(인공지능)에 의해 자동으로 생성됩니다.</li>
              <li>이러한 결과는 참고 목적의 콘텐츠이며, 과학적으로 입증된 것이 아닙니다.</li>
              <li>이용자는 자동화된 결정에 대해 설명을 요구하거나 이의를 제기할 수 있으며, 해당 요청은 개인정보보호책임자에게 연락하여 처리할 수 있습니다.</li>
            </ol>
          </Article>

          {/* ── 제10조 ── */}
          <Article title="제10조 (개인정보의 안전성 확보 조치)">
            <p>회사는 개인정보의 안전한 처리를 위하여 다음과 같이 관리적·기술적·물리적 보호조치를 취하고 있습니다.</p>
            <p className="font-medium text-text-primary mt-2">1. 관리적 조치</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>개인정보 내부관리계획의 수립 및 시행</li>
              <li>개인정보를 취급하는 인원의 최소화 및 정기적인 개인정보 보호 교육</li>
              <li>개인정보 처리 수탁사에 대한 보호 의무 부과 및 관리·감독</li>
            </ul>
            <p className="font-medium text-text-primary mt-2">2. 기술적 조치</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>비밀번호 등 중요 정보의 암호화 저장 및 관리</li>
              <li>SSL/TLS 등 암호화 통신을 통한 개인정보 전송</li>
              <li>개인정보처리시스템의 접근 권한 제한 및 관리</li>
              <li>접근 기록의 보관 및 위·변조 방지</li>
              <li>해킹 등에 대비한 보안 프로그램 설치 및 주기적 갱신</li>
            </ul>
            <p className="font-medium text-text-primary mt-2">3. 물리적 조치</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>회사는 자체 전산설비를 운영하지 않으며, 개인정보는 AWS(서울)·Vercel 등 클라우드 인프라에 보관되어 해당 사업자의 데이터센터 물리 보안 기준에 따라 보호됩니다.</li>
            </ul>
          </Article>

          {/* ── 제11조 ── */}
          <Article title="제11조 (쿠키 및 행태정보의 처리·거부)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 로그인 세션 유지 및 개인화된 서비스 제공을 위해 쿠키와 유사 기술(localStorage·sessionStorage)을 사용합니다.</li>
              <li>이용 목적: 로그인 상태 유지, 회원/비회원 구분, 접속 빈도·서비스 이용 패턴 파악, 유입/이탈 등 이용 통계 분석</li>
              <li>회사는 서비스 이용 통계 분석을 위해 제3자 분석 도구인 Vercel Analytics(Vercel Inc.)를 이용하며, 해당 도구는 쿠키를 사용하지 않고 익명·집계 형태로 방문 정보를 처리합니다.</li>
              <li>회사는 온라인 맞춤형 광고를 위한 행태정보를 수집하지 않으며, 이용자의 행태정보를 제3자에게 광고 목적으로 제공하지 않습니다.</li>
              <li>이용자는 웹 브라우저 설정으로 쿠키 저장을 거부하거나, 브라우저 저장소(localStorage·sessionStorage) 삭제 기능으로 저장된 식별자를 삭제할 수 있습니다. 다만 이 경우 로그인 유지 등 일부 서비스 이용에 제한이 있을 수 있습니다.</li>
            </ol>
          </Article>

          {/* ── 제12조 ── */}
          <Article title="제12조 (AI 학습 미활용)">
            <p>
              회사는 이용자의 개인정보(생년월일, 출생 시간, 성별 등 사주 정보 포함)를
              AI 모델의 학습 데이터로 활용하지 않습니다. 이용자의 정보는 오직 해당 이용자의
              풀이·상담 결과 생성 목적으로만 사용되며, 회사는 결과 생성 외의 목적으로 이를
              보관·이용하지 않습니다. 다만 AI 처리 과정에서 AI 제공사(Google, OpenAI)의
              자체 정책에 따라 오·남용 모니터링 목적으로 일시적으로 보관될 수 있습니다.
            </p>
          </Article>

          {/* ── 제13조 ── */}
          <Article title="제13조 (개인정보 보호책임자)">
            <p>
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
              정보주체의 불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를
              지정하고 있습니다.
            </p>
            <div className="mt-2 p-3 rounded-lg bg-[rgba(124,92,252,0.06)] border border-[var(--border-subtle)]">
              <p className="font-medium text-text-primary">개인정보보호책임자</p>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                <li>회사명: (주)하트웨어</li>
                <li>책임자: 허진우 (대표자 겸임)</li>
                <li>이메일: heojinwoo@heartware.co.kr</li>
                <li>전화: 010-5960-0920</li>
              </ul>
            </div>
            <p className="mt-3">
              기타 개인정보 침해에 대한 신고나 상담이 필요하신 경우 아래 기관에 문의하시기 바랍니다.
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-[13px]">
              <li>개인정보분쟁조정위원회 (www.kopico.go.kr / 1833-6972)</li>
              <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>대검찰청 사이버수사과 (www.spo.go.kr / 1301)</li>
              <li>경찰청 사이버수사국 (ecrm.police.go.kr / 182)</li>
            </ul>
          </Article>

          {/* ── 제14조 ── */}
          <Article title="제14조 (개인정보처리방침의 변경)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 수정이 있는 경우에는 변경사항의 시행 7일 전부터 서비스 내 공지사항을 통하여 고지할 것입니다.</li>
              <li>이용자의 권리에 중요한 변경이 있는 경우에는 시행 30일 전에 고지합니다.</li>
            </ol>
          </Article>

          {/* ── 부칙 ── */}
          <h2 className="text-[15px] font-bold text-cta/80 mt-4">부칙</h2>
          <p>본 개인정보처리방침은 2026년 5월 1일부터 시행합니다.</p>
          <p>개정된 본 방침(버전 1.3 — 민감정보 처리, 국외이전 연락처, 보호책임자 연락처 보강)은 2026년 6월 14일부터 시행합니다.</p>
          <p>개정된 본 방침(버전 1.4 — 「개인정보 보호법」 제30조 수립 근거 명시, 수집·보유·자동수집·쿠키/행태정보·민감정보 항목 명확화, 법정 보존기간 정비, 처리위탁 수탁사 추가 등)은 2026년 6월 15일부터 시행합니다.</p>

        </section>

        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <p className="text-[12px] text-text-tertiary">
            (주)하트웨어
          </p>
        </div>
      </div>
    </div>
  );

  return isEmbed ? inner : <Layout>{inner}</Layout>;
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article>
      <h3 className="text-[15px] font-bold text-text-primary mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </article>
  );
}
