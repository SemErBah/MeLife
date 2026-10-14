import { Component, type ReactNode } from 'react';

/** Beklenmeyen bir hata tüm uygulamayı beyaz sayfaya çevirmesin */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('MeLife hata:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh flex items-center justify-center bg-base p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="font-display text-3xl font-semibold">Bir şeyler ters gitti</p>
          <p className="text-sm text-text-muted leading-relaxed">
            Verilerin güvende; sadece bu ekran çizilemedi. Yenilemek genelde yeter.
          </p>
          <p className="text-[11px] text-text-muted/70 font-mono break-words">{this.state.error.message}</p>
          <button onClick={() => location.reload()} className="btn btn-primary">Yenile</button>
        </div>
      </div>
    );
  }
}
