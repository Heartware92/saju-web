/**
 * 어드민 전용 ErrorBoundary —
 * 하얀 화면 대신 실제 에러 메시지와 스택을 보여주어 디버깅을 돕는다.
 * 프로덕션 어드민은 관리자만 접속하므로 스택 노출 허용.
 */
'use client';

import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: string | null }

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ error, info: info.componentStack ?? null });
    // Vercel Functions 로그로도 보냄
    if (typeof console !== 'undefined') {
      console.error('[AdminErrorBoundary]', error, info);
    }
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#0a0614] text-text-primary p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
            <h1 className="text-[18px] font-bold text-red-300 mb-2">어드민 렌더 오류</h1>
            <p className="text-[14px] text-text-secondary mb-3">
              페이지를 렌더링하는 중 예외가 발생했습니다. 아래 메시지를 확인하고 개발팀에 전달하세요.
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-[12px] text-text-tertiary uppercase tracking-wider mb-1">메시지</p>
                <pre className="text-[13px] bg-black/30 border border-white/10 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-words">
                  {this.state.error.name}: {this.state.error.message}
                </pre>
              </div>
              {this.state.error.stack && (
                <div>
                  <p className="text-[12px] text-text-tertiary uppercase tracking-wider mb-1">스택</p>
                  <pre className="text-[11px] bg-black/30 border border-white/10 rounded-lg p-3 overflow-auto max-h-[300px] whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
              {this.state.info && (
                <div>
                  <p className="text-[12px] text-text-tertiary uppercase tracking-wider mb-1">컴포넌트 트리</p>
                  <pre className="text-[11px] bg-black/30 border border-white/10 rounded-lg p-3 overflow-auto max-h-[240px] whitespace-pre-wrap">
                    {this.state.info}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg bg-cta text-white text-[14px] font-medium hover:bg-cta/90 transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
              className="px-4 py-2 rounded-lg bg-white/10 text-text-primary text-[14px] font-medium hover:bg-white/15 transition-colors"
            >
              페이지 새로고침
            </button>
            <button
              onClick={() => {
                try { sessionStorage.clear(); } catch { /* noop */ }
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[14px] font-medium hover:bg-amber-500/30 transition-colors"
            >
              캐시 비우고 새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }
}
