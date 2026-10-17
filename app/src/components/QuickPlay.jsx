import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, ArrowRight, ArrowCounterClockwise, GameController, Airplane, Cpu, Palette, House } from '@phosphor-icons/react';
import { api } from '../api.js';
import { Button, Panel } from './ui.jsx';
import { WinsBurst } from './momentum.jsx';

const ease = [0.16, 1, 0.3, 1];
export const THEME_ICONS = { Gaming: GameController, Travel: Airplane, Tech: Cpu, Culture: Palette, 'Daily life': House };

// One-word completions: tap only, no typing, low stakes.
const ITEMS = [
  { theme: 'Gaming', text: 'I press ___ to start the game.', options: ['play', 'eat', 'sleep'], answer: 0 },
  { theme: 'Gaming', text: 'My character has three ___ left.', options: ['lives', 'chairs', 'trains'], answer: 0 },
  { theme: 'Gaming', text: 'We won! Let\'s play ___!', options: ['again', 'yesterday', 'never'], answer: 0 },
  { theme: 'Gaming', text: 'This level is very ___. I can\'t finish it.', options: ['hard', 'blue', 'hungry'], answer: 0 },
  { theme: 'Travel', text: 'Can I see your ___, please? (at the airport)', options: ['passport', 'pizza', 'pencil'], answer: 0 },
  { theme: 'Travel', text: 'The train ___ at 9 o\'clock.', options: ['leaves', 'cooks', 'sings'], answer: 0 },
  { theme: 'Travel', text: 'I want a room ___ two nights.', options: ['for', 'at', 'under'], answer: 0 },
  { theme: 'Travel', text: 'Excuse me, where is the ___? I need a taxi.', options: ['taxi rank', 'kitchen', 'library'], answer: 0 },
  { theme: 'Tech', text: 'My phone battery is ___. I need a charger.', options: ['low', 'tall', 'happy'], answer: 0 },
  { theme: 'Tech', text: 'Please ___ the app and try again.', options: ['restart', 'drink', 'paint'], answer: 0 },
  { theme: 'Tech', text: 'What\'s the Wi-Fi ___?', options: ['password', 'sandwich', 'weather'], answer: 0 },
  { theme: 'Culture', text: 'The concert starts ___ 8 p.m.', options: ['at', 'on', 'in'], answer: 0 },
  { theme: 'Culture', text: 'I love this song. Who ___ it?', options: ['sings', 'drives', 'opens'], answer: 0 },
  { theme: 'Culture', text: 'The museum is ___ on Mondays.', options: ['closed', 'tired', 'cheap'], answer: 0 },
  { theme: 'Daily life', text: 'I drink ___ every morning.', options: ['coffee', 'shoes', 'books'], answer: 0 },
  { theme: 'Daily life', text: 'She ___ to work by bus.', options: ['goes', 'go', 'going'], answer: 0 },
  { theme: 'Daily life', text: 'It\'s cold. Take your ___.', options: ['jacket', 'spoon', 'ticket'], answer: 0 },
  { theme: 'Daily life', text: 'I am ___ years old.', options: ['30', 'tall', 'from'], answer: 0 },
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRound(interests) {
  const preferred = shuffle(ITEMS.filter((it) => interests.includes(it.theme)));
  const rest = shuffle(ITEMS.filter((it) => !interests.includes(it.theme)));
  return [...preferred, ...rest].slice(0, 5).map((it) => {
    const order = shuffle(it.options.map((o, i) => i));
    return { ...it, options: order.map((i) => it.options[i]), answer: order.indexOf(it.answer) };
  });
}

/** Low-Effort Mode: five tap-only completions. Rewards effort; never touches levels. */
export default function QuickPlay({ profile, reason, onSaved, onExit }) {
  const interests = profile.interests ?? [];
  const [seed, setSeed] = useState(0);
  const round = useMemo(() => makeRound(interests), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState(null);
  const done = i >= round.length;

  async function pick(idx) {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === round[i].answer;
    const nextCorrect = correct + (ok ? 1 : 0);
    setCorrect(nextCorrect);
    setTimeout(async () => {
      setPicked(null);
      setI((n) => n + 1);
      if (i + 1 >= round.length) {
        const r = await api.quickPlay({ correct: nextCorrect, total: round.length, theme: round[0].theme });
        setResult(r);
        onSaved?.(r);
      }
    }, ok ? 650 : 1300);
  }

  function again() {
    setSeed((s) => s + 1);
    setI(0);
    setCorrect(0);
    setResult(null);
  }

  return (
    <Panel as="section" aria-label="Low-effort quick play" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-indigo-soft/40 px-6 py-4">
        <Coffee size={20} className="text-indigo" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Low-Effort Mode</h2>
          <p className="text-[13px] text-ink-2">{reason ? `Switched on because ${reason}. ` : ''}Light, tap-only rounds. Every round still counts for your streak and XP.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onExit}>
          Back to full practice <ArrowRight size={14} />
        </Button>
      </div>

      <div className="px-6 py-7">
        {!done ? (
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease }} className="space-y-6">
              <div className="flex items-center gap-2 text-[13px] text-ink-3">
                {(() => {
                  const Icon = THEME_ICONS[round[i].theme];
                  return <Icon size={15} />;
                })()}
                {round[i].theme}
                <span className="ml-auto font-mono">
                  {i + 1} / {round.length}
                </span>
              </div>
              <p className="font-serif text-[28px] leading-snug">
                {round[i].text.split('___').map((part, k, arr) => (
                  <span key={k}>
                    {part}
                    {k < arr.length - 1 && (
                      <span className={`mx-1 inline-block min-w-16 border-b-2 text-center ${picked === null ? 'border-line-strong' : 'border-emerald text-emerald'}`}>
                        {picked === null ? ' ' : round[i].options[round[i].answer]}
                      </span>
                    )}
                  </span>
                ))}
              </p>
              <div className="flex flex-wrap gap-2">
                {round[i].options.map((o, idx) => {
                  const state = picked === null ? '' : idx === round[i].answer ? 'border-emerald bg-emerald-soft text-emerald' : idx === picked ? 'border-amber bg-amber-soft text-amber' : 'opacity-50';
                  return (
                    <button
                      key={o}
                      onClick={() => pick(idx)}
                      disabled={picked !== null}
                      className={`h-12 rounded-full border border-line-strong px-6 font-serif text-lg transition-colors hover:border-ink ${state}`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {picked !== null && picked !== round[i].answer && <p className="text-sm text-ink-2">Close! It&rsquo;s &ldquo;{round[i].options[round[i].answer]}&rdquo;. You will see it again.</p>}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="space-y-5">
            <p className="font-serif text-2xl font-medium">
              {correct} of {round.length}. {correct >= 4 ? 'You are on fire.' : correct >= 2 ? 'Nice and easy. That counts.' : 'You showed up, and that is what builds the habit.'}
            </p>
            {result && <WinsBurst motivation={result.motivation} />}
            <div className="flex flex-wrap gap-2">
              <Button onClick={again}>
                <ArrowCounterClockwise size={16} /> Another round
              </Button>
              <Button variant="secondary" onClick={onExit}>
                Back to full practice
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
