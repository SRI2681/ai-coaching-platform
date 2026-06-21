'use client';
import React, { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL; // your backend address

export default function CoachingSessionPage() {
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [voiceFallback, setVoiceFallback] = useState(false);
  const [loading, setLoading] = useState(false);

  const startSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/coaching/avatar-session/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate_id: localStorage.getItem('candidate_id'),
            session_type: 'avatar',
          }),
        }
      );
      const data = await res.json();
      if (data.conversation_url && !data.fallback_mode) {
        setConversationUrl(data.conversation_url);  // live avatar
      } else {
        setVoiceFallback(true);                     // voice-only
      }
    } catch (e) {
      setVoiceFallback(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen
                    bg-slate-900 text-white">
      <h1 className="text-2xl font-bold mb-6">Executive Coaching Session</h1>
      <div className="relative w-full max-w-4xl aspect-video bg-black
                      rounded-xl overflow-hidden border border-slate-700">

        {conversationUrl && (
          <iframe
            src={conversationUrl}
            allow="camera; microphone; fullscreen; autoplay; display-capture"
            className="w-full h-full"
          />
        )}

        {voiceFallback && (
          <div className="absolute inset-0 flex flex-col items-center
                          justify-center bg-slate-800">
            <img src="/coach-photo.jpg" alt="Your coach"
                 className="w-40 h-40 rounded-full object-cover mb-4" />
            <p className="text-slate-300">Voice coaching active</p>
          </div>
        )}

        {!conversationUrl && !voiceFallback && (
          <div className="absolute inset-0 flex items-center
                          justify-center bg-slate-800">
            <button onClick={startSession} disabled={loading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500
                         rounded-lg font-medium">
              {loading ? 'Connecting...' : 'Enter Coaching Room'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
