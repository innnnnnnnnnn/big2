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
        <div className="fixed inset-0 w-full h-[100dvh] bg-[#071c10] flex flex-col items-center overflow-hidden touch-none select-none">
            {/* Premium Immersive Background */}
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/30 via-[#0a2313] to-[#040e08]" />

            {/* Very faint glowing casino table lines */}
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-20">
                <div className="w-[150vw] h-[150vw] max-w-[1400px] border-[2px] border-emerald-500/20 rounded-[40%] animate-[spin_120s_linear_infinite]" />
                <div className="absolute w-[120vw] h-[120vw] max-w-[1000px] border-[1px] border-emerald-400/10 rounded-[45%] animate-[spin_90s_linear_infinite_reverse]" />
            </div>

            {/* Top Area: All 3 Opponents (20vh) */}
            <div className="w-full h-[20vh] bg-black/40 backdrop-blur-xl border-b border-white/10 z-20 flex flex-col items-center relative flex-none shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                {/* Status Overlay */}
                <div className="w-full flex justify-between items-start px-4 pt-2 absolute top-0 left-0 right-0 z-50 pointer-events-none">
                    <button onClick={onExit} className="pointer-events-auto px-4 py-1.5 bg-red-900/30 hover:bg-red-800/80 text-white rounded-xl text-[10px] md:text-sm font-black border border-red-400/30 shadow-[0_4px_15px_rgba(220,38,38,0.3)] backdrop-blur-sm transition-all active:scale-95">
                        <span className="drop-shadow-md">🚪 退出</span>
                    </button>
                    <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-end shadow-xl">
                        <span className="text-[8px] text-emerald-400 font-black uppercase tracking-widest drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">Global Score</span>
                        <span className="text-xs md:text-lg text-yellow-400 font-black leading-none drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">{gameState.players[playerIndex].score.toLocaleString()}</span>
                    </div>
                </div>

                {/* Opponents Row - Unified Scale */}
                <div className="flex w-full h-full max-w-6xl justify-around items-center px-4 pt-4">
                    {[1, 2, 3].map((pos) => {
                        const p = getPlayerAtPosition(pos);
                        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                        return (
                            <div key={pos} className={`flex flex-col items-center transition-all duration-300 ${isCurrent ? 'scale-110 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'opacity-60 scale-90'}`}>
                                <div className="relative mb-1">
                                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-3xl border  ${isCurrent ? 'bg-gradient-to-b from-yellow-400 to-yellow-600 border-yellow-200 shadow-[0_0_20px_rgba(234,179,8,0.5),inset_0_2px_5px_rgba(255,255,255,0.6)] text-black' : 'bg-gradient-to-b from-white/10 to-white/5 border-white/20 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)] text-white/80'}`}>
                                        👤
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-[#12381f] flex items-center justify-center font-black text-[10px] md:text-xs shadow-lg ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-blue-800 text-white/80'}`}>
                                        {p.hand.length}
                                    </div>
                                </div>
                                <div className="text-white font-bold text-[10px] md:text-xs text-center max-w-[70px] md:max-w-none truncate leading-none mb-0.5 drop-shadow-md">{p.name}</div>
                                <div className="text-emerald-400 text-[10px] md:text-xs font-bold leading-none drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]">💰 {p.score.toLocaleString()}</div>
                                <div className="flex -space-x-12 mt-1.5 transform scale-[0.35] md:scale-[0.5] origin-top">
                                    {Array(Math.min(p.hand.length, 10)).fill(0).map((_, i) => (
                                        <div key={i} className={`w-8 h-12 rounded-md shadow-[0_2px_5px_rgba(0,0,0,0.5)] border border-white/20 ${isCurrent ? 'bg-indigo-500' : 'bg-blue-900/80'}`} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Middle Area: Table (30vh) */}
            <div className="w-full h-[30vh] flex items-center justify-center px-4 relative z-10 flex-none">
                <div className="w-full max-w-4xl h-[85%] bg-white/5 backdrop-blur-[2px] rounded-[40px] border border-white/10 flex items-center justify-center relative shadow-[inset_0_0_40px_rgba(0,0,0,0.6),0_0_15px_rgba(0,0,0,0.3)] overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 mix-blend-overlay">
                        <span className="text-5xl md:text-8xl font-black italic tracking-[1em] text-white">CENTER</span>
                    </div>
                    {gameState.tableHand ? (
                        <div className="flex space-x-1 md:space-x-4 animate-in fade-in zoom-in duration-300 transform scale-[0.75] sm:scale-100 md:scale-125 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
                            {gameState.tableHand.cards.map((c, i) => (
                                <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                            ))}
                        </div>
                    ) : (
                        <div className="text-white/20 text-xs md:text-sm font-bold italic tracking-widest uppercase drop-shadow-md">Waiting for play...</div>
                    )}
                </div>
                {error && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.8)] z-50 animate-bounce text-sm font-bold border border-red-400/50`}>
                        {error}
                    </div>
                )}
            </div>

            {/* Bottom Area: Controls & Hand (50vh) */}
            <div className="flex-1 w-full flex flex-col items-center justify-end pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-[max(2.5rem,env(safe-area-inset-bottom))] z-40 bg-gradient-to-t from-black via-[#041208]/90 to-transparent overflow-visible">
                <div className="w-full max-w-6xl flex flex-col items-center justify-end">

                    {/* All Controls (Tools & Actions) */}
                    <div className="w-full flex flex-col items-center gap-2 px-2 mb-2 md:mb-4">
                        {/* Row 1: Organize Tools */}
                        <div className="w-full flex flex-wrap justify-center gap-2 px-2">
                            <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                                <button onClick={handleGroupCards} disabled={selectedCards.length === 0} className="px-5 py-2.5 bg-gradient-to-b from-indigo-500 to-indigo-700 text-white rounded-xl text-xs md:text-sm font-black active:scale-95 disabled:opacity-30 shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_2px_5px_rgba(0,0,0,0.5)] border border-indigo-400/50 transition-all">組合</button>
                                <button onClick={handleSmartSort} className="px-5 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white rounded-xl text-xs md:text-sm font-black ml-2 active:scale-95 shadow-[inset_0_2px_5px_rgba(255,255,255,0.2),0_2px_5px_rgba(0,0,0,0.5)] border border-emerald-500/50 transition-all">智能</button>
                            </div>
                            <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-x-auto scrollbar-hide max-w-[80vw]">
                                {Object.entries(availableCombos).map(([key, avail]) => (
                                    <button key={key} onClick={() => handleAutoPlayCombo(HandType[key as keyof typeof HandType])} disabled={!avail} className={`px-4 py-2.5 rounded-xl font-bold text-[10px] md:text-xs ml-1 first:ml-0 whitespace-nowrap transition-all ${avail ? 'bg-gradient-to-b from-white/30 to-white/10 border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.2),inset_0_2px_5px_rgba(255,255,255,0.3)] animate-pulse' : 'bg-transparent text-white/20'}`}>
                                        {key === 'Pair' ? '對子' : key === 'Straight' ? '順子' : key === 'FullHouse' ? '葫蘆' : '鐵支'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row 2: Action Buttons (Same size as organize tools) */}
                        <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-1">
                            <button onClick={() => handlePlay()} disabled={!isMyTurn || selectedCards.length === 0} className="px-12 md:px-16 py-2.5 bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950 font-black rounded-xl active:scale-95 disabled:opacity-30 shadow-[inset_0_2px_10px_rgba(255,255,255,0.6),0_2px_5px_rgba(0,0,0,0.5)] border border-yellow-300 transition-all text-sm md:text-base">出 牌</button>
                            <button onClick={handlePass} disabled={!isMyTurn || gameState.tableHand === null} className="px-12 md:px-16 py-2.5 bg-gradient-to-b from-red-600 to-red-800 text-white font-black rounded-xl ml-2 active:scale-95 disabled:opacity-30 shadow-[inset_0_2px_10px_rgba(255,255,255,0.3),0_2px_5px_rgba(0,0,0,0.5)] border border-red-500 transition-all text-sm md:text-base">PASS</button>
                        </div>
                    </div>

                    {/* Hand Display (Maximized Scale) */}
                    <div className="w-full flex flex-col items-center">
                        <div className="text-emerald-500/50 text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mb-2 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]">Player Hand</div>
                        <div className="flex justify-center w-full px-4 overflow-visible relative">
                            {/* Glowing aura behind hand */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-20 bg-emerald-500/10 blur-[50px] pointer-events-none rounded-full z-0" />
                            <div className="flex -space-x-[3.25rem] sm:-space-x-12 md:-space-x-[3.25rem] lg:-space-x-10 transform scale-[0.85] sm:scale-100 md:scale-110 lg:scale-[1.3] origin-bottom transition-transform duration-300 relative z-10 hover:z-50">
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
