'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CaretDown, MagicWand, Diamond, ChatsCircle, Waveform, ArrowRight, WarningCircle, Sparkle, Cpu, SpeakerSimpleHigh, Star, Key, ArrowsClockwise } from '@phosphor-icons/react';
import { wordDiff } from '@/lib/diff';
import { LevelBadge, Panel, Score, Segmented, Skeleton } from './ui';

const ease = [0.16, 1, 0.3, 1] as const;

// ---------- micro-badges ----------
const Chip = ({ tone = 'neutral', children, title = undefined }: { tone?: string; children: React.ReactNode; title?: string }) => {
  const T = {
    neutral: 'border border-line text-ink-2',
    brick: 'bg-brick-soft text-brick',
    emerald: 'bg-emerald-soft text-emerald',
    amber: 'bg-amber-soft text-amber',
    indigo: 'bg-indigo-soft text-indigo',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] leading-5 font-medium ${T[tone]}`}>
      {children}
    </span>
  );
};

const IpaChip = ({ ipa, word = undefined }: { ipa: string; word?: string }) =>
  ipa ? (
    <Chip tone="indigo" title={word ? `Pronunciation of "${word}"` : 'Pronunciation'}>
      <SpeakerSimpleHigh size={12} weight="fill" />
      <span className="font-mono tracking-tight">{ipa}</span>
    </Chip>
  ) : null;

/** Inline word-level diff: deletions struck through in brick, insertions in emerald. */
function Diff({ before, after, large = false }) {
  const parts = wordDiff(before, after);
  return (
    <span className={`font-serif ${large ? 'text-[19px] leading-8' : 'text-[16px] leading-7'}`}>
      {parts.map((p, i) =>
        p.type === 'same' ? (
          <span key={i}>{p.text} </span>
        ) : p.type === 'del' ? (
          <del key={i} className="mr-1 text-ink-3 decoration-ink-3/70 decoration-[1.5px]">
            {p.text}
          </del>
        ) : (
          <ins key={i} className="mr-1 rounded-[4px] bg-emerald-soft px-1 text-emerald no-underline">
            {p.text}
          </ins>
        ),
      )}
    </span>
  );
}

// ---------- annotated manuscript ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits the learner text into plain and marked segments for each grammar item it can locate. */
function annotate(text, items) {
  const marks = [];
  items.forEach((g, i) => {
    if (!g.before?.trim()) return;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(g.before.trim())}(?![\\p{L}\\p{N}])`, 'iu');
    let offset = 0;
    let rest = text;
    while (rest) {
      const m = re.exec(rest);
      if (!m) break;
      const start = offset + m.index;
      const end = start + m[0].length;
      if (!marks.some((k) => start < k.end && end > k.start)) {
        marks.push({ start, end, i });
        break;
      }
      offset = end;
      rest = text.slice(end);
    }
  });
  marks.sort((a, b) => a.start - b.start);
  const out = [];
  let pos = 0;
  for (const m of marks) {
    if (m.start > pos) out.push({ text: text.slice(pos, m.start) });
    out.push({ text: text.slice(m.start, m.end), i: m.i });
    pos = m.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return { segments: out, located: marks.length };
}

function Manuscript({ text, items, active, onPick }) {
  const { segments, located } = useMemo(() => annotate(text, items), [text, items]);
  return (
    <figure className="rounded-[10px] bg-paper px-4 py-3.5">
      <p className="font-serif text-[17px] leading-8 whitespace-pre-wrap text-ink-2">
        {segments.map((s, k) =>
          s.i === undefined ? (
            <span key={k}>{s.text}</span>
          ) : (
            <button
              key={k}
              onClick={() => onPick(s.i)}
              className={`rounded-[3px] text-ink underline decoration-wavy decoration-[1.5px] underline-offset-[5px] transition-colors ${active === s.i ? 'bg-amber-soft decoration-amber' : 'decoration-amber/60 hover:bg-amber-soft/60'}`}
              aria-label={`Polish point ${s.i + 1}: ${s.text}`}
            >
              {s.text}
              <sup className="ml-0.5 font-sans text-[10px] font-semibold text-amber no-underline">{s.i + 1}</sup>
            </button>
          ),
        )}
      </p>
      {items.length > 0 && (
        <figcaption className="mt-2 text-xs text-ink-3">
          {located} of {items.length} polish points marked in your text. Tap one to open it.
        </figcaption>
      )}
    </figure>
  );
}

