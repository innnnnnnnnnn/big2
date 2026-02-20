import { Card, Suit, Rank, HandType, Hand } from './types';

export const SORTED_RANKS = [
    Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, Rank.Eight,
    Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace, Rank.Two
];

/**
 * Sorts cards by rank and then by suit.
 */
export function sortCards(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => {
        if (a.rank !== b.rank) {
            return a.rank - b.rank;
        }
        return a.suit - b.suit;
    });
}

/**
 * Compares two cards based on Big Two rules (Rank first, then Suit).
 */
export function compareCards(a: Card, b: Card): number {
    if (a.rank !== b.rank) {
        return a.rank - b.rank;
    }
    return a.suit - b.suit;
}

/**
 * Get the strength of a straight for comparison.
 * Returns a score where higher is better.
 * A2345 Smallest, 23456 Largest.
 */
function getStraightStrength(ranks: Rank[]): number {
    const sorted = [...ranks].sort((a, b) => a - b);

    // Check for 2, 3, 4, 5, 6 (Largest)
    if (JSON.stringify(sorted) === JSON.stringify([Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Two])) {
        return 100;
    }

    // Check for A, 2, 3, 4, 5 (Smallest)
    if (JSON.stringify(sorted) === JSON.stringify([Rank.Three, Rank.Four, Rank.Five, Rank.Ace, Rank.Two])) {
        return 0;
    }

    // For others, use the highest rank in the sequence.
    // 3, 4, 5, 6, 7 => 7
    // 10, J, Q, K, A => A (14)
    return sorted[sorted.length - 1];
}

/**
 * Identify the hand type and its primary value for comparison.
 */
export function getHand(cards: Card[]): Hand | null {
    if (cards.length === 0) return null;
    const sorted = sortCards(cards);
    const len = cards.length;

    // Single
    if (len === 1) {
        return {
            type: HandType.Single,
            cards: sorted,
            value: sorted[0].rank,
            suitValue: sorted[0].suit
        };
    }

    // Pair
    if (len === 2) {
        if (sorted[0].rank === sorted[1].rank) {
            return {
                type: HandType.Pair,
                cards: sorted,
                value: sorted[0].rank,
                suitValue: Math.max(sorted[0].suit, sorted[1].suit)
            };
        }
        return null;
    }

    // 5-card hands
    if (len === 5) {
        const ranks = sorted.map(c => c.rank);
        const suits = sorted.map(c => c.suit);

        // Count frequencies
        const counts: Record<number, number> = {};
        ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const freqValues = Object.values(counts).sort((a, b) => b - a);
        const freqRanks = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a);

        const isStraight = (r: Rank[]) => {
            const s = [...r].sort((a, b) => a - b);
            // Check normal sequence
            const isNormal = s.every((val, i) => i === 0 || val === s[i - 1] + 1);
            if (isNormal) return true;

            // Check A, 2, 3, 4, 5
            if (JSON.stringify(s) === JSON.stringify([Rank.Three, Rank.Four, Rank.Five, Rank.Ace, Rank.Two])) return true;

            // Check 2, 3, 4, 5, 6
            if (JSON.stringify(s) === JSON.stringify([Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Two])) return true;

            return false;
        };

        const isFlush = suits.every(s => s === suits[0]);
        const straight = isStraight(ranks);

        // Straight Flush
        if (straight && isFlush) {
            return {
                type: HandType.StraightFlush,
                cards: sorted,
                value: getStraightStrength(ranks),
                // Special rule for 23456: only compare 2's suit
                suitValue: getStraightStrength(ranks) === 100 ? sorted.find(c => c.rank === Rank.Two)!.suit : sorted[sorted.length - 1].suit
            };
        }

        // Four of a Kind (Iron Branch)
        if (freqValues[0] === 4) {
            return {
                type: HandType.FourOfAKind,
                cards: sorted,
                value: freqRanks[0] // Rank of the 4 cards
            };
        }

        // Full House
        if (freqValues[0] === 3 && freqValues[1] === 2) {
            return {
                type: HandType.FullHouse,
                cards: sorted,
                value: freqRanks[0] // Rank of the 3 cards
            };
        }

        // Straight
        if (straight) {
            return {
                type: HandType.Straight,
                cards: sorted,
                value: getStraightStrength(ranks),
                suitValue: getStraightStrength(ranks) === 100 ? sorted.find(c => c.rank === Rank.Two)!.suit : sorted[sorted.length - 1].suit
            };
        }
    }

    return null;
}

