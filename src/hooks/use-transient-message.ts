import { useCallback, useEffect, useRef, useState } from 'react';

export interface TransientMessage {
  text: string;
  tone: 'ok' | 'error';
}

/**
 * A short status message that clears itself. The timer is cleared on unmount and whenever a new
 * message replaces the old one, so a stale timeout can never wipe a newer message.
 */
export function useTransientMessage(durationMs = 4000) {
  const [message, setMessage] = useState<TransientMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const notify = useCallback(
    (text: string, tone: TransientMessage['tone']) => {
      setMessage({ text, tone });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  return { message, notify };
}
