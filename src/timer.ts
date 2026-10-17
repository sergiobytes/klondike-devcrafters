let startedAt: number | null = null; // performance.now() of the running stretch
let accumulated = 0;                  // ms from previous stretches (before a pause)
let interval: ReturnType<typeof setInterval> | undefined;

export const isRunning = (): boolean => startedAt !== null;

export const elapsedSeconds = (): number =>
    Math.floor((accumulated + (startedAt === null ? 0 : performance.now() - startedAt)) / 1000);

export function start(onTick: () => void): void {
    if (startedAt !== null) return;
    startedAt = performance.now();
    interval = setInterval(onTick, 250);
}

export function stop(): void {
    if (startedAt === null) return;
    accumulated += performance.now() - startedAt;
    startedAt = null;
    clearInterval(interval);
}

export function reset(): void {
    stop();
    accumulated = 0;
}

export function formatTime(total: number): string {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
