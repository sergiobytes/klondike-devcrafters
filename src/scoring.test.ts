import { afterEach, describe, expect, it, vi } from 'vitest';
import { draw, findHint, move, state, undo } from './game';
import { currentScore, loadBest, pointsForMove, saveBest, winBonus } from './scoring';
import type { BestScore } from './scoring';
import { card, cards, hidden, setup, upTo } from './test-helpers';
import type { PileType } from './types';

// One test per row of the scoring table in the README
describe('points for each move', () => {
    it.each<[PileType, PileType, number]>([
        ['waste', 'foundation', 10],
        ['tableau', 'foundation', 10],
        ['waste', 'tableau', 5],
        ['foundation', 'tableau', -15],
        ['tableau', 'tableau', 0],
        ['foundation', 'foundation', 0],
    ])('%s to %s: %i', (from, to, points) => {
        expect(pointsForMove(from, to)).toBe(points);
    });

    it('+10 for a card to a foundation', () => {
        setup({ waste: cards('A♠'), tableau: [cards('A♥')] });
        move({ type: 'waste', pile: 0, index: 0 }, 'foundation', 0);
        move({ type: 'tableau', pile: 0, index: 0 }, 'foundation', 1);
        expect(state.score).toBe(20);
    });

    it('+5 for a card from the waste to the tableau', () => {
        setup({ waste: cards('7♥'), tableau: [cards('8♠')] });
        move({ type: 'waste', pile: 0, index: 0 }, 'tableau', 0);
        expect(state.score).toBe(5);
    });

    it('+5 for turning over a tableau card', () => {
        setup({ tableau: [[hidden('2♣'), card('7♥')], cards('8♠')] });
        move({ type: 'tableau', pile: 0, index: 1 }, 'tableau', 1);
        expect(state.score).toBe(5);
    });

    it('−15 for a card from a foundation back to the tableau', () => {
        setup({ score: 40, foundations: [upTo('♠', 8)], tableau: [cards('9♥')] });
        move({ type: 'foundation', pile: 0, index: 7 }, 'tableau', 0);
        expect(state.score).toBe(25);
    });

    it('−20 for turning the waste over', () => {
        setup({ score: 50, waste: cards('3♦ 9♣') });
        draw();
        expect(state.score).toBe(30);
    });

    it('−2 every 10 seconds of play', () => {
        expect(currentScore(100, 0)).toBe(100);
        expect(currentScore(100, 9)).toBe(100);
        expect(currentScore(100, 10)).toBe(98);
        expect(currentScore(100, 59)).toBe(90);
        expect(currentScore(100, 300)).toBe(40);
    });

    it('nothing for a hint, and undo gives the points back', () => {
        setup({ score: 30, waste: cards('A♦') });
        findHint();
        expect(state.score).toBe(30);
        move({ type: 'waste', pile: 0, index: 0 }, 'foundation', 0);
        expect(state.score).toBe(40);
        undo();
        expect(state.score).toBe(30);
    });
});

describe('the score never goes below 0', () => {
    it('when a move costs more points than there are', () => {
        setup({ score: 10, foundations: [upTo('♠', 8)], tableau: [cards('9♥')] });
        move({ type: 'foundation', pile: 0, index: 7 }, 'tableau', 0);
        expect(state.score).toBe(0);
        setup({ waste: cards('3♦') });
        draw();
        expect(state.score).toBe(0);
    });

    it('when the time penalty is bigger than the points', () => {
        expect(currentScore(10, 60)).toBe(0);
        expect(currentScore(0, 3600)).toBe(0);
    });
});

describe('winBonus', () => {
    it.each([
        [1, 0],
        [29, 0],
        [30, 23_333],
        [60, 11_667],
        [700, 1_000],
        [3_600, 194],
    ])('after %i s: %i points', (seconds, bonus) => {
        expect(winBonus(seconds)).toBe(bonus);
    });
});

describe('best score', () => {
    const KEY = 'klondike-devcrafters:best'; // changing it would forget everyone's record
    const record: BestScore = { score: 4321, seconds: 245, moves: 118, date: '2026-01-01T00:00:00.000Z' };

    const fakeStorage = (data = new Map<string, string>()) => ({
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
    });

    afterEach(() => vi.unstubAllGlobals());

    it('is saved and read back', () => {
        vi.stubGlobal('localStorage', fakeStorage());
        expect(loadBest()).toBeNull();
        saveBest(record);
        expect(loadBest()).toEqual(record);
    });

    it('ignores anything stored that is not a record', () => {
        for (const saved of ['not json', '{"moves":3}', 'null']) {
            vi.stubGlobal('localStorage', fakeStorage(new Map([[KEY, saved]])));
            expect(loadBest()).toBeNull();
        }
    });

    it('keeps the game going when there is no storage', () => {
        const fail = () => {
            throw new Error('storage disabled');
        };
        vi.stubGlobal('localStorage', { getItem: fail, setItem: fail });
        expect(loadBest()).toBeNull();
        expect(() => saveBest(record)).not.toThrow();
    });
});
