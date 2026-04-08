import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, streamChat, type ChatMessageRecord, type ChatTurn } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

/**
 * Streaming chat hook. Loads history on mount, exposes a `send` that streams
 * tokens into the in-flight assistant message, and an `abort` to cancel.
 */
export function useChat() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load history once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const res = await api.chatHistory(token);
      if (cancelled || !res.data) return;
      setMessages(
        res.data.messages.map((m: ChatMessageRecord) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const send = useCallback(
    async (text: string) => {
      const token = await getToken();
      if (!token) {
        setError('Not signed in');
        return;
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

      // Snapshot history BEFORE we mutate state, for the request payload
      const history: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const delta of streamChat({
          token,
          message: text,
          history,
          signal: controller.signal,
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
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [getToken, messages]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, error, send, abort };
}
