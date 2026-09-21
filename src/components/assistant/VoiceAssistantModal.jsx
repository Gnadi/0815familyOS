import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  Mic,
  Repeat,
  ShoppingCart,
  Sparkles,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import useAuth from '../../hooks/useAuth';
import useCategories from '../../hooks/useCategories';
import useFamilyMembers from '../../hooks/useFamilyMembers';
import useT from '../../hooks/useT';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import { tLabel } from '../../i18n/labels';
import { DEFAULT_CATEGORY } from '../../constants/eventCategories';
import {
  DEFAULT_TASK_CATEGORY,
  TASK_CATEGORY_LIST,
  TASK_PRIORITY_MAP,
} from '../../constants/taskCategories';
import { isDemoMode } from '../../lib/demoMode';
import { applyAssistantActions, interpretTranscript } from '../../services/assistant';
import { buildAssistantContext, normalizeAssistantActions } from '../../utils/assistantPlan';
import { describeRecurrence } from '../../utils/recurrence';

// Speak a sentence, get entries. The model only ever proposes: nothing is
// written until the review list below has been confirmed, because a misheard
// word in a shared family calendar is worse than one extra tap.

const KIND_ICON = {
  create_event: Calendar,
  create_task: CheckSquare,
  add_shopping_item: ShoppingCart,
};

const KIND_LABEL_KEY = {
  create_event: 'assistant.kindEvent',
  create_task: 'assistant.kindTask',
  add_shopping_item: 'assistant.kindShopping',
};

const SPEECH_ERROR_KEY = {
  denied: 'assistant.micDenied',
  'no-speech': 'assistant.micNoSpeech',
  network: 'assistant.micNetwork',
  audio: 'assistant.micAudio',
  failed: 'assistant.micFailed',
};

