/**
 * POST /api/gunghap/classify-relation
 *
 * 궁합 "직접 입력" 자유 텍스트를 1차로 분류한다.
 * 키워드 매칭(resolveCustomCategory)의 오분류를 대체 — 예: "섹스파트너"의
 * '파트너'가 business 로 잘못 잡히던 문제를 LLM 의미 판단으로 해결.
 *
 * Body: { label: string }
 * Response: { valid, category, normalizedLabel, nuance }  (RelationClassification)
 * 실패 시 502 — 클라이언트는 키워드 매칭으로 폴백.
 */

import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai/aiClients';
import {
  buildRelationClassifyPrompt,
  type RelationClassification,
} from '@/constants/prompts';

const MAX_LABEL_LEN = 40;

function parseClassification(raw: string, label: string): RelationClassification | null {
  // jsonMode 응답이지만 코드펜스·잡텍스트 방어
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return null;
  }

  const valid = obj.valid === true;

  const normalizedLabel =
    typeof obj.normalizedLabel === 'string' && obj.normalizedLabel.trim()
      ? obj.normalizedLabel.trim().slice(0, 16)
      : label;
  const nuance = typeof obj.nuance === 'string' ? obj.nuance.trim().slice(0, 120) : '';

  // 분류기가 짠 ordered sections (9~12개) — 공통/특수 구분 없이 흐름 그대로 사용.
  // 필수 슬롯 누락 시 보강해 본 풀이가 빈약해지지 않게 안전망.
  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  let sections = rawSections
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 40))
    .slice(0, 14);

  // 필수 슬롯 보강 — 분류기가 빠뜨려도 본 풀이 골격이 무너지지 않게 폴백
  const REQUIRED = ['핵심 요약', '오행 상보 관계', '서로의 속마음'] as const;
  for (const req of REQUIRED) {
    if (!sections.includes(req)) {
      // 핵심 요약은 첫 자리, 나머지는 중간에 끼움
      if (req === '핵심 요약') sections.unshift(req);
      else sections.splice(Math.floor(sections.length / 2), 0, req);
    }
  }

  // sections 가 완전히 비었으면 (분류기 응답 망가짐) 최소 골격으로
  if (sections.length === 0) {
    sections = [
      '핵심 요약',
      '오행 상보 관계',
      '마음의 결속·깊이',
      '갈등·마찰 포인트',
      '서로의 속마음',
      '개운법·처방',
      '이 관계의 미래·전망',
    ];
  }

  return { valid, normalizedLabel, nuance, sections };
}

export async function POST(req: NextRequest) {
  let label = '';
  try {
    const body = await req.json();
    label = typeof body?.label === 'string' ? body.label.trim() : '';
  } catch {
    /* ignore — 아래 빈 라벨 처리 */
  }

  if (!label) {
    return NextResponse.json({ error: 'EMPTY_LABEL' }, { status: 400 });
  }
  if (label.length > MAX_LABEL_LEN) {
    return NextResponse.json({ error: 'LABEL_TOO_LONG' }, { status: 400 });
  }

  try {
    const result = await callAI(buildRelationClassifyPrompt(label), 512, {
      systemPrompt:
        '당신은 관계 분류기입니다. 반드시 지정된 JSON 형식의 객체 하나로만 응답합니다.',
      temperature: 0,
      jsonMode: true,
    });

    const parsed = parseClassification(result.content, label);
    if (!parsed) {
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 502 });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI_FAILED';
    console.error('[classify-relation] 실패:', msg);
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 });
  }
}
