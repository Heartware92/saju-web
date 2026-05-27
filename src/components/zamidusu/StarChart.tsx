'use client';

/**
 * 자미두수 12궁 별자리 시각화 (SVG)
 *
 * 전통 자미두수 명반은 4x4 그리드에 12궁을 배치하는데, 이 컴포넌트는
 * 그 배치를 **별자리처럼** 보이게 렌더한다:
 *  - 각 궁의 중심을 "별"로 표시
 *  - 명궁은 가장 밝은 별 (자미·태양 느낌)
 *  - 신궁은 두 번째 밝은 별
 *  - 주성이 많을수록 별을 크게
 *  - 궁과 궁 사이를 옅은 선으로 연결해 성좌 느낌
 *  - 12궁 외곽을 둘러싼 별 가루 배경
 *
 * 클릭하면 해당 궁 선택 (onSelect 콜백)
 */

import { motion } from 'framer-motion';
import type { ZamidusuPalace } from '../../engine/zamidusu';
import { PALACE_GRID_POSITIONS } from '../../engine/zamidusu';
import { isValidBrightness, isValidMutagen } from '../../engine/zamidusu/knowledge';

interface StarChartProps {
  palaces: ZamidusuPalace[];
  soul: string;          // 명주 (별 이름)
  fiveElementsClass: string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

// viewBox를 실제 표시 영역에 딱 맞춰 거의 1:1 스케일로 폰트 크게 보이게 — 가독성 최우선
const VIEWBOX = 420;
const CENTER = 210;

// 4x4 그리드에서 각 셀의 중심 좌표
function gridToXY(row: number, col: number): { x: number; y: number } {
  const cellSize = VIEWBOX / 4;
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  };
}

// 별 크기 — 텍스트와 균형 맞춤
function starRadius(palace: ZamidusuPalace): number {
  const base = palace.name === '명궁' ? 11 : palace.isBodyPalace ? 9 : 7;
  const extra = Math.min(palace.majorStars.length * 1, 4);
  return base + extra;
}

// 별 색상 — 궁 유형에 따라
function starColor(palace: ZamidusuPalace): string {
  if (palace.name === '명궁') return '#FBBF24';      // 금빛
  if (palace.isBodyPalace) return '#F472B6';         // 신궁 — 로즈
  if (palace.majorStars.length === 0) return '#6B7280'; // 공궁 — 회색
  // 주성 성격 따라
  const firstStar = palace.majorStars[0]?.name;
  if (['자미', '태양'].includes(firstStar)) return '#FCD34D';
  if (['무곡', '칠살', '파군'].includes(firstStar)) return '#60A5FA';
  if (['태음', '천부', '천상'].includes(firstStar)) return '#C4B5FD';
  if (['염정', '탐랑'].includes(firstStar)) return '#F87171';
  if (['천기', '거문', '천량'].includes(firstStar)) return '#34D399';
  return '#E5E7EB';
}

