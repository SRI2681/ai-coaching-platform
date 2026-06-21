'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Vapi from '@vapi-ai/web';
import { endSession } from '@/lib/api';

const VAPI_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? '';
const VAPI_AID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? '';

export default function SessionPage() {
  const router = useRouter();
  const vapiRef = useRef<Vapi | null>(null);

  const [sessionType, setSessionType] = useState('voice');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [fallback, setFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [coachReply, setCoachReply] = useState('');
  const [humanScore, setHumanScore] = useState<number | null>(null);
  const [agentScore, setAgentScore] = useState<number | null>(null);
  const [cdl, setCdl] = useState(1.0);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const type = localStorage.getItem('session_type') || 'voice';
    const candidateId = localStorage.getItem('candidate_id');
    const sessionId = localStorage.getItem('session_id');

    if (!candidateId || !sessionId) {
      router.push('/dashboard');
      return;
    }

    setSessionType(type);
    setCdl(parseFloat(localStorage.getItem('current_cdl') || '1.0'));

    if (type === 'avatar') {
      const url = localStorage.getItem('conversation_url') || '';
      const isFallback =
        localStorage.getItem('fallback_mode') === 'true' || !url;
      const reason = localStorage.getItem('fallback_reason') || '';

      setAvatarUrl(url);
      setFallback(isFallback);
      setFallbackReason(reason);

      if (!isFallback && url) {
        setStatus('Avatar session active — speak to your coach');
        return;
      }

      setStatus(
        reason
          ? `Avatar unavailable — using voice instead (${reason})`
          : 'Avatar unavailable — using voice instead'
      );
    }

    if (!VAPI_KEY || !VAPI_AID) {
      setError('Voice session is not configured. Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID.');
      setStatus('Voice unavailable');
      return;
    }

    setCoachReply(localStorage.getItem('coach_opening') || '');

    const vapi = new Vapi(VAPI_KEY);
    vapiRef.current = vapi;

    vapi.on('call-start', () => setStatus('Session active — start speaking'));
    vapi.on('call-end', () => setStatus('Session ended'));
    vapi.on('speech-start', () => setIsListening(true));
    vapi.on('speech-end', () => setIsListening(false));

    vapi.on('message', (msg: {
      type?: string;
      transcriptType?: string;
      transcript?: string;
      content?: string;
      toolCallsResult?: Array<{ result?: { human_score?: number; agent_score?: number; cdl_new?: number } }>;
    }) => {
      if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
        setTranscript(msg.transcript);
      }
      if (msg.type === 'assistant-response' && msg.content) {
        setCoachReply(msg.content);
      }
      if (msg.type === 'tool-calls-result') {
        const r = msg.toolCallsResult?.[0]?.result;
        if (r?.human_score !== undefined) setHumanScore(r.human_score);
        if (r?.agent_score !== undefined) setAgentScore(r.agent_score);
        if (r?.cdl_new !== undefined) setCdl(r.cdl_new);
      }
    });

    vapi.start(VAPI_AID, {
      metadata: {
        candidate_id: candidateId,
        session_id: sessionId,
        turn_number: '2'
      }
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Unable to start voice session.');
      setStatus('Voice unavailable');
    });

    return () => {
      vapi.stop();
    };
  }, [router]);

  async function handleEndSession() {
    setEnding(true);
    setError('');
    vapiRef.current?.stop();

    try {
      const sessionId = localStorage.getItem('session_id');
      const candidateId = localStorage.getItem('candidate_id');
      if (!sessionId || !candidateId) {
        router.push('/dashboard');
        return;
      }

      const result = await endSession(sessionId, candidateId);
      if (result.debrief) {
        localStorage.setItem('debrief', JSON.stringify(result.debrief));
        localStorage.setItem('current_cdl', String(result.debrief.cdl_end));
      }

      localStorage.removeItem('session_id');
      localStorage.removeItem('session_type');
      localStorage.removeItem('conversation_url');
      localStorage.removeItem('fallback_mode');
      localStorage.removeItem('fallback_reason');
      localStorage.removeItem('coach_opening');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end session.');
      setEnding(false);
    }
  }

  const showAvatar = sessionType === 'avatar' && avatarUrl && !fallback;

  return (
    <div className='min-h-screen bg-gray-900 text-white flex flex-col'>
      <nav className='bg-blue-950 px-8 py-4 flex justify-between items-center gap-4'>
        <h1 className='text-xl font-bold'>AI Executive Coach</h1>
        <span className='text-blue-300 text-sm text-center flex-1'>{status}</span>
        <button
          onClick={handleEndSession}
          disabled={ending}
          className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50'
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
            <iframe
              src={avatarUrl}
              title='AI Coach Avatar'
              className='w-full max-w-3xl aspect-video rounded-2xl shadow-2xl border border-gray-700'
              allow='camera; microphone; fullscreen; autoplay; display-capture'
            />
          ) : (
            <div className='text-center'>
              <div
                className={`w-48 h-48 rounded-full border-4 flex items-center justify-center text-6xl mx-auto
                  ${isListening ? 'border-green-400 bg-green-900 animate-pulse' : 'border-blue-400 bg-blue-900'}`}
              >
                {isListening ? '🎙' : '🎧'}
              </div>
              {fallback && fallbackReason && (
                <p className='mt-4 max-w-md text-sm text-gray-400'>{fallbackReason}</p>
              )}
            </div>
          )}
        </div>

        <div className='w-full lg:w-80 bg-gray-800 p-6 flex flex-col gap-4 overflow-y-auto'>
          <div>
            <p className='text-gray-400 text-xs uppercase mb-1'>Coaching Level</p>
            <p className='text-2xl font-bold text-blue-300'>CDL {cdl.toFixed(1)}</p>
          </div>

          {humanScore !== null && (
            <div className='space-y-3'>
              <p className='text-gray-400 text-xs uppercase'>Last Turn Scores</p>
              <div>
                <div className='flex justify-between text-sm mb-1'>
                  <span>Human Leadership</span>
                  <span className='font-bold text-blue-300'>{humanScore}</span>
                </div>
                <div className='w-full bg-gray-700 rounded-full h-2'>
                  <div className='bg-blue-400 h-2 rounded-full' style={{ width: `${humanScore}%` }} />
                </div>
              </div>
              <div>
                <div className='flex justify-between text-sm mb-1'>
                  <span>Agent Leadership</span>
                  <span className='font-bold text-purple-300'>{agentScore}</span>
                </div>
                <div className='w-full bg-gray-700 rounded-full h-2'>
                  <div
                    className='bg-purple-400 h-2 rounded-full'
                    style={{ width: `${agentScore ?? 0}%` }}
                  />
                </div>
              </div>
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
