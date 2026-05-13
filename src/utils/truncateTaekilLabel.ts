/**
 * 택일 카테고리 라벨 — "기타 — {customLabel}" 형태의 customLabel 부분만 길이 제한.
 * 예: "기타 — 첫데이트를하려는데언제가좋을지" → "기타 — 첫데이트…" (maxCustom=5)
 * 보관함 리스트·게이트 등 좁은 chip 영역에서 UI 일관성 유지를 위해 사용.
 */
export function truncateTaekilLabel(label?: string, maxCustom = 5): string {
  if (!label) return '';
  const m = label.match(/^기타\s*[—-]\s*(.+)$/);
  if (!m) return label;
  const customPart = m[1].trim();
  if (customPart.length <= maxCustom) return label;
  return `기타 — ${customPart.slice(0, maxCustom)}…`;
}
