// Triple-Layer feedback via the Claude API, following the coach rules in CLAUDE.md.
// Falls back to the offline heuristic engine when no credentials are configured or a
// request fails, so the app always works.

import Anthropic from '@anthropic-ai/sdk';
import { heuristicFeedback, speakingMetrics } from './heuristics.js';
import { readCoachInstructions, readErrors, readProfile } from './store.js';

export const MODEL = process.env.COACH_MODEL ?? 'claude-opus-5-5';

export const llmConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client = null;
export const getClient = () => (client ??= new Anthropic());

const str = { type: 'string' };
const FEEDBACK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['strengths', 'recast', 'score', 'estimatedLevel', 'summary', 'grammar', 'vocabulary', 'tone', 'pronunciation'],
  properties: {
    recast: {
      type: 'string',
      description: "The learner's whole text re-said naturally with all polish applied, keeping their ideas and words where possible (corrective recast).",
    },
    strengths: {
      type: 'array',
      description: '1-3 specific things the learner did well, each quoting their own words. The first is the most impressive.',
      items: str,
    },
    score: { type: 'integer', description: '0-100: accuracy and task achievement measured at the task level' },
    estimatedLevel: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    summary: { type: 'string', description: 'One or two encouraging sentences framing the polish points as keys to the next level' },
    grammar: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['before', 'after', 'rule', 'category', 'ipa', 'severity'],
        properties: { severity: { type: 'string', enum: ['local', 'global'], description: 'ACTFL: global = blocks or changes meaning; local = meaning still clear' }, before: str, after: str, rule: str, ipa: { type: 'string', description: 'British IPA of the key corrected word, e.g. "/wɜːks/", or empty string' }, category: { type: 'string', description: 'Short error category, e.g. "Present simple (3rd person -s)", "Prepositions of place", "Articles"' } },
      },
    },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['original', 'upgrade', 'level', 'example', 'stretch', 'ipa'],
        properties: { original: str, upgrade: str, ipa: { type: 'string', description: 'British IPA of the upgrade word, e.g. "/ˈeksələnt/"' }, level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }, example: str, stretch: { type: 'string', description: 'Optional C1/C2 alternative for later, or empty string' } },
      },
    },
    tone: {
      type: 'object',
      additionalProperties: false,
      required: ['register', 'summary', 'notes'],
      properties: { register: { type: 'string', enum: ['informal', 'neutral', 'formal'] }, summary: str, notes: { type: 'array', items: str } },
    },
    pronunciation: {
      type: 'array',
      description: 'Up to 5 words from the learner text that a Turkish speaker may mispronounce based on spelling',
      items: { type: 'object', additionalProperties: false, required: ['word', 'ipa', 'tip'], properties: { word: str, ipa: str, tip: str } },
    },
  },
};

function buildPrompt({ mode, text, level, task, profile, topErrors }) {
  return [
    `<learner_profile>\n${JSON.stringify({ skill_bands: profile.skill_bands, overall: profile.sub_band, target: profile.target_cefr, interests: profile.interests, weaknesses: profile.metrics?.weaknesses ?? [] })}\n</learner_profile>`,
    topErrors.length ? `<recurring_errors>\n${topErrors.map((e) => `- [${e.category}] "${e.before}" → "${e.after}" (×${e.count})`).join('\n')}\n</recurring_errors>` : '',
    `<task level="${level}" mode="${mode}">\n${task.title ?? ''}\n${task.prompt ?? ''}${task.minWords ? `\nTarget length: ${task.minWords}-${task.maxWords ?? task.minWords * 2} words.` : ''}${task.register ? `\nExpected register: ${task.register}.` : ''}\n</task>`,
    `<learner_${mode === 'speaking' ? 'transcript' : 'text'}>\n${text}\n</learner_${mode === 'speaking' ? 'transcript' : 'text'}>`,
    [
      'Give Triple-Layer feedback on the learner response above, as Apex, following the Strength-First rule.',
      '- strengths: before any correction, name 1-3 concrete things done well or bravely attempted, quoting the learner (e.g. You used "since" instead of "because", which sounds fluent).',
      '- Frame every correction as a "quick polish" that unlocks the next level. Never use the words "wrong", "mistake" or "error" in rule or summary text; keep the tone warm and specific.',
      `- grammar: the most important errors first (at most 5). "before" and "after" must be short exact fragments from the text and their corrected form. Write "rule" as a short explanation the learner can understand at ${level}; a short Turkish gloss in parentheses is welcome for A1–A2.`,
      `- vocabulary: 1-4 upgrades one step above the learner's level (i+1), never far above it. Put the C1/C2 option in "stretch".`,
      '- tone: register plus cohesion notes (discourse markers, sentence variety).',
      ['A1', 'A2'].includes(level)
        ? '- ACTFL tolerance (A1-A2): local slips that keep the meaning clear are tolerated; mark them severity "local", keep them out of the score as far as possible, and model the fix through the recast instead of interrupting. Only meaning-blocking issues are "global".'
        : ['B1'].includes(level)
          ? '- ACTFL tolerance (B1): local slips count lightly; global (meaning-blocking) issues count fully.'
          : '- ACTFL (B2-C2): sociolinguistic appropriacy, idiomaticity and cultural fit are required. Flag register mismatches, unidiomatic collocations and culturally odd phrasing in tone notes and grammar items, and score them.',
      '- ipa: give British IPA between slashes for the key corrected word (grammar) and for each upgrade word (vocabulary).',
      '- pronunciation: up to 5 words from the learner text that a Turkish speaker may mispronounce, with IPA and a one-line tip.',
      mode === 'speaking' ? '- This is a speech-to-text transcript: ignore punctuation and capitalisation, and judge spoken grammar, collocations and fluency.' : '',
      '- If a recurring error appears again, list it first.',
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateFeedback(input) {
  const { mode, text, durationSec } = input;
  if (!llmConfigured()) return heuristicFeedback(input);

  try {
    const [instructions, profile, errors] = await Promise.all([readCoachInstructions(), readProfile(), readErrors()]);
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: instructions || 'You are Apex, an English coach and CEFR assessor.',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: FEEDBACK_SCHEMA } },
      messages: [{ role: 'user', content: buildPrompt({ ...input, task: input.task ?? {}, profile, topErrors: errors.active.slice(0, 5) }) }],
    });

    if (response.stop_reason === 'refusal') throw new Error('The model declined this request');
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error(`No text in response (stop_reason: ${response.stop_reason})`);
    const data = JSON.parse(textBlock.text);

    const result = { source: 'claude', model: response.model, ...data, strength: data.strengths?.[0] ?? '' };
    if (mode === 'speaking') result.speaking = { ...speakingMetrics(text, durationSec), ipa: data.pronunciation };
    return result;
  } catch (err) {
    const reason =
      err instanceof Anthropic.AuthenticationError
        ? 'Claude API key was rejected'
        : err instanceof Anthropic.RateLimitError
          ? 'Claude API rate limit reached'
          : err instanceof Anthropic.APIConnectionError
            ? 'Could not reach the Claude API'
            : err instanceof Anthropic.APIError
              ? `Claude API error (${err.status ?? 'unknown'})`
              : err.message;
    console.warn(`[feedback] falling back to heuristic engine: ${reason}`);
    return { ...heuristicFeedback(input), warning: `${reason}. Showing offline feedback instead.` };
  }
}
