'use client';

import { useEffect, useRef, useState } from 'react';
import { Marked } from 'marked';
import { PaperPlaneRight, Stop, Sparkle, ArrowCounterClockwise } from '@phosphor-icons/react';
import { streamChat } from '@/api';
import { readStored, writeStored } from '@/lib/useActivity';
import { Button, Panel } from './ui';

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Replies can quote the learner, so raw HTML is shown as text, never rendered.
const marked = new Marked({ gfm: true, breaks: true, renderer: { html: ({ text }) => escapeHtml(text) } });

const STARTERS = ['Start today’s lesson at my level.', 'Give me a short speaking drill about my daily routine.', 'Check this sentence: "I am working in a office since 2020."', 'Teach me 3 travel phrases with IPA.'];

/** The saved conversation (JSON in localStorage); anything unreadable starts a fresh chat. */
function loadHistory() {
  try {
    const list = JSON.parse(readStored('coach.chat', '[]'));
    return Array.isArray(list) ? list.filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string') : [];
  } catch {
    return [];
  }
}

/** Free chat with the coach (Claude, CLAUDE.md as the system prompt), streamed token by token. */
export default function CoachChat({ llm }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(loadHistory);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const abort = useRef(null);
  const end = useRef(null);

  useEffect(() => {
    if (!busy) writeStored('coach.chat', JSON.stringify(messages.slice(-40)));
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  async function send(text) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setError(null);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await streamChat(history, {
        signal: abort.current.signal,
        onText: (t) => setMessages((ms) => [...ms.slice(0, -1), { role: 'assistant', content: ms.at(-1).content + t }]),
      });
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
      setMessages((ms) => (ms.at(-1)?.content ? ms : ms.slice(0, -1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Koç</h1>
          <p className="mt-2 text-ink-2">Lumos ile İngilizce konuş. Alt bantlarını, serini, tekrar zamanı gelen kelimelerini ve Polish kalıplarını biliyor.</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={busy}>
            <ArrowCounterClockwise size={14} /> Yeni sohbet
          </Button>
        )}
      </header>

      {!llm && <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2">Yapay zekâ koçu çevrimdışı. <code className="font-mono">api.php</code> ile aynı klasördeki <code className="font-mono">.env</code> dosyasına <code className="font-mono">GEMINI_API_KEY</code> ekleyin. Çalışma görevleri çevrimdışı geri bildirimle çalışmaya devam eder.</p>}

      <Panel className="flex min-h-[460px] flex-col">
        <div className="flex-1 space-y-6 px-6 py-6" aria-live="polite">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-sm text-ink-3">
                <Sparkle size={16} /> Bunlardan birini dene
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={!llm} className="rounded-full border border-line-strong px-4 py-2 text-left text-sm hover:border-ink disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ml-auto max-w-[80%] rounded-[12px] rounded-br-[4px] border border-line-strong bg-sunk px-3.5 py-2.5 whitespace-pre-wrap text-ink">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="prose-session max-w-[65ch] text-[15px]">
                  {m.content ? <div dangerouslySetInnerHTML={{ __html: marked.parse(m.content) }} /> : <span className="inline-block h-4 w-2 animate-pulse bg-ink-3" aria-label="Koç yazıyor" />}
                </div>
              ),
            )
          )}
          <div ref={end} />
        </div>

        {error && (
          <p role="alert" className="border-t border-line px-6 py-3 text-sm text-brick">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2 border-t border-line p-3"
        >
          <label htmlFor="chat-input" className="sr-only">
            Koça mesaj yaz
          </label>
          <textarea
            id="chat-input"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder={llm ? 'İngilizce yaz. Göndermek için Enter, yeni satır için Shift+Enter.' : 'Yapay zekâ koçu çevrimdışı'}
            disabled={!llm}
            className="min-h-12 flex-1 resize-none rounded-xl bg-sunk px-4 py-3 outline-none focus:ring-2 focus:ring-line-strong"
          />
          {busy ? (
            <Button type="button" variant="secondary" onClick={() => abort.current?.abort()}>
              <Stop size={16} /> Durdur
            </Button>
          ) : (
            <Button type="submit" disabled={!draft.trim() || !llm}>
              <PaperPlaneRight size={16} /> Gönder
            </Button>
          )}
        </form>
      </Panel>
    </div>
  );
}
