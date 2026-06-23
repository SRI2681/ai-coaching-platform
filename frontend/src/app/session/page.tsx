'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Vapi from '@vapi-ai/web';
import { createClient } from '@anam-ai/js-sdk';
import { endSession, updateSessionCallMeta } from '@/lib/api';

const VAPI_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? '';
const VAPI_AID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? '';
const ANAM_VIDEO_ID = 'anam-coach-video';

interface TurnScores {
  strategic: number | null;
  operational: number | null;
  influence: number | null;
  composite: number | null;
}

export default function SessionPage() {
  const router = useRouter();
  const vapiRef = useRef<Vapi | null>(null);
  const anamRef = useRef<ReturnType<typeof createClient> | null>(null);
  const vapiCallIdRef = useRef('');
  const recordingUrlRef = useRef('');

  const [sessionType, setSessionType] = useState('voice');
  const [anamToken, setAnamToken] = useState('');
  const [showAnamAvatar, setShowAnamAvatar] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');
  const [framework, setFramework] = useState('GROW');
  const [status, setStatus] = useState('Connecting...');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [coachReply, setCoachReply] = useState('');
  const [scores, setScores] = useState<TurnScores>({
    strategic: null,
    operational: null,
    influence: null,
    composite: null,
  });
  const [cdl, setCdl] = useState(1.0);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');

  const startVoice = useCallback((candidateId: string, sessionId: string) => {
    if (!VAPI_KEY || !VAPI_AID) {
      setError(
        'Voice session is not configured. Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID.'
      );
      setStatus('Voice unavailable');
      return;
    }

    setCoachReply(localStorage.getItem('coach_opening') || '');

    const vapi = new Vapi(VAPI_KEY);
    vapiRef.current = vapi;

    vapi.on('call-start', (event?: { id?: string; call?: { id?: string } }) => {
      setStatus('Session active — start speaking');
      const callId = event?.id || event?.call?.id || '';
      if (callId) {
        vapiCallIdRef.current = callId;
        updateSessionCallMeta(sessionId, { vapi_call_id: callId }).catch(() => undefined);
      }
    });
    vapi.on('call-end', () => setStatus('Session ended'));
    vapi.on('speech-start', () => setIsListening(true));
    vapi.on('speech-end', () => setIsListening(false));

    vapi.on('message', (msg: {
      type?: string;
      transcriptType?: string;
      transcript?: string;
      content?: string;
      call?: { id?: string };
      recordingUrl?: string;
      artifact?: { recordingUrl?: string };
      toolCallsResult?: Array<{
        result?: {
          strategic_thinking_score?: number;
          operational_accountability_score?: number;
          influence_communication_score?: number;
          composite_score?: number;
          cdl_new?: number;
        };
      }>;
    }) => {
      if (msg.type === 'end-of-call-report') {
        const url = msg.recordingUrl || msg.artifact?.recordingUrl;
        if (url) recordingUrlRef.current = url;
        if (msg.call?.id) vapiCallIdRef.current = msg.call.id;
      }
      if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
        setTranscript(msg.transcript);
      }
      if (msg.type === 'assistant-response' && msg.content) {
        setCoachReply(msg.content);
      }
      if (msg.type === 'tool-calls-result') {
        const r = msg.toolCallsResult?.[0]?.result;
        if (r) {
          setScores({
            strategic: r.strategic_thinking_score ?? null,
            operational: r.operational_accountability_score ?? null,
            influence: r.influence_communication_score ?? null,
            composite: r.composite_score ?? null,
          });
          if (r.cdl_new !== undefined) {
            setCdl(r.cdl_new);
            localStorage.setItem('current_cdl', String(r.cdl_new));
          }
        }
      }
    });

    vapi
      .start(VAPI_AID, {
        metadata: {
          candidate_id: candidateId,
          session_id: sessionId,
          turn_number: '2',
        },
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to start voice session.');
        setStatus('Voice unavailable');
      });
  }, []);

  useEffect(() => {
    const type = localStorage.getItem('session_type') || 'voice';
    const candidateId = localStorage.getItem('candidate_id');
    const sessionId = localStorage.getItem('session_id');

    if (!candidateId || !sessionId) {
      router.push('/dashboard');
      return;
    }

    setSessionType(type);
    setFramework(localStorage.getItem('framework') || 'GROW');
    setCdl(parseFloat(localStorage.getItem('current_cdl') || '1.0'));

    if (type === 'avatar') {
      const token = localStorage.getItem('anam_session_token') || '';
      const isFallback = localStorage.getItem('fallback_mode') === 'true' || !token;
      const reason = localStorage.getItem('fallback_reason') || '';

      setAnamToken(token);
      setFallback(isFallback);
      setFallbackReason(reason);

      if (!isFallback && token) {
        setShowAnamAvatar(true);
        setStatus('Connecting to avatar coach...');
        return;
      }

      setStatus(
        reason
          ? `Avatar unavailable — using voice instead (${reason})`
          : 'Avatar unavailable — using voice instead'
      );
    }

    startVoice(candidateId, sessionId);

    return () => {
      vapiRef.current?.stop();
    };
  }, [router, startVoice]);

  useEffect(() => {
    if (!showAnamAvatar || !anamToken) return;

    let cancelled = false;

    async function startAnam() {
      try {
        const client = createClient(anamToken);
        anamRef.current = client;
        await client.streamToVideoElement(ANAM_VIDEO_ID);
        if (!cancelled) {
          setStatus('Avatar session active — speak to your coach');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to start avatar session.');
          setStatus('Avatar unavailable');
          setShowAnamAvatar(false);
          setFallback(true);

          const candidateId = localStorage.getItem('candidate_id');
          const sessionId = localStorage.getItem('session_id');
          if (candidateId && sessionId) {
            startVoice(candidateId, sessionId);
          }
        }
      }
    }

    startAnam();

    return () => {
      cancelled = true;
      anamRef.current?.stopStreaming();
      anamRef.current = null;
    };
  }, [showAnamAvatar, anamToken, startVoice]);

  async function handleEndSession() {
    setEnding(true);
    setError('');
    vapiRef.current?.stop();
    anamRef.current?.stopStreaming();
    anamRef.current = null;

    try {
      const sessionId = localStorage.getItem('session_id');
      const candidateId = localStorage.getItem('candidate_id');
      if (!sessionId || !candidateId) {
        router.push('/dashboard');
        return;
      }

      const result = await endSession(
        sessionId,
        candidateId,
        recordingUrlRef.current || undefined,
        vapiCallIdRef.current || undefined
      );
      if (result.debrief) {
        localStorage.setItem('debrief', JSON.stringify(result.debrief));
        localStorage.setItem('last_debrief', JSON.stringify(result.debrief));
        localStorage.setItem('current_cdl', String(result.debrief.cdl_end));
      }

      localStorage.removeItem('session_id');
      localStorage.removeItem('session_type');
      localStorage.removeItem('anam_session_token');
      localStorage.removeItem('fallback_mode');
      localStorage.removeItem('fallback_reason');
      localStorage.removeItem('coach_opening');
      router.push('/summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end session.');
      setEnding(false);
    }
  }

  const showAvatar = sessionType === 'avatar' && showAnamAvatar && !fallback;
  const hasScores =
    scores.strategic !== null ||
    scores.operational !== null ||
    scores.influence !== null;

  return (
    <div className='min-h-screen bg-gray-900 text-white flex flex-col'>
      <nav className='bg-blue-950 px-8 py-4 flex justify-between items-center gap-4'>
        <div className='flex items-center gap-6'>
          <div>
            <h1 className='text-xl font-bold'>Live Coaching Session</h1>
            <p className='text-blue-300 text-xs mt-0.5'>
              {framework} framework · {sessionType} mode
            </p>
          </div>
          <div className='hidden sm:flex gap-4 text-sm'>
            <Link href='/dashboard' className='text-blue-300 hover:text-white'>
              Dashboard
            </Link>
            <Link href='/summary' className='text-blue-300 hover:text-white'>
              Session Summary
            </Link>
          </div>
        </div>
        <span className='text-blue-300 text-sm text-center flex-1'>{status}</span>
        <button
          onClick={handleEndSession}
          disabled={ending}
          className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 shrink-0'
        >
          {ending ? 'Ending...' : 'End Session'}
        </button>
      </nav>

      {error && (
        <div className='bg-red-900/80 text-red-100 px-8 py-3 text-sm border-b border-red-700'>
          {error}
        </div>
      )}

      <div className='flex-1 flex flex-col lg:flex-row'>
        <div className='flex-1 flex items-center justify-center p-8'>
          {showAvatar ? (
            <video
              id={ANAM_VIDEO_ID}
              autoPlay
              playsInline
              className='w-full max-w-3xl aspect-video rounded-2xl shadow-2xl border border-gray-700 bg-black object-cover'
            />
          ) : (
            <div className='text-center'>
              <div
                className={`w-48 h-48 rounded-full border-4 flex items-center justify-center text-6xl mx-auto
                  ${isListening ? 'border-green-400 bg-green-900 animate-pulse' : 'border-blue-400 bg-blue-900'}`}
              >
                {isListening ? '🎙' : '🎧'}
              </div>
              <p className='mt-4 text-slate-300 text-sm'>Voice coaching active</p>
              {fallback && fallbackReason && (
                <p className='mt-2 max-w-md text-sm text-gray-400 mx-auto'>{fallbackReason}</p>
              )}
            </div>
          )}
        </div>

        <div className='w-full lg:w-80 bg-gray-800 p-6 flex flex-col gap-4 overflow-y-auto'>
          <div>
            <p className='text-gray-400 text-xs uppercase mb-1'>Coaching Level</p>
            <p className='text-2xl font-bold text-blue-300'>CDL {cdl.toFixed(1)}</p>
          </div>

          {hasScores && (
            <div className='space-y-3'>
              <p className='text-gray-400 text-xs uppercase'>Last Turn Scores</p>
              {scores.strategic !== null && (
                <ScoreBar label='Strategic Thinking' value={scores.strategic} color='bg-blue-400' />
              )}
              {scores.operational !== null && (
                <ScoreBar label='Operational Accountability' value={scores.operational} color='bg-emerald-400' />
              )}
              {scores.influence !== null && (
                <ScoreBar label='Influence & Communication' value={scores.influence} color='bg-purple-400' />
              )}
              {scores.composite !== null && (
                <p className='text-sm text-gray-400'>
                  Composite: <span className='font-bold text-white'>{scores.composite}</span>
                </p>
              )}
            </div>
          )}

          {coachReply && (
            <div className='bg-blue-900 rounded-lg p-3'>
              <p className='text-xs text-blue-300 mb-1'>Coach said:</p>
              <p className='text-sm text-white'>{coachReply}</p>
            </div>
          )}

          {transcript && (
            <div className='bg-gray-700 rounded-lg p-3'>
              <p className='text-xs text-gray-400 mb-1'>You said:</p>
              <p className='text-sm text-gray-200'>{transcript}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className='flex justify-between text-sm mb-1'>
        <span>{label}</span>
        <span className='font-bold text-blue-300'>{value}</span>
      </div>
      <div className='w-full bg-gray-700 rounded-full h-2'>
        <div className={`${color} h-2 rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
