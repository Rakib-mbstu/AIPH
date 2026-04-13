import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  api,
  streamChat,
  type ChatMessageRecord,
  type ChatSessionRecord,
  type ChatTurn,
} from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

/**
 * Streaming chat hook with session management.
 *
 * On mount: loads the session list and auto-resumes the most recent session.
 * newChat(): creates a server session and resets local state.
 * loadSession(): switches to a past session from history.
 * send(): streams a message into the active session; creates a session on
 *   demand if none exists (e.g. first send from quick-start chips).
 */
export function useChat() {
  const { getToken } = useAuth();

  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── On mount: load session list + auto-resume latest ─────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) { setIsLoadingSessions(false); return; }

      const res = await api.listSessions(token);
      if (cancelled) return;
      if (!res.data) { setIsLoadingSessions(false); return; }

      const sessionList = res.data.sessions;
      setSessions(sessionList);

      if (sessionList.length > 0) {
        const latest = sessionList[0];
        setActiveSessionId(latest.id);
        const msgRes = await api.getSession(token, latest.id);
        if (!cancelled && msgRes.data) {
          setMessages(
            msgRes.data.messages.map((m: ChatMessageRecord) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
      }

      if (!cancelled) setIsLoadingSessions(false);
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  // ── New chat ──────────────────────────────────────────────────────────────
  const newChat = useCallback(async () => {
    abortRef.current?.abort();
    const token = await getToken();
    if (!token) return;

    const res = await api.createSession(token);
    if (!res.data) return;

    const newSession = res.data.session;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, [getToken]);

  // ── Load a past session ───────────────────────────────────────────────────
  const loadSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      abortRef.current?.abort();

      setIsLoadingMessages(true);
      const token = await getToken();
      if (!token) { setIsLoadingMessages(false); return; }

      const res = await api.getSession(token, sessionId);
      if (!res.data) { setIsLoadingMessages(false); return; }

      setActiveSessionId(sessionId);
      setMessages(
        res.data.messages.map((m: ChatMessageRecord) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );
      setIsLoadingMessages(false);
    },
    [getToken, activeSessionId]
  );

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string) => {
      const token = await getToken();
      if (!token) { setError('Not signed in'); return; }

      // Create a session on demand (e.g. first send from empty state)
      let sessionId = activeSessionId;
      if (!sessionId) {
        const res = await api.createSession(token);
        if (!res.data) { setError('Failed to create session'); return; }
        sessionId = res.data.session.id;
        setSessions((prev) => [res.data!.session, ...prev]);
        setActiveSessionId(sessionId);
      }

      const userMsg: ChatMessage = {
        id: `local-${Date.now()}-u`,
        role: 'user',
        content: text,
      };
      const assistantId = `local-${Date.now()}-a`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        pending: true,
      };

      const history: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const capturedSessionId = sessionId;

      try {
        for await (const delta of streamChat({
          token,
          message: text,
          sessionId: capturedSessionId,
          history,
          signal: controller.signal,
          onSessionTitle: (title) => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === capturedSessionId && s.title === 'New chat'
                  ? { ...s, title }
                  : s
              )
            );
          },
        })) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Stream failed');
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m))
        );
        // Bump active session to top of list
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === capturedSessionId
              ? { ...s, updatedAt: new Date().toISOString() }
              : s
          );
          return [...updated].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [getToken, messages, activeSessionId]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    sessions,
    activeSessionId,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isStreaming,
    error,
    send,
    abort,
    newChat,
    loadSession,
  };
}
