import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowsClockwise, Eye, ArrowRight, Timer } from '@phosphor-icons/react';
import { api } from '../api.js';
import { readStored, writeStored } from '../lib/useActivity.js';
import { Button, LevelBadge, Panel } from './ui.jsx';

const ease = [0.16, 1, 0.3, 1];
const todayKey = () => new Date().toLocaleDateString('sv-SE');
const WARMUP_SECONDS = 180;

// SM-2 grades (quality 1, 3, 4, 5). Labels in plain English, Turkish in the tooltip.
const GRADES = [
  { id: 'again', label: 'Again', tr: 'Hatırlamadım', variant: 'secondary' },
  { id: 'hard', label: 'Hard', tr: 'Zorlandım', variant: 'secondary' },
  { id: 'good', label: 'Good', tr: 'Hatırladım', variant: 'primary' },
  { id: 'easy', label: 'Easy', tr: 'Çok kolay', variant: 'secondary' },
];

/** A meaning card for learned words; an upgrade card for the learner's own words that got a stronger alternative. */
function CardFace({ card, revealed }) {
  const isUpgrade = !card.meaning;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-3">
        {card.cefr && <LevelBadge level={card.cefr} />}
        <span>{isUpgrade ? 'Say a stronger word for' : 'What does it mean? Use it in a sentence.'}</span>
        <span className="ml-auto font-mono text-[11px]" title={`SM-2 ease factor ${card.ease}`}>
          {card.stage} · ease {card.ease}
        </span>
      </div>
      <p className="font-serif text-[34px] leading-tight font-medium tracking-tight">{card.original}</p>
      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
            <div className="space-y-1.5 border-t border-line pt-4">
              {isUpgrade ? (
                <p className="flex items-center gap-2 font-serif text-2xl text-emerald">
                  <ArrowRight size={18} /> {card.upgraded}
                </p>
              ) : (
                <p lang="tr" className="text-lg">
                  {card.meaning}
                </p>
              )}
              {card.example && <p className="font-serif text-[16px] text-ink-2 italic">&ldquo;{card.example}&rdquo;</p>}
              {!isUpgrade && card.upgraded && <p className="text-[13px] text-indigo">Higher level: {card.upgraded}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * SM-2 warm-up: the first three minutes of the day go to due vocabulary (CLAUDE.md, section 1).
 * Results update vocabulary.md, profile.json (srs_queue, history, XP) and today's session log.
 */
export default function WarmUp({ refreshKey, onReviewed }) {
  const [cards, setCards] = useState(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [left, setLeft] = useState(WARMUP_SECONDS);
  const [skipped, setSkipped] = useState(() => readStored('coach.warmup.skipped', '') === todayKey());
  const timer = useRef(null);

  useEffect(() => {
    if (results.length) return; // keep the finished state until the next day
    api
      .dueVocabulary()
      .then(setCards)
      .catch((e) => setError(e.message));
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = cards?.length > 0 && !skipped;
  useEffect(() => {
    if (!active) return undefined;
    timer.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer.current);
  }, [active]);

  if (error) return <p className="text-sm text-brick">Warm-up unavailable: {error}</p>;
  if (!cards || skipped) return null;
  if (!cards.length && !results.length) {
    return <p className="text-[13px] text-ink-3">No words due for review today. New words from today&rsquo;s tasks come back tomorrow.</p>;
  }

  // The warm-up ends when the cards run out or the three minutes are up (the current card is finished first).
  const done = i >= cards.length || (left === 0 && !revealed && results.length > 0);
  if (done && timer.current) clearInterval(timer.current);

  async function grade(g) {
    setBusy(true);
    try {
      const r = await api.reviewVocabulary(cards[i].original, g);
      setResults((rs) => [...rs, { word: cards[i].original, grade: g, stage: r.entry.stage }]);
      onReviewed?.(r);
      setRevealed(false);
      setI((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    writeStored('coach.warmup.skipped', todayKey());
    setSkipped(true);
  }

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <Panel as="section" aria-label="Spaced repetition warm-up" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-3.5">
        <ArrowsClockwise size={18} className="text-amber" />
        <h2 className="text-sm font-semibold">Warm-up review</h2>
        <span className="text-[13px] text-ink-3">{done ? 'Done for today' : `Word ${i + 1} of ${cards.length}`}</span>
        {!done && (
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-3" aria-label={`${mm} left`}>
            <Timer size={13} /> {mm}
          </span>
        )}
        {!done && (
          <button onClick={skip} className="ml-auto text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
            Skip today
          </button>
        )}
      </div>

      <div className="px-6 py-6">
        {done ? (
          <div className="space-y-3">
            <p className="font-serif text-xl font-medium">Warm-up complete. Your memory just got a little stronger.</p>
            <ul className="flex flex-wrap gap-2">
              {results.map((r) => (
                <li key={r.word} className={`rounded-full px-3 py-1 text-[13px] ${r.grade === 'again' ? 'bg-amber-soft text-amber' : 'bg-emerald-soft text-emerald'}`}>
                  {r.word}: {r.grade === 'again' ? 'back tomorrow' : `next in ${r.stage}`}
                </li>
              ))}
            </ul>
            {i < cards.length && <p className="text-[13px] text-ink-3">{cards.length - i} more due; they will be first tomorrow.</p>}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={cards[i].original} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3, ease }} className="space-y-5">
              <CardFace card={cards[i]} revealed={revealed} />
              {!revealed ? (
                <Button variant="secondary" onClick={() => setRevealed(true)}>
                  <Eye size={16} /> Show answer
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2" role="group" aria-label="How well did you remember it?">
                  {GRADES.map((g) => (
                    <Button key={g.id} variant={g.variant} onClick={() => grade(g.id)} disabled={busy} title={g.tr}>
                      {g.label}
                      <span className="font-mono text-[11px] opacity-70">{cards[i].preview?.[g.id]}</span>
                    </Button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Panel>
  );
}
