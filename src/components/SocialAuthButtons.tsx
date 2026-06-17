'use client';

/**
 * 소셜 로그인 버튼 (Google / Kakao).
 *
 * 약관 동의는 AuthCallbackPage 가 user_metadata.terms_agreed_at 을 보고
 * 자동으로 /auth/consent 로 분기하므로, 여기서는 모달을 띄우지 않는다.
 * - 기존 사용자: 동의 메타 존재 → 콜백이 그대로 홈으로 보냄
 * - 신규 OAuth 사용자: 동의 메타 없음 → 콜백이 /auth/consent 로 보냄
 */

import React, { useState, useEffect } from 'react';
import { auth } from '../services/supabase';

interface SocialAuthButtonsProps {
  /** 버튼 위 라벨 텍스트 — 기본: "소셜 계정으로 로그인" */
  label?: string;
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({ label }) => {
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'google' | 'kakao' | null>(null);

  // OAuth 리다이렉트 후 뒤로가기로 돌아오면 페이지가 bfcache 에서 복원되는데,
  // 이때 React 는 재마운트되지 않고 이전 state(pending='google'/'kakao')를 그대로 되살린다.
  // → 두 버튼이 영구 비활성화. 페이지 복원/재가시화 시 pending 을 초기화해 풀어준다.
  useEffect(() => {
    const reset = () => setPending(null);
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) reset(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') reset(); };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // 인앱 브라우저(임베디드 웹뷰) 감지 — 구글은 웹뷰/비표준 브라우저에서 OAuth 를 차단한다.
  //   증상(안드로이드): 계정 선택 후 우리 앱으로 안 돌아오고 Gmail 앱으로 튀거나 로그인 실패.
  //   iOS 는 이 제약이 없어 정상. → 감지되면 외부 브라우저(Chrome)로 열도록 유도한다.
  const [inApp, setInApp] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    setIsAndroid(/Android/i.test(ua));
    const isWebView = /; wv\)/.test(ua) || /\bwv\b/.test(ua);
    const knownInApp = /(KAKAOTALK|Instagram|FB(AN|AV|_IAB)|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Snapchat|TikTok|Twitter)/i.test(ua);
    setInApp(isWebView || knownInApp);
  }, []);

  const openInExternalBrowser = () => {
    const ua = navigator.userAgent || '';
    const raw = window.location.href.replace(/^https?:\/\//, '');
    if (/Android/i.test(ua)) {
      // 안드로이드: 현재 페이지를 Chrome 으로 다시 연다(인앱 웹뷰 탈출). Chrome 미설치 시 무동작.
      window.location.href = `intent://${raw}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const handleClick = async (provider: 'google' | 'kakao') => {
    // 구글 OAuth 는 인앱/웹뷰에서 막혀(계정선택 후 Gmail 로 튐) → 외부 브라우저로 유도.
    if (provider === 'google' && inApp) {
      if (isAndroid) { openInExternalBrowser(); return; }
      setError('인앱 브라우저에서는 구글 로그인이 제한돼요. 우측 상단 메뉴의 "다른 브라우저로 열기"를 이용하거나, 카카오 로그인을 사용해주세요.');
      return;
    }
    setError('');
    setPending(provider);
    try {
      await auth.signInWithProvider(provider);
      // signInWithOAuth 는 브라우저를 OAuth 페이지로 리다이렉트시키므로 이후 코드는 실행되지 않음
    } catch (err) {
      console.error('Social login error:', err);
      setError('소셜 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setPending(null);
    }
  };

  return (
    <>
      <div className="text-center mb-4">
        <span className="text-xs text-text-tertiary">
          {label || '소셜 계정으로 로그인'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-3 text-sm text-status-error mb-3">
          {error}
        </div>
      )}

      {inApp && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-[13px] text-amber-200 mb-3 leading-relaxed">
          인앱 브라우저에서는 <b>구글 로그인이 제한</b>될 수 있어요.{' '}
          {isAndroid ? (
            <button type="button" onClick={openInExternalBrowser} className="underline font-semibold text-amber-100">Chrome으로 열기</button>
          ) : '우측 상단 메뉴에서 "다른 브라우저로 열기"를 눌러주세요.'}
          {' '}또는 카카오 로그인을 이용해주세요.
        </div>
      )}

      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() => handleClick('google')}
          disabled={pending !== null}
          className="w-14 h-14 rounded-full border border-[var(--border-default)] bg-space-elevated/40 flex items-center justify-center transition-all hover:scale-105 hover:border-[var(--border-strong)] hover:bg-space-elevated disabled:opacity-60 disabled:cursor-not-allowed"
          title="구글로 시작하기"
          aria-label="구글로 시작하기"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => handleClick('kakao')}
          disabled={pending !== null}
          className="w-14 h-14 rounded-full bg-[#FEE500] flex items-center justify-center transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#FEE500]/20 disabled:opacity-60 disabled:cursor-not-allowed"
          title="카카오로 시작하기"
          aria-label="카카오로 시작하기"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="#000000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3zm5.907 8.06l1.47-1.424a.472.472 0 0 0-.656-.678l-1.928 1.866V9.282a.472.472 0 0 0-.944 0v2.557a.471.471 0 0 0 0 .222V13.5a.472.472 0 0 0 .944 0v-1.363l.427-.413 1.428 2.033a.472.472 0 1 0 .773-.543l-1.514-2.155zm-2.958 1.924h-1.46V9.297a.472.472 0 0 0-.943 0v4.159c0 .26.21.472.471.472h1.932a.472.472 0 1 0 0-.944zm-5.857-1.092l.696-1.707.638 1.707H9.092zm2.523.488l.002-.016a.469.469 0 0 0-.127-.32l-1.046-2.8a.69.69 0 0 0-.627-.474.696.696 0 0 0-.653.447l-1.661 4.075a.472.472 0 0 0 .874.357l.33-.813h2.07l.299.8a.472.472 0 1 0 .884-.33l-.345-.926zM8.293 9.302a.472.472 0 0 0-.471-.472H4.577a.472.472 0 1 0 0 .944h1.16v3.736a.472.472 0 0 0 .944 0V9.774h1.14c.26 0 .472-.212.472-.472z"/>
          </svg>
        </button>
      </div>
    </>
  );
};
