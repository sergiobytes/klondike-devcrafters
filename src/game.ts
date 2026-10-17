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

export type Hint =
    | { kind: 'move'; from: Selection; to: PileType; pile: number }
    | { kind: 'draw' };

/**
 * Finds the most promising move, or null when the game is stuck. Only moves that
 * get somewhere count: shuffling a run between two equivalent spots doesn't.
 * Every stock and waste card counts as reachable, since the waste can be turned
 * over as many times as needed.
 */
export function findHint(): Hint | null {
    const reachable = [...state.stock, ...state.waste];
    const fitsFoundation = (card: Card) => state.foundations.some((f) => canGoToFoundation(card, f));
    const kingWaiting =
        reachable.some((c) => c.rank === 13) ||
        state.tableau.some((column) => column.some((c, k) => k > 0 && c.faceUp && c.rank === 13));
    // Face-up cards sitting on a hidden one: moving them anywhere reveals a card
    const blockedBases = state.tableau.flatMap((column) =>
        column.filter((c, k) => c.faceUp && k > 0 && !column[k - 1].faceUp));
    // Cards that need a tableau spot to get into play (not those ready for a foundation)
    const waiting = [...reachable, ...blockedBases].filter((c) => !fitsFoundation(c));
    const isWaitedOn = (card: Card) => waiting.some((c) => canGoToTableau(c, [card]));

    // Lower priority = better hint
    const candidates: { priority: number; hint: Hint }[] = [];
    const tryTargets = (priority: number, from: Selection, to: PileType) => {
        const piles = to === 'foundation' ? state.foundations.length : state.tableau.length;
        for (let pile = 0; pile < piles; pile++) {
            if (isValidMove(from, to, pile)) candidates.push({ priority, hint: { kind: 'move', from, to, pile } });
        }
    };

    // Waste top or tableau tops onto a foundation. A tableau card that another card is
    // waiting to go on comes last, so a card just brought down isn't sent straight back up
    if (state.waste.length) tryTargets(0, { type: 'waste', pile: 0, index: state.waste.length - 1 }, 'foundation');
    state.tableau.forEach((column, pile) => {
        const top = column.at(-1);
        if (top) tryTargets(isWaitedOn(top) ? 6 : 0, { type: 'tableau', pile, index: column.length - 1 }, 'foundation');
    });

    // Tableau runs that reveal a hidden card (deeper columns first), uncover a card
    // for a foundation, or empty a column a king is waiting for
    state.tableau.forEach((column, pile) => {
        column.forEach((card, index) => {
            if (!card.faceUp) return;
            const from: Selection = { type: 'tableau', pile, index };
            const below = column[index - 1];
            if (below && !below.faceUp) {
                tryTargets(1 - index / 100, from, 'tableau');
            } else if (below?.faceUp ? fitsFoundation(below) && !isWaitedOn(below) : card.rank !== 13 && kingWaiting) {
                tryTargets(3, from, 'tableau');
            }
        });
    });

    // Waste top onto the tableau
    if (state.waste.length) tryTargets(2, { type: 'waste', pile: 0, index: state.waste.length - 1 }, 'tableau');

    // A foundation card back down, when a waiting card could then go on top of it
    state.foundations.forEach((cards, pile) => {
        const top = cards.at(-1);
        if (top && isWaitedOn(top)) {
            tryTargets(4, { type: 'foundation', pile, index: cards.length - 1 }, 'tableau');
        }
    });

    // Drawing, when some stock or waste card already has somewhere to go
    if (reachable.some((c) => fitsFoundation(c) || state.tableau.some((column) => canGoToTableau(c, column)))) {
        candidates.push({ priority: 5, hint: { kind: 'draw' } });
    }

    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0]?.hint ?? null;
}

export const isStuck = (): boolean => !hasWon() && findHint() === null;
