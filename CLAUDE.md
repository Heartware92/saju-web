# 사주명리 시스템 개발 - Phase 1 진행 상황

## 프로젝트 개요
- **목적**: 자평명리학 기반 사주팔자 분석 시스템
- **기술 스택**: Next.js 16 + TypeScript + Tailwind 4 + Supabase
- **경로**: `/Users/hjw/Desktop/Real_Project/saju-project/saju-web`

## 인프라 규칙 — 함수 리전 (반드시 준수)
- **모든 함수는 Seoul(icn1)에서 실행한다.** Supabase가 Seoul이라 리전이 다르면 호출마다 태평양 왕복으로 레이턴시가 폭증한다.
- `vercel.json`의 `"regions": ["icn1"]`를 **절대 제거하지 말 것.**
- 새 **edge 라우트**(`export const runtime = 'edge'`)는 반드시 `export const preferredRegion = 'icn1'`를 추가한다 (edge는 vercel.json의 regions가 적용되지 않음).
- 배포 후 `vercel inspect <url> | grep iad1` 로 미국 리전 잔존 함수가 없는지 확인.
- 경위: `incidents.md` 2026-06-03 entry 참고.

## 완료된 작업 (Phase 1: 만세력 계산 엔진)

### 1. 프로젝트 생성 ✅
```bash
npx create-next-app@latest saju-web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 2. 패키지 설치 ✅
```bash
npm install @supabase/supabase-js zod lunar-javascript date-fns framer-motion zustand lucide-react
```

### 3. 생성된 파일 구조 ✅
```
src/
├── types/
│   └── saju.ts                    # 타입 정의 (Manseryeok, UserInput 등)
├── lib/
│   ├── data/
│   │   ├── gapja.ts               # 60갑자 데이터
│   │   ├── constants.ts           # 천간/지지/오행/오호전환/오서전환
│   │   ├── locations.ts           # 지역 경도 데이터 (시간 보정용)
│   │   ├── jeolip.ts              # 절입일 데이터 (1992, 2024-2027년)
│   │   └── daylight-saving.ts     # 썸머타임 데이터
│   └── saju/
│       └── manseryeok/
│           ├── index.ts           # 모듈 내보내기
│           ├── calculate.ts       # 메인 계산 함수
│           ├── validators.ts      # 입력 검증
│           ├── time-adjustment.ts # 시간 보정 (경도/썸머타임)
│           ├── lunar-converter.ts # 음력-양력 변환
│           └── calculators/
│               ├── year-pillar.ts # 연주 계산
│               ├── month-pillar.ts # 월주 계산 (절입일 체크)
│               ├── day-pillar.ts  # 일주 계산
│               └── hour-pillar.ts # 시주 계산 (오서전환)
└── app/
    ├── globals.css                # Tailwind + 디자인 시스템
    └── api/
        └── manseryeok/
            └── calculate/
                └── route.ts       # POST /api/manseryeok/calculate
```

### 4. 핵심 알고리즘 구현 ✅
- **입력 검증**: 날짜/시간/성별/역법 검증
- **시간 보정**: 경도 보정 + 썸머타임 보정
- **음력 변환**: lunar-javascript 활용
- **연주 계산**: 1900년 기준 60갑자 순환 + 입춘 체크
- **월주 계산**: 절입일 기준 + 오호전환
- **일주 계산**: 2000-01-01 기준 60갑자 순환
- **시주 계산**: 시진 변환 + 오서전환

### 5. API 엔드포인트 ✅
```
POST /api/manseryeok/calculate
{
  "birthDate": "1992-09-14",
  "birthTime": "13:22",
  "birthPlace": "서울",
  "gender": "남",
  "calendarType": "양력"
}

