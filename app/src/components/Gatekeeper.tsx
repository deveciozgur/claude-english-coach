'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LockSimple, ArrowRight, Eye, EyeSlash } from '@phosphor-icons/react';
import { api } from '@/api';

const ease = [0.16, 1, 0.3, 1] as const;

/** Lock screen. The PIN is checked on the server (APP_SECRET_PIN); a correct PIN sets an HttpOnly session cookie. */
export default function Gatekeeper({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  async function submit(e) {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.verify(pin);
      onUnlock();
    } catch (err) {
      setError(err.message);
      setShake((n) => n + 1);
      setPin('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-sunk px-14 py-12 lg:flex">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-medium tracking-tight">Lumos</span>
          <span className="text-sm text-ink-3">AI English Coach</span>
          <span className="rounded-full border border-line-strong px-1.5 py-px font-mono text-[10px] text-ink-3">v1.0</span>
        </div>
        <div className="space-y-6">
          <p className="font-serif text-[64px] leading-[0.95] font-medium tracking-tight">
            A1 <span className="text-ink-3">to</span> C2,
            <br />
            <span className="italic">one sub-band</span> at a time.
          </p>
          <p className="max-w-md text-ink-2">Can-Do goals, spaced repetition and strength-first feedback, saved to your own files on your own server.</p>
        </div>
        <ol className="flex gap-2" aria-hidden>
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l, i) => (
            <li key={l} className={`flex h-9 flex-1 items-end rounded-md px-2 pb-1 font-mono text-[11px] ${i === 0 ? 'bg-amber-soft text-amber' : 'bg-paper text-ink-3'}`}>
              {l}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex items-center justify-center px-4 py-16">
        <motion.form
          key={shake}
          onSubmit={submit}
          initial={shake ? { x: 0 } : { opacity: 0, y: 12 }}
          animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : { opacity: 1, y: 0 }}
          transition={{ duration: shake ? 0.4 : 0.6, ease }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="space-y-3">
            <span className="grid size-11 place-items-center rounded-full border border-line-strong">
              <LockSimple size={20} />
            </span>
            <h1 className="font-serif text-4xl font-medium tracking-tight">Welcome back, Özgür.</h1>
            <p className="text-ink-2">Enter your PIN to open the coaching studio.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">
              PIN
            </label>
            <div className="relative">
              <input
                ref={input}
                id="pin"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'pin-error' : undefined}
                className="h-12 w-full rounded-xl border border-line-strong bg-raised px-4 pr-12 font-mono text-lg tracking-[0.3em] outline-none focus:border-ink"
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide PIN' : 'Show PIN'} className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-ink-3 hover:text-ink">
                {show ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p id="pin-error" role="alert" className="text-sm text-brick">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!pin || busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-medium text-paper transition-transform active:scale-[0.98] disabled:bg-line-strong"
          >
            {busy ? 'Checking…' : 'Unlock'} <ArrowRight size={16} />
          </button>
          <p className="text-center text-xs text-ink-3">Özgür Deveci · Lumos AI English Coach v1.0</p>
        </motion.form>
      </section>
    </div>
  );
}
