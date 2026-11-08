import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    autoCompleteStep, canAutoComplete, canPick, canUndo, draw, findHint, hasWon, isStuck,
    isValidMove, move, newGame, sendToFoundation, state, undo,
} from './game';
import type { Hint, MoveResult } from './game';
import { canGoToTableau } from './rules';
import { card, cards, hidden, seededRandom, setup, upTo } from './test-helpers';
import type { Card, GameState } from './types';

const SUITS = ['♠', '♥', '♦', '♣'] as const;

const allCards = (s: GameState): Card[] => [s.stock, s.waste, ...s.foundations, ...s.tableau].flat();
const idsOf = (pile: Card[]) => pile.map((c) => c.id);

function dealSeeded(seed: number): void {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
    newGame();
    vi.restoreAllMocks();
}

const play = (hint: Hint): MoveResult => (hint.kind === 'draw' ? draw() : move(hint.from, hint.to, hint.pile));

// What has to hold after any sequence of moves
function expectConsistentTable(): void {
    const ids = idsOf(allCards(state));
    expect(ids).toHaveLength(52);
    expect(new Set(ids).size).toBe(52);
    expect(state.stock.every((c) => !c.faceUp)).toBe(true);
    expect(state.waste.every((c) => c.faceUp)).toBe(true);
    for (const pile of state.foundations) {
        pile.forEach((c, k) => expect([c.suit, c.rank]).toEqual([pile[0].suit, k + 1]));
    }
    for (const column of state.tableau) {
        // Face-down cards at the bottom, then a run that follows the tableau rules
        const firstUp = column.findIndex((c) => c.faceUp);
        if (!column.length) continue;
        expect(firstUp).toBeGreaterThanOrEqual(0);
        for (let k = firstUp + 1; k < column.length; k++) {
            expect(canGoToTableau(column[k], column.slice(0, k))).toBe(true);
        }
    }
}

