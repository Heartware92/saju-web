'use client';

/**
 * 듀 × 아이비 상생 대화 데모 (/intro1)
 *
 * 숨쉬기/눈깜빡임 idle 영상(duvy.mp4) 위에 CSS 말풍선으로 대화.
 * 상생(수생목): 물(듀)이 덩굴(아이비)을 살려주는 케미.
 *
 * 영상: <video autoplay loop muted playsinline poster>. 정적 포스터로 로딩 폴백.
 */

import styles from './intro1.module.css';

export default function DuvyChatPage() {
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

        {/* 듀 말풍선 — 상단 좌측, 꼬리 아래(듀 쪽) */}
        <div
          className={`absolute z-10 ${styles.bubble} ${styles.tailL} ${styles.fadeUp} px-4 py-3`}
          style={{ top: '8%', left: '5%', maxWidth: '56%', animationDelay: '0.4s' }}
        >
          <p className="break-keep text-[14px] leading-snug">있지, 너 옆에 있으면 자꾸 새잎이 돋더라?</p>
        </div>

        {/* 아이비 말풍선 — 그 아래 우측, 꼬리 아래(아이비 쪽) */}
        <div
          className={`absolute z-10 ${styles.bubble} ${styles.tailR} ${styles.fadeUp} px-4 py-3`}
          style={{ top: '25%', right: '5%', maxWidth: '56%', animationDelay: '1.6s' }}
        >
          <p className="break-keep text-[14px] leading-snug">네가 자꾸 적셔주니까 그렇지. …나쁘진 않네.</p>
        </div>

        {/* 하단 라벨 — 상생 */}
        <div
          className={`absolute bottom-6 left-1/2 z-10 -translate-x-1/2 ${styles.fadeUp}`}
          style={{ animationDelay: '2.8s' }}
        >
          <span className="rounded-full bg-[rgba(12,7,26,0.6)] px-4 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
            수생목 · 잘 맞는 한 쌍 ✦
          </span>
        </div>
      </div>
    </div>
  );
}
