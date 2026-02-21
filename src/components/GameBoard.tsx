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

    // Helper to render an opponent component
    const renderOpponent = (pos: number, className: string = "") => {
        const p = getPlayerAtPosition(pos);
        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
        return (
            <div className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-105 md:scale-110' : 'opacity-70 scale-90'} ${className}`}>
                <div className="relative mb-0.5">
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-sm md:text-xl ${isCurrent ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-black/50 border border-white/10'}`}>
                        👤
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-6 h-6 md:w-7 md:h-7 rounded-full border border-white flex items-center justify-center font-black text-[10px]">
                        {p.hand.length}
                    </div>
                </div>
                <div className="text-white font-bold text-[8px] md:text-[10px] text-center max-w-[80px] truncate leading-tight">{p.name}</div>
                <div className="text-yellow-400 text-[8px] md:text-[9px] font-bold">💰 {p.score.toLocaleString()}</div>
                <div className={`flex -space-x-12 mt-1 transform scale-[0.3] md:scale-[0.5] origin-top`}>
                    {Array(Math.min(p.hand.length, 10)).fill(0).map((_, i) => (
                        <div key={i} className="w-8 h-12 bg-blue-800 border border-white/20 rounded-md shadow-sm" />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 w-full h-screen bg-[#1a472a] overflow-hidden touch-none select-none">
            {/* Immersive Background */}
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                <div className="w-[150vw] h-[150vw] max-w-[1200px] border-[16px] border-white/5 rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
            </div>

            {/* Common UI: Exit & Score */}
            <button onClick={onExit} className="absolute left-4 top-4 z-[60] px-4 py-1.5 bg-red-900/40 hover:bg-red-800 text-white rounded-xl text-[10px] md:text-xs font-black border border-red-500/20 flex items-center shadow-2xl active:scale-90 transition-all">
                🚪 <span className="ml-1">退出</span>
            </button>
            <div className="absolute right-4 top-4 z-[60] bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-end shadow-xl">
                <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Global Score</span>
                <span className="text-sm md:text-xl text-yellow-500 font-black leading-none">{gameState.players[playerIndex].score.toLocaleString()}</span>
            </div>

            {isLandscape ? (
                /* LANDSCAPE LAYOUT: Immersive Table Style */
                <div className="w-full h-full relative flex flex-col">
                    {/* Opponents (Top Middle) */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                        {renderOpponent(2)}
                    </div>
                    {/* Opponents (Left) */}
                    <div className="absolute left-6 top-1/2 -translate-y-2/3 z-20">
                        {renderOpponent(1)}
                    </div>
                    {/* Opponents (Right) */}
                    <div className="absolute right-6 top-1/2 -translate-y-2/3 z-20">
                        {renderOpponent(3)}
                    </div>

                    {/* Central Table */}
                    <div className="flex-1 flex items-center justify-center z-10">
                        <div className="w-full max-w-2xl aspect-[3/2] bg-black/10 rounded-[60px] border border-white/5 flex flex-col items-center justify-center relative shadow-inner mx-20">
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                                <span className="text-6xl font-black italic tracking-[1em] text-white">SHENMAO</span>
                            </div>
                            {gameState.tableHand ? (
                                <div className="flex space-x-2 animate-in fade-in zoom-in duration-300 transform scale-100 md:scale-125 lg:scale-150">
                                    {gameState.tableHand.cards.map((c, i) => (
                                        <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/10 text-sm italic">Place your cards on the table</div>
                            )}
                        </div>
                    </div>

                    {/* Right Side Thumb Zone (Controls) */}
                    <div className="absolute right-6 bottom-40 z-50 flex flex-col space-y-4">
                        <button onClick={() => handlePlay()} disabled={!isMyTurn || selectedCards.length === 0} className="w-24 h-24 bg-white text-black font-black rounded-full shadow-2xl active:scale-95 disabled:opacity-20 text-xl border-4 border-black/10 transition-all flex items-center justify-center">出牌</button>
                        <button onClick={handlePass} disabled={!isMyTurn || gameState.tableHand === null} className="w-20 h-20 bg-red-600 text-white font-black rounded-full shadow-2xl active:scale-95 disabled:opacity-20 text-sm border-4 border-black/10 transition-all flex items-center justify-center">PASS</button>
                    </div>

                    {/* Bottom Area: Hand & Tools */}
                    <div className="w-full h-1/3 flex flex-col items-center justify-end pb-4 bg-gradient-to-t from-black/60 to-transparent">
                        <div className="flex gap-2 mb-4 bg-black/40 p-1 rounded-2xl border border-white/10 shadow-xl overflow-x-auto max-w-[80%]">
                            <button onClick={handleGroupCards} disabled={selectedCards.length === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black disabled:opacity-20">組合</button>
                            <button onClick={handleSmartSort} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-black">智能</button>
                            <div className="w-px bg-white/10 mx-1" />
                            {Object.entries(availableCombos).map(([key, avail]) => (
                                <button key={key} onClick={() => handleAutoPlayCombo(HandType[key as keyof typeof HandType])} disabled={!avail} className={`px-4 py-2 rounded-lg font-bold text-xs ${avail ? 'bg-white/20 text-white' : 'bg-black/20 text-white/10'}`}>
                                    {key === 'Pair' ? '對子' : key === 'Straight' ? '順子' : key === 'FullHouse' ? '葫蘆' : '鐵支'}
                                </button>
                            ))}
                        </div>
                        <div className="flex -space-x-10 transform scale-110 lg:scale-125 origin-bottom">
                            {localHand.map((card) => (
                                <Card key={`${card.rank}-${card.suit}`} card={card} selected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)} onClick={() => toggleCardSelection(card)} />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                /* PORTRAIT LAYOUT: Stacked Style (Optimized 20/30/50 logic) */
                <div className="w-full h-full flex flex-col">
                    {/* Opponents Top Row (20vh) */}
                    <div className="w-full h-[20vh] flex items-center justify-around px-2 pt-10">
                        {renderOpponent(1)}
                        {renderOpponent(2, "scale-110")}
                        {renderOpponent(3)}
                    </div>

                    {/* Table Center (30vh) */}
                    <div className="w-full h-[30vh] flex items-center justify-center px-4 relative">
                        <div className="w-full max-w-sm aspect-video bg-black/10 rounded-3xl border border-white/5 shadow-inner flex items-center justify-center">
                            {gameState.tableHand ? (
                                <div className="flex space-x-1 transform scale-75 md:scale-90">
                                    {gameState.tableHand.cards.map((c, i) => (
                                        <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/5 text-[10px] italic">Waiting for turn...</div>
                            )}
                        </div>
                        {error && (
                            <div className="absolute bottom-0 bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold animate-bounce z-50">{error}</div>
                        )}
                    </div>

                    {/* Player Area (50vh) */}
                    <div className="flex-1 flex flex-col items-center justify-between pb-6 pt-2 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="w-full flex flex-col items-center space-y-4">
                            <div className="flex gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 overflow-x-auto max-w-[90%]">
                                <button onClick={handleGroupCards} disabled={selectedCards.length === 0} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black disabled:opacity-20">組合</button>
                                <button onClick={handleSmartSort} className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-[10px] font-black">智能</button>
                                {Object.entries(availableCombos).map(([key, avail]) => (
                                    <button key={key} onClick={() => handleAutoPlayCombo(HandType[key as keyof typeof HandType])} disabled={!avail} className={`px-2 py-1.5 rounded-lg font-bold text-[9px] ${avail ? 'bg-white/10 text-white' : 'bg-black/20 text-white/5'}`}>
                                        {key === 'Pair' ? '對子' : key === 'Straight' ? '順子' : key === 'FullHouse' ? '葫蘆' : '鐵支'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex space-x-6">
                                <button onClick={() => handlePlay()} disabled={!isMyTurn || selectedCards.length === 0} className="px-14 py-3 bg-white text-black font-black rounded-2xl shadow-xl active:scale-95 disabled:opacity-20 text-lg">出牌</button>
                                <button onClick={handlePass} disabled={!isMyTurn || gameState.tableHand === null} className="px-8 py-3 bg-red-600 text-white font-black rounded-2xl shadow-xl active:scale-95 disabled:opacity-20 text-sm">PASS</button>
                            </div>
                        </div>
                        <div className="flex -space-x-12 transform scale-90 sm:scale-100 origin-bottom">
                            {localHand.map((card) => (
                                <Card key={`${card.rank}-${card.suit}`} card={card} selected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)} onClick={() => toggleCardSelection(card)} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Finish Screen */}
            {gameState.isFinished && (
                <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-10 text-white">
                    <div className="text-3xl text-yellow-500 mb-8 font-black animate-bounce text-center">
                        🏆 恭喜 {gameState.players.find(p => p.hand.length === 0)?.name} 獲勝！
                    </div>

                    <div className="space-y-4 text-2xl w-full max-w-md bg-black/40 p-6 rounded-3xl border border-white/10">
                        {gameState.players.map(p => (
                            <div key={p.id} className="flex justify-between items-center border-b border-white/10 last:border-0 pb-4 last:pb-0">
                                <div className="flex flex-col">
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-sm text-white/40">{p.hand.length} 張剩餘</span>
                                </div>
                                <span className={`font-black text-3xl ${p.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {p.score > 0 ? '+' : ''}{p.score.toLocaleString()} 💰
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 mt-12 w-full max-w-md">
                        <button
                            onClick={onNextGame}
                            disabled={!isHost}
                            className={`flex-1 py-4 font-black rounded-xl text-2xl shadow-[0_6px_0_rgb(180,100,0)] active:translate-y-1 transition-all ${isHost ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-gray-600 text-white/50 cursor-not-allowed shadow-[0_6px_0_rgb(50,50,50)]'}`}
                        >
                            {isHost ? "確認 (下一局)" : "等待房主..."}
                        </button>
                        <button
                            onClick={onExit}
                            className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl text-2xl border border-white/20 transition-all active:translate-y-1"
                        >
                            退出 (LOBBY)
                        </button>
                    </div>

                    {!isHost && <p className="mt-4 text-white/40 italic">請等待房主點擊下一局</p>}
                </div>
            )}
        </div>
    );
};

export default GameBoard;
