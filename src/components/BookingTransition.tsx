import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { BOOKING_FADE_MS, BOOKING_SLIDE_MS, bookingHistoryDirection } from '@/domain/booking-transition';

type Snapshot = { key: string; node: HTMLElement; height: number; historyIndex: number };
type Motion = { snapshot: RefObject<Snapshot | null>; direction: RefObject<'forward' | 'back'> };
const Context = createContext<Motion | null>(null);

/** One coordinator survives Shell changes, including holding a slot and reviewing the booking. */
export function BookingTransitionProvider({ children }: { children: ReactNode }) {
  const snapshot = useRef<Snapshot | null>(null);
  const direction = useRef<'forward' | 'back'>('forward');
  useEffect(() => {
    let index = Number(window.history.state?.__TSR_index ?? 0);
    const pop = () => {
      const next = Number(window.history.state?.__TSR_index ?? 0);
      direction.current = bookingHistoryDirection(index, next);
      index = next;
    };
    const push = () => { direction.current = 'forward'; index = Number(window.history.state?.__TSR_index ?? 0); };
    window.addEventListener('popstate', pop);
    document.addEventListener('click', push, true);
    return () => { window.removeEventListener('popstate', pop); document.removeEventListener('click', push, true); };
  }, []);
  return <Context.Provider value={{ snapshot, direction }}>{children}</Context.Provider>;
}

export function useBookingTransition(ref: RefObject<HTMLElement | null>, key: string, options?: {
  direction?: RefObject<'forward' | 'back'>;
  scrollRef?: RefObject<HTMLElement | null>;
  pageScroll?: boolean;
}) {
  const motion = useContext(Context);
  useLayoutEffect(() => {
    const main = ref.current;
    if (!main || !motion) return;
    const previous = motion.snapshot.current;
    const historyIndex = Number(window.history.state?.__TSR_index ?? 0);
    if (previous) motion.direction.current = bookingHistoryDirection(previous.historyIndex, historyIndex);
    if (!previous || previous.key === key) return;
    const scrollTop = () => {
      options?.scrollRef?.current?.scrollTo({ top: 0, behavior: 'instant' });
      if (options?.pageScroll !== false) window.scrollTo({ top: 0, behavior: 'instant' });
    };
    scrollTop();
    const scrollFrame = requestAnimationFrame(scrollTop);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sign = (options?.direction?.current ?? motion.direction.current) === 'back' ? -1 : 1;
    const box = main.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'booking-transition-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    const viewport = options?.scrollRef?.current?.getBoundingClientRect();
    const height = viewport ? Math.max(0, viewport.bottom - box.top) : Math.max(box.height, previous.height);
    Object.assign(overlay.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${height}px` });
    previous.node.classList.add('booking-transition-old');
    overlay.append(previous.node);
    const frame = main.parentElement;
    const overflow = frame?.style.overflow ?? '';
    if (frame) { if (!options?.scrollRef) frame.style.overflow = 'clip'; frame.append(overlay); }
    const timing = { duration: reduced ? BOOKING_FADE_MS : BOOKING_SLIDE_MS, easing: 'ease-out' };
    const incoming = main.animate([{ transform: reduced ? 'none' : `translateX(${sign * 100}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], timing);
    const outgoing = previous.node.animate([{ transform: 'none', opacity: 1 }, { transform: reduced ? 'none' : `translateX(${-sign * 100}%)`, opacity: 0 }], timing);
    const finish = () => { overlay.remove(); if (frame) frame.style.overflow = overflow; };
    void incoming.finished.then(finish).catch(finish);
    return () => { cancelAnimationFrame(scrollFrame); incoming.cancel(); outgoing.cancel(); finish(); };
  }, [key, ref]);
  // Refresh the inert snapshot after answer edits too, without restarting an animation.
  useLayoutEffect(() => {
    const main = ref.current;
    if (!main || !motion) return;
    const clone = main.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-booking-tapped]').forEach(node => node.removeAttribute('data-booking-tapped'));
    motion.snapshot.current = { key, node: clone, height: main.getBoundingClientRect().height,
      historyIndex: Number(window.history.state?.__TSR_index ?? 0) };
  });
}
