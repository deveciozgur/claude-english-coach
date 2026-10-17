'use client';

import { useEffect, useState } from 'react';
import { PaperPlaneRight, ArrowCounterClockwise, ArrowRight, Lightbulb } from '@phosphor-icons/react';
import { api } from '@/api';
import { readStored, useActivity, writeStored } from '@/lib/useActivity';
import FeedbackCard, { feedbackToActivity } from './FeedbackCard';
import { Button, Panel, SaveReceipt, TaskPicker, TaskTitle, TurkishHint } from './ui';

/** A half-finished answer built from the sentence starters, for the frustration shield. */
const starter = (task) => (task.hints ?? []).join(' ');

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Ruled-paper background aligned to the 32px line height of the textarea.
const RULED = {
  backgroundImage: 'linear-gradient(to bottom, transparent 31px, var(--line) 31px, var(--line) 32px)',
  backgroundSize: '100% 32px',
  backgroundPositionY: '20px',
};

export default function WritingModule({ level, tasks, onActivitySaved, passedIds = [], shield = false }) {
  const [index, setIndex] = useState(0);
  const task = tasks[index];
  const draftKey = `coach.draft.${task.id}`;
  const [text, setText] = useState(() => readStored(draftKey, ''));
  const [submitted, setSubmitted] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activity = useActivity(onActivitySaved);

  useEffect(() => writeStored(draftKey, text), [draftKey, text]);

  const words = countWords(text);
  const enough = words >= task.minWords;

  async function submit() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setSubmitted(text);
    activity.reset();
    try {
      const fb = await api.feedback({ mode: 'writing', text, level, task: { title: task.title, prompt: task.prompt, minWords: task.minWords, maxWords: task.maxWords, register: task.register } });
      setFeedback(fb);
      await activity.save({
        skill: 'writing',
        level,
        score: fb.score,
        taskId: task.id,
        fn: task.fn,
        taskTitle: task.title,
        response: text,
        summary: `${fb.summary} (estimated ${fb.estimatedLevel}, ${words} words, ${fb.source} feedback)`,
        ...feedbackToActivity(fb),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function go(i) {
    setIndex(i);
    setText(readStored(`coach.draft.${tasks[i].id}`, ''));
    setFeedback(null);
    activity.reset();
  }

  return (
    <div className="grid [&>*]:min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-10">
      <div className="space-y-6">
        <div className="space-y-4">
          <TaskTitle level={level} title={task.title} theme={task.theme} hook={task.hook} fn={task.fn} skill="writing">
            <TaskPicker tasks={tasks} index={index} onChange={go} passedIds={passedIds} />
          </TaskTitle>
          <p className="max-w-[60ch] font-serif text-[19px] leading-relaxed">{task.prompt}</p>
          {task.tr && <TurkishHint>{task.tr}</TurkishHint>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
            <span>
              {task.minWords} to {task.maxWords} words
            </span>
            <span>{task.register.charAt(0).toUpperCase() + task.register.slice(1)} register</span>
          </div>
          {task.hints?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Lightbulb size={16} className="text-amber" aria-hidden />
              <span className="sr-only">Sentence starters:</span>
              {task.hints.map((h) => (
                <button
                  key={h}
                  onClick={() => setText((t) => (t ? `${t.trimEnd()} ${h}` : h))}
                  className="rounded-full border border-dashed border-line-strong px-2.5 py-1 font-serif text-[14px] text-ink-2 italic transition-colors hover:border-ink hover:text-ink"
                  title="Insert into your text"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        {shield && !text.trim() && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-soft/70 px-4 py-3">
            <p className="min-w-0 flex-1 font-serif text-[16px] text-ink-2 italic">{starter(task)}</p>
            <Button size="sm" onClick={() => setText(starter(task))}>
              Start me off
            </Button>
          </div>
        )}

        <Panel className="overflow-hidden">
          <label htmlFor="writing-input" className="sr-only">
            Your answer
          </label>
          <textarea
            id="writing-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={11}
            spellCheck={false}
            placeholder="Start writing here. Spell-check is off, so we see your natural English."
            style={RULED}
            className="block w-full resize-y bg-transparent px-6 pt-5 pb-6 font-serif text-[18px] leading-[32px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className={`font-mono text-xs ${enough ? 'text-emerald' : 'text-ink-3'}`} aria-live="polite">
              {words} / {task.minWords}+ words
            </span>
            <Button onClick={submit} disabled={!words || loading}>
              <PaperPlaneRight size={16} weight="fill" /> {feedback ? 'Resubmit' : 'Get feedback'}
            </Button>
          </div>
        </Panel>

        {error && (
          <p className="text-sm text-brick" role="alert">
            {error}
          </p>
        )}
        <SaveReceipt result={activity.result} error={activity.error} />
        {feedback && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFeedback(null)}>
              <ArrowCounterClockwise size={16} /> Revise
            </Button>
            {tasks.length > 1 && (
              <Button variant="ghost" onClick={() => go((index + 1) % tasks.length)}>
                Next task <ArrowRight size={16} />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <FeedbackCard feedback={feedback} loading={loading} text={submitted} level={level} />
      </div>
    </div>
  );
}
