import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Gift, CaretDown, Flame, Medal, TrendUp, Trophy, BookmarkSimple, SealCheck } from '@phosphor-icons/react';
import { api } from '../api.js';
import { readStored, writeStored } from '../lib/useActivity.js';
import { Panel } from './ui.jsx';
import { WinBadge } from './momentum.jsx';

const ease = [0.16, 1, 0.3, 1];

/** "Bugün neler kazandın?": today's wins, words and obstacles cleared, like an end-of-level screen. */
export default function DailyLoot({ refreshKey }) {
  const [loot, setLoot] = useState(null);
  // Collapsed by default so practice stays in view; the choice is remembered on this device.
  const [open, setOpen] = useState(() => readStored('coach.loot.open', 'no') === 'yes');
  const toggle = () =>
    setOpen((o) => {
      writeStored('coach.loot.open', o ? 'no' : 'yes');
      return !o;
    });

  useEffect(() => {
    api.loot().then(setLoot).catch(() => setLoot(null));
  }, [refreshKey]);

  if (!loot || loot.activities + loot.reviews === 0) return null;

  // Milestones get their own medal row, so they are not repeated among the wins.
  const milestoneTitles = new Set(loot.milestones.map((x) => x.title));
  const wins = [...new Set(loot.wins)].filter((w) => !milestoneTitles.has(w));
  const obstacles = [
    ...loot.bandUps.map((l) => ({ icon: TrendUp, text: `${l.skill[0].toUpperCase() + l.skill.slice(1)} ${l.change.replace('→', ' to ')}` })),
    ...loot.canDos.map((c) => ({ icon: SealCheck, text: `Can-Do: ${c.statement}` })),
    ...loot.resolved.map((e) => ({ icon: Trophy, text: `Mastered "${e.after}"` })),
  ];

  return (
    <Panel as="section" aria-label="Daily loot" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-amber-soft blur-3xl" aria-hidden />
      <button onClick={toggle} aria-expanded={open} className="relative flex w-full items-center gap-4 px-6 py-4 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber text-paper shadow-paper">
          <Gift size={22} weight="fill" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-2xl leading-tight font-medium">Daily Loot</span>
          <span lang="tr" className="block font-serif text-[15px] text-ink-3 italic">
            Bugün neler kazandın?{!open && <span className="ml-2 font-sans text-xs not-italic">{wins.length} wins, {loot.milestones.length} milestones, {loot.words.length} words</span>}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-serif text-3xl leading-none font-medium text-amber tabular-nums">+{loot.points}</span>
          <span className="text-xs text-ink-3">XP today</span>
        </span>
        <CaretDown size={16} className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.4, ease }} className="relative overflow-hidden">
          <div className="space-y-5 border-t border-line px-6 pt-5 pb-6">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Streak', `${loot.streak} day${loot.streak === 1 ? '' : 's'}`, Flame],
                ['Tasks', loot.activities, null],
                ['Reviews', loot.reviews, null],
                ['Sub-band', loot.subBand, null],
              ].map(([label, value, Icon]) => (
                <div key={label}>
                  <dt className="flex items-center gap-1 text-xs text-ink-3">
                    {Icon && <Icon size={12} weight="fill" className="text-amber" />}
                    {label}
                  </dt>
                  <dd className="font-serif text-2xl font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Wins</h3>
              <ul className="flex flex-wrap gap-1.5">
                {wins.map((w, i) => (
                  <WinBadge key={w} win={{ label: w }} index={i} size="sm" />
                ))}
              </ul>
            </div>

            {loot.milestones.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Milestones unlocked</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {loot.milestones.map((x) => (
                    <li key={x.id} className="shine relative flex items-center gap-2.5 overflow-hidden rounded-[10px] bg-gradient-to-r from-amber-soft to-emerald-soft px-3 py-2.5 text-sm font-medium">
                      <Medal size={18} weight="fill" className="text-amber" /> {x.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {obstacles.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Obstacles cleared</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {obstacles.map(({ icon: Icon, text }) => (
                    <li key={text} className="shine relative flex items-center gap-2.5 overflow-hidden rounded-[10px] bg-gradient-to-r from-amber-soft to-emerald-soft px-3 py-2.5 text-sm font-medium">
                      <Icon size={18} weight="fill" className="text-amber" /> {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {loot.words.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <BookmarkSimple size={15} className="text-indigo" /> New words ({loot.words.length})
                </h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {loot.words.map((w) => (
                    <li key={w.original} className="font-serif text-[17px]">
                      {w.original}
                      {(w.meaning || w.upgraded) && <span className="ml-1.5 font-sans text-xs text-ink-3">{w.meaning || `→ ${w.upgraded}`}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </Panel>
  );
}
