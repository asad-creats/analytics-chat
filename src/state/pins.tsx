import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useToast } from './toast';

/** Every answer that can sit on the Morning board. Order is board order. */
export const pinnableIds = [
  'lead-sources',
  'new-leads',
  'uncalled',
  'median-response',
  'deals-closing',
  'appointments',
  'response-slip',
] as const;

export type PinId = (typeof pinnableIds)[number];

const initialPins: PinId[] = ['lead-sources', 'new-leads', 'uncalled', 'median-response', 'deals-closing', 'appointments'];

interface PinsValue {
  pinned: PinId[];
  isPinned: (id: PinId) => boolean;
  toggle: (id: PinId) => void;
}

const PinsContext = createContext<PinsValue | null>(null);

export function PinsProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState<PinId[]>(initialPins);
  const toast = useToast();

  const toggle = useCallback(
    (id: PinId) => {
      if (pinned.includes(id)) {
        setPinned(pinned.filter((p) => p !== id));
        toast.show('Removed from your board.');
      } else {
        // Pinning saves the question and its filters, not today's numbers.
        setPinned(pinnableIds.filter((p) => p === id || pinned.includes(p)));
        toast.show('Pinned. Refreshes daily at 7:00 AM.');
      }
    },
    [pinned, toast],
  );

  const value = useMemo<PinsValue>(
    () => ({ pinned, isPinned: (id) => pinned.includes(id), toggle }),
    [pinned, toggle],
  );

  return <PinsContext.Provider value={value}>{children}</PinsContext.Provider>;
}

export function usePins() {
  const value = useContext(PinsContext);
  if (!value) throw new Error('usePins must be used inside <PinsProvider>');
  return value;
}
