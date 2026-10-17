import { useEffect, useState } from 'react';
import { CaretDown, ClipboardText, Coffee, Lifebuoy } from '@phosphor-icons/react';
import { api } from '../api.js';
import DailyLoot from './DailyLoot.jsx';
import QuickPlay, { THEME_ICONS } from './QuickPlay.jsx';
import { THEMES } from '../data/tasks-themes.js';
import { BANDS, FUNCTIONS, FUNCTION_INFO, LEVELS, MASTERY, SKILLS, bandLevel, cap, nextBand } from '../lib/cefr.js';
import { tasksFor } from '../data/tasks.js';
import { readStored, writeStored } from '../lib/useActivity.js';
import { SKILL_ICONS, Segmented, LevelBadge, Button } from './ui.jsx';
import { FunctionSlots } from './Sidebar.jsx';
import WarmUp from './WarmUp.jsx';
import ReadingModule from './ReadingModule.jsx';
import WritingModule from './WritingModule.jsx';
import ListeningModule from './ListeningModule.jsx';
import SpeakingModule from './SpeakingModule.jsx';

const MODULES = { reading: ReadingModule, writing: WritingModule, listening: ListeningModule, speaking: SpeakingModule };
const BLURBS = {
  reading: 'Read slowly, then answer. Questions test inference and vocabulary in context, not only recall.',
  writing: 'Write without spell-check. Feedback comes in three layers: grammar, vocabulary and register.',
  listening: 'The text stays blurred while you listen. Fill the gaps, then reveal it.',
  speaking: 'Speak freely for the target time. The transcript and your voice are analysed together.',
};