export function StarChart({ palaces, soul, fiveElementsClass, selectedIndex, onSelect }: StarChartProps) {
  const palaceWithPos = palaces.map(p => {
    const pos = PALACE_GRID_POSITIONS[p.name];
    if (!pos) return null;
    const { x, y } = gridToXY(pos.row, pos.col);
    return { palace: p, x, y };
  }).filter((v): v is { palace: ZamidusuPalace; x: number; y: number } => !!v);

  // 12궁 순환 연결선 (시계 방향 인접궁끼리)
  // 12궁 전통 순서: 명궁 → 부모 → 복덕 → 전택 → 관록 → 노복 → 천이 → 질액 → 재백 → 자녀 → 부처 → 형제 → (명궁)
  const ORDER = ['명궁', '부모궁', '복덕궁', '전택궁', '관록궁', '노복궁', '천이궁', '질액궁', '재백궁', '자녀궁', '부처궁', '형제궁'];
  const ordered = ORDER
    .map(name => palaceWithPos.find(p => p.palace.name === name))
    .filter((v): v is { palace: ZamidusuPalace; x: number; y: number } => !!v);

  // 배경 별가루
  const dust = Array.from({ length: 45 }).map((_, i) => {
    // 결정론적 — 인덱스 기반 의사 랜덤 (hydration 안전)
    const rx = (i * 73.17) % VIEWBOX;
    const ry = (i * 119.31) % VIEWBOX;
    const rs = 0.4 + ((i * 17) % 12) / 10;
    const ro = 0.15 + ((i * 7) % 7) / 20;
    return { x: rx, y: ry, r: rs, o: ro };
  });

  return (
    <div className="relative w-full aspect-square max-w-none mx-auto">
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.15))' }}
      >
        {/* 배경 우주 */}
        <defs>
          <radialGradient id="sky-bg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#0f0a2e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="star-glow">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={VIEWBOX} height={VIEWBOX} fill="url(#sky-bg)" rx="200" />

        {/* 배경 별가루 */}
        {dust.map((d, i) => (
          <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={d.o} />
        ))}

        {/* 별자리 연결선 (명궁 → ... → 형제 → 명궁 순회) */}
        {ordered.length >= 2 && (
          <polygon
            points={ordered.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(196,181,253,0.2)"
            strokeWidth="0.8"
            strokeDasharray="3 4"
          />
        )}

        {/* 중심 원 — 명주·오행국 표기 */}
        <circle cx={CENTER} cy={CENTER} r="64" fill="rgba(20,12,38,0.85)" stroke="rgba(139,92,246,0.35)" strokeWidth="1.5" />
        <text x={CENTER} y={CENTER - 14} textAnchor="middle" fill="#C4B5FD" fontSize="16" fontWeight="600" letterSpacing="2">
          {fiveElementsClass}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" fill="#FBBF24" fontSize="28" fontWeight="700" style={{ fontFamily: 'var(--font-serif)' }}>
          {soul}
        </text>
        <text x={CENTER} y={CENTER + 38} textAnchor="middle" fill="#9CA3AF" fontSize="13" letterSpacing="3">
          명주
        </text>

        {/* 각 궁의 별 */}
        {palaceWithPos.map(({ palace, x, y }) => {
          const r = starRadius(palace);
          const color = starColor(palace);
          const isSelected = selectedIndex === palace.index;
          return (
            <g key={palace.index} style={{ cursor: 'pointer' }} onClick={() => onSelect(palace.index)}>
              {/* 선택 시 반짝 외광 */}
              {isSelected && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r={r + 8}
                  fill="url(#star-glow)"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* 명궁·신궁 외광 */}
              {(palace.name === '명궁' || palace.isBodyPalace) && (
                <circle cx={x} cy={y} r={r + 4} fill={color} opacity="0.15" />
              )}

              {/* 본체 별 (원) */}
              <circle cx={x} cy={y} r={r} fill={color} opacity={palace.majorStars.length === 0 ? 0.35 : 0.9} />

              {/* 별 반짝이 십자 */}
              <line x1={x - r - 3} y1={y} x2={x + r + 3} y2={y} stroke={color} strokeWidth="0.5" opacity="0.6" />
              <line x1={x} y1={y - r - 3} x2={x} y2={y + r + 3} stroke={color} strokeWidth="0.5" opacity="0.6" />

              {/* 궁 이름 */}
              <text
                x={x}
                y={y + r + 18}
                textAnchor="middle"
                fill={isSelected ? '#FBBF24' : '#F3F4F6'}
                fontSize="18"
                fontWeight={palace.name === '명궁' ? '700' : '600'}
              >
                {palace.name}
              </text>

              {/* 간지 */}
              <text
                x={x}
                y={y + r + 35}
                textAnchor="middle"
                fill="#B8B1C8"
                fontSize="13"
                letterSpacing="0.5"
              >
                {palace.heavenlyStem}{palace.earthlyBranch}
              </text>

              {/* 주성 이름 (최대 2개) — 별 이름만 위에, brightness/mutagen은 별 이름 아래 줄로 분리해 겹침 방지 */}
              {palace.majorStars.slice(0, 2).map((s, si) => {
                const hasBrightness = isValidBrightness(s.brightness);
                const hasMutagen = isValidMutagen(s.mutagen);
                // 별 이름 — 위쪽
                const namePosY = y - r - 8 - (si * 26);
                return (
                  <g key={`${palace.index}-s-${si}`}>
                    <text
                      x={x}
                      y={namePosY}
                      textAnchor="middle"
                      fill={hasMutagen ? '#FBBF24' : '#D8BFFD'}
                      fontSize="13"
                      fontWeight="700"
                    >
                      {s.name}
                    </text>
                    {(hasBrightness || hasMutagen) && (
                      <text
                        x={x}
                        y={namePosY + 11}
                        textAnchor="middle"
                        fontSize="9"
                        fillOpacity="0.7"
                      >
                        {hasBrightness && <tspan fill="#B8B1C8">{s.brightness}</tspan>}
                        {hasBrightness && hasMutagen && <tspan fill="#B8B1C8">·</tspan>}
                        {hasMutagen && <tspan fill="#FBBF24" fontWeight="700">{s.mutagen}</tspan>}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* 하단 범례 — 한 번 더 확대 */}
      <div className="mt-4 rounded-xl p-4 bg-[rgba(20,12,38,0.45)] border border-[var(--border-subtle)]">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[16px] text-text-primary">
          <span className="flex items-center gap-2 font-semibold">
            <span className="inline-block w-4 h-4 rounded-full bg-[#FBBF24]" />
            명궁
          </span>
          <span className="flex items-center gap-2 font-semibold">
            <span className="inline-block w-4 h-4 rounded-full bg-[#F472B6]" />
            신궁
          </span>
          <span className="flex items-center gap-2 font-semibold">
            <span className="inline-block w-4 h-4 rounded-full bg-[#6B7280] opacity-60" />
            공궁
          </span>
        </div>
        {/* 묘왕도(廟旺度) 색범례 — 별 강약 7단계 (강 → 약) */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] text-text-tertiary">
          <span><strong className="text-[#FBBF24]">묘</strong>·<strong className="text-[#FBBF24]">왕</strong> 강</span>
          <span className="opacity-70">득·이</span>
          <span className="opacity-50">평</span>
          <span className="opacity-40">불·함 약</span>
        </div>
        <p className="text-[13px] text-text-secondary text-center mt-3">
          별을 눌러 자세히 볼 수 있어요
        </p>
      </div>
    </div>
  );
}
