/**
 * Kakao JavaScript SDK 초기화 및 공유 유틸리티
 *
 * 사용 전 .env.local에 NEXT_PUBLIC_KAKAO_JS_KEY 설정 필요
 * Kakao Developers > 내 애플리케이션 > 앱 키 > JavaScript 키
 */

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: KakaoShareOptions) => void;
      };
    };
  }
}

interface KakaoShareOptions {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttons?: Array<{
    title: string;
    link: { mobileWebUrl: string; webUrl: string };
  }>;
}

let sdkLoaded = false;

function loadKakaoSDK(): Promise<void> {
  if (sdkLoaded && window.Kakao) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.getElementById('kakao-sdk')) {
      sdkLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-sdk';
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    script.integrity = 'sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4lqqLbptI3YR8w2V';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      sdkLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Kakao SDK 로드 실패'));
    document.head.appendChild(script);
  });
}

function initKakao(): boolean {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) {
    console.warn('[Kakao] NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.');
    return false;
  }
  if (!window.Kakao) return false;
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(key);
  }
  return window.Kakao.isInitialized();
}

export async function ensureKakaoReady(): Promise<boolean> {
  try {
    await loadKakaoSDK();
    return initKakao();
  } catch {
    return false;
  }
}

export interface KakaoShareParams {
  title: string;
  description: string;
  shareUrl: string;
  imageUrl?: string;
  buttonLabel?: string;
}

export async function shareToKakao({
  title,
  description,
  shareUrl,
  imageUrl,
  buttonLabel = '결과 보러 가기',
}: KakaoShareParams): Promise<'shared' | 'no-sdk' | 'failed'> {
  const ready = await ensureKakaoReady();
  if (!ready || !window.Kakao) return 'no-sdk';

  try {
    const baseUrl = window.location.origin;
    const ogImage = imageUrl || `${baseUrl}/og-image.png`;

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description,
        imageUrl: ogImage,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
      buttons: [
        {
          title: buttonLabel,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
      ],
    });
    return 'shared';
  } catch {
    return 'failed';
  }
}
