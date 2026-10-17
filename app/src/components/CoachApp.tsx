'use client';

import { useEffect, useId, useState } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { IconContext, WarningCircle, SignOut, Sun, Moon, Notebook, ChatsCircle, Monitor, Vault as VaultIcon, Archive, Path, TrendUp } from '@phosphor-icons/react';
import { api, refreshOnFocus } from '@/api';
import { readStored, writeStored } from '@/lib/useActivity';
import { useTheme } from '@/lib/theme';
import LearnerSheet from '@/components/Sidebar';
import Studio from '@/components/Studio';
import Vault from '@/components/Vault';
import SessionsView from '@/components/SessionsView';
import CoachChat from '@/components/CoachChat';
import Roadmap from '@/components/Roadmap';
import { getBand } from '@/lib/core/curriculum';
import Gatekeeper from '@/components/Gatekeeper';
import { Skeleton } from '@/components/ui';

const TITLE = 'Özgür Deveci | Seyyahname AI English Coach v1.0';
const LOCKED_TITLE = 'Giriş';

const VIEWS = [
  { id: 'studio', label: 'Çalışma', icon: Notebook },
  { id: 'roadmap', label: 'Müfredat', title: 'Müfredat & Yol Haritası', icon: Path },
  { id: 'coach', label: 'Koç', icon: ChatsCircle },
  { id: 'vault', label: 'Kasa', icon: VaultIcon },
  { id: 'sessions', label: 'Arşiv', icon: Archive },
];

const THEME_OPTIONS = [
  { id: 'system', label: 'Sistem', icon: Monitor },
  { id: 'dark', label: 'Koyu', icon: Moon },
  { id: 'light', label: 'Açık', icon: Sun },
] as const;