describe('the deal', () => {
    beforeEach(() => newGame());

    it('puts 1 to 7 cards in the tableau columns, only the top one face up', () => {
        expect(state.tableau.map((column) => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        for (const column of state.tableau) {
            expect(column.map((c) => c.faceUp)).toEqual(column.map((_, k) => k === column.length - 1));
        }
    });

    it('leaves the other 24 cards face down in the stock', () => {
        expect(state.stock).toHaveLength(24);
        expect(state.stock.every((c) => !c.faceUp)).toBe(true);
        expect(state.waste).toEqual([]);
        expect(state.foundations).toEqual([[], [], [], []]);
    });

    it('uses every card of the deck once', () => {
        expectConsistentTable();
    });

    it('starts from zero, with nothing to undo from the last game', () => {
        draw();
        newGame();
        expect(state.moves).toBe(0);
        expect(state.score).toBe(0);
        expect(canUndo()).toBe(false);
    });
});

describe('moving cards', () => {
    it('picks face-up cards only, and just the top one from the waste or a foundation', () => {
        setup({
            waste: cards('2♦ 9♣'),
            foundations: [upTo('♠', 2)],
            tableau: [[hidden('5♥'), card('8♠'), card('7♥')]],
        });
        expect(canPick({ type: 'tableau', pile: 0, index: 0 })).toBe(false);
        expect(canPick({ type: 'tableau', pile: 0, index: 1 })).toBe(true);
        expect(canPick({ type: 'tableau', pile: 0, index: 2 })).toBe(true);
        expect(canPick({ type: 'waste', pile: 0, index: 0 })).toBe(false);
        expect(canPick({ type: 'waste', pile: 0, index: 1 })).toBe(true);
        expect(canPick({ type: 'foundation', pile: 0, index: 0 })).toBe(false);
        expect(canPick({ type: 'foundation', pile: 0, index: 1 })).toBe(true);
    });

    it('moves a whole run and turns over the card it uncovers', () => {
        setup({ tableau: [[hidden('2♣'), card('8♠'), card('7♥')], cards('9♦')] });
        expect(move({ type: 'tableau', pile: 0, index: 1 }, 'tableau', 1)).toEqual({ valid: true, flipped: '♣2' });
        expect(idsOf(state.tableau[1])).toEqual(['♦9', '♠8', '♥7']);
        expect(state.tableau[0]).toEqual([card('2♣')]);
        expect(state.moves).toBe(1);
    });

    it('lets only a King, or a run starting with one, into an empty column', () => {
        setup({ tableau: [[hidden('3♣'), card('K♠'), card('Q♥')], [hidden('4♣'), card('Q♣'), card('J♦')]] });
        expect(isValidMove({ type: 'tableau', pile: 0, index: 1 }, 'tableau', 2)).toBe(true);
        expect(isValidMove({ type: 'tableau', pile: 0, index: 2 }, 'tableau', 2)).toBe(false);
        expect(isValidMove({ type: 'tableau', pile: 1, index: 1 }, 'tableau', 2)).toBe(false);
    });

    it('sends single cards to a foundation, never a run', () => {
        setup({ foundations: [upTo('♥', 6)], tableau: [cards('8♣ 7♥')] });
        expect(isValidMove({ type: 'tableau', pile: 0, index: 1 }, 'foundation', 0)).toBe(true);
        setup({ foundations: [upTo('♣', 7)], tableau: [cards('8♣ 7♥')] });
        expect(isValidMove({ type: 'tableau', pile: 0, index: 0 }, 'foundation', 0)).toBe(false);
    });

    it('finds the right foundation on its own', () => {
        setup({ foundations: [upTo('♥', 1), upTo('♠', 2)], tableau: [cards('3♠'), cards('A♦')] });
        expect(sendToFoundation({ type: 'tableau', pile: 0, index: 0 }).valid).toBe(true);
        expect(sendToFoundation({ type: 'tableau', pile: 1, index: 0 }).valid).toBe(true);
        expect(state.foundations.map(idsOf)).toEqual([['♥1'], ['♠1', '♠2', '♠3'], ['♦1'], []]);
    });

    it('ignores invalid moves: no move counted, nothing to undo', () => {
        setup({ foundations: [upTo('♠', 1)], tableau: [cards('7♥'), cards('8♦')] });
        expect(move({ type: 'tableau', pile: 0, index: 0 }, 'tableau', 1)).toEqual({ valid: false });
        expect(move({ type: 'tableau', pile: 0, index: 0 }, 'tableau', 0)).toEqual({ valid: false });
        expect(move({ type: 'waste', pile: 0, index: 0 }, 'tableau', 2)).toEqual({ valid: false }); // empty waste
        expect(sendToFoundation({ type: 'tableau', pile: 1, index: 0 })).toEqual({ valid: false });
        expect(sendToFoundation({ type: 'foundation', pile: 0, index: 0 })).toEqual({ valid: false });
        expect(state.moves).toBe(0);
        expect(canUndo()).toBe(false);
    });

    it('draws one card at a time and turns the waste over when the stock runs out', () => {
        setup({ stock: [hidden('5♣'), hidden('9♥')] });
        expect(draw()).toEqual({ valid: true, flipped: '♥9' });
        expect(draw()).toEqual({ valid: true, flipped: '♣5' });
        expect(idsOf(state.waste)).toEqual(['♥9', '♣5']);

        expect(draw()).toEqual({ valid: true, flipped: null });
        expect(state.waste).toEqual([]);
        expect(state.stock).toEqual([hidden('5♣'), hidden('9♥')]); // the same order as at first
        expect(state.moves).toBe(3);
    });

    it('cannot draw when the stock and the waste are both empty', () => {
        setup({});
        expect(draw()).toEqual({ valid: false });
    });
});

describe('undo', () => {
    it('restores the cards and the points, counting one more move', () => {
        setup({ score: 10, moves: 4, tableau: [[hidden('2♣'), card('7♥')], cards('8♠')] });
        const before = structuredClone(state);
        move({ type: 'tableau', pile: 0, index: 1 }, 'tableau', 1);

        expect(undo()).toBe(true);
        expect(state).toEqual({ ...before, moves: 6 });
        expect(canUndo()).toBe(false);
        expect(undo()).toBe(false);
    });

    it('takes back turning the waste over', () => {
        setup({ score: 25, waste: cards('3♦ 9♣') });
        const before = structuredClone(state);
        draw();
        undo();
        expect(state).toEqual({ ...before, moves: 2 });
    });

    it.each([1, 2, 3, 4, 5])('walks game %i all the way back to the deal', (seed) => {
        dealSeeded(seed);
        const deal = structuredClone(state);
        let played = 0;
        for (let hint = findHint(); hint && played < 150; hint = findHint()) {
            play(hint);
            played++;
        }

        let undone = 0;
        while (undo()) undone++;
        expect(undone).toBe(played);
        expect(state).toEqual({ ...deal, moves: played * 2 });
    });

    it('remembers the last 300 moves', () => {
        newGame();
        for (let i = 0; i < 310; i++) draw();
        let undone = 0;
        while (undo()) undone++;
        expect(undone).toBe(300);
    });
});

describe('auto-complete', () => {
    // Every card from 10 up is still out: three runs in the tableau, the rest in the stock and waste
    const almostWon = () => setup({
        foundations: SUITS.map((suit) => upTo(suit, 9)),
        tableau: [cards('K♠ Q♥ J♣ 10♦'), cards('K♥ Q♣ J♦ 10♠'), cards('K♦ Q♠ J♥ 10♣')],
        stock: [hidden('K♣'), hidden('J♠')],
        waste: cards('Q♦ 10♥'),
    });

    it('is not available while a tableau card is face down', () => {
        newGame();
        expect(canAutoComplete()).toBe(false);
        almostWon();
        state.tableau[2][0].faceUp = false;
        expect(canAutoComplete()).toBe(false);
    });

    it('is available once every tableau card is face up, even with cards left in the stock', () => {
        almostWon();
        expect(canAutoComplete()).toBe(true);
    });

    it('wins the game, one card to a foundation at a time', () => {
        almostWon();
        const flipped: string[] = [];
        let steps = 0;
        for (let r = autoCompleteStep(); r.valid; r = autoCompleteStep()) {
            if (r.flipped) flipped.push(r.flipped);
            steps++;
        }
        expect(steps).toBe(16);
        expect(hasWon()).toBe(true);
        expect(state.score).toBe(160);
        expect(state.moves).toBe(16);
        expect(flipped.toSorted()).toEqual(['♠11', '♣13']); // the two stock cards
        expect(canAutoComplete()).toBe(false);
    });

    it('can be undone card by card', () => {
        almostWon();
        const before = structuredClone(state);
        autoCompleteStep();
        autoCompleteStep();
        undo();
        undo();
        expect(state).toEqual({ ...before, moves: 4 });
    });
});

describe('hints', () => {
    it('suggests putting an Ace on a foundation', () => {
        setup({ waste: cards('A♦'), tableau: [cards('5♣')] });
        expect(findHint()).toEqual({ kind: 'move', from: { type: 'waste', pile: 0, index: 0 }, to: 'foundation', pile: 0 });
    });

    it('suggests a move that turns over a hidden card', () => {
        setup({ tableau: [[hidden('2♣'), card('7♥')], cards('8♠')] });
        expect(findHint()).toEqual({ kind: 'move', from: { type: 'tableau', pile: 0, index: 1 }, to: 'tableau', pile: 1 });
    });

    it('suggests moving a King into an empty column', () => {
        setup({ tableau: [[hidden('2♣'), card('K♥')]] });
        expect(findHint()).toEqual({ kind: 'move', from: { type: 'tableau', pile: 0, index: 1 }, to: 'tableau', pile: 1 });
    });

    it('suggests drawing when a stock card has somewhere to go', () => {
        setup({ stock: [hidden('7♥'), hidden('3♠')], tableau: [cards('8♣')] });
        expect(findHint()).toEqual({ kind: 'draw' });
    });

    it('does not suggest moving a run between two equivalent cards', () => {
        setup({ tableau: [cards('9♠ 8♥'), cards('9♣')] });
        expect(isValidMove({ type: 'tableau', pile: 0, index: 1 }, 'tableau', 1)).toBe(true);
        expect(findHint()).toBeNull();
    });

    it.each(Array.from({ length: 30 }, (_, i) => i + 1))('only suggests legal moves (game %i)', (seed) => {
        dealSeeded(seed);
        for (let step = 0; step < 300; step++) {
            const hint = findHint();
            expect(isStuck()).toBe(!hint && !hasWon());
            if (!hint) break;

            if (hint.kind === 'move') {
                expect(canPick(hint.from)).toBe(true);
                expect(isValidMove(hint.from, hint.to, hint.pile)).toBe(true);
            } else {
                expect(state.stock.length + state.waste.length).toBeGreaterThan(0);
            }
            expect(play(hint).valid).toBe(true);
            expectConsistentTable();
        }
    });
});

describe('end of the game', () => {
    it('is won once every foundation holds a whole suit', () => {
        setup({ foundations: SUITS.map((suit) => upTo(suit, 13)) });
        expect(hasWon()).toBe(true);
        expect(isStuck()).toBe(false);
    });

    it('is not over while a card is still out', () => {
        setup({ foundations: [upTo('♠', 13), upTo('♥', 13), upTo('♦', 13), upTo('♣', 12)], waste: cards('K♣') });
        expect(hasWon()).toBe(false);
        expect(isStuck()).toBe(false);
    });

    it('is stuck when no move gets anywhere', () => {
        setup({
            stock: [hidden('2♥'), hidden('6♣')],
            tableau: [[hidden('A♠'), card('9♦')], [hidden('A♥'), card('4♠')]],
        });
        expect(isStuck()).toBe(true);
    });

    it('is not stuck while drawing can still help', () => {
        setup({
            stock: [hidden('2♥'), hidden('3♦')],
            tableau: [[hidden('A♠'), card('9♦')], [hidden('A♥'), card('4♠')]],
        });
        expect(isStuck()).toBe(false);
    });

    it('is not stuck right after undoing the last move', () => {
        setup({ waste: cards('8♣'), tableau: [[hidden('A♠'), card('9♦')]] });
        move({ type: 'waste', pile: 0, index: 0 }, 'tableau', 0);
        expect(isStuck()).toBe(true);
        undo();
        expect(isStuck()).toBe(false);
    });
});