function DiagnosticStrip({ diagnostic, current, onPick }) {
  if (!diagnostic || diagnostic.status === 'completed') return null;
  const pending = SKILLS.filter((s) => (diagnostic.stages?.[s]?.status ?? diagnostic.stages?.[s]) !== 'completed');
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-start gap-2 text-sm text-ink-2">
        <ClipboardText size={18} className="mt-px shrink-0 text-amber" />
        <span>
          <span className="font-medium text-ink">Diagnostic {diagnostic.status === 'paused' ? 'paused' : 'in progress'}.</span> Your first finished task in each skill sets your baseline. {pending.length} left.
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {pending.map((s) => {
          const Icon = SKILL_ICONS[s];
          return (
            <button
              key={s}
              onClick={() => onPick(s)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${s === current ? 'bg-ink text-paper' : 'border border-line-strong text-ink-2 hover:border-ink hover:text-ink'}`}
            >
              <Icon size={14} /> {cap(s)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Studio({ profile, onActivitySaved, refreshKey }) {
  const [skill, setSkill] = useState(() => {
    const stored = readStored('coach.skill', 'reading');
    return SKILLS.includes(stored) ? stored : 'reading';
  });
  const userLevel = profile.skills[skill];
  const band = profile.skill_bands[skill];
  const [level, setLevel] = useState(userLevel);

  useEffect(() => {
    writeStored('coach.skill', skill);
    setLevel(profile.skills[skill]);
  }, [skill]); // eslint-disable-line react-hooks/exhaustive-deps

  const interests = profile.interests ?? [];
  const { level: taskLevel, tasks } = tasksFor(skill, level, interests);
  const mode = profile.gamification?.mode ?? 'normal';
  const shield = (profile.gamification?.struggle_streak ?? 0) >= 2;

  async function changeMode(next) {
    const r = await api.setMode(next);
    onActivitySaved({ profile: r.profile });
  }
  async function toggleInterest(theme) {
    const next = interests.includes(theme) ? interests.filter((t) => t !== theme) : [...interests, theme];
    const saved = await api.saveProfile({ ...profile, interests: next });
    onActivitySaved({ profile: saved });
  }
  const Module = MODULES[skill];
  // Tasks already used for a sub-band at this level cannot count again (one distinct task per function).
  const passedIds = BANDS.filter((b) => bandLevel(b) === taskLevel).flatMap((b) => FUNCTIONS.map((f) => profile.progress?.[skill]?.[b]?.[f]).filter(Boolean));
  const missing = FUNCTIONS.filter((f) => !profile.progress?.[skill]?.[band]?.[f]);

  return (
    <div className="space-y-7">
      <header className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl leading-[1.1] font-medium tracking-tight md:text-[44px]">Today&rsquo;s practice</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{BLURBS[skill]}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
          {mode !== 'low' && (
            <Button variant="ghost" size="sm" onClick={() => changeMode('low')} title="Switch to light, tap-only rounds">
              <Coffee size={15} /> Take it easy
            </Button>
          )}
          <label className="flex shrink-0 items-center gap-2 text-sm text-ink-3">
            Task level
            <span className="relative">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="h-9 appearance-none rounded-full border border-line-strong bg-raised py-0 pr-8 pl-3.5 font-mono text-sm text-ink hover:border-ink"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                    {l === userLevel ? ' (you)' : ''}
                  </option>
                ))}
              </select>
              <CaretDown size={14} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
            </span>
          </label>
          </div>
        </div>

        <WarmUp refreshKey={refreshKey} onReviewed={(r) => onActivitySaved({ profile: r.profile })} />

        <DailyLoot refreshKey={refreshKey} />

        <div className="flex flex-wrap items-center gap-1.5" aria-label="Your interests">
          <span className="mr-1 text-[13px] text-ink-3">I enjoy</span>
          {THEMES.map((t) => {
            const Icon = THEME_ICONS[t];
            const on = interests.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleInterest(t)}
                aria-pressed={on}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${on ? 'bg-indigo-soft text-indigo ring-1 ring-indigo/30 ring-inset' : 'border border-line text-ink-3 hover:border-ink hover:text-ink'}`}
              >
                <Icon size={14} weight={on ? 'fill' : 'regular'} /> {t}
              </button>
            );
          })}
        </div>

        <Segmented id="skill" items={SKILLS.map((s) => ({ id: s, label: cap(s), icon: SKILL_ICONS[s] }))} value={skill} onChange={setSkill} />

        <DiagnosticStrip diagnostic={profile.diagnostic} current={skill} onPick={setSkill} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
          <span>
            Your {skill} band is <span className="font-mono font-medium text-ink">{band}</span> <LevelBadge level={userLevel} />.
          </span>
          {band !== BANDS[BANDS.length - 1] && (
            <span className="inline-flex items-center gap-2">
              {missing.length
                ? `To reach ${nextBand(band)}: ${missing.map((f) => FUNCTION_INFO[f].label).join(', ')} ${userLevel} task${missing.length === 1 ? '' : 's'} at ${MASTERY}%+`
                : `Ready for ${nextBand(band)}`}
              <FunctionSlots profile={profile} skill={skill} />
            </span>
          )}
          {taskLevel !== userLevel && <span className="text-amber">Practice only: sub-band steps use {userLevel} tasks. Can-Do statements at {taskLevel} still count.</span>}
          {taskLevel !== level && <span>No {level} tasks yet, so this is {taskLevel}.</span>}
        </div>
      </header>

      {shield && mode !== 'low' && (
        <p className="flex items-start gap-2 rounded-2xl bg-emerald-soft/70 px-4 py-3 text-[14px] text-ink-2" role="status">
          <Lifebuoy size={18} className="mt-px shrink-0 text-emerald" />
          <span>
            <span className="font-medium text-ink">Frustration shield is on.</span> The last rounds were tough, so hints are open, choices are offered and sentences come half-finished. Nothing gets harder until you are flying again.
          </span>
        </p>
      )}

      {/* Low-Effort Mode puts quick play first; the full task stays below so no feedback is lost. */}
      {mode === 'low' && <QuickPlay profile={profile} reason={profile.gamification?.mode_reason} onSaved={(r) => onActivitySaved({ profile: r.profile })} onExit={() => changeMode('normal')} />}
      <div className={mode === 'low' ? 'opacity-70 transition-opacity hover:opacity-100' : ''}>
        <Module key={`${skill}-${taskLevel}-${interests.join()}`} level={taskLevel} tasks={tasks} profile={profile} onActivitySaved={onActivitySaved} passedIds={passedIds} shield={shield} />
      </div>
    </div>
  );
}
