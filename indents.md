# 텍스트 줄바꿈 & 들여쓰기 정책

이 문서는 자미두수·정통사주 등 결과 페이지에서 텍스트 줄바꿈을 어떻게 처리할지에 대한 **확정된 정책**을 모은다.
같은 지적을 여러 차례 받은 이슈라 한 곳에 못 박아둔다.

---

## 1. 한국어 줄바꿈 정책 (핵심 결정)

### 1-1. 결론

> **단어 중간에서 줄바꿈이 일어나도 OK. 한 줄 가득 채우는 게 우선.**

- CSS `word-break`는 **기본값(normal)** 유지
- `word-break: keep-all` 사용 **금지** (특수 라벨 예외만)
- `overflow-wrap: break-word` 또는 `anywhere` 추가는 허용 (영문/긴 토큰 안전망)

### 1-2. 이유 (Why)

`word-break: keep-all`을 적용하면 한국어 단어를 **통째로** 다음 줄로 보낸다.
한 줄에 단어 하나가 안 들어가면 그 단어를 통째로 다음 줄로 보내며,
**한 줄 끝에 공백이 남아 우측이 비어 보임**.

좁은 카드/모바일 화면에서 우측 여백이 시각적으로 어색해진다.

| 비교 | 결과 |
|------|------|
| `keep-all` (금지) | `[원로의 지혜와         ]` `[청렴함이 숨겨진…]` |
| 기본값 (권장) | `[원로의 지혜와 청]` `[렴함이 숨겨진…]` |

사용자 결정 (2026-05-28):
> "원로의 지혜와 청렴함이 숨겨진 이렇게 줄바꿈 해도 된다는 소리야"
> "단어 중간에 줄바꿈이 이뤄져도 상관없어"

### 1-3. 예외 — `keep-all` 유지가 맞는 곳

| 케이스 | 예시 | 이유 |
|--------|------|------|
| 짧은 라벨(2~4글자) | "복덕궁", "관록궁" | 단어 중간 깨지면 식별 불가 |
| 차트 축 라벨 | `DaehanTimeline` 라벨 | 한 줄로만 표시되어야 정렬됨 |
| `whiteSpace: nowrap` 과 짝 | 칩/배지 안 텍스트 | 그래픽 무결성 보호 |

→ 본문 텍스트(2문장 이상)에는 절대 적용하지 말 것.

### 1-4. 적용 범위

- **자미두수 결과 페이지** (ZamidusuResultPage.tsx) — 본문 전체
- **정통사주 결과 페이지** — 본문 전체
- **신년운세·꿈해몽·이름풀이 등 모든 결과 페이지** — 본문 전체
- **공통 컴포넌트** (CharacterCard, HoroscopeTimeline, MutagenCards, CorePalaceScores 등) — 본문 텍스트
- **모달·툴팁** — 본문 텍스트

---

## 2. 자주 잘못 적용되는 위치 (체크리스트)

새 컴포넌트 추가 시 아래를 점검:

- [ ] `style={{ wordBreak: 'keep-all' }}` 인라인 추가하지 않았는가
- [ ] `className="break-keep"` Tailwind 클래스 추가하지 않았는가
- [ ] 페이지 최상위에 `wordBreak: 'keep-all'` 적용해서 자식들이 상속받는 구조 만들지 않았는가
- [ ] 스타일 토큰(ZV.sub 같은 객체)에 `wordBreak` 포함되지 않았는가
- [ ] CSS 모듈(`.module.css`)에 `word-break: keep-all` 선언되지 않았는가

### 적용 예 (OK)

```tsx
// 본문 텍스트 — 줄바꿈 제약 없음
<p className="text-sm text-text-secondary leading-[1.65]">
  {longKoreanText}
</p>
```

```tsx
// 짧은 라벨 — keep-all 유지 (예외)
<div style={{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>
  {palaceName}  {/* "복덕궁" 같은 3글자 */}
</div>
```

### 잘못된 예 (NG)

```tsx
// 본문에 keep-all — 우측 여백 발생
<p className="text-sm" style={{ wordBreak: 'keep-all' }}>
  {longKoreanText}  ← 단어가 안 들어가면 다음 줄로 통째로
</p>
```

```tsx
// 최상위 wrapper에 적용 — 모든 자식에 상속 (전역 영향)
<div className={styles.container} style={{ wordBreak: 'keep-all' }}>
  {/* 자식들 모두 우측 여백 발생 */}
</div>
```

---

## 3. AI 풀이 본문 줄바꿈은 별도 관리

AI 풀이 본문(prompts.ts에서 생성)은 마크다운/평문이고,
CSS `word-break`로 제어되는 게 아니라 **문자열 자체에 줄바꿈이 들어감**.

`prompts.ts`의 풀이 본문 규칙 (이미 적용됨):
- 단락 사이 빈 줄 한 줄 (연속 줄바꿈 두 번)
- 한 단락 2~4문장
- 자동 줄바꿈은 CSS 줄바꿈 규칙(normal)이 처리

→ 정책 1번은 **렌더링 시 한 단락 안에서의 줄바꿈**에 적용.

---

## 4. 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-05-28 | 정책 확정. 이전 일괄 `keep-all` 적용을 모두 해제. RadarChart 등 차트 여백도 함께 축소 (commit 48d3b2b) |
| 2026-05-28 | 일시적으로 `keep-all` 전면 적용했다가 같은 날 reverse — 우측 여백 문제로 사용자 반복 지적 (commit 1b04473 → 48d3b2b) |

---

## 5. 들여쓰기 정책 (보조)

- TypeScript/TSX: 2 space (Prettier 기본)
- 한 줄 길이: 100자 권장, 절대 한계 120자
- JSX 속성: 3개 이상이면 줄바꿈
- 함수 인자: 4개 이상이면 줄바꿈

(자세한 코드 스타일은 .prettierrc·eslint 설정 따름)
