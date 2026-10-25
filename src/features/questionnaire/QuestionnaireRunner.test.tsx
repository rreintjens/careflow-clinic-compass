import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMemoryHistory } from '@tanstack/history';
import type { QuestionnaireDef } from '@/domain/questionnaire/engine';
import { BOOKING_TAP_MS } from '@/domain/booking-transition';

const mocked = vi.hoisted(() => ({ router: {} as { history: ReturnType<typeof createMemoryHistory> } }));
vi.mock('@tanstack/react-router', () => ({ useRouter: () => mocked.router }));
import { QuestionnaireRunner } from './QuestionnaireRunner';

const def: QuestionnaireDef = { id: 'transition-test', name: 'Test', moment: 'after_booking', pages: [
  { id: 'one', items: [{ id: 'answer', text: 'Keuze', type: 'yes_no' }, { id: 'text', text: 'Tekst', type: 'text', optional: true }] },
  { id: 'two', title: 'Tweede pagina', items: [{ id: 'date', text: 'Datum', type: 'date_segmented', optional: true }] },
] };
const animate = vi.fn(() => ({ finished: new Promise<void>(() => {}), cancel: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  mocked.router.history = createMemoryHistory({ initialEntries: ['/vragenlijst/test'] });
  Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.requestAnimationFrame = vi.fn(() => 1);
  window.cancelAnimationFrame = vi.fn();
  animate.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const run = () => render(<QuestionnaireRunner flow={{ settings: {}, computed_fields: {} }} def={def} ui={{ next: 'Verder', yes: 'Ja', no: 'Nee' }} today="2026-10-25" />);
const advance = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Verder' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(BOOKING_TAP_MS); });
};
it('blocks page advancement for missing required answers without animating', async () => {
  run(); await advance();
  expect(mocked.router.history.location.state.questionnaireScreen).toBeUndefined();
  expect(animate).not.toHaveBeenCalled();
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
});
it('answer changes on one page do not animate or create history entries', () => {
  run(); fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
  expect(animate).not.toHaveBeenCalled();
  expect(mocked.router.history.length).toBe(1);
});
it('waits 100ms before advancing and slides forward for 280ms', async () => {
  run(); fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verder' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(99); });
  expect(mocked.router.history.length).toBe(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocked.router.history.location.state.questionnaireScreen?.page).toBe('two');
  expect(animate.mock.calls[0]).toEqual([[{ transform: 'translateX(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'ease-out' }]);
  expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
});
it('browser back reverses the slide while preserving answers and excludes answers from history', async () => {
  run(); fireEvent.click(screen.getByRole('button', { name: 'Ja' })); await advance();
  animate.mockClear(); act(() => mocked.router.history.back());
  expect(screen.getByRole('button', { name: 'Ja' })).toHaveAttribute('aria-pressed', 'true');
  expect(animate.mock.calls[0]?.[0]).toEqual([{ transform: 'translateX(-100%)', opacity: 0 }, { transform: 'none', opacity: 1 }]);
  expect(mocked.router.history.location.state.questionnaireScreen).toEqual({ owner: expect.any(String), page: 'one', position: 0 });
});
it('reduced motion uses the shared 120ms fade without a slide', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
  run(); fireEvent.click(screen.getByRole('button', { name: 'Ja' })); await advance();
  expect(animate.mock.calls[0]).toEqual([[{ transform: 'none', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 120, easing: 'ease-out' }]);
});