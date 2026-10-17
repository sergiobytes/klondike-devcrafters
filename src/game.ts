import { createDeck } from './deck';
import { canGoToFoundation, canGoToTableau } from './rules';
import { POINTS, pointsForMove } from './scoring';
import type { Card, GameState, PileType, Selection } from './types';

export type MoveResult =
    | { valid: false }
    | { valid: true; flipped: string | null };

const MAX_HISTORY = 300;

export const state: GameState = {
    stock: [], waste: [], foundations: [], tableau: [], moves: 0, score: 0,
};

// Copies of the state taken before every move, so it can be undone
const history: GameState[] = [];

function saveSnapshot(): void {
    history.push(structuredClone(state));
    if (history.length > MAX_HISTORY) history.shift();
}

function addPoints(points: number): void {
    state.score = Math.max(0, state.score + points);
}

export function newGame(): void {
    const deck = createDeck();
    state.waste = [];
    state.foundations = [[], [], [], []];
    state.tableau = Array.from({ length: 7 }, () => []);
    state.moves = 0;
    state.score = 0;
    history.length = 0;

    for (let i = 0; i < 7; i++) {
        for (let j = 0; j <= i; j++) {
            const card = deck.pop()!;
            card.faceUp = j === i;
            state.tableau[i].push(card);
        }
    }
    state.stock = deck;
}

export function getPile(type: PileType, pile: number): Card[] {
    if (type === 'waste') return state.waste;
    if (type === 'foundation') return state.foundations[pile];
    return state.tableau[pile];
}

// Any face-up top card can be picked; in the tableau, also one with cards on top of it
export function canPick({ type, pile, index }: Selection): boolean {
    const cards = getPile(type, pile);
    if (!cards[index]?.faceUp) return false;
    return type === 'tableau' || index === cards.length - 1;
}

export function isValidMove(from: Selection, toType: PileType, toPile: number): boolean {
    if (from.type === toType && from.pile === toPile) return false;
    const cards = getPile(from.type, from.pile).slice(from.index);
    const target = getPile(toType, toPile);
    const [first] = cards;
    if (!first) return false;

    return toType === 'foundation'
        ? cards.length === 1 && canGoToFoundation(first, target)
        : toType === 'tableau' && canGoToTableau(first, target);
}

export function move(from: Selection, toType: PileType, toPile: number): MoveResult {
    if (!isValidMove(from, toType, toPile)) return { valid: false };
    saveSnapshot();

    const source = getPile(from.type, from.pile);
    getPile(toType, toPile).push(...source.splice(from.index));
    state.moves++;
    addPoints(pointsForMove(from.type, toType));

    let flipped: string | null = null;
    const newTop = source.at(-1);
    if (from.type === 'tableau' && newTop && !newTop.faceUp) {
        newTop.faceUp = true;
        flipped = newTop.id;
        addPoints(POINTS.flip);
    }
    return { valid: true, flipped };
}

export function sendToFoundation(from: Selection): MoveResult {
    if (from.type === 'foundation') return { valid: false };
    for (let f = 0; f < 4; f++) {
        const r = move(from, 'foundation', f);
        if (r.valid) return r;
    }
    return { valid: false };
}

export function draw(): MoveResult {
    if (!state.stock.length && !state.waste.length) return { valid: false };
    saveSnapshot();
    state.moves++;

    const card = state.stock.pop();
    if (card) {
        card.faceUp = true;
        state.waste.push(card);
        return { valid: true, flipped: card.id };
    }
    state.stock = state.waste.toReversed();
    state.stock.forEach((c) => (c.faceUp = false));
    state.waste = [];
    addPoints(POINTS.recycle);
    return { valid: true, flipped: null };
}

export const canUndo = (): boolean => history.length > 0;

// Undo restores the cards and the points, but still counts as one more move
export function undo(): boolean {
    const previous = history.pop();
    if (!previous) return false;
    const moves = state.moves;
    Object.assign(state, previous);
    state.moves = moves + 1;
    return true;
}

export const hasWon = (): boolean => state.foundations.every((f) => f.length === 13);

export const canAutoComplete = (): boolean =>
    !hasWon() && state.tableau.every((column) => column.every((c) => c.faceUp));

/**
 * Moves the lowest card still outside the foundations onto its foundation. Once
 * every tableau card is face up, that card is always free (it is the top of its
 * column, or it is in the stock/waste) and always fits, so the game is solved.
 */
export function autoCompleteStep(): MoveResult {
    let source: Card[] | null = null;
    let index = -1;
    for (const pile of [state.stock, state.waste, ...state.tableau]) {
        for (let k = 0; k < pile.length; k++) {
            if (!source || pile[k].rank < source[index].rank) {
                source = pile;
                index = k;
            }
        }
    }
    const card = source?.[index];
    const target = card && state.foundations.find((f) => canGoToFoundation(card, f));
    if (!source || !card || !target) return { valid: false };

    saveSnapshot();
    source.splice(index, 1);
    const wasHidden = !card.faceUp;
    card.faceUp = true;
    target.push(card);
    state.moves++;
    addPoints(POINTS.toFoundation);
    return { valid: true, flipped: wasHidden ? card.id : null };
}
