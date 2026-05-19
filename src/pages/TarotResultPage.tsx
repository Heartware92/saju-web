'use client';

/**
 * 타로 결과 페이지 (readonly · 보관함 재생 전용)
 *
 * URL: /tarot/result?recordId=<id>
 *
 * 보관함에서 카드 클릭 시 진입. 모드 라벨 + 뽑은 카드 + AI 풀이를 정적 표시.
 * 라이브 드로잉(/tarot)은 그대로 유지 — 이쪽은 새 풀이만, 결과 보기는 분리.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { tarotDB } from '../services/supabase';
import { parseNumberedSections } from '../services/fortuneService';
import { TAROT_DECK, ELEMENT_COLORS, getCardImg, type TarotCard } from '../engine/tarot/deck';
import { TAROT_SPREAD_LABEL } from '../constants/adminLabels';
import { BackButton } from '../components/ui/BackButton';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { renderEmphasis } from '../utils/renderEmphasis';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';

interface SavedCard {
  card: TarotCard;
  isReversed: boolean;
  position?: string;
}

const MODE_DESC: Record<string, string> = {
  today: '오늘 하루의 흐름을 한 장의 카드로',
  monthly: '한 달의 시작·중반·끝을 세 장으로',
  'monthly-3card': '한 달의 시작·중반·끝을 세 장으로',
  question: '질문에 대한 카드의 답',
  single: '한 장의 카드',
  'hybrid-saju': '사주와 카드가 만난 풀이',
};

function readonlyCard(width: number, c: SavedCard) {
  const color = ELEMENT_COLORS[c.card.element];
  const height = Math.round(width * 1.714);
  return (
    <div style={{ width, flexShrink: 0, textAlign: 'center' }}>
      {c.position && (
        <div className="text-[12px] text-text-tertiary mb-2 font-semibold tracking-wide uppercase">
          {c.position}
        </div>
      )}
      <div
        style={{
          width, height,
          borderRadius: 13,
          overflow: 'hidden',
          border: `2px solid ${color}`,
          boxShadow: `0 4px 22px ${color}35`,
          position: 'relative',
        }}
      >
        <img
          src={getCardImg(c.card)}
          alt={c.card.nameKr}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: c.isReversed ? 'rotate(180deg)' : 'none',
          }}
        />
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-bold"
          style={{
            backgroundColor: c.isReversed ? '#F8717133' : '#34D39933',
            color: c.isReversed ? '#F87171' : '#34D399',
            backdropFilter: 'blur(4px)',
          }}
        >
          {c.isReversed ? '역' : '정'}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[14px] font-semibold text-text-primary">{c.card.nameKr}</div>
        <div className="text-[12px] text-text-tertiary mt-0.5">{c.card.name}</div>
      </div>
    </div>
  );
}

export default function TarotResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams?.get('recordId') ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!loading && !error);
  const [spreadType, setSpreadType] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [interpretation, setInterpretation] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');

  useEffect(() => {
    if (!recordId) {
      setError('보관함 기록 ID 가 없어요.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    tarotDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setError('기록을 찾을 수 없어요.');
          return;
        }
        setSpreadType(record.spread_type || '');
        setQuestion(record.question || '');
        setInterpretation(record.interpretation || '');
        setCreatedAt(record.created_at || '');

        // cards 페이로드 파싱 — 신규 { mode, cards: TarotCardInfo[], card } / 레거시 { card }
        try {
          const c = record.cards as Record<string, unknown> | undefined;
          const arr = (c?.cards ?? (c?.card ? [c.card] : [])) as Array<{
            name?: string; nameKr?: string; isReversed?: boolean; position?: string;
          }>;
          const restored: SavedCard[] = arr
            .map((ci): SavedCard | null => {
              const idx = TAROT_DECK.findIndex((d) => d.name === ci.name || d.nameKr === ci.nameKr);
              if (idx < 0) return null;
              return {
                card: TAROT_DECK[idx],
                isReversed: !!ci.isReversed,
                position: ci.position,
              };
            })
            .filter((x): x is SavedCard => x !== null);
          setCards(restored);
        } catch (e) {
          console.warn('[tarot result] cards parse failed', e);
        }
      })
      .catch((e) => {
        console.error('[tarot result] load failed', e);
        if (!cancelled) setError('기록을 불러오지 못했어요.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  const modeLabel = useMemo(
    () => TAROT_SPREAD_LABEL[spreadType] ?? spreadType ?? '타로 풀이',
    [spreadType]
  );
  const modeDesc = MODE_DESC[spreadType] ?? '';
  const cardWidth = cards.length >= 3 ? 92 : 132;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[15px] text-text-secondary mb-4">{error}</p>
        <button
          onClick={() => router.push('/archive')}
          className="px-4 py-2 rounded-lg bg-cta text-white text-[14px] font-semibold"
        >
          보관함으로
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full px-4 pt-4 pb-10 max-w-[640px] mx-auto"
    >
      {/* 헤더 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton to="/archive" className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}>
            {modeLabel}
          </h1>
          {modeDesc && (
            <p className="text-base text-text-tertiary mt-1">{modeDesc}</p>
          )}
          {createdAt && (
            <p className="text-[11px] text-text-tertiary mt-0.5 opacity-70">
              {new Date(createdAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
      </div>

      {/* 질문 (있으면) */}
      {question && (
        <div className="rounded-xl px-4 py-3 mb-5 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.25)]">
          <div className="text-[11px] text-text-tertiary mb-1 font-semibold uppercase tracking-wider">질문</div>
          <p className="text-[14px] text-text-secondary leading-relaxed">{question}</p>
        </div>
      )}

      {/* 카드 — 정렬: 1장 가운데, 3장 가로 */}
      {cards.length > 0 && (
        <div
          className="flex justify-center items-start gap-3 mb-6 flex-wrap"
        >
          {cards.map((c, i) => (
            <div key={i}>{readonlyCard(cardWidth, c)}</div>
          ))}
        </div>
      )}

      {/* AI 풀이 본문 — 1·2·3… 번호 섹션을 카드로 분리 (다른 운세 결과와 동일 톤) */}
      {interpretation && (() => {
        const sections = parseNumberedSections(interpretation);
        if (sections.length === 0) {
          // 파싱 실패 fallback: 단일 카드
          return (
            <section className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <div
                className="text-[16px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {interpretation.split(/\n\n+/).map((para, pi) => (
                  <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
                ))}
              </div>
            </section>
          );
        }
        return (
          <div className="space-y-3">
            {sections.map((s, idx) => (
              <SectionCollapsible
                key={idx}
                title={s.title}
                defaultOpen={idx === 0}
                enterDelay={0.1 + idx * 0.05}
              >
                <div
                  className="text-[16px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {s.body.split(/\n\n+/).map((para, pi) => (
                    <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
                  ))}
                </div>
              </SectionCollapsible>
            ))}
          </div>
        );
      })()}

      {/* 새로 한 장 더 — 라이브 페이지로 */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => router.push('/tarot')}
          className="px-5 py-2.5 rounded-lg border border-[var(--border-subtle)] text-[13px] text-text-secondary hover:text-text-primary hover:border-cta/40 transition-colors"
        >
          새로 카드 뽑기
        </button>
      </div>

      {recordId && (
        <div className="mt-6">
          <ShareBar recordId={recordId} type="tarot" category={spreadType || 'tarot'} />
        </div>
      )}
    </motion.div>
  );
}
