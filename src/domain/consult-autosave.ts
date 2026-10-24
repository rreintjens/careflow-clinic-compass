/** Coalesce edits across the two consult editors and serialize database writes. */
export function consultAutosave<T extends object>(write: (patch: Partial<T>) => Promise<void>, onError: (error: unknown) => void, delay = 300) {
  let pending: Partial<T> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = Promise.resolve();
  const flush = () => {
    clearTimeout(timer);
    const patch = pending;
    pending = {};
    running = running.catch(() => undefined).then(async () => {
      if (!Object.keys(patch).length) return;
      try { await write(patch); } catch (error) { pending = { ...patch, ...pending }; throw error; }
    });
    return running;
  };
  return {
    patch(value: Partial<T>) { pending = { ...pending, ...value }; clearTimeout(timer); timer = setTimeout(() => { void flush().catch(onError); }, delay); },
    flush,
  };
}