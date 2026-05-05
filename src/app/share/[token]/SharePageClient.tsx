'use client';

import { motion } from 'framer-motion';
import { SAJU_CATEGORY_LABEL } from '@/constants/adminLabels';
import {
  JUNGTONGSAJU_SECTION_KEYS, JUNGTONGSAJU_SECTION_LABELS,
  NEWYEAR_SECTION_KEYS, NEWYEAR_SECTION_LABELS,
  TODAY_SECTION_KEYS, TODAY_SECTION_LABELS,
  PICKED_DATE_SECTION_KEYS, PICKED_DATE_SECTION_LABELS,
  ZAMIDUSU_SECTION_KEYS, ZAMIDUSU_SECTION_LABELS,
  TOJEONG_SECTION_KEYS, TOJEONG_SECTION_LABELS,
} from '@/constants/prompts';
import {
  parseJungtongsaju, parseNewyearReport, parseTodayFortune,
  parsePickedDateReport, parseZamidusuSections, parseTojeongSections,
} from '@/services/fortuneService';
import { parseGunghapHeader } from '@/lib/gunghap';
import { GunghapResultBlock } from '@/components/gunghap/GunghapResultBlock';

interface Props {
  type: 'saju' | 'tarot';
  record: Record<string, any>;
}

type SectionConfig = {
  keys: readonly string[];
  labels: Record<string, string>;
  parser: (raw: string) => Partial<Record<string, string>>;
};

const SECTION_MAP: Record<string, SectionConfig> = {
  traditional: { keys: JUNGTONGSAJU_SECTION_KEYS, labels: JUNGTONGSAJU_SECTION_LABELS, parser: parseJungtongsaju },
  newyear:     { keys: NEWYEAR_SECTION_KEYS,      labels: NEWYEAR_SECTION_LABELS,      parser: parseNewyearReport },
  today:       { keys: TODAY_SECTION_KEYS,         labels: TODAY_SECTION_LABELS,         parser: parseTodayFortune },
  date:        { keys: PICKED_DATE_SECTION_KEYS,   labels: PICKED_DATE_SECTION_LABELS,  parser: parsePickedDateReport },
  zamidusu:    { keys: ZAMIDUSU_SECTION_KEYS,      labels: ZAMIDUSU_SECTION_LABELS,      parser: parseZamidusuSections },
  tojeong:     { keys: TOJEONG_SECTION_KEYS,       labels: TOJEONG_SECTION_LABELS,       parser: parseTojeongSections as (raw: string) => Partial<Record<string, string>> },
};

/**
 * ▶ 섹션 마커 기반 범용 파서 — 궁합·택일·기간운세·더많은운세 등
 * [tag] 블록을 제거하고 ▶ 마커로 섹션을 분리합니다.
 */
function universalSectionParser(raw: string): { sections: { title: string; body: string }[] } {
  let cleaned = raw
    .replace(/\[gunghap_header\][\s\S]*?\[\/gunghap_header\]/g, '')
    .replace(/\[gunghap_scores\][\s\S]*?\[\/gunghap_scores\]/g, '')
    .replace(/\[tojeong_scores\][\s\S]*?\[\/tojeong_scores\]/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  const parts: { title: string; body: string }[] = [];
  const lines = cleaned.split('\n');
  let currentTitle = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('▶')) {
      if (currentTitle || currentBody.length > 0) {
        parts.push({ title: currentTitle, body: currentBody.join('\n').trim() });
      }
      currentTitle = trimmed.replace(/^▶\s*/, '').replace(/\s*\(.*?\)\s*$/, '');
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentTitle || currentBody.length > 0) {
    parts.push({ title: currentTitle, body: currentBody.join('\n').trim() });
  }

  return { sections: parts.filter(p => p.body.length > 0) };
}