/**
 * Compare two hands. Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareHands(a: Hand, b: Hand): number {
    // This is now mainly for comparing identical types
    if (a.type !== b.type) {
        const typeOrder = {
            [HandType.FourOfAKind]: 1,
            [HandType.StraightFlush]: 2
        } as any;

        return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
    }

    // Same type
    if (a.value !== b.value) {
        return a.value - b.value;
    }

    // Tie-breaker for same value
    if (a.suitValue !== undefined && b.suitValue !== undefined) {
        return a.suitValue - b.suitValue;
    }

    return 0;
}

/**
 * Checks if a played hand is valid against the current table hand.
 */
export function isValidMove(played: Hand, table: Hand | null): boolean {
    if (!table) return true;

    // RULE: Straight Flush beats EVERYTHING
    if (played.type === HandType.StraightFlush) {
        if (table.type === HandType.StraightFlush) {
            return compareHands(played, table) > 0;
        }
        return true; // Beats anything else (Single, Pair, Straight, Full House, FourOfAKind)
    }

    // RULE: Four of a Kind beats EVERYTHING except Straight Flush
    if (played.type === HandType.FourOfAKind) {
        if (table.type === HandType.StraightFlush) return false;
        if (table.type === HandType.FourOfAKind) {
            return compareHands(played, table) > 0;
        }
        return true; // Beats Single, Pair, Straight, Full House
    }

    // For other types (Single, Pair, Straight, Full House)
    // they MUST be the same type and same length
    if (played.type !== table.type) {
        return false;
    }

    // Same type, check strength
    return compareHands(played, table) > 0;
}

/**
 * Finds all valid pairs in the hand that can beat the given table hand.
 */
export function findValidPairs(hand: Card[], table: Hand | null): Card[][] {
    const sorted = sortCards(hand);
    const pairs: Card[][] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        const combo = [sorted[i], sorted[i + 1]];
        const handObj = getHand(combo);
        if (handObj && handObj.type === HandType.Pair) {
            if (isValidMove(handObj, table)) {
                pairs.push(combo);
            }
        }
    }
    return pairs;
}

/**
 * Finds all valid 5-card combinations of a specific type.
 */
export function findValidFiveCardHands(hand: Card[], table: Hand | null, type: HandType): Card[][] {
    if (hand.length < 5) return [];

    // This is computationally expensive if done naively (combinations).
    // We'll use a more targeted search for Big Two combinations.
    const results: Card[][] = [];
    const sorted = sortCards(hand);

    if (type === HandType.FullHouse) {
        const counts: Record<number, Card[]> = {};
        sorted.forEach(c => {
            if (!counts[c.rank]) counts[c.rank] = [];
            counts[c.rank].push(c);
        });
        const ranks = Object.keys(counts).map(Number);
        for (const tripRank of ranks) {
            if (counts[tripRank].length >= 3) {
                for (const pairRank of ranks) {
                    if (pairRank !== tripRank && counts[pairRank].length >= 2) {
                        const combo = [...counts[tripRank].slice(0, 3), ...counts[pairRank].slice(0, 2)];
                        const h = getHand(combo);
                        if (h && isValidMove(h, table)) results.push(combo);
                    }
                }
            }
        }
    }

    if (type === HandType.FourOfAKind) {
        const counts: Record<number, Card[]> = {};
        sorted.forEach(c => {
            if (!counts[c.rank]) counts[c.rank] = [];
            counts[c.rank].push(c);
        });
        const ranks = Object.keys(counts).map(Number);
        for (const quadRank of ranks) {
            if (counts[quadRank].length === 4) {
                for (const kicker of sorted) {
                    if (kicker.rank !== quadRank) {
                        const combo = [...counts[quadRank], kicker];
                        const h = getHand(combo);
                        if (h && isValidMove(h, table)) results.push(combo);
                    }
                }
            }
        }
    }

    if (type === HandType.Straight || type === HandType.StraightFlush) {
        // Targeted Straight Finder
        // Group by rank
        const byRank: Record<number, Card[]> = {};
        sorted.forEach(c => {
            if (!byRank[c.rank]) byRank[c.rank] = [];
            byRank[c.rank].push(c);
        });

        const uniqueRanks = Object.keys(byRank).map(Number).sort((a, b) => a - b);

        // Define all possible straight rank sets (including A2345, 23456)
        const possibleStraights: number[][] = [];
        // Normal straights
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            const slice = uniqueRanks.slice(i, i + 5);
            if (slice[4] - slice[0] === 4) possibleStraights.push(slice);
        }
        // A2345 (3,4,5,14,15)
        if ([3, 4, 5, 14, 15].every(r => byRank[r])) possibleStraights.push([3, 4, 5, 14, 15]);
        // 23456 (3,4,5,6,15)
        if ([3, 4, 5, 6, 15].every(r => byRank[r])) possibleStraights.push([3, 4, 5, 6, 15]);

        for (const sr of possibleStraights) {
            // Optimization: Just take one card of each rank for now
            // A truly advanced AI would check suits, but for a "helper button", picking one is fine
            // We take the best suit for the highest rank to maximize strength
            const combo = sr.map(r => byRank[r][0]);

            // If checking Straight Flush, must all be same suit
            if (type === HandType.StraightFlush) {
                for (let s = 0; s < 4; s++) {
                    const suitedCombo = sr.map(r => byRank[r].find(c => c.suit === s));
                    if (suitedCombo.every(c => c !== undefined)) {
                        const h = getHand(suitedCombo as Card[]);
                        if (h && isValidMove(h, table)) results.push(suitedCombo as Card[]);
                    }
                }
            } else {
                const h = getHand(combo);
                if (h && isValidMove(h, table)) results.push(combo);
            }
        }
    }

    return results;
}