응답:
{
  "success": true,
  "data": {
    "manseryeok": {
      "year": { "gan": "임", "ji": "신" },
      "month": { "gan": "기", "ji": "유" },
      "day": { "gan": "계", "ji": "사" },
      "hour": { "gan": "기", "ji": "미" }
    },
    "formatted": { ... },
    "meta": { ... }
  }
}
```

## 다음 단계
1. **빌드 테스트**: `npm run build`
2. **API 테스트**: `npm run dev` 후 API 호출 테스트
3. **Phase 2**: 오행 분석 엔진 구현

## 테스트 케이스
```
입력: 1992-09-14 13:22, 서울, 남자, 양력
기대 결과: 壬申(연) 己酉(월) 癸巳(일) 戊午(시)
# 경도 보정 적용: 13:22 - 32분(서울) = 12:50 → 오시(午時)
```

## 디자인 시스템 (기존 saju-web에서 마이그레이션)
- Primary: #8B4513 (조선 전통색)
- Secondary: #F5E6D3 (한지색)
- 오행 색상: 목(#2D8659), 화(#E63946), 토(#F4A261), 금(#CBD5E1), 수(#264653)
- 폰트: Gowun Batang, Noto Sans KR

## 참고
- 기존 saju-web 프로젝트: `/Users/hjw/Desktop/Real_Project/saju-project/saju-web-legacy`
- Supabase 연동은 새 프로젝트로 재설정

---

## 세션 기록 규칙

사용자가 "세션 종료 기록해줘", "세션 끝", "기록해줘" 등을 말하면 아래 규칙에 따라 `work-log.md` 파일을 업데이트한다.

### 기록 위치
- 파일: `/Users/hjw/.claude/projects/-Users-hjw-Desktop-Real-Project-saju-project/memory/work-log.md`
- 새 기록은 항상 파일 상단(기존 기록 위)에 추가한다 (최신순 정렬)

### 기록 형식

```
## YYYY-MM-DD (요일) HH:MM 종료

### 완료된 작업
- 각 작업을 번호 매겨서 굵은 제목으로 구분
- 무엇을 왜 변경했는지 한 줄 요약
- 새로 생성한 파일 목록 (경로 포함)
- 수정한 파일 목록 (경로 포함)
- 삭제한 파일이 있으면 명시

### 커밋 내역
- 해시값 커밋 메시지 (이번 세션에서 만든 모든 커밋)

### 주요 의사결정
- 이번 세션에서 사용자와 합의한 기술적/디자인적 결정 사항
- 선택한 방향과 그 이유
- 포기하거나 롤백한 접근법이 있으면 기록

### 발견된 이슈 / 알게 된 것
- 디버깅 중 발견한 문제와 해결 방법
- 외부 서비스 설정 관련 확인 사항
- 다음 세션에서 주의해야 할 사항

### 현재 프로젝트 상태
- 동작하는 기능 요약
- 빌드 상태 (성공/실패)
- 배포 상태 (푸쉬 여부, Vercel 배포 확인 여부)

### 남은 작업 / 다음에 이어할 것
- 우선순위 순으로 정리
- 외부 의존성이 있는 것은 명시
- 사용자가 직접 해야 하는 것과 개발로 해결할 것 구분
```

### 기록 시 주의사항
1. **시간은 현재 시각 기준으로 정확히 기입**
2. **커밋 해시는 실제 git log에서 확인**하여 기록 (추측하지 않음)
3. **파일 경로는 src/부터 시작하는 상대 경로**로 기록
4. **이전 세션의 "남은 작업"에서 완료된 것은 이번 세션의 "완료된 작업"으로 이동**
5. **코드 변경 없이 논의만 한 내용도 "주요 의사결정"에 기록**
6. **빌드 실패 상태로 세션 종료 시 반드시 명시**
7. **푸쉬하지 않은 커밋이 있으면 명시** ("로컬에만 있음, 푸쉬 필요")
8. 기록 완료 후 사용자에게 "세션 종료 기록 완료했습니다" 한 줄로 알림

### 세션 시작 시
1. work-log.md 최상단 기록 읽기
2. "남은 작업"에서 오늘 할 것 확인
3. 빌드 실패 상태였으면 먼저 해결