// ---------- accordion ----------
function AccordionItem({ open, onToggle, index, header, children }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 py-3.5 text-left">
        <span className="w-5 shrink-0 pt-1 font-serif text-[15px] leading-none text-ink-3">{index}</span>
        <span className="min-w-0 flex-1">{header}</span>
        <CaretDown size={16} className={`mt-1 shrink-0 text-ink-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
            <div className="space-y-3 pb-4 pl-8">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function PolishItem({ g, i, open, onToggle }) {
  return (
    <AccordionItem
      index={i + 1}
      open={open}
      onToggle={onToggle}
      header={
        <span className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <Chip tone="amber">{g.category}</Chip>
            {g.severity === 'global' ? (
              <Chip tone="indigo">
                <Key size={11} weight="fill" /> Key to next level
              </Chip>
            ) : (
              <Chip tone="neutral">Meaning was clear</Chip>
            )}
            <IpaChip ipa={g.ipa} />
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2 font-serif text-[16px]">
            <span className="text-ink-3 line-through decoration-ink-3/60">{g.before}</span>
            <ArrowRight size={13} className="self-center text-ink-3" />
            <span className="text-emerald">{g.after}</span>
          </span>
        </span>
      }
    >
      <div className="rounded-[10px] border border-line px-3.5 py-2.5">
        <Diff before={g.before} after={g.after} large />
      </div>
      <p className="text-[14.5px] leading-relaxed text-ink-2">{g.rule}</p>
      {g.context && <p className="font-serif text-[15px] text-ink-3 italic">&ldquo;{g.context}&rdquo;</p>}
    </AccordionItem>
  );
}

/**
 * ACTFL tolerance: at A1-A2, slips that keep the meaning clear are grouped as optional polish
 * (already modelled in the recast); meaning-blocking items come first.
 */
function GrammarLayer({ items, openIdx, setOpenIdx, tolerant }) {
  if (!items.length) return <Empty title="Nothing to polish">Clean work. Try a harder task or a longer answer next time.</Empty>;
  const indexed = items.map((g, i) => ({ g, i }));
  const groups = tolerant
    ? [
        { title: null, list: indexed.filter(({ g }) => g.severity === 'global') },
        { title: 'Optional polish: your meaning was already clear', list: indexed.filter(({ g }) => g.severity !== 'global') },
      ]
    : [{ title: null, list: indexed }];
  return (
    <div className="space-y-2">
      {groups
        .filter((grp) => grp.list.length)
        .map((grp) => (
          <div key={grp.title ?? 'main'}>
            {grp.title && <p className="pt-2 text-[12.5px] font-medium text-ink-3">{grp.title}</p>}
            <ol>
              {grp.list.map(({ g, i }) => (
                <PolishItem key={i} g={g} i={i} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
              ))}
            </ol>
          </div>
        ))}
    </div>
  );
}

/** Corrective recast: the learner's message re-said naturally; only added words are highlighted, nothing is struck out. */
function RecastBlock({ text, recast, early }) {
  const parts = wordDiff(text, recast);
  return (
    <section className="rounded-[14px] border border-line px-4 py-3.5" aria-label="Natural recast">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink-2">
          <ArrowsClockwise size={14} weight="bold" /> Natural Recast
        </span>
        <span className="text-ink-3">{early ? 'how it sounds naturally' : 'your text, polished'}</span>
      </div>
      <p className="font-serif text-[17px] leading-8">
        {parts
          .filter((p) => p.type !== 'del')
          .map((p, k) =>
            p.type === 'same' ? (
              <span key={k}>{p.text} </span>
            ) : (
              <span key={k} className="rounded-[4px] bg-emerald-soft px-1 text-emerald">
                {p.text}{' '}
              </span>
            ),
          )}
      </p>
      {early && <p className="mt-1 text-[12px] text-ink-3">Read it once out loud. The green words are the polish; your ideas stay the same.</p>}
    </section>
  );
}

function VocabLayer({ items, openIdx, setOpenIdx }) {
  if (!items.length) return <Empty title="No upgrades this time">Use a few more describing words (good, big, important) and the coach will suggest stronger ones.</Empty>;
  return (
    <ol>
      {items.map((v, i) => (
        <AccordionItem
          key={i}
          index={i + 1}
          open={openIdx === i}
          onToggle={() => setOpenIdx(openIdx === i ? null : i)}
          header={
            <span className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-baseline gap-x-2 font-serif text-[17px]">
                <span className="text-ink-3">{v.original}</span>
                <ArrowRight size={13} className="self-center text-ink-3" />
                <span className="font-medium text-ink">{v.upgrade}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <LevelBadge level={v.level} />
                <IpaChip ipa={v.ipa} word={v.upgrade} />
                {v.stretch && <Chip tone="emerald">Later: {v.stretch}</Chip>}
              </span>
            </span>
          }
        >
          <p className="font-serif text-[16px] text-ink-2 italic">&ldquo;{v.example}&rdquo;</p>
          {v.stretch && <p className="text-[13.5px] text-ink-3">The stretch option is for C1/C2. Recognise it now; start using it once {v.upgrade} feels natural.</p>}
        </AccordionItem>
      ))}
    </ol>
  );
}

function RegisterLayer({ tone }) {
  const tones = { informal: 'amber', neutral: 'neutral', formal: 'indigo' };
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-3">Register</span>
        <Chip tone={tones[tone.register] ?? 'neutral'}>
          <span className="capitalize">{tone.register}</span>
        </Chip>
      </div>
      <p className="font-serif text-[17px] leading-relaxed">{tone.summary}</p>
      {tone.notes?.length > 0 && (
        <ul className="space-y-2.5">
          {tone.notes.map((n, i) => (
            <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-2">
              <span className="mt-2.5 h-px w-3 shrink-0 bg-line-strong" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SoundLayer({ speaking, pronunciation }) {
  const ipa = pronunciation?.length ? pronunciation : (speaking?.ipa ?? []);
  return (
    <div className="space-y-6 pt-2">
      {speaking && (
        <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-line">
          {[
            ['Words', speaking.wordCount, null],
            ['Per minute', speaking.wpm ?? '-', 'natural pace 110 to 150'],
            ['Fillers', speaking.fillerTotal, Object.entries(speaking.fillers).map(([k, v]) => `${k} ×${v}`).join(', ') || 'none'],
            ['Variety', `${speaking.sentenceVariety}%`, 'different openers'],
          ].map(([label, value, hint]) => (
            <div key={label} className="sm:px-4 sm:first:pl-0">
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className="font-serif text-[28px] leading-tight font-medium tabular-nums">{value}</dd>
              {hint && <dd className="text-[11.5px] text-ink-3">{hint}</dd>}
            </div>
          ))}
        </dl>
      )}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Words to watch</h4>
        {ipa.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {ipa.map((p) => (
              <li key={p.word} className="rounded-[10px] border border-line px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-lg font-medium">{p.word}</span>
                  <span className="font-mono text-[13px] text-indigo">{p.ipa}</span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-ink-3">{p.tip}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No tricky words in this text.</p>
        )}
      </div>
    </div>
  );
}

function Empty({ title, children }) {
  return (
    <div className="py-6">
      <p className="font-serif text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm text-ink-3">{children}</p>
    </div>
  );
}

/** Strength-First rule: one concrete thing done well, before any polish. */
function StrengthBlock({ strengths }) {
  if (!strengths.length) return null;
  const [first, ...rest] = strengths;
  return (
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="rounded-[14px] bg-gradient-to-br from-emerald-soft to-raised px-4 py-3.5 ring-1 ring-emerald/20 ring-inset" aria-label="Strength recognition">
      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald">
        <Star size={14} weight="fill" /> Strength Recognition
      </div>
      <p className="font-serif text-[17px] leading-snug text-ink">{first}</p>
      {rest.length > 0 && (
        <ul className="mt-2 space-y-1">
          {rest.map((r) => (
            <li key={r} className="flex gap-2 text-[13.5px] text-ink-2">
              <Sparkle size={13} weight="fill" className="mt-1 shrink-0 text-emerald" /> {r}
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

// ---------- card ----------
export default function FeedbackCard({ feedback, loading, text, level = 'A1' }) {
  const [layer, setLayer] = useState('grammar');
  const [openGrammar, setOpenGrammar] = useState(0);
  const [openVocab, setOpenVocab] = useState(0);

  if (loading)
    return (
      <Panel className="space-y-5 p-6" aria-busy="true" aria-label="Analysing">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[68px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-80 rounded-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </Panel>
    );

  if (!feedback)
    return (
      <Panel className="flex flex-col justify-between p-7 xl:min-h-[420px]">
        <div>
          <p className="font-serif text-2xl font-medium tracking-tight">Feedback in three layers</p>
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-2">Submit your answer and each part will be marked and explained here.</p>
        </div>
        <ol className="mt-8 space-y-4">
          {[
            [Star, 'Strength first', 'What you did well, quoted from your own words.'],
            [MagicWand, 'Next-level polish', 'Small before-and-after fixes, recast naturally at A1-A2 so your flow is never cut.'],
            [Diamond, 'Vocabulary', 'Stronger words one step above your level, plus a C1/C2 option.'],
            [ChatsCircle, 'Register', 'Tone, linking words and sentence variety.'],
          ].map(([Icon, title, body]: [typeof Star, string, string]) => (
            <li key={title} className="flex gap-3">
              <Icon size={20} className="mt-0.5 shrink-0 text-ink-3" />
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-sm text-ink-3">{body}</div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    );

  const hasSound = Boolean(feedback.speaking) || feedback.pronunciation?.length > 0;
  const layers = [
    { id: 'grammar', label: 'Polish', icon: MagicWand, count: feedback.grammar.length },
    { id: 'vocab', label: 'Vocabulary', icon: Diamond, count: feedback.vocabulary.length },
    { id: 'tone', label: 'Register', icon: ChatsCircle },
    ...(hasSound ? [{ id: 'sound', label: feedback.speaking ? 'Fluency' : 'Sound', icon: Waveform }] : []),
  ];

  function pickMark(i) {
    setLayer('grammar');
    setOpenGrammar(i);
  }

  return (
    <Panel className="p-5 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="space-y-5">
        <StrengthBlock strengths={feedback.strengths ?? (feedback.strength ? [feedback.strength] : [])} />
        {feedback.recast && text && <RecastBlock text={text} recast={feedback.recast} early={['A1', 'A2'].includes(level)} />}
        <header className="flex items-start gap-4">
          <Score value={feedback.score} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              Estimated level <LevelBadge level={feedback.estimatedLevel} />
              <span className="ml-auto inline-flex items-center gap-1">
                {feedback.source === 'claude' ? <Sparkle size={13} /> : <Cpu size={13} />}
                {feedback.source === 'claude' ? 'Claude' : 'Offline rules'}
              </span>
            </div>
            <p className="font-serif text-[17px] leading-snug">{feedback.summary}</p>
          </div>
        </header>

        {feedback.warning && (
          <p className="flex items-start gap-2 rounded-[10px] bg-amber-soft px-3 py-2 text-[13px] text-amber">
            <WarningCircle size={16} className="mt-px shrink-0" /> {feedback.warning}
          </p>
        )}

        {text && <Manuscript text={text} items={feedback.grammar} active={layer === 'grammar' ? openGrammar : null} onPick={pickMark} />}

        <Segmented id="layer" items={layers} value={layer} onChange={setLayer} size="sm" />

        <AnimatePresence mode="wait">
          <motion.div key={layer} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}>
            {layer === 'grammar' && <GrammarLayer items={feedback.grammar} openIdx={openGrammar} setOpenIdx={setOpenGrammar} tolerant={['A1', 'A2'].includes(level)} />}
            {layer === 'vocab' && <VocabLayer items={feedback.vocabulary} openIdx={openVocab} setOpenIdx={setOpenVocab} />}
            {layer === 'tone' && <RegisterLayer tone={feedback.tone} />}
            {layer === 'sound' && <SoundLayer speaking={feedback.speaking} pronunciation={feedback.pronunciation} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </Panel>
  );
}

/** Converts feedback into ledger/vault entries for /api/activity. */
export function feedbackToActivity(feedback) {
  return {
    errors: feedback.grammar.map((g) => ({ category: g.category, before: g.before, after: g.after, rule: g.rule })),
    // Original = the learner's word, Upgraded = the stronger word to learn (reviewed as an upgrade card).
    vocabulary: feedback.vocabulary.map((v) => ({ original: v.original, upgraded: v.upgrade, cefr: v.level, meaning: '', example: v.example })),
  };
}
