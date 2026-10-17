import { motion } from 'motion/react';
import { Check, Target } from '@phosphor-icons/react';
import { BAND_GOALS, FUNCTIONS, FUNCTION_INFO, LEVEL_INFO, SKILLS, bandLevel, cap, levelIndex, nextBand } from '../lib/cefr.js';
import { CefrLadder, LevelBadge, SKILL_ICONS, bandClasses } from './ui.jsx';
import { MomentumBar, MomentumStats } from './momentum.jsx';

export { SKILL_ICONS };

const stageDone = (s) => (typeof s === 'object' && s ? s.status : s) === 'completed';

/** The three function slots (T, I, E) a skill needs for its next sub-band. */
export function FunctionSlots({ profile, skill, size = 'sm' }) {
  const band = profile.skill_bands[skill];
  const prog = profile.progress?.[skill]?.[band] ?? {};
  return (
    <span className="inline-flex gap-1" aria-label={`${FUNCTIONS.filter((f) => prog[f]).length} of 3 functional tasks done for ${nextBand(band)}`}>
      {FUNCTIONS.map((f) => (
        <span
          key={f}
          title={`${FUNCTION_INFO[f].label}${prog[f] ? ': done' : ': still needed'}`}
          className={`grid place-items-center rounded-full font-mono font-semibold ${size === 'sm' ? 'size-[18px] text-[9.5px]' : 'size-6 text-[11px]'} ${prog[f] ? 'bg-emerald text-paper' : 'border border-dashed border-line-strong text-ink-3'}`}
        >
          {FUNCTION_INFO[f].short}
        </span>
      ))}
    </span>
  );
}

