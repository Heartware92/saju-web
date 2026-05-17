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
          시행일: 2026-05-01 / 최종 개정일: 2026-05-02 / 버전 1.1
        </p>

        <section className="space-y-6 text-[14px] text-text-secondary leading-relaxed">

          <p>
            (주)하트웨어(이하 &quot;회사&quot;)는 이천점 서비스(이하 &quot;서비스&quot;)를 운영함에 있어
            이용자의 개인정보를 중요시하며, 「개인정보보호법」, 「정보통신망 이용촉진 및 정보보호 등에
            관한 법률」 등 관련 법령을 준수합니다. 본 개인정보처리방침을 통하여 이용자가 제공한
            개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 어떠한 보호 조치가 취해지고 있는지
            알려드립니다.
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
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">네이버 로그인</td>
                  <td className="px-3 py-2">이메일, 이름, 네이버 회원번호, 휴대폰 번호</td>
                </tr>
              </tbody>
            </table>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">2. 서비스 이용 시 (이용자가 직접 입력)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>이름(프로필명), 생년월일, 태어난 시간, 성별</li>
              <li>궁합 서비스: 상대방 이름, 생년월일, 태어난 시간, 성별</li>
            </ul>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">3. 결제 시</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>결제수단 정보, 결제 기록 (결제대행사 경유, 카드번호 등 민감정보는 회사가 직접 저장하지 않음)</li>
            </ul>

            <h4 className="text-[13px] font-bold text-text-primary mt-3 mb-1">4. 서비스 이용 중 자동 수집</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스 이용 기록, 접속 로그, 접속 IP 주소, 기기 및 브라우저 정보, 쿠키</li>
            </ul>
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
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">기간</th>
                  <th className="text-left px-3 py-2 text-text-tertiary font-medium">근거 법령</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">계약 또는 청약철회 기록</td>
                  <td className="px-3 py-2">5년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">대금결제 및 재화 공급 기록</td>
                  <td className="px-3 py-2">5년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">소비자 불만 또는 분쟁처리 기록</td>
                  <td className="px-3 py-2">3년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">표시·광고에 관한 기록</td>
                  <td className="px-3 py-2">6개월</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">웹사이트 방문 기록</td>
                  <td className="px-3 py-2">3개월</td>
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
                  <td className="px-3 py-2">결제 처리 대행</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Supabase (AWS)</td>
                  <td className="px-3 py-2">데이터 저장 및 인증 처리</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">Google (Gemini AI)</td>
                  <td className="px-3 py-2">AI 풀이 결과 생성</td>
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
              <li>이용자가 개인정보의 오류에 대한 정정을 요청한 경우, 정정을 완료하기 전까지 해당 개인정보를 이용 또는 제공하지 않습니다.</li>
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
            <p>회사는 개인정보의 안전성 확보를 위해 다음의 조치를 취하고 있습니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>비밀번호의 암호화 저장 및 관리</li>
              <li>SSL/TLS 등 암호화 통신을 통한 개인정보 전송</li>
              <li>개인정보 접근 권한의 제한 및 관리</li>
              <li>개인정보 처리 시스템의 접근 기록 보관 및 위·변조 방지</li>
              <li>해킹 등에 대비한 보안 프로그램 설치 및 갱신</li>
            </ul>
          </Article>

          {/* ── 제11조 ── */}
          <Article title="제11조 (쿠키의 설치·운영 및 거부)">
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 이용자에게 개인화된 서비스를 제공하기 위해 쿠키를 사용할 수 있습니다.</li>
              <li>쿠키는 서비스 운영에 이용되는 서버가 이용자의 브라우저에 보내는 작은 텍스트 파일로, 이용자의 기기에 저장됩니다.</li>
              <li>쿠키 사용 목적: 회원/비회원 구분, 접속 빈도 분석, 서비스 이용 패턴 파악</li>
              <li>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 일부 제한이 있을 수 있습니다.</li>
            </ol>
          </Article>

          {/* ── 제12조 ── */}
          <Article title="제12조 (AI 학습 미활용)">
            <p>
              회사는 이용자의 개인정보(생년월일, 출생 시간, 성별 등 사주 정보 포함)를
              AI 모델의 학습 데이터로 활용하지 않습니다. 이용자의 정보는 오직 해당 이용자의
              풀이 결과 생성 목적으로만 사용되며, 결과 생성 후 AI 시스템에 보존되지 않습니다.
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
                <li>이메일: [추후 기재]</li>
                <li>전화: [추후 기재]</li>
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
