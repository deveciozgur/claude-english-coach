'use client';

import { useEffect, useState } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { IconContext, WarningCircle, SignOut, Sun, Moon, Notebook, ChatsCircle, Vault as VaultIcon, Archive } from '@phosphor-icons/react';
import { api, refreshOnFocus } from '@/api';
import { readStored, writeStored } from '@/lib/useActivity';
import { useTheme } from '@/lib/theme';
import LearnerSheet from '@/components/Sidebar';
import Studio from '@/components/Studio';
import Vault from '@/components/Vault';
import SessionsView from '@/components/SessionsView';
import CoachChat from '@/components/CoachChat';
import Gatekeeper from '@/components/Gatekeeper';
import { Skeleton } from '@/components/ui';

const TITLE = 'Özgür Deveci | Lumos AI English Coach v1.0';
const LOCKED_TITLE = 'Giriş';

const VIEWS = [
  { id: 'studio', label: 'Çalışma', icon: Notebook },
  { id: 'coach', label: 'Koç', icon: ChatsCircle },
  { id: 'vault', label: 'Kasa', icon: VaultIcon },
  { id: 'sessions', label: 'Arşiv', icon: Archive },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-sunk/60 text-ink-2 transition-colors hover:bg-hover hover:text-ink"
      aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      title={dark ? 'Açık tema' : 'Koyu tema'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ opacity: 0, rotate: -60, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 60, scale: 0.6 }} transition={{ duration: 0.2 }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function LockButton({ onLogout }) {
  if (!onLogout) return null;
  return (
    <button onClick={onLogout} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink" aria-label="Kilitle" title="Kilitle">
      <SignOut size={17} />
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1.5">
      <span className="size-[26px] shrink-0 rounded-lg bg-[radial-gradient(circle_at_30%_30%,#fff3d6,#e8c07d_45%,#8a6a35)] shadow-[0_0_18px_var(--glow)]" aria-hidden />
      <span className="font-semibold tracking-[-0.01em]">Lumos</span>
      <span className="rounded-[5px] border border-line-strong px-1.5 font-mono text-[10.5px] text-ink-3">v1.0</span>
    </div>
  );
}

/** Sidebar navigation: a vertical list on desktop, four tabs on mobile. */
function Nav({ view, onView }) {
  return (
    <nav aria-label="Ana menü" className="grid grid-cols-4 gap-1 lg:grid-cols-1 lg:gap-0.5">
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onView(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors lg:justify-start ${active ? 'bg-sunk text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-ink-2 hover:bg-hover hover:text-ink'}`}
          >
            <Icon size={16} weight={active ? 'fill' : 'regular'} className="hidden opacity-80 lg:block" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/** Slim top bar over the content (Concept C): current view, AI status, theme and lock. */
function TopBar({ view, llm, onLogout }) {
  const current = VIEWS.find((v) => v.id === view);
  return (
    <div className="sticky top-0 z-20 hidden h-[52px] items-center gap-3 border-b border-line bg-paper/80 px-7 backdrop-blur-md lg:flex">
      <span className="text-[13px] text-ink-3">
        Lumos <span className="mx-1">›</span> <b className="font-medium text-ink">{current?.label}</b>
      </span>
      <span
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-[3px] text-xs text-ink-2"
        title={llm ? 'Geri bildirim Gemini ile üretiliyor' : 'Yapay zekâ geri bildirimi için sunucudaki .env dosyasına GEMINI_API_KEY ekleyin'}
      >
        <i className={`size-1.5 rounded-full ${llm ? 'bg-emerald shadow-[0_0_8px_var(--emerald)]' : 'bg-ink-3'}`} />
        {llm ? 'Gemini bağlı' : 'Çevrimdışı geri bildirim'}
      </span>
      <ThemeToggle />
      <LockButton onLogout={onLogout} />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[272px_minmax(0,1fr)]">
      <div className="space-y-4 border-r border-line bg-panel p-4">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[420px] w-full max-w-3xl rounded-[14px]" />
      </div>
    </div>
  );
}

export default function CoachApp() {
  const [profile, setProfile] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('studio');
  const [refreshKey, setRefreshKey] = useState(0);
  // null while checking; then the lock screen until the PIN is accepted
  const [auth, setAuth] = useState<{ required: boolean; authenticated: boolean } | null>(null);

  useEffect(() => {
    const v = readStored('coach.view', 'studio');
    if (VIEWS.some((x) => x.id === v)) setView(v);
    // An expired session makes any api.php call answer 401: show the lock screen again.
    const lock = () => setAuth((a) => ({ required: true, ...a, authenticated: false }));
    window.addEventListener('lumos:locked', lock);
    api
      .authStatus()
      .then((a) => {
        setAuth(a);
        setHealth({ llm: a.ai, model: a.model });
      })
      .catch((e) => setError(e.message));
    return () => window.removeEventListener('lumos:locked', lock);
  }, []);

  // The tab title names the app only after the PIN; the lock screen stays anonymous.
  useEffect(() => {
    document.title = auth?.authenticated ? TITLE : LOCKED_TITLE;
  }, [auth?.authenticated]);

  useEffect(() => {
    if (!auth?.authenticated) return undefined;
    api
      .profile()
      .then(setProfile)
      .catch((e) => !e.locked && setError(e.message));
    // Changes saved from another device show up when this tab is focused again.
    return refreshOnFocus(() =>
      api.profile().then((p) => {
        setProfile(p);
        setRefreshKey((k) => k + 1);
      }),
    );
  }, [auth?.authenticated]);

  async function logout() {
    await api.logout().catch(() => {});
    setProfile(null);
    setAuth((a) => ({ ...a, authenticated: false }));
  }

  useEffect(() => writeStored('coach.view', view), [view]);

  function onActivitySaved(result) {
    setProfile(result.profile);
    setRefreshKey((k) => k + 1);
  }

  const onLogout = auth?.required ? logout : null;

  return (
    <MotionConfig reducedMotion="user">
      <IconContext.Provider value={{ size: 18, weight: 'regular' }}>
        {auth && !auth.authenticated && !error ? (
          <Gatekeeper onUnlock={() => setAuth((a) => ({ ...a, authenticated: true }))} />
        ) : error ? (
          <div className="mx-auto max-w-lg px-4 py-24">
            <div className="flex items-center gap-2 font-medium text-brick">
              <WarningCircle size={22} /> Verilere ulaşılamıyor
            </div>
            <p className="mt-2 text-ink-2">{error}</p>
            <p className="mt-4 text-sm text-ink-3">
              Sunucuda <code className="rounded bg-sunk px-1.5 py-0.5 font-mono">api.php</code>, <code className="font-mono">config.php</code> ve <code className="font-mono">.env</code> dosyalarının{' '}
              <code className="font-mono">index.html</code> ile aynı klasörde olduğunu kontrol edip sayfayı yenileyin.
            </p>
          </div>
        ) : !profile ? (
          <LoadingShell />
        ) : (
          <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
            <LearnerSheet
              profile={profile}
              refreshKey={refreshKey}
              header={
                <div className="flex items-center justify-between gap-2">
                  <Brand />
                  <span className="flex items-center gap-1 lg:hidden">
                    <ThemeToggle />
                    <LockButton onLogout={onLogout} />
                  </span>
                </div>
              }
              nav={<Nav view={view} onView={setView} />}
            />
            <div className="min-w-0">
              <TopBar view={view} llm={health?.llm} onLogout={onLogout} />
              <main className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
                <AnimatePresence mode="wait">
                  <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}>
                    {view === 'studio' && <Studio profile={profile} onActivitySaved={onActivitySaved} refreshKey={refreshKey} />}
                    {view === 'coach' && <CoachChat llm={health?.llm} />}
                    {view === 'vault' && <Vault refreshKey={refreshKey} profile={profile} onReviewed={onActivitySaved} />}
                    {view === 'sessions' && <SessionsView refreshKey={refreshKey} />}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </div>
        )}
      </IconContext.Provider>
    </MotionConfig>
  );
}
