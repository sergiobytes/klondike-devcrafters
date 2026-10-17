import type { PileType } from './types';

// Scoring inspired by Windows Solitaire
export const POINTS = {
    toFoundation: 10,
    wasteToTableau: 5,
    flip: 5,
    foundationToTableau: -15,
    recycle: -20, // turning the waste back over into the stock
} as const;

const TIME_PENALTY = 2; // points lost every 10 seconds
const BEST_KEY = 'klondike-devcrafters:best';

export interface BestScore {
    score: number;
    seconds: number;
    moves: number;
    date: string;
}

export function pointsForMove(from: PileType, to: PileType): number {
    if (to === 'foundation') return from === 'foundation' ? 0 : POINTS.toFoundation;
    if (from === 'waste') return POINTS.wasteToTableau;
    if (from === 'foundation') return POINTS.foundationToTableau;
    return 0;
}

export const currentScore = (points: number, seconds: number): number =>
    Math.max(0, points - TIME_PENALTY * Math.floor(seconds / 10));

// The faster the win, the bigger the bonus (none under 30 s, as in Windows)
export const winBonus = (seconds: number): number =>
    seconds >= 30 ? Math.round(700_000 / seconds) : 0;

export function loadBest(): BestScore | null {
    try {
        const saved = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null');
        return typeof saved?.score === 'number' ? saved : null;
    } catch {
        return null;
    }
}

export function saveBest(best: BestScore): void {
    try {
        localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
        // No storage available (private mode, quota…): the record only lasts this session
    }
}