function Diagnostic({ diagnostic }) {
  if (!diagnostic) return null;
  const done = SKILLS.filter((s) => stageDone(diagnostic.stages?.[s])).length;
  const status = diagnostic.status === 'completed' ? 'Complete' : `${done} of 4 done${diagnostic.status === 'paused' ? ', paused' : ''}`;
  return (
    <section aria-labelledby="diag-h">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 id="diag-h" className="text-sm font-semibold">
          Diagnostic
        </h3>
        <span className="text-xs text-ink-3">{status}</span>
      </div>
      <ol className="grid grid-cols-4 gap-2">
        {SKILLS.map((s) => {
          const st = diagnostic.stages?.[s];
          const ok = stageDone(st);
          const Icon = SKILL_ICONS[s];
          return (
            <li key={s} className="flex flex-col items-center gap-1.5" title={ok ? `${cap(s)}: ${st.task_level}, ${st.score}%` : `${cap(s)}: not yet`}>
              <span className={`relative grid size-9 place-items-center rounded-full border ${ok ? 'border-emerald bg-emerald-soft text-emerald' : 'border-dashed border-line-strong text-ink-3'}`}>
                <Icon size={16} weight={ok ? 'fill' : 'regular'} />
                {ok && (
                  <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-emerald text-paper">
                    <Check size={10} weight="bold" />
                  </span>
                )}
              </span>
              <span className="text-[10.5px] text-ink-3">{ok ? <span className="font-mono">{st.score}%</span> : cap(s)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** What the current sub-band asks of the learner, and what the next one unlocks. */
function BandGoal({ band }) {
  const next = nextBand(band);
  return (
    <div className="space-y-1.5 border-l-2 border-line-strong pl-3 text-[13px]">
      <p>
        <span className="font-mono text-[11px] text-ink-3">{band}</span> <span className="text-ink-2">{BAND_GOALS[band]}</span>
      </p>
      {next !== band && (
        <p className="text-ink-3">
          <span className="font-mono text-[11px]">Next {next}</span> {BAND_GOALS[next]}
        </p>
      )}
    </div>
  );
}

function OverallMark({ band, compact = false }) {
  const level = bandLevel(band);
  const b = bandClasses(level);
  return (
    <div className="flex items-end gap-4">
      <span className={`font-serif leading-[0.85] font-medium tracking-tight ${compact ? 'text-5xl' : 'text-[76px]'}`}>
        {level[0]}
        <span className={b.text}>{level[1]}</span>
        <span className={`font-sans font-medium text-ink-3 ${compact ? 'text-xl' : 'text-2xl'}`}>.{band.slice(3)}</span>
      </span>
      <div className="pb-1">
        <div className="font-medium">{LEVEL_INFO[level].name}</div>
        <div lang="tr" className="font-serif text-ink-3 italic">
          {LEVEL_INFO[level].tr}
        </div>
      </div>
    </div>
  );
}

export default function LearnerSheet({ profile }) {
  const { stats, diagnostic, metrics } = profile;
  const stepsLeft = levelIndex(profile.target_cefr) - levelIndex(profile.overall_cefr);
  const canDoCount = profile.can_do_mastered.length;

  return (
    <aside aria-label="Learner profile" className="lg:sticky lg:top-24 lg:self-start">
      {/* Compact summary below lg */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5 lg:hidden">
        <OverallMark band={profile.sub_band} compact />
        <div className="w-full sm:order-last">
          <MomentumBar profile={profile} compact />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.map((s) => {
            const Icon = SKILL_ICONS[s];
            return (
              <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs text-ink-2" title={cap(s)}>
                <Icon size={13} aria-hidden /> <span className="sr-only">{cap(s)}</span>
                <span className="font-mono">{profile.skill_bands[s]}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Full sheet on lg+ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="hidden space-y-8 lg:block">
        <section className="space-y-4">
          <OverallMark band={profile.sub_band} />
          <BandGoal band={profile.sub_band} />
          <MomentumBar profile={profile} />
          <MomentumStats profile={profile} />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <Target size={14} /> Goal <LevelBadge level={profile.target_cefr} />
              </span>
              <span>{stepsLeft > 0 ? `${stepsLeft} level${stepsLeft > 1 ? 's' : ''} to go` : 'Goal reached'}</span>
            </div>
            <CefrLadder level={profile.overall_cefr} label="Overall level on the A1 to C2 scale" />
          </div>
        </section>

        <section aria-labelledby="skills-h">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 id="skills-h" className="text-sm font-semibold">
              Skills
            </h3>
            <span className="text-[11px] text-ink-3">{canDoCount} Can-Do achieved</span>
          </div>
          <ul className="space-y-4">
            {SKILLS.map((s) => {
              const Icon = SKILL_ICONS[s];
              const st = stats?.per_skill?.[s];
              const band = profile.skill_bands[s];
              const bc = bandClasses(bandLevel(band));
              return (
                <li key={s} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-ink-2">
                      <Icon size={16} aria-hidden /> {cap(s)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      {st?.attempts > 0 && <span className="font-mono text-[11px] text-ink-3">avg {st.average_score}</span>}
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${bc.soft} ${bc.text}`}>{band}</span>
                    </span>
                  </div>
                  <CefrLadder level={profile.skills[s]} label={`${cap(s)} level`} />
                  <div className="flex items-center justify-between text-[11px] text-ink-3">
                    <span>to {nextBand(band)}</span>
                    <FunctionSlots profile={profile} skill={s} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <Diagnostic diagnostic={diagnostic} />

        <dl className="grid grid-cols-2 gap-4 border-t border-line pt-5">
          <div>
            <dt className="text-xs text-ink-3">Activities</dt>
            <dd className="font-serif text-3xl font-medium tabular-nums">{stats?.activities_completed ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Vocabulary, est.</dt>
            <dd className="font-serif text-3xl font-medium tabular-nums">{metrics?.vocabulary_size_estimate ?? 0}</dd>
          </div>
        </dl>

        {metrics?.weaknesses?.length > 0 && (
          <section aria-labelledby="focus-h">
            <h3 id="focus-h" className="mb-2 text-sm font-semibold">
              Next keys to unlock
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {metrics.weaknesses.map((w) => (
                <span key={w} className="rounded-full bg-amber-soft px-2.5 py-1 text-xs text-amber">
                  {w}
                </span>
              ))}
            </div>
          </section>
        )}
      </motion.div>
    </aside>
  );
}
