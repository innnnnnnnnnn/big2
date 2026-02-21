"use client";

import React, { useState, useEffect } from 'react';
import { GameState, Card as CardType, HandType } from '../logic/types';
import Card from './Card';
import { Socket } from 'socket.io-client';
import { autoOrganizeHand, sortCards, findValidPairs, findValidFiveCardHands } from '../logic/bigTwo';

interface GameBoardProps {
    initialGameState: GameState;
    playerIndex: number;
    socket: Socket;
    roomId: string;
    onExit: () => void;
    onNextGame: () => void;
    isHost: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ initialGameState, playerIndex, socket, roomId, onExit, onNextGame, isHost }) => {
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Manage local display order
    const [localHand, setLocalHand] = useState<CardType[]>(initialGameState.players[playerIndex].hand);

    useEffect(() => {
        socket.on("state_update", (state: GameState) => {
            setGameState(state);
            setError(null);

            // Sync local hand with new server hand (preserving order)
            const serverHand = state.players[playerIndex].hand;
            setLocalHand(prev => {
                // Remove cards no longer in server hand
                const stillHeld = prev.filter(pc =>
                    serverHand.some(sc => sc.rank === pc.rank && sc.suit === pc.suit)
                );
                // Add any new cards (shouldn't happen mid-game but for safety)
                const newCards = serverHand.filter(sc =>
                    !prev.some(pc => pc.rank === sc.rank && pc.suit === sc.suit)
                );
                return [...stillHeld, ...newCards];
            });
        });

        socket.on("game_start", (data: { state: GameState, playerIndex: number }) => {
            setGameState(data.state);
            setLocalHand(data.state.players[data.playerIndex].hand);
            setSelectedCards([]);
            setError(null);
        });

        socket.on("error", (msg: string) => {
            setError(msg);
        });

        return () => {
            socket.off("state_update");
            socket.off("game_start");
            socket.off("error");
        };
    }, [socket, playerIndex]);

    const isMyTurn = gameState.currentPlayerIndex === playerIndex;

    const toggleCardSelection = (card: CardType) => {
        const isSelected = selectedCards.some(c => c.rank === card.rank && c.suit === card.suit);
        if (isSelected) {
            setSelectedCards(selectedCards.filter(c => !(c.rank === card.rank && c.suit === card.suit)));
        } else {
            setSelectedCards([...selectedCards, card]);
        }
    };

    const handlePlay = (cardsToPlay: CardType[] = selectedCards) => {
        socket.emit("play_hand", { roomId, cards: cardsToPlay });
        setSelectedCards([]);
    };

    const handlePass = () => {
        socket.emit("play_hand", { roomId, cards: null });
        setSelectedCards([]);
    };

    const handleSmartSort = () => {
        setLocalHand(autoOrganizeHand(localHand));
    };

    const handleNormalSort = () => {
        setLocalHand(sortCards(localHand));
    };

    const handleGroupCards = () => {
        if (selectedCards.length === 0) return;

        // Move selected cards to the front
        const unselected = localHand.filter(hc =>
            !selectedCards.some(sc => sc.rank === hc.rank && sc.suit === hc.suit)
        );

        setLocalHand([...selectedCards, ...unselected]);
        setSelectedCards([]); // Clear selection after grouping
    };

    const handleAutoPlayCombo = (type: HandType) => {
        if (!isMyTurn) return;
        let combos: CardType[][] = [];
        if (type === HandType.Pair) {
            combos = findValidPairs(localHand, gameState.tableHand);
        } else {
            combos = findValidFiveCardHands(localHand, gameState.tableHand, type);
        }

        if (combos.length > 0) {
            // Pick the smallest valid one (findValid already returns them moderately sorted)
            handlePlay(combos[0]);
        }
    };

    // Check availability for helper buttons
    const availableCombos = {
        Pair: isMyTurn && findValidPairs(localHand, gameState.tableHand).length > 0,
        Straight: isMyTurn && findValidFiveCardHands(localHand, gameState.tableHand, HandType.Straight).length > 0,
        FullHouse: isMyTurn && findValidFiveCardHands(localHand, gameState.tableHand, HandType.FullHouse).length > 0,
        FourOfAKind: isMyTurn && findValidFiveCardHands(localHand, gameState.tableHand, HandType.FourOfAKind).length > 0,
    };

    // Reorder players to put current human at the bottom
    const getPlayerAtPosition = (pos: number) => {
        const idx = (playerIndex + pos) % 4;
        return { ...gameState.players[idx], originalIndex: idx };
    };

    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    return (
        <div className="fixed inset-0 w-full h-screen bg-[#1a472a] flex flex-col items-center overflow-hidden touch-none select-none">
            {/* Immersive Background */}
            <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40" />

            {/* Top Area: All 3 Opponents (20vh) */}
            <div className="w-full h-[20vh] bg-black/30 backdrop-blur-sm border-b border-white/5 z-20 flex flex-col items-center relative flex-none">
                {/* Status Overlay */}
                <div className="w-full flex justify-between items-start px-4 pt-2 absolute top-0 left-0 right-0 z-50 pointer-events-none">
                    <button onClick={onExit} className="pointer-events-auto px-4 py-1.5 bg-red-900/40 hover:bg-red-800 text-white rounded-xl text-[10px] md:text-sm font-black border border-red-500/20 shadow-xl transition-all active:scale-90">
                        🚪 <span className="ml-1">退出</span>
                    </button>
                    <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-end shadow-xl">
                        <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Global Score</span>
                        <span className="text-xs md:text-lg text-yellow-500 font-black leading-none">{gameState.players[playerIndex].score.toLocaleString()}</span>
                    </div>
                </div>

                {/* Opponents Row - Unified Scale */}
                <div className="flex w-full h-full max-w-6xl justify-around items-center px-4 pt-4">
                    {[1, 2, 3].map((pos) => {
                        const p = getPlayerAtPosition(pos);
                        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                        return (
                            <div key={pos} className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-110' : 'opacity-70 scale-90'}`}>
                                <div className="relative mb-1">
                                    <div className={`w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-3xl ${isCurrent ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'bg-black/50 border border-white/10'}`}>
                                        👤
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white flex items-center justify-center font-black text-[10px] md:text-xs">
                                        {p.hand.length}
                                    </div>
                                </div>
                                <div className="text-white font-bold text-[10px] md:text-xs text-center max-w-[70px] md:max-w-none truncate leading-none mb-0.5">{p.name}</div>
                                <div className="text-yellow-400 text-[10px] md:text-xs font-bold leading-none">💰 {p.score.toLocaleString()}</div>
                                <div className="flex -space-x-12 mt-1 transform scale-[0.3] md:scale-[0.5] origin-top">
                                    {Array(Math.min(p.hand.length, 10)).fill(0).map((_, i) => (
                                        <div key={i} className="w-8 h-12 bg-blue-800 border border-white/20 rounded-md shadow-md" />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Middle Area: Table (30vh) */}
            <div className="w-full h-[30vh] flex items-center justify-center px-4 relative z-10 flex-none">
                <div className="w-full max-w-4xl h-[85%] bg-black/10 rounded-[40px] border border-white/5 flex items-center justify-center relative shadow-inner overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                        <span className="text-5xl md:text-8xl font-black italic tracking-[1em] text-white">CENTER</span>
                    </div>
                    {gameState.tableHand ? (
                        <div className="flex space-x-1 md:space-x-4 animate-in fade-in zoom-in duration-300 transform scale-[0.75] sm:scale-100 md:scale-125">
                            {gameState.tableHand.cards.map((c, i) => (
                                <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                            ))}
                        </div>
                    ) : (
                        <div className="text-white/10 text-xs italic tracking-widest uppercase">Waiting for play...</div>
                    )}
                </div>
                {error && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce text-sm font-bold border border-white/20">
                        {error}
                    </div>
                )}
            </div>

            {/* Bottom Area: Controls & Hand (50vh) */}
            <div className="flex-1 w-full flex flex-col items-center justify-between pb-8 md:pb-12 pt-4 z-40 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <div className="w-full max-w-6xl h-full flex flex-col items-center justify-between">

                    {/* Organize Tools */}
                    <div className="w-full flex flex-wrap justify-center gap-2 px-2">
                        <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 shadow-xl">
                            <button onClick={handleGroupCards} disabled={selectedCards.length === 0} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black active:scale-95 disabled:opacity-20">組合</button>
                            <button onClick={handleSmartSort} className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-black ml-2 active:scale-95">智能</button>
                        </div>
                        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/10 items-center">
                            {Object.entries(availableCombos).map(([key, avail]) => (
                                <button key={key} onClick={() => handleAutoPlayCombo(HandType[key as keyof typeof HandType])} disabled={!avail} className={`px-4 py-2 rounded-lg font-bold text-[10px] md:text-sm ml-1 first:ml-0 whitespace-nowrap ${avail ? 'bg-white/20 text-white animate-pulse' : 'bg-black/20 text-white/5'}`}>
                                    {key === 'Pair' ? '對子' : key === 'Straight' ? '順子' : key === 'FullHouse' ? '葫蘆' : '鐵支'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Actions */}
                    <div className="flex justify-center space-x-6 md:space-x-12 px-6 w-full">
                        <button onClick={() => handlePlay()} disabled={!isMyTurn || selectedCards.length === 0} className="flex-1 max-w-[320px] py-4 md:py-8 bg-white text-black font-black rounded-[2rem] shadow-[0_8px_0_rgb(200,200,200)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-20 text-xl md:text-4xl">出 牌</button>
                        <button onClick={handlePass} disabled={!isMyTurn || gameState.tableHand === null} className="flex-1 max-w-[320px] py-4 md:py-8 bg-red-600 text-white font-black rounded-[2rem] shadow-[0_8px_0_rgb(180,0,0)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-20 text-xl md:text-4xl">PASS</button>
                    </div>

                    {/* Hand Display (Centered & Scaled) */}
                    <div className="w-full flex flex-col items-center">
                        <div className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Player Hand</div>
                        <div className="flex justify-center w-full px-10 overflow-visible">
                            <div className="flex -space-x-14 md:-space-x-10 transform scale-[0.6] sm:scale-80 md:scale-110 lg:scale-[1.3] origin-bottom transition-transform duration-300">
                                {localHand.map((card) => (
                                    <Card key={`${card.rank}-${card.suit}`} card={card} selected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)} onClick={() => toggleCardSelection(card)} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Finish Screen */}
            {gameState.isFinished && (
                <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-10 text-white backdrop-blur-xl">
                    <div className="text-4xl md:text-6xl text-yellow-500 mb-10 font-black animate-bounce text-center drop-shadow-2xl">
                        🏆 WINNER: {gameState.players.find(p => p.hand.length === 0)?.name}
                    </div>

                    <div className="space-y-4 w-full max-w-lg bg-white/5 p-8 rounded-[3rem] border border-white/10 shadow-2xl">
                        {gameState.players.map(p => (
                            <div key={p.id} className="flex justify-between items-center border-b border-white/5 last:border-0 pb-4 last:pb-0">
                                <div className="flex flex-col">
                                    <span className="font-black text-lg md:text-2xl">{p.name}</span>
                                    <span className="text-xs md:text-sm text-white/40">{p.hand.length} cards left</span>
                                </div>
                                <span className={`font-black text-2xl md:text-4xl ${p.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {p.score > 0 ? '+' : ''}{p.score.toLocaleString()} 💰
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 mt-12 w-full max-w-lg">
                        <button onClick={onNextGame} disabled={!isHost} className={`flex-1 py-5 font-black rounded-2xl text-xl md:text-3xl transition-all ${isHost ? 'bg-yellow-500 text-black shadow-lg active:scale-95' : 'bg-gray-700 text-white/20 cursor-not-allowed'}`}>
                            {isHost ? "NEXT GAME" : "WAITING..."}
                        </button>
                        <button onClick={onExit} className="flex-1 py-5 bg-white/10 text-white font-black rounded-2xl text-xl md:text-3xl border border-white/20 active:scale-95 transition-all">EXIT</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
