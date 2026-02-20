import { Suit, Rank, HandType, Card } from './types';
import { getHand, compareHands, isValidMove, sortCards } from './bigTwo';
import { calculateDeduction, initializeGame, playTurn } from './game';

function test() {
    console.log('Running Big Two Logic Tests...\n');

    // Test 1: Singleton Comparison
    const s3c = { suit: Suit.Club, rank: Rank.Three };
    const s3s = { suit: Suit.Spade, rank: Rank.Three };
    const s2d = { suit: Suit.Diamond, rank: Rank.Two };

    const h3c = getHand([s3c])!;
    const h3s = getHand([s3s])!;
    const h2d = getHand([s2d])!;

    console.log('Test 1: Singletons');
    console.log('3♣ < 3♠:', compareHands(h3c, h3s) < 0);
    console.log('3♠ < 2♦:', compareHands(h3s, h2d) < 0);

    // Test 2: Straights
    const a2345 = [
        { rank: Rank.Ace, suit: Suit.Spade },
        { rank: Rank.Two, suit: Suit.Spade },
        { rank: Rank.Three, suit: Suit.Spade },
        { rank: Rank.Four, suit: Suit.Spade },
        { rank: Rank.Five, suit: Suit.Spade },
    ];
    const straight34567 = [
        { rank: Rank.Three, suit: Suit.Club },
        { rank: Rank.Four, suit: Suit.Club },
        { rank: Rank.Five, suit: Suit.Club },
        { rank: Rank.Six, suit: Suit.Club },
        { rank: Rank.Seven, suit: Suit.Club },
    ];
    const largest23456 = [
        { rank: Rank.Two, suit: Suit.Club },
        { rank: Rank.Three, suit: Suit.Club },
        { rank: Rank.Four, suit: Suit.Club },
        { rank: Rank.Five, suit: Suit.Club },
        { rank: Rank.Six, suit: Suit.Club },
    ];

    const hA2345 = getHand(a2345)!;
    const h34567 = getHand(straight34567)!;
    const h23456 = getHand(largest23456)!;

    console.log('\nTest 2: Straights');
    console.log('A2345 type:', hA2345.type); // Should be StraightFlush since all spades
    console.log('A2345 vs 34567 (A2345 is smaller):', compareHands(hA2345, h34567) < 0);
    console.log('23456 vs 34567 (23456 is larger):', compareHands(h23456, h34567) > 0);

    // Test 3: Iron Branch (Four of a Kind) vs Full House
    const ironBranch3 = [
        { rank: Rank.Three, suit: Suit.Club },
        { rank: Rank.Three, suit: Suit.Diamond },
        { rank: Rank.Three, suit: Suit.Heart },
        { rank: Rank.Three, suit: Suit.Spade },
        { rank: Rank.Four, suit: Suit.Club },
    ];
    const fullHouse2 = [
        { rank: Rank.Two, suit: Suit.Club },
        { rank: Rank.Two, suit: Suit.Diamond },
        { rank: Rank.Two, suit: Suit.Heart },
        { rank: Rank.Ace, suit: Suit.Club },
        { rank: Rank.Ace, suit: Suit.Diamond },
    ];

    const hIron3 = getHand(ironBranch3)!;
    const hFull2 = getHand(fullHouse2)!;

    console.log('\nTest 3: Iron Branch vs Full House');
    console.log('Iron Branch 3 type:', hIron3.type);
    console.log('Full House 2 type:', hFull2.type);
    console.log('Iron Branch 3 beats Full House 2:', compareHands(hIron3, hFull2) > 0);

    // Test 4: Scoring
    console.log('\nTest 4: Scoring (Double Mechanism)');
    const sevenCards: Card[] = Array(7).fill({ rank: Rank.Three, suit: Suit.Club });
    console.log('7 cards, no 2s (score=7):', calculateDeduction(sevenCards) === 7);

    const eightCards: Card[] = Array(8).fill({ rank: Rank.Three, suit: Suit.Club });
    console.log('8 cards, no 2s (score=16):', calculateDeduction(eightCards) === 16);

    const nineCardsTwo2s: Card[] = [
        ...Array(7).fill({ rank: Rank.Three, suit: Suit.Club }),
        { rank: Rank.Two, suit: Suit.Club },
        { rank: Rank.Two, suit: Suit.Diamond }
    ];
    // 9 cards (1 double) + 2x Rank.Two (2 doubles) = 3 doubles total. 9 * 2^3 = 72
    console.log('9 cards, two 2s (score=72):', calculateDeduction(nineCardsTwo2s) === 72);

    const thirteenCardsFour2s: Card[] = [
        ...Array(9).fill({ rank: Rank.Three, suit: Suit.Club }),
        { rank: Rank.Two, suit: Suit.Club },
        { rank: Rank.Two, suit: Suit.Diamond },
        { rank: Rank.Two, suit: Suit.Heart },
        { rank: Rank.Two, suit: Suit.Spade }
    ];
    // 13 cards (1 double) + 4x Rank.Two (4 doubles) = 5 doubles. 13 * 2^5 = 416
    console.log('13 cards, four 2s (score=416):', calculateDeduction(thirteenCardsFour2s) === 416);

    // Test 5: Game Initialization
    console.log('\nTest 5: Initialization');
    const state = initializeGame([
        { name: 'Alice', isHuman: true },
        { name: 'Bob', isHuman: false },
        { name: 'Charlie', isHuman: false },
        { name: 'Dave', isHuman: false }
    ]);
    console.log('4 players:', state.players.length === 4);
    console.log('Each has 13 cards:', state.players.every(p => p.hand.length === 13));

    const starter = state.players[state.currentPlayerIndex];
    const has3C = starter.hand.some(c => c.rank === Rank.Three && c.suit === Suit.Club);
    console.log('Starter has 3♣:', has3C);

    // Test 6: Turn Logic
    console.log('\nTest 6: Turn Logic');
    const starterHand3C = starter.hand.filter(c => c.rank === Rank.Three && c.suit === Suit.Club);
    const nextState = playTurn(state, state.currentPlayerIndex, starterHand3C);
    if (typeof nextState !== 'string') {
        console.log('First move with 3♣ successful:', nextState.currentPlayerIndex !== state.currentPlayerIndex);
    } else {
        console.log('First move failed:', nextState);
    }
}

test();
