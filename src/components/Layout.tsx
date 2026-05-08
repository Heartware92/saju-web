'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CreditDisplay } from './ui/CreditDisplay';
import { useCreditStore } from '../store/useCreditStore';
import StarfallBackground from './StarfallBackground';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '홈', icon: 'home' },
  { path: '/sangdamso', label: '상담소', icon: 'chat' },
  { path: '/tarot', label: '타로', icon: 'card' },
  { path: '/archive', label: '보관함', icon: 'archive' },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'var(--cta-primary)' : 'var(--text-tertiary)';
  const size = 22;

  switch (name) {
    case 'home':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
      );
    case 'chat':
      // 상담소 — 달+말풍선 조합 (사주 데이터 기반 채팅)
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8.5 8.5 0 0 1-12.4 7.56L3 21l1.44-4.56A8.5 8.5 0 1 1 21 12Z" />
          <circle cx="9" cy="12" r="0.9" fill={color} stroke="none" />
          <circle cx="12" cy="12" r="0.9" fill={color} stroke="none" />
          <circle cx="15" cy="12" r="0.9" fill={color} stroke="none" />
        </svg>
      );
    case 'card':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <circle cx="12" cy="12" r="3" fill={active ? color : 'none'} />
        </svg>
      );
    case 'archive':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="5" rx="1" />
          <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
          <path d="M10 12h4" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sunBalance, moonBalance } = useCreditStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path) ?? false;
  };

  return (
    <div className="app-shell">
      <div className="app-container">
        {/* 9:16 프레임 안쪽에 별똥별이 떨어지도록 — 바깥은 body 의 듀스크 그라디언트 */}
        <StarfallBackground />

        {/* Top Header Bar */}
        <header className="sticky top-0 z-50 flex items-center justify-between h-12 px-4 bg-[rgba(20,12,38,0.88)] backdrop-blur-xl border-b border-[var(--border-subtle)]">
          {/* Left: 이천점 로고 (홈 링크) — 추후 아이콘으로 교체 */}
          <Link
            href="/"
            className="h-8 flex items-center px-1 rounded-lg transition-opacity hover:opacity-80 active:opacity-60"
            aria-label="이천점 홈으로"
          >
            <span
              className="text-base font-bold bg-gradient-to-r from-[var(--cta-primary)] to-[var(--cta-secondary)] bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              이천점
            </span>
          </Link>

          {/* Center: Credit Display */}
          <CreditDisplay
            sunBalance={sunBalance}
            moonBalance={moonBalance}
            compact
            onClick={() => router.push('/credit')}
          />

          {/* Right: Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-space-elevated transition-colors"
            aria-label="메뉴 열기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </header>

        {/* Side Menu Overlay */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-[59] bg-black/50"
              onClick={() => setMenuOpen(false)}
            />
            <div className="fixed top-0 right-0 w-[280px] h-[100dvh] z-[60] bg-[rgba(20,12,38,0.96)] backdrop-blur-xl border-l border-[var(--border-subtle)] p-6 pt-[calc(24px+env(safe-area-inset-top,0px))] pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl animate-slideInRight overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <span className="text-lg font-bold bg-gradient-to-r from-cta to-[#c9a6ff] bg-clip-text text-transparent">
                  이천점
                </span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-2">
                {[
                  { path: '/credit', label: '크레딧 충전', icon: '💎' },
                  { path: '/mypage', label: '내 정보', icon: '👤' },
                  { path: '/archive', label: '보관함', icon: '📦' },
                ].map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-space-surface transition-colors"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="mt-8 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Link
                    href="/terms"
                    onClick={() => setMenuOpen(false)}
                    className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    이용약관
                  </Link>
                  <span className="text-[11px] text-text-tertiary/40">|</span>
                  <Link
                    href="/privacy"
                    onClick={() => setMenuOpen(false)}
                    className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    개인정보처리방침
                  </Link>
                  <span className="text-[11px] text-text-tertiary/40">|</span>
                  <Link
                    href="/licenses"
                    onClick={() => setMenuOpen(false)}
                    className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    오픈소스 라이선스
                  </Link>
                </div>
                <div className="flex flex-col items-center gap-1 text-[11px] leading-snug text-text-tertiary text-center px-2">
                  <p>(주)하트웨어 · 대표자 허진우</p>
                  <p>사업자등록번호 136-88-03376</p>
                  <p>통신판매업 신고 2026-대구북구-0028</p>
                  <p>대구광역시 북구 동북로 117, 7층 701호</p>
                  <p>고객센터 010-5960-0920</p>
                  <p>이메일 heojinwoo@heartware.co.kr</p>
                  <p className="mt-1">&copy; 2026 이천점</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="relative z-10 flex-1 w-full overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>

        {/* Bottom Tab Bar - always visible */}
        <nav className="app-tab-bar">
          <div className="flex items-center justify-around h-16">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`
                    flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[56px]
                    ${active ? 'text-cta' : 'text-text-tertiary'}
                  `}
                >
                  <div className="relative">
                    <NavIcon name={item.icon} active={active} />
                    {active && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cta shadow-[0_0_6px_var(--cta-primary)]" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