/** Sistem / Koyu / Açık. "Sistem" follows the OS setting; a manual choice is remembered and wins. */
function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  const pill = useId(); // the top bar and the mobile header each have a switch
  return (
    <div role="radiogroup" aria-label="Tema" className="relative flex shrink-0 items-center gap-0.5 rounded-lg border border-line-strong bg-sunk/60 p-0.5">
      {THEME_OPTIONS.map(({ id, label, icon: Icon }) => {
        const on = mode === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            aria-label={`Tema: ${label}`}
            title={label}
            onClick={() => setMode(id)}
            className={`relative grid size-7 place-items-center rounded-md transition-colors ${on ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
          >
            {on && <motion.span layoutId={pill} className="absolute inset-0 rounded-md bg-panel shadow-[inset_0_0_0_1px_var(--line-strong)]" transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }} />}
            <Icon size={14} weight={on ? 'fill' : 'regular'} className="relative" />
          </button>
        );
      })}
    </div>
  );
}

/** True on screens wide enough for the persistent chat column (Tailwind xl, 1280px). */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(min-width: 1280px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
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
      <span className="font-semibold tracking-[-0.01em]">Seyyahname</span>
      <span className="rounded-[5px] border border-line-strong px-1.5 font-mono text-[10.5px] text-ink-3">v1.0</span>
    </div>
  );
}

/** Sidebar navigation: a vertical list on desktop, five tabs on mobile. */
function Nav({ view, onView }) {
  return (
    <nav aria-label="Ana menü" className="grid grid-cols-5 gap-1 lg:grid-cols-1 lg:gap-0.5">
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onView(id)}
            aria-current={active ? 'page' : undefined}
            className={`${id === 'coach' ? 'xl:hidden ' : ''}flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors lg:justify-start ${active ? 'bg-sunk text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-ink-2 hover:bg-hover hover:text-ink'}`}
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
        Seyyahname <span className="mx-1">›</span> <b className="font-medium text-ink">{current?.title ?? current?.label}</b>
      </span>
      <span
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-[3px] text-xs text-ink-2"
        title={llm ? 'Geri bildirim Gemini ile üretiliyor' : 'Yapay zekâ geri bildirimi için sunucudaki .env dosyasına GEMINI_API_KEY ekleyin'}
      >
        <i className={`size-1.5 rounded-full ${llm ? 'bg-emerald shadow-[0_0_8px_var(--emerald)]' : 'bg-ink-3'}`} />
        {llm ? 'Gemini bağlı' : 'Çevrimdışı geri bildirim'}
      </span>
      <ThemeSwitch />
      <LockButton onLogout={onLogout} />
    </div>
  );
}

/** Shown once when a band's four Can-Dos are all mastered and the next sub-band opens. */
function LevelUp({ up, onClose, onRoadmap }) {
  const next = getBand(up.to);
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-paper/70 px-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="levelup-title"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] as const }}
        onClick={(e) => e.stopPropagation()}
        className="edge-top w-full max-w-[420px] space-y-4 rounded-[16px] border border-line bg-panel p-6 shadow-paper"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-amber-soft text-amber shadow-[0_0_24px_var(--glow)]">
          <TrendUp size={20} weight="bold" />
        </span>
        <div className="space-y-1.5">
          <h2 id="levelup-title" className="text-[22px] font-semibold tracking-[-0.02em]">
            Seviye atladın: <span className="text-sheen font-mono">{up.from} → {up.to}</span>
          </h2>
          <p className="text-[14px] text-ink-2">{up.from} bandının dört Can-Do hedefinin hepsini tamamladın. Yeni hedefin:</p>
          {next && <p className="text-[15px] text-ink">{next.goal_tr}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRoadmap} className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-paper active:scale-[0.98]">
            Yeni bandı gör
          </button>
          <button onClick={onClose} className="h-10 rounded-full border border-line-strong px-4 text-sm text-ink-2 hover:text-ink">
            Devam et
          </button>
        </div>
      </motion.div>
    </motion.div>
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
  const [levelUp, setLevelUp] = useState<{ from: string; to: string } | null>(null);
  const [roadmapKey, setRoadmapKey] = useState(0);
  const wide = useWide();
  const [chatSeed, setChatSeed] = useState<{ text: string; n: number } | null>(null);
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
    if (result.curriculum?.levelUp) setLevelUp(result.curriculum.levelUp);
  }

  // "Koçla canlandır": open the coach with the scenario written out as the first message.
  function rehearse(band, s) {
    const text = `Let's role-play a ${band.id} scenario: "${s.title}". ${s.setting} ${s.task} You play the other person; keep your English at my level and start the conversation.`;
    setChatSeed((c) => ({ text, n: (c?.n ?? 0) + 1 }));
    if (!wide) setView('coach'); // on wide screens the chat column is already open
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
          <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_minmax(340px,400px)]">
            <LearnerSheet
              profile={profile}
              refreshKey={refreshKey}
              header={
                <div className="flex items-center justify-between gap-2">
                  <Brand />
                  <span className="flex items-center gap-1 lg:hidden">
                    <ThemeSwitch />
                    <LockButton onLogout={onLogout} />
                  </span>
                </div>
              }
              nav={<Nav view={view} onView={setView} />}
            />
            <div className="min-w-0">
              <TopBar view={view} llm={health?.llm} onLogout={onLogout} />
              <main className="@container mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
                <AnimatePresence mode="wait">
                  <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}>
                    {(view === 'studio' || (view === 'coach' && wide)) && <Studio profile={profile} onActivitySaved={onActivitySaved} refreshKey={refreshKey} />}
                    {view === 'roadmap' && <Roadmap key={roadmapKey} profile={profile} onActivitySaved={onActivitySaved} onRehearse={rehearse} refreshKey={refreshKey} />}
                    {view === 'coach' && !wide && <CoachChat key={chatSeed?.n ?? 0} llm={health?.llm} seed={chatSeed?.text} />}
                    {view === 'vault' && <Vault refreshKey={refreshKey} profile={profile} onReviewed={onActivitySaved} />}
                    {view === 'sessions' && <SessionsView refreshKey={refreshKey} />}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
            {/* Persistent chat column (xl+): stays open while the left and centre panels change. */}
            {wide && (
              <div className="sticky top-0 hidden h-dvh border-l border-line bg-panel xl:block">
                <CoachChat key={chatSeed?.n ?? 0} docked llm={health?.llm} seed={chatSeed?.text} />
              </div>
            )}
            <AnimatePresence>
              {levelUp && (
                <LevelUp
                  up={levelUp}
                  onClose={() => setLevelUp(null)}
                  onRoadmap={() => {
                    setLevelUp(null);
                    setRoadmapKey((k) => k + 1); // leave a practice screen and show the new band
                    setView('roadmap');
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </IconContext.Provider>
    </MotionConfig>
  );
}