function KindIcon({ type }) {
  const Icon = KIND_ICON[type];
  return Icon ? <Icon size={13} /> : null;
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

export default function VoiceAssistantModal({ open, onClose }) {
  const { user, userDoc, family } = useAuth();
  const { list: categories } = useCategories();
  const members = useFamilyMembers();
  const { t, tn, locale } = useT();
  const speech = useSpeechRecognition(locale);

  // 'input' -> 'thinking' -> 'review' -> 'done'
  const [phase, setPhase] = useState('input');
  const [typed, setTyped] = useState('');
  const [plan, setPlan] = useState([]);
  const [reply, setReply] = useState('');
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const kids = family?.kids || [];
  const wasListening = useRef(false);
  const inFlight = useRef(null);

  const resetAll = useCallback(() => {
    setPhase('input');
    setTyped('');
    setPlan([]);
    setReply('');
    setSkipped(0);
    setError('');
    setSaving(false);
    setSavedCount(0);
    speech.reset();
    // `speech` is a fresh object every render; only its `reset` identity matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.reset]);

  const restart = useCallback(() => {
    resetAll();
    if (speech.supported) speech.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAll, speech.supported, speech.start]);

  // Opening the sheet is itself the user gesture the microphone needs, so
  // recording starts right away: tap, speak, done. Closing it has to hand the
  // microphone back -- this component stays mounted behind its trigger, so
  // nothing else would.
  useEffect(() => {
    if (!open) {
      inFlight.current?.abort();
      inFlight.current = null;
      speech.stop();
      return;
    }
    restart();
    // Only on open; the callbacks above are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = useCallback(
    async (text) => {
      const transcript = (text || '').trim();
      if (!transcript) return;
      // A sentence that is already on its way must not keep collecting words.
      speech.stop();
      setError('');
      setPhase('thinking');

      // The same roster is what the model is told and what its answer is
      // validated against, so it is built once.
      const roster = {
        categories: categories.map((c) => ({ id: c.id, label: tLabel(t, c) })),
        taskCategories: TASK_CATEGORY_LIST.map((c) => ({ id: c.id, label: tLabel(t, c) })),
        kids: kids.map((k) => ({ id: k.id, name: k.name })),
        members: members.map((m) => ({ id: m.uid, name: m.displayName })),
      };

      const controller = new AbortController();
      inFlight.current = controller;
      try {
        const context = buildAssistantContext({
          now: new Date(),
          locale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          ...roster,
        });
        const result = await interpretTranscript({ transcript, context, signal: controller.signal });
        const normalized = normalizeAssistantActions(result.actions, {
          now: new Date(),
          ...roster,
          defaultCategory: DEFAULT_CATEGORY,
          defaultTaskCategory: DEFAULT_TASK_CATEGORY,
          defaultResponsible: userDoc?.displayName || '',
        });
        setPlan(normalized.actions);
        setSkipped(normalized.skipped);
        setReply(result.reply);
        setPhase('review');
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setError(errorMessage(err, { t, demo: isDemoMode() }));
        setPhase('input');
      } finally {
        inFlight.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, kids, locale, members, speech.stop, t, userDoc?.displayName],
  );

  // The recognizer stops on its own at the end of a sentence; that end is the
  // "send" signal, so nothing has to be tapped between speaking and seeing the
  // proposal.
  useEffect(() => {
    if (!open) return;
    if (wasListening.current && !speech.listening && phase === 'input' && speech.transcript.trim()) {
      submit(speech.transcript);
    }
    wasListening.current = speech.listening;
  }, [open, phase, speech.listening, speech.transcript, submit]);

  function updateAction(id, patch) {
    setPlan((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeAction(id) {
    setPlan((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave() {
    if (!plan.length || !userDoc?.familyId || !user?.uid) return;
    setSaving(true);
    setError('');
    try {
      const { created, failed } = await applyAssistantActions(plan, {
        familyId: userDoc.familyId,
        userId: user.uid,
      });
      setSavedCount(created);
      if (failed.length) {
        setError(tn('assistant.savePartial', failed.length));
        setPlan(failed.map((f) => f.action));
        return;
      }
      setPhase('done');
    } catch (err) {
      setError(err?.message || t('assistant.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const speechError = speech.error ? t(SPEECH_ERROR_KEY[speech.error] || 'assistant.micFailed') : '';
  const heard = `${speech.transcript} ${speech.interim}`.trim();

  return (
    <Modal open={open} onClose={onClose} title={t('assistant.title')}>
      {phase === 'input' && (
        <div className="space-y-4">
          {speech.supported ? (
            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                aria-label={speech.listening ? t('assistant.micStop') : t('assistant.micStart')}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
                  speech.listening ? 'animate-pulse bg-red-500' : 'bg-brand-500 hover:bg-brand-600'
                }`}
              >
                {speech.listening ? <Square size={26} /> : <Mic size={30} />}
              </button>
              <p className="text-sm text-slate-500">
                {speech.listening ? t('assistant.listening') : t('assistant.micStart')}
              </p>
              {heard && (
                <p className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-center text-base text-slate-800">
                  {heard}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('assistant.notSupported')}
            </p>
          )}

          {speechError && <p className="text-sm text-red-600">{speechError}</p>}

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('assistant.examplesTitle')}
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
              <li>„{t('assistant.example1')}”</li>
              <li>„{t('assistant.example2')}”</li>
              <li>„{t('assistant.example3')}”</li>
            </ul>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(typed);
            }}
            className="space-y-2"
          >
            <Input
              label={t('assistant.typeInstead')}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('assistant.typePlaceholder')}
            />
            <Button type="submit" variant="secondary" className="w-full" disabled={!typed.trim()}>
              <Sparkles size={16} />
              {t('assistant.send')}
            </Button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-400">{t('assistant.privacyNote')}</p>
        </div>
      )}

      {phase === 'thinking' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-500">{t('assistant.thinking')}</p>
          {speech.transcript && (
            <p className="max-w-xs text-center text-sm text-slate-400">„{speech.transcript}”</p>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          {heard && (
            <p className="rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-500">„{heard}”</p>
          )}

          {plan.length === 0 ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {reply || t('assistant.nothingFound')}
              </p>
              <Button variant="secondary" className="w-full" onClick={restart}>
                <Mic size={16} />
                {t('assistant.tryAgain')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">{t('assistant.reviewHint')}</p>
              <ul className="space-y-3">
                {plan.map((action) => (
                  <li key={action.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <KindIcon type={action.type} />
                        {t(KIND_LABEL_KEY[action.type])}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAction(action.id)}
                        aria-label={t('assistant.remove')}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <PlanFields
                      action={action}
                      onChange={(patch) => updateAction(action.id, patch)}
                      categories={categories}
                      kids={kids}
                      t={t}
                      tn={tn}
                    />
                  </li>
                ))}
              </ul>

              {skipped > 0 && (
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  {tn('assistant.skipped', skipped)}
                </p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={restart} className="flex-1">
                  <Mic size={16} />
                  {t('assistant.tryAgain')}
                </Button>
                <Button onClick={handleSave} loading={saving} className="flex-1">
                  {tn('assistant.save', plan.length)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckSquare size={26} />
          </div>
          <p className="text-base font-semibold text-slate-900">
            {tn('assistant.saved', savedCount)}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={restart}>
              <Mic size={16} />
              {t('assistant.another')}
            </Button>
            <Button className="flex-1" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// The editable part of a proposal. Only the fields a misheard sentence
// typically gets wrong are inputs -- title, day, time, amount. Everything the
// model inferred (category, children, who is responsible, repetition) is shown
// as a chip so it can be checked at a glance and corrected later in the full
// form, which is where those controls already live.
function PlanFields({ action, onChange, categories, kids, t, tn }) {
  if (action.type === 'add_shopping_item') {
    return (
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={action.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label={t('assistant.fieldTitle')}
          />
        </div>
        <div className="w-24">
          <Input
            value={action.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder={t('assistant.fieldQuantity')}
            aria-label={t('assistant.fieldQuantity')}
          />
        </div>
      </div>
    );
  }

  const isEvent = action.type === 'create_event';
  const category = isEvent
    ? categories.find((c) => c.id === action.category)
    : TASK_CATEGORY_LIST.find((c) => c.id === action.category);
  const priority = !isEvent ? TASK_PRIORITY_MAP[action.priority] : null;
  const kidNames = (action.kidIds || [])
    .map((id) => kids.find((k) => k.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="space-y-2">
      <Input
        value={action.title}
        onChange={(e) => onChange({ title: e.target.value })}
        aria-label={t('assistant.fieldTitle')}
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="date"
            value={isEvent ? action.date : action.dueDate}
            onChange={(e) => onChange(isEvent ? { date: e.target.value } : { dueDate: e.target.value })}
            aria-label={isEvent ? t('assistant.fieldDate') : t('assistant.fieldDue')}
          />
        </div>
        {isEvent && (
          <div className="w-28">
            <Input
              type="time"
              value={action.time}
              onChange={(e) => onChange({ time: e.target.value })}
              aria-label={t('assistant.fieldTime')}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {category && <Chip>{tLabel(t, category)}</Chip>}
        {priority && <Chip>{tLabel(t, priority)}</Chip>}
        {isEvent && action.endTime && <Chip>{t('assistant.untilTime', { time: action.endTime })}</Chip>}
        {isEvent && action.location && <Chip>{action.location}</Chip>}
        {kidNames.length > 0 && <Chip>{kidNames.join(', ')}</Chip>}
        {isEvent && action.responsibleParent && (
          <Chip>
            <Users size={11} /> {action.responsibleParent}
          </Chip>
        )}
        {isEvent && action.recurrence && (
          <Chip>
            <Repeat size={11} /> {describeRecurrence(action.recurrence, t, tn)}
          </Chip>
        )}
        {!isEvent && action.points > 0 && <Chip>{t('assistant.points', { points: action.points })}</Chip>}
      </div>
      {action.description && <p className="text-xs text-slate-500">{action.description}</p>}
    </div>
  );
}

// Server-side failures the user can actually act on: a missing key is the
// deployer's job, an expired sign-in means signing in again, demo mode simply
// has no account to authenticate with.
function errorMessage(err, { t, demo }) {
  if (err?.code === 'not_configured') {
    return `${t('assistant.notConfigured')} (${(err.missing || []).join(', ')})`;
  }
  if (err?.code === 'unauthorized') {
    return demo ? t('assistant.demoNote') : t('assistant.errUnauthorized');
  }
  if (err?.code === 'rate_limited') return t('assistant.errRateLimited');
  if (err?.code === 'timeout') return t('assistant.errTimeout');
  return err?.message || t('assistant.errGeneric');
}
