'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { JUNGTONGSAJU_SECTION_KEYS, JUNGTONGSAJU_SECTION_LABELS } from '@/constants/prompts';
import { parseJungtongsaju, parseAdviceMeta } from '@/services/fortuneService';
import { computeSajuFromProfile } from '@/utils/profileSaju';
import type { BirthProfile } from '@/types/credit';
import { determineGyeokguk } from '@/engine/gyeokguk';
import { stemToHanja, zhiToHanja } from '@/lib/character';
import SajuReport from '@/components/saju/SajuReport';
import { AdviceCard } from '@/components/saju/AdviceCard';
import { renderEmphasizedBody } from '@/utils/renderEmphasizedBody';
import { extractMetaphor } from '@/utils/parseMetaphor';

const ELEMENT_COLORS: Record<string, string> = {
  '목': '#34D399', '화': '#F43F5E', '토': '#F59E0B', '금': '#CBD5E1', '수': '#3B82F6',
};
const ELEMENT_TO_STEMS: Record<string, [string, string]> = {
  '목': ['갑목', '을목'], '화': ['병화', '정화'], '토': ['무토', '기토'],
  '금': ['경금', '신금'], '수': ['임수', '계수'],
};

interface Props {
  record: Record<string, any>;
}

/**
 * 정통사주 결과 블록 — 결과 페이지(SajuResultPage)와 동일한 시각.
 * - DB 의 birth_date/time/gender/calendar_type 으로 SajuResult 재계산
 * - 핵심 요약 카드(일주·격국·용신·신강신약) + SajuReport(만세력 보드) + 9섹션 카드(은유 + 본문 + AdviceCard)
 */
export function SajuTraditionalResultBlock({ record }: Props) {
  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  const sections = parseJungtongsaju(content);
  const adviceMeta = sections.advice ? parseAdviceMeta(sections.advice) : undefined;

  const profile: BirthProfile = {
    id: record.profile_id ?? 'share',
    user_id: '',
    name: record.profile_name ?? '',
    birth_date: record.birth_date,
    birth_time: record.birth_time ?? undefined,
    birth_place: record.birth_place ?? 'seoul',
    gender: record.gender,
    calendar_type: record.calendar_type ?? 'solar',
    is_primary: false,
    created_at: '',
    updated_at: '',
  };
  const result = computeSajuFromProfile(profile);
  if (!result) {
    return (
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[14px] text-text-secondary">사주 데이터를 불러오지 못했어요.</p>
      </div>
    );
  }

  const gyeokguk = determineGyeokguk(result);
  const yongStems = ELEMENT_TO_STEMS[result.yongSinElement];
  const yongColor = ELEMENT_COLORS[result.yongSinElement] ?? 'var(--text-secondary)';
  const dayPillarLabel = `${stemToHanja(result.pillars.day.gan)}${zhiToHanja(result.pillars.day.zhi)}`;
  const dayKor = `${result.pillars.day.gan}${result.pillars.day.zhi}`;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: '일주',
      value: (
        <span>
          <span style={{ fontFamily: 'var(--font-serif)', marginRight: 6 }}>{dayPillarLabel}</span>
          <span className="text-text-tertiary text-[13px]">({dayKor})</span>
        </span>
      ),
    },
    { label: '격국', value: gyeokguk.name },
    {
      label: '용신',
      value: (
        <span>
          <span style={{ color: yongColor, fontWeight: 700 }}>{result.yongSinElement}</span>
          {yongStems && (
            <span className="text-text-tertiary text-[13px]" style={{ marginLeft: 6 }}>
              · {yongStems[0]}·{yongStems[1]}
            </span>
          )}
        </span>
      ),
    },
    { label: '신강신약', value: `${result.strengthStatus} (${result.strengthScore}점)` },
  ];

  return (
    <>
      {/* 시간 미상 안내 */}
      {result.hourUnknown && (
        <div className="mb-3 rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-[14px] text-amber-300 leading-relaxed">
          출생 시간 미상 · 삼주추명(三柱推命) — 연·월·일주 기반으로 분석합니다.
        </div>
      )}

      {/* 핵심 요약 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl px-5 py-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center text-[14px]">
              <span className="w-16 flex-shrink-0 text-text-tertiary">{r.label}</span>
              <span className="text-text-primary font-semibold">{r.value}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* 만세력 보드 — 정통사주 공유는 사주원국 + 천간/지지 관계까지만 노출 (SajuResultPage 와 동일) */}
      <SajuReport result={result} hideAnalysis />

      {/* 9섹션 카드 */}
      <div className="space-y-2 mt-3">
        {JUNGTONGSAJU_SECTION_KEYS.map((key, idx) => {
          const text = sections[key];
          if (!text) return null;
          const isAdvice = key === 'advice';
          // 단순 lines[0] 추출은 [은유] 마커가 그대로 부제목으로 노출되는 사고가 있어
          // 공통 파서로 교체 — SajuResultPage 와 동일 동작 보장.
          const { metaphorTitle, bodyText } = extractMetaphor(text);

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * idx }}
              className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                <div
                  className="text-[17px] font-bold text-text-primary tracking-tight"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {JUNGTONGSAJU_SECTION_LABELS[key]}
                </div>
              </div>
              {metaphorTitle && (
                <div
                  className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {metaphorTitle}
                </div>
              )}
              {isAdvice && adviceMeta ? (
                <AdviceCard yongSinElement={result.yongSinElement} meta={adviceMeta} />
              ) : (
                <p className="text-[17px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]">
                  {renderEmphasizedBody(bodyText)}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
