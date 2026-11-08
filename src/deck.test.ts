import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeck, isRed, rankName } from './deck';
import { card } from './test-helpers';

// The 52 ids in the order the deck is built, before shuffling
const UNSHUFFLED = ['♠', '♥', '♦', '♣'].flatMap((suit) =>
    Array.from({ length: 13 }, (_, k) => `${suit}${k + 1}`));

const ids = (deck = createDeck()) => deck.map((c) => c.id);

describe('createDeck', () => {
    afterEach(() => vi.restoreAllMocks());

    it('has 52 different cards, all face down', () => {
        const deck = createDeck();
        expect(deck).toHaveLength(52);
        expect(new Set(ids(deck)).size).toBe(52);
        expect(deck.every((c) => !c.faceUp)).toBe(true);
        expect(deck.every((c) => c.id === `${c.suit}${c.rank}`)).toBe(true);
    });

    it('has the Ace to the King of every suit', () => {
        const deck = createDeck();
        for (const suit of ['♠', '♥', '♦', '♣']) {
            const ranks = deck.filter((c) => c.suit === suit).map((c) => c.rank);
            expect(ranks.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        }
    });

    it('never loses or repeats a card when shuffling', () => {
        const expected = UNSHUFFLED.toSorted();
        for (let i = 0; i < 200; i++) expect(ids().toSorted()).toEqual(expected);
    });

    it('shuffles the cards', () => {
        // With every random number at the top of its range, no card is swapped
        vi.spyOn(Math, 'random').mockReturnValue(0.999999);
        expect(ids()).toEqual(UNSHUFFLED);

        vi.restoreAllMocks();
        expect(ids()).not.toEqual(UNSHUFFLED);
        expect(ids()).not.toEqual(ids());
    });
});

describe('card helpers', () => {
    it('tells red suits from black ones', () => {
        expect(isRed(card('5♥'))).toBe(true);
        expect(isRed(card('5♦'))).toBe(true);
        expect(isRed(card('5♠'))).toBe(false);
        expect(isRed(card('5♣'))).toBe(false);
    });

    it('names face cards by letter and the rest by number', () => {
        expect([1, 2, 10, 11, 12, 13].map(rankName)).toEqual(['A', '2', '10', 'J', 'Q', 'K']);
    });
});
