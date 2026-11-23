import "server-only";

/**
 * Runs `run` with an AbortSignal and gives up after `ms` milliseconds.
 *
 * - Resolves with `run`'s result if it settles in time; a rejection from `run`
 *   propagates unchanged.
 * - Otherwise aborts the signal and resolves with `"timed_out"`, without waiting
 *   for `run` to notice the abort.
 * - The timer is always cleared, so nothing fires after this settles.
 *
 * Uses setTimeout and an AbortController (not AbortSignal.timeout) so the
 * timeout follows fake timers in tests.
 */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T | "timed_out"> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timed_out">((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve("timed_out");
    }, ms);
  });

  try {
    return await Promise.race([run(controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
