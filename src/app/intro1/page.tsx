'use client';

/**
 * 듀 × 아이비 상생 대화 데모 (/intro1)
 *
 * idle 영상(duvy.mp4) 위에 각 캐릭터 머리 위로 둥근 말풍선이 번갈아 등장(3초 간격).
 * 한 번에 하나씩 — 현재 말하는 쪽만 표시, 다음 줄로 넘어가면 이전 건 사라짐(루프). 상생(수생목) 케미.
 */

import { useEffect, useState } from 'react';
import styles from './intro1.module.css';

type Line = { who: 'dew' | 'ivy'; text: string };

const LINES: Line[] = [
  { who: 'dew', text: '난 계수, 듀야. 이슬처럼 조용히 스며드는 편이지.' },
  { who: 'ivy', text: '난 을목, 아이비. 유연하게 휘감고 자라는 덩굴이야.' },
  { who: 'dew', text: '내 물기가 네 뿌리를 적셔주잖아. 수생목이거든.' },
  { who: 'ivy', text: '응, 네가 적셔주면 난 쭉쭉 자라서 좋아.' },
  { who: 'dew', text: '넌 적응력이 좋아서 변덕스런 나도 잘 받아주더라.' },
  { who: 'ivy', text: '네 섬세함이 딱 필요한 만큼만 주니까 편하고.' },
  { who: 'dew', text: '그래서 우리가 잘 맞는 거야. 물이랑 나무.' },
  { who: 'ivy', text: '맞아. 너랑 있으면 자라는 게 즐거워.' },
];

// 내용 길이에 따라 폰트 크기 자동조절 (원형 말풍선 안에 맞게)
function fontFor(len: number): number {
  if (len <= 10) return 20;
  if (len <= 16) return 18;
  if (len <= 22) return 16.5;
  if (len <= 28) return 15;
  return 13.5;
}

const STEP = 4000; // 말풍선 간격(ms)

type Bubble = { text: string; k: number } | null;

export default function DuvyChatPage() {
  // 각 캐릭터 말풍선은 항상 머리 위에 유지되고, 그 캐릭터가 말할 때 내용이 '교체'됨(사라졌다 생기지 않음).
  const [dew, setDew] = useState<Bubble>(null);
  const [ivy, setIvy] = useState<Bubble>(null);

  useEffect(() => {
    let idx = 0;
    let k = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const line = LINES[idx];
      k += 1;
      if (line.who === 'dew') setDew({ text: line.text, k });
      else setIvy({ text: line.text, k });
      idx = (idx + 1) % LINES.length;
      timer = setTimeout(tick, STEP);
    };

    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="app-auth-shell items-center">
      <div
        className="relative w-full max-w-[430px] overflow-hidden bg-black"
        style={{ aspectRatio: '9 / 16', maxHeight: '100dvh' }}
      >
        {/* idle 영상 배경 */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster="/intro/duvy-poster.webp"
        >
          <source src="/intro/duvy.mp4" type="video/mp4" />
        </video>

        {/* 듀 말풍선 — 왼쪽 머리 위 (항상 유지, 듀가 말하면 내용 교체) */}
        {dew && (
          <div key={dew.k} className="absolute z-10" style={{ left: '3%', bottom: '46%', width: '44%' }}>
            <div className={`${styles.bubble} ${styles.dew} ${styles.pop} p-3`}>
              <p className="break-keep" style={{ fontSize: fontFor(dew.text.length), lineHeight: 1.25 }}>
                {dew.text}
              </p>
            </div>
          </div>
        )}

        {/* 아이비 말풍선 — 오른쪽 머리 위 (항상 유지, 아이비가 말하면 내용 교체) */}
        {ivy && (
          <div key={ivy.k} className="absolute z-10" style={{ right: '3%', bottom: '45%', width: '44%' }}>
            <div className={`${styles.bubble} ${styles.ivy} ${styles.pop} p-3`}>
              <p className="break-keep" style={{ fontSize: fontFor(ivy.text.length), lineHeight: 1.25 }}>
                {ivy.text}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
