export type Suit = '♠' | '♥' | '♦' | '♣';

export interface Card {
    id: string;       // e.g. "♥7", used to track the card across re-renders
    suit: Suit;
    rank: number;     // 1 = Ace ... 13 = King
    faceUp: boolean;
}

export type PileType = 'waste' | 'foundation' | 'tableau';

export interface Selection {
    type: PileType;
    pile: number;   // which pile (e.g. tableau column 3)
    index: number;  // from which card of that pile
}

export interface GameState {
    stock: Card[];
    waste: Card[];
    foundations: Card[][];
    tableau: Card[][];
    moves: number;
    score: number;    // points earned by moves (the time penalty is applied separately)
}
