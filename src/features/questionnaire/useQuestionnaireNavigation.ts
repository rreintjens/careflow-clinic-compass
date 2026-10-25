import { useEffect, useId, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';

declare module '@tanstack/history' {
  interface HistoryState {
    questionnaireScreen?: { owner: string; page: string; position: number };
  }
}

/** Keep page-only history: answers never enter the URL or browser history. */
export function useQuestionnaireNavigation(onRestore: (page: string) => void) {
  const router = useRouter();
  const owner = useId();
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const direction = useRef<'forward' | 'back'>('forward');
  const position = useRef(0);
  useEffect(() => router.history.subscribe(({ location, action }) => {
    if (action.type !== 'BACK' && action.type !== 'FORWARD' && action.type !== 'GO') return;
    const screen = location.state.questionnaireScreen;
    if (screen?.owner !== owner) return;
    direction.current = screen.position < position.current ? 'back' : 'forward';
    position.current = screen.position;
    restore.current(screen.page);
  }), [router, owner]);
  const move = (from: string, to: string, back = false) => {
    direction.current = back ? 'back' : 'forward';
    const { location } = router.history;
    const screen = location.state.questionnaireScreen;
    if (back && screen?.owner === owner && screen.position > 0) {
      router.history.back();
      return;
    }
    if (screen?.owner !== owner) {
      position.current = 0;
      router.history.replace(location.href, { ...location.state, questionnaireScreen: { owner, page: from, position: 0 } });
      // Browser history batches writes; commit the initial page before pushing the next.
      router.history.flush();
    }
    position.current += 1;
    void router.navigate({ to: location.href, resetScroll: false,
      state: { ...router.history.location.state, questionnaireScreen: { owner, page: to, position: position.current } } });
    restore.current(to);
  };
  return { direction, move };
}