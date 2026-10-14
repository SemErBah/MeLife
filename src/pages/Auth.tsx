import React, { useState } from 'react';
import { auth as maybeAuth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from '../store/useUI';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

const auth = maybeAuth!;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.error(err);
      if (err.code === 'auth/too-many-requests') {
        setError('Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('İnternet bağlantısı yok gibi görünüyor.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-posta veya şifre hatalı.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Bu e-posta adresi zaten kullanılıyor.');
      } else if (err.code === 'auth/weak-password') {
        setError('Şifre çok zayıf. En az 6 karakter olmalı.');
      } else {
        setError('Bir hata oluştu: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');
    if (!email) { setError('Şifre sıfırlama bağlantısı için önce e-posta adresinizi yazın.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      toast('Şifre sıfırlama bağlantısı e-postanıza gönderildi', 'info');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError((err as { code?: string }).code === 'auth/invalid-email' ? 'Geçerli bir e-posta adresi girin.' : 'Bağlantı gönderilemedi, tekrar deneyin.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4 relative overflow-hidden">
      {/* Background blur elements */}
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-purple/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex mb-4" style={{ filter: 'drop-shadow(0 8px 24px color-mix(in srgb, var(--accent-base) 35%, transparent))' }}>
            <Logo size={64} />
          </div>
          <h1 className="text-3xl font-extrabold text-text-main mb-2">MeLife</h1>
          <p className="text-text-muted">Rutinlerin, derslerin ve paran tek yerde.</p>
          <p className="text-xs text-text-muted mt-2">MeDebit hesabınla giriş yapabilirsin.</p>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="flex p-1 rounded-xl mb-6" style={{ background: 'var(--surface-el)' }}>
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isLogin ? 'bg-surface border border-border text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isLogin ? 'bg-surface border border-border text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              Kayıt Ol
            </button>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 text-xs text-danger bg-danger-dim p-3 rounded-xl border border-danger/20">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">E-posta Adresi</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11"
                  placeholder="isim@ornek.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 ml-1">Şifre</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11"
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {isLogin && (
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={handleReset} className="text-xs font-semibold text-accent" style={{ minHeight: 32 }}>
                  Şifremi unuttum
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-accent text-[var(--base)] rounded-xl font-semibold hover:opacity-90 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ boxShadow: '0 4px 16px color-mix(in srgb, var(--accent-base) 30%, transparent)' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Lütfen Bekleyin...
                </>
              ) : isLogin ? 'Giriş Yap' : 'Hesap Oluştur'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
