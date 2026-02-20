export enum Suit {
    Club = 0,    // 梅花 ♣
    Diamond = 1, // 方塊 ♦
    Heart = 2,   // 紅心 ♥
    Spade = 3,   // 黑桃 ♠
}

export enum Rank {
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
    Ten = 10,
    Jack = 11,
    Queen = 12,
    King = 13,
    Ace = 14,
    Two = 15, // 2 is the largest
}

export interface Card {
    suit: Suit;
    rank: Rank;
}

export enum HandType {
    Single = 'Single',
    Pair = 'Pair',
    Straight = 'Straight',
    FullHouse = 'FullHouse',
    FourOfAKind = 'FourOfAKind', // 鐵支
    StraightFlush = 'StraightFlush',
}

export interface Player {
    id: string;
    name: string;
    hand: Card[];
    isHuman: boolean;
    score: number;
}

export interface GameState {
    players: Player[];
    currentPlayerIndex: number;
    tableHand: Hand | null;
    lastPlayerIndex: number | null; // Index of the player who played the current table hand
    roundWinnerIndex: number | null;
    history: { playerIndex: number, hand: Hand | null }[];
    isFinished: boolean;
    winners: string[]; // Order of finishing
}

export interface Hand {
    type: HandType;
    cards: Card[];
    value: number; // A primary value for comparison within the same type
    suitValue?: number; // Tie-breaker suit value
}
