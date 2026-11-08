// Builders shared by the unit tests
import { newGame, state } from './game';
import type { Card, GameState, Suit } from './types';

const FACE_RANKS: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };

/** A face-up card from its label: card('7♥'), card('10♣'), card('K♠') */
export function card(label: string): Card {
    const suit = label.slice(-1) as Suit;
    const rank = FACE_RANKS[label.slice(0, -1)] ?? Number(label.slice(0, -1));
    return { id: `${suit}${rank}`, suit, rank, faceUp: true };
}

export const hidden = (label: string): Card => ({ ...card(label), faceUp: false });

/** Several face-up cards, bottom first: cards('K♠ Q♥ J♣') */
export const cards = (labels: string): Card[] => labels.split(' ').map((label) => card(label));

/** A foundation holding one suit from the Ace up to `rank` */
export const upTo = (suit: Suit, rank: number): Card[] =>
    Array.from({ length: rank }, (_, k) => ({ id: `${suit}${k + 1}`, suit, rank: k + 1, faceUp: true }));

/** Starts a game with nothing to undo and only the given cards on the table */
export function setup(layout: Partial<GameState>): void {
    newGame();
    Object.assign(state, {
        stock: [], waste: [], moves: 0, score: 0, ...layout,
        foundations: Array.from({ length: 4 }, (_, i) => layout.foundations?.[i] ?? []),
        tableau: Array.from({ length: 7 }, (_, i) => layout.tableau?.[i] ?? []),
    });
}

/** Math.random replacement that always deals the same game for the same seed (mulberry32) */
export function seededRandom(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
