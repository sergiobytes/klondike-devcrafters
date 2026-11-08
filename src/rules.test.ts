import { describe, expect, it } from 'vitest';
import { canGoToFoundation, canGoToTableau } from './rules';
import { card, cards, hidden, upTo } from './test-helpers';
import type { Card } from './types';

describe('canGoToTableau', () => {
    it.each([
        ['7♥', '8♠'],
        ['7♦', '8♣'],
        ['7♠', '8♥'],
        ['7♣', '8♦'],
        ['Q♥', 'K♣'],
        ['A♠', '2♦'],
    ])('accepts %s on %s', (moving, top) => {
        expect(canGoToTableau(card(moving), [card(top)])).toBe(true);
    });

    it.each([
        ['7♥', '8♦', 'same colour'],
        ['7♠', '8♣', 'same colour'],
        ['6♥', '8♠', 'skips a rank'],
        ['9♥', '8♠', 'goes up'],
        ['8♥', '8♠', 'same rank'],
    ])('rejects %s on %s (%s)', (moving, top) => {
        expect(canGoToTableau(card(moving), [card(top)])).toBe(false);
    });

    it('only looks at the top card of the column', () => {
        expect(canGoToTableau(card('7♥'), cards('K♦ 9♣ 8♠'))).toBe(true);
        expect(canGoToTableau(card('7♥'), cards('8♠ 9♣'))).toBe(false);
    });

    it('never puts a card on a face-down one', () => {
        expect(canGoToTableau(card('7♥'), [hidden('8♠')])).toBe(false);
    });

    it('only lets a King into an empty column', () => {
        expect(canGoToTableau(card('K♥'), [])).toBe(true);
        expect(canGoToTableau(card('K♠'), [])).toBe(true);
        expect(canGoToTableau(card('Q♠'), [])).toBe(false);
        expect(canGoToTableau(card('A♣'), [])).toBe(false);
    });
});

describe('canGoToFoundation', () => {
    it('starts with an Ace and nothing else', () => {
        expect(canGoToFoundation(card('A♥'), [])).toBe(true);
        expect(canGoToFoundation(card('2♥'), [])).toBe(false);
        expect(canGoToFoundation(card('K♠'), [])).toBe(false);
    });

    it('builds up one suit, one rank at a time', () => {
        expect(canGoToFoundation(card('2♥'), upTo('♥', 1))).toBe(true);
        expect(canGoToFoundation(card('2♦'), upTo('♥', 1))).toBe(false);
        expect(canGoToFoundation(card('3♥'), upTo('♥', 1))).toBe(false);
        expect(canGoToFoundation(card('A♥'), upTo('♥', 1))).toBe(false);
        expect(canGoToFoundation(card('4♣'), upTo('♣', 5))).toBe(false);
    });

    it('takes a whole suit from Ace to King, then nothing more', () => {
        const pile: Card[] = [];
        for (const next of upTo('♣', 13)) {
            expect(canGoToFoundation(next, pile)).toBe(true);
            pile.push(next);
        }
        expect(canGoToFoundation(card('A♣'), pile)).toBe(false);
        expect(canGoToFoundation(card('A♠'), pile)).toBe(false);
    });
});
