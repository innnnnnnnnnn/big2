import { Card, Suit, Rank, Hand, Player, GameState, HandType } from './types';
import { getHand, isValidMove, sortCards } from './bigTwo';

export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of [Suit.Club, Suit.Diamond, Suit.Heart, Suit.Spade]) {
        for (const rank of [
            Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, Rank.Eight,
            Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace, Rank.Two
        ]) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function initializeGame(playerInfos: { name: string, isHuman: boolean, score?: number }[]): GameState {
    const deck = shuffleDeck(createDeck());
    const players: Player[] = playerInfos.map((info, i) => ({
        id: `p${i}`,
        name: info.name,
        hand: sortCards(deck.slice(i * 13, (i + 1) * 13)),
        isHuman: info.isHuman,
        score: info.score || 0
    }));

    // Find player with 3 of Clubs to start
    let starterIndex = 0;
    for (let i = 0; i < players.length; i++) {
        if (players[i].hand.some(c => c.rank === Rank.Three && c.suit === Suit.Club)) {
            starterIndex = i;
            break;
        }
    }

    return {
        players,
        currentPlayerIndex: starterIndex,
        tableHand: null,
        lastPlayerIndex: null,
        roundWinnerIndex: null,
        history: [],
        isFinished: false,
        winners: []
    };
}

/**
 * Calculates the score deduction for a player based on remaining cards and 2s.
 */
export function calculateDeduction(cards: Card[]): number {
    const count = cards.length;
    if (count === 0) return 0;

    let doubles = 0;
    if (count >= 8) doubles += 1;

    const twoCount = cards.filter(c => c.rank === Rank.Two).length;
    doubles += twoCount;

    // Max 5 doubles
    doubles = Math.min(doubles, 5);

    return count * Math.pow(2, doubles);
}

/**
 * Main function to play a turn.
 */
export function playTurn(state: GameState, playerIndex: number, selectedCards: Card[] | null): GameState | string {
    if (state.currentPlayerIndex !== playerIndex) return "Not your turn";
    if (state.isFinished) return "Game already finished";

    const player = state.players[playerIndex];

    // PASS
    if (selectedCards === null || selectedCards.length === 0) {
        if (state.tableHand === null) return "Cannot pass when table is clear";

        const nextState = { ...state };
        nextState.history.push({ playerIndex, hand: null });

        // Check if others passed (3 passes in a row)
        const recentHistory = nextState.history.slice(-3);
        const passCount = recentHistory.filter(h => h.hand === null).length;

        if (passCount === 3) {
            // Clear table
            nextState.tableHand = null;
            nextState.lastPlayerIndex = null;
            // Round winner starts next
            // Current player passed, but who was the last to play?
            // Actually if 3 passed, the one who played the hand starts.
            nextState.currentPlayerIndex = state.lastPlayerIndex!;
        } else {
            nextState.currentPlayerIndex = (playerIndex + 1) % 4;
        }

        return nextState;
    }

    // PLAY HAND
    const hand = getHand(selectedCards);
    if (!hand) return "Invalid card combination";

    // First turn rule: must include 3 of Clubs
    if (state.history.length === 0) {
        const has3C = selectedCards.some(c => c.rank === Rank.Three && c.suit === Suit.Club);
        if (!has3C) return "First hand must include 3 of Clubs";
    }

    if (!isValidMove(hand, state.tableHand)) return "Hand cannot beat current table hand";

    // Valid move, update player's hand
    const nextPlayers = [...state.players];
    const nextHand = player.hand.filter(c =>
        !selectedCards.some(sc => sc.rank === c.rank && sc.suit === c.suit)
    );
    nextPlayers[playerIndex] = { ...player, hand: nextHand };

    const nextState = {
        ...state,
        players: nextPlayers,
        tableHand: hand,
        lastPlayerIndex: playerIndex,
        currentPlayerIndex: (playerIndex + 1) % 4,
        history: [...state.history, { playerIndex, hand }]
    };

    // Check if player won
    if (nextHand.length === 0) {
        return finishGame(nextState, playerIndex);
    }

    return nextState;
}

function finishGame(state: GameState, winnerIndex: number): GameState {
    const winner = state.players[winnerIndex];
    const nextPlayers = [...state.players];
    let totalDeduction = 0;

    for (let i = 0; i < 4; i++) {
        if (i === winnerIndex) continue;
        const deduction = calculateDeduction(nextPlayers[i].hand);
        nextPlayers[i] = { ...nextPlayers[i], score: nextPlayers[i].score - deduction };
        totalDeduction += deduction;
    }

    nextPlayers[winnerIndex] = { ...winner, score: winner.score + totalDeduction };

    return {
        ...state,
        players: nextPlayers,
        isFinished: true,
        winners: [winner.id]
    };
}
