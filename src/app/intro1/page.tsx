'use client';

/**
 * 듀 × 아이비 상생 대화 데모 (/intro1)
 *
 * idle 영상(duvy.mp4) 위에 각 캐릭터 머리 위로 둥근 말풍선이 번갈아 등장(3초 간격).
 * 4번 주고받으면 비우고 다음 대화로 이어짐(루프). 상생(수생목) 케미.
 */

import { useEffect, useState } from 'react';
import styles from './intro1.module.css';

type Line = { who: 'dew' | 'ivy'; text: string };
type Bubble = { text: string; k: number } | null;

const LINES: Line[] = [
  { who: 'dew', text: '있지, 너 옆에 있으면 자꾸 새잎이 돋더라?' },
  { who: 'ivy', text: '네가 자꾸 적셔주니까 그렇지.' },
  { who: 'dew', text: '물은 원래 나무를 키우는 거니까~' },
  { who: 'ivy', text: '…나쁘진 않네, 너 곁이.' },
  { who: 'ivy', text: '근데 너무 적시진 마. 뿌리 썩어.' },
  { who: 'dew', text: '앗, 미안. 딱 적당히 할게.' },
  { who: 'ivy', text: '그래, 그 정도가 딱 좋아.' },
  { who: 'dew', text: '거봐, 우리 은근 잘 맞지?' },
];

const GROUP = 4; // 4번 주고받으면 비움
const STEP = 3000; // 말풍선 간격(ms)
const HOLD = 1800; // 다 찼을 때 유지(ms)
const CLEAR_PAUSE = 700;

export default function DuvyChatPage() {
  const [dew, setDew] = useState<Bubble>(null);
  const [ivy, setIvy] = useState<Bubble>(null);

  useEffect(() => {
    let idx = 0;
    let inGroup = 0;
    let k = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const line = LINES[idx];
      k += 1;
      if (line.who === 'dew') setDew({ text: line.text, k });
      else setIvy({ text: line.text, k });
      idx = (idx + 1) % LINES.length;
      inGroup += 1;

      if (inGroup >= GROUP) {
        timer = setTimeout(() => {
          setDew(null);
          setIvy(null);
          inGroup = 0;
          timer = setTimeout(tick, CLEAR_PAUSE);
        }, HOLD);
      } else {
        timer = setTimeout(tick, STEP);
      }
    };

    timer = setTimeout(tick, 500);
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

        {/* 듀 말풍선 — 듀(왼쪽) 머리 위 */}
        {dew && (
          <div key={dew.k} className="absolute z-10 flex justify-center" style={{ left: '3%', bottom: '44%', width: '46%' }}>
            <div className={`${styles.bubble} ${styles.dew} ${styles.pop} px-3.5 py-2.5`} style={{ maxWidth: '100%' }}>
              <p className="break-keep text-center text-[13.5px] leading-snug">{dew.text}</p>
            </div>
          </div>
        )}

        {/* 아이비 말풍선 — 아이비(오른쪽) 머리 위 */}
        {ivy && (
          <div key={ivy.k} className="absolute z-10 flex justify-center" style={{ right: '3%', bottom: '43%', width: '46%' }}>
            <div className={`${styles.bubble} ${styles.ivy} ${styles.pop} px-3.5 py-2.5`} style={{ maxWidth: '100%' }}>
              <p className="break-keep text-center text-[13.5px] leading-snug">{ivy.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
