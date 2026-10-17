import { isRed } from './deck';
import type { Card } from './types';

export function canGoToFoundation(card: Card, pile: Card[]): boolean {
    const top = pile.at(-1);
    if (!top) return card.rank === 1;
    return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canGoToTableau(card: Card, pile: Card[]): boolean {
    const top = pile.at(-1);
    if (!top) return card.rank === 13;
    return top.faceUp && isRed(top) !== isRed(card) && card.rank === top.rank - 1;
}
