'use client';

/**
 * 듀 × 아이비 상생 티키타카 채팅 데모 (/intro1)
 *
 * idle 영상(duvy.mp4) 위에 말풍선이 번갈아 하나씩 등장 → 4개 쌓이면 모두 사라지고
 * 다음 대화로 이어짐(무한 루프). 상생(수생목): 물(듀)이 덩굴(아이비)을 살려주는 케미.
 */

import { useEffect, useState } from 'react';
import styles from './intro1.module.css';

type Line = { who: 'dew' | 'ivy'; text: string };

// 상생(수생목) 대화 — 8줄(4개씩 두 묶음), 루프
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

const GROUP = 4; // 4개 쌓이면 비움
const STEP = 2000; // 말풍선 간격(ms)
const HOLD = 1600; // 4개 다 찼을 때 유지(ms)
const CLEAR_PAUSE = 700; // 비운 뒤 다음 묶음까지(ms)

export default function DuvyChatPage() {
  const [shown, setShown] = useState<number[]>([]);

  useEffect(() => {
    let idx = 0; // 다음에 보여줄 줄
    let inGroup = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const cur = idx;
      setShown((s) => [...s, cur]);
      idx = (idx + 1) % LINES.length;
      inGroup += 1;

      if (inGroup >= GROUP) {
        timer = setTimeout(() => {
          setShown([]);
          inGroup = 0;
          timer = setTimeout(tick, CLEAR_PAUSE);
        }, HOLD);
      } else {
        timer = setTimeout(tick, STEP);
      }
    };

    timer = setTimeout(tick, 600);
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

        {/* 채팅 말풍선 스택 — 상단(캐릭터 위 여백) */}
        <div className="absolute left-4 right-4 top-[5%] z-10 flex flex-col gap-2">
          {shown.map((lineIdx, i) => {
            const line = LINES[lineIdx];
            const isDew = line.who === 'dew';
            return (
              <div
                key={`${i}-${lineIdx}`}
                className={`${styles.fadeUp} ${isDew ? 'self-start' : 'self-end'}`}
                style={{ maxWidth: '72%' }}
              >
                <div className={`${styles.bubble} ${isDew ? styles.dew : styles.ivy} px-3.5 py-2.5`}>
                  <p className="break-keep text-[13.5px] leading-snug">{line.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 라벨 — 상생 */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          <span className="rounded-full bg-[rgba(12,7,26,0.6)] px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
            수생목 · 잘 맞는 한 쌍 ✦
          </span>
        </div>
      </div>
    </div>
  );
}
