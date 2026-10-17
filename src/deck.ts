import type { Card, Suit } from './types';

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const FACE_NAMES: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function createDeck(): Card[] {
    const deck: Card[] = SUITS.flatMap((suit) =>
        Array.from({ length: 13 }, (_, k) => ({
            id: `${suit}${k + 1}`,
            suit,
            rank: k + 1,
            faceUp: false,
        })),
    );

    // Fisher-Yates: walk backwards swapping each card with a random earlier one
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

export const isRed = (c: Card): boolean => c.suit === '♥' || c.suit === '♦';
export const rankName = (rank: number): string => FACE_NAMES[rank] ?? String(rank);
