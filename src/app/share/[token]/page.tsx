import type { Metadata } from 'next';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { SAJU_CATEGORY_LABEL } from '@/constants/adminLabels';
import SharePageClient from './SharePageClient';

interface Props {
  params: Promise<{ token: string }>;
}

async function fetchRecord(token: string) {
  const { data: saju } = await supabaseAdmin
    .from('saju_records')
    .select('*')
    .eq('share_token', token)
    .maybeSingle();

  if (saju) return { type: 'saju' as const, record: saju };

  const { data: tarot } = await supabaseAdmin
    .from('tarot_records')
    .select('*')
    .eq('share_token', token)
    .maybeSingle();

  if (tarot) return { type: 'tarot' as const, record: tarot };

  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchRecord(token);

  if (!result) {
    return { title: '풀이를 찾을 수 없어요' };
  }

  const label =
    result.type === 'saju'
      ? SAJU_CATEGORY_LABEL[result.record.category] ?? '사주 풀이'
      : '타로 리딩';

  const description =
    result.type === 'saju' && result.record.profile_name
      ? `${result.record.profile_name}님의 ${label} 결과`
      : `${label} 결과를 확인하세요`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.2000-saju.com';

  return {
    title: `${label} — 이천점`,
    description,
    openGraph: {
      title: `${label} — 이천점`,
      description: `우주의 기운으로 풀어낸 ${label}`,
      siteName: '이천점',
      images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630 }],
      type: 'article',
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const result = await fetchRecord(token);

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-[48px] mb-4">🔗</div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          풀이를 찾을 수 없어요
        </h1>
        <p className="text-sm text-text-secondary text-center mb-6">
          삭제되었거나 잘못된 링크일 수 있습니다.
        </p>
        <a
          href="/"
          className="px-6 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold"
        >
          이천점 홈으로
        </a>
      </div>
    );
  }

  return (
    <SharePageClient
      type={result.type}
      record={result.record}
    />
  );
}