export default function SharePageClient({ type, record }: Props) {
  const category: string = type === 'saju' ? record.category : 'tarot';
  const label = type === 'saju'
    ? SAJU_CATEGORY_LABEL[category] ?? '사주 풀이'
    : '타로 리딩';

  const content = record.interpretation_detailed || record.interpretation_basic || record.interpretation || '';

  // 궁합: 점수 원·레이더 차트·점수 바를 본문 위에 그대로 렌더 (결과 페이지와 동일)
  const isGunghap = type === 'saju' && category === 'gunghap';
  const gunghapHeader = isGunghap ? parseGunghapHeader(content) : null;
  // 궁합 본문은 헤더/스코어 블록을 제거한 body 만 섹션 파서에 넘긴다
  const bodyForSections = gunghapHeader ? gunghapHeader.body : content;

  const config = SECTION_MAP[category];
  const useUniversal = !config;
  const universalResult = useUniversal ? universalSectionParser(bodyForSections) : null;

  const sections = config ? config.parser(bodyForSections) : {};
  const sectionKeys = config ? config.keys : [];
  const sectionLabels = config ? config.labels : {};

  const profileName = record.profile_name;
  const birthDate = record.birth_date;
  const createdAt = record.created_at;

  return (
    <div className="min-h-screen px-4 pt-4 pb-12 max-w-lg mx-auto">
      {/* 브랜드 헤더 */}
      <div className="text-center mb-6">
        <a href="/" className="inline-block">
          <h1
            className="text-lg font-bold bg-gradient-to-r from-sun-core via-cta to-moon-halo bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            이천점
          </h1>
        </a>
      </div>

      {/* 카테고리 + 프로필 정보 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div
          className="text-[18px] font-bold text-text-primary mb-1"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {label}
        </div>
        <div className="text-[13px] text-text-tertiary space-x-2">
          {profileName && <span>{profileName}</span>}
          {birthDate && <span>{birthDate.replace(/-/g, '.')}</span>}
          {record.partner_name && (
            <span>
              {'& '}{record.partner_name}
              {record.partner_birth_date && ` (${record.partner_birth_date.replace(/-/g, '.')})`}
            </span>
          )}
        </div>
        {createdAt && (
          <div className="text-[12px] text-text-tertiary mt-1">
            {new Date(createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </motion.div>

      {/* 궁합 점수·레이더 차트 — 결과 페이지와 동일한 시각 블록 */}
      {isGunghap && gunghapHeader && gunghapHeader.score != null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <GunghapResultBlock
            title={gunghapHeader.title}
            score={gunghapHeader.score}
            domainScores={gunghapHeader.domainScores}
          />
        </motion.div>
      )}

      {/* 타로 질문 */}
      {type === 'tarot' && record.question && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-5 py-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[13px] text-text-tertiary mb-1">질문</div>
          <div className="text-[15px] text-text-secondary">{record.question}</div>
        </motion.div>
      )}

      {/* 섹션 카드 — 전용 파서가 있는 카테고리 */}
      {!useUniversal && (
        <div className="space-y-2">
          {(sectionKeys as readonly string[]).map((key, idx) => {
            const text = sections[key as string];
            if (!text) return null;

            const sLabel = (sectionLabels as Record<string, string>)[key as string] ?? '';
            return (
              <SectionCard key={key} label={sLabel} text={text} idx={idx} />
            );
          })}
        </div>
      )}

      {/* 섹션 카드 — 범용 파서 (궁합·택일·기간운세 등) */}
      {useUniversal && universalResult && (
        <div className="space-y-2">
          {universalResult.sections.map((sec, idx) => (
            <SectionCard key={idx} label={sec.title} text={sec.body} idx={idx} />
          ))}
        </div>
      )}

      {/* CTA 배너 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] shadow-lg shadow-cta/20"
        >
          나도 운세 보러 가기
        </a>
        <p className="text-[12px] text-text-tertiary mt-2">
          이천점 — 별빛이 읽어주는 사주
        </p>
      </motion.div>
    </div>
  );
}

function SectionCard({ label, text, idx }: { label: string; text: string; idx: number }) {
  const lines = text.trim().split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const hasMetaphor =
    lines.length > 1 &&
    firstLine.length > 0 &&
    firstLine.length <= 40 &&
    !firstLine.endsWith('.');
  const metaphorTitle = hasMetaphor ? firstLine : '';
  const bodyText = hasMetaphor ? lines.slice(1).join('\n').trim() : text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.07 * idx }}
      className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
    >
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <div
            className="text-[17px] font-bold text-text-primary tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {label}
          </div>
        </div>
      )}

      {metaphorTitle && (
        <div
          className="text-[15px] font-medium leading-snug text-cta/90 mb-4 pl-3"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {metaphorTitle}
        </div>
      )}

      <div className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
        {bodyText.split(/\n\n+/).map((para, pi) => (
          <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
        ))}
      </div>
    </motion.div>
  );
}