/**
 * Automatically groups cards into combinations (5-card hands, pairs, singles).
 * Used for the "Smart Sort" feature.
 */
export function autoOrganizeHand(cards: Card[]): Card[] {
    let remaining = sortCards(cards);
    const organized: Card[] = [];

    // Helper to extract a set of cards from remaining
    const extract = (toExtract: Card[]) => {
        toExtract.forEach(ex => {
            const idx = remaining.findIndex(c => c.rank === ex.rank && c.suit === ex.suit);
            if (idx !== -1) remaining.splice(idx, 1);
        });
        organized.push(...toExtract);
    };

    // 1. Try to find 5-card hands (Simple greedy approach)
    // We'll check for Full Houses and Straights
    // Full Houses
    const counts: Record<number, Card[]> = {};
    remaining.forEach(c => {
        if (!counts[c.rank]) counts[c.rank] = [];
        counts[c.rank].push(c);
    });

    const rankFreqs = Object.keys(counts).map(Number).sort((a, b) => counts[b].length - counts[a].length || b - a);

    // Check for 4-of-a-kind (Iron Branch)
    for (const r of rankFreqs) {
        if (counts[r].length === 4) {
            // Find a kicker
            const kickerRank = rankFreqs.find(rk => rk !== r);
            if (kickerRank) {
                const quad = [...counts[r]];
                const kicker = counts[kickerRank][0];
                extract([...quad, kicker]);
                // Re-calculate freqs for next pass
                return autoOrganizeHand([...organized, ...remaining]);
            }
        }
    }

    // Check for Full House
    const trips = rankFreqs.filter(r => counts[r].length === 3);
    const pairs = rankFreqs.filter(r => counts[r].length >= 2);

    if (trips.length > 0) {
        const tripRank = trips[0];
        const pairRank = pairs.find(r => r !== tripRank);
        if (pairRank) {
            extract([...counts[tripRank], ...counts[pairRank].slice(0, 2)]);
            return autoOrganizeHand([...organized, ...remaining]);
        }
    }

    // 2. Find Pairs
    const remainingCounts: Record<number, Card[]> = {};
    remaining.forEach(c => {
        if (!remainingCounts[c.rank]) remainingCounts[c.rank] = [];
        remainingCounts[c.rank].push(c);
    });

    const currentPairs = Object.keys(remainingCounts).map(Number).filter(r => remainingCounts[r].length >= 2).sort((a, b) => a - b);
    for (const r of currentPairs) {
        extract(remainingCounts[r].slice(0, 2));
    }

    // 3. Add remaining singles
    organized.push(...remaining);

    return organized;
}
