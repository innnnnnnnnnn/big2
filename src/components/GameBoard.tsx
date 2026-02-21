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

    return (
        <div className="relative w-full min-h-screen bg-[#1a472a] flex flex-col items-center overflow-x-hidden">
            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-30">
                <div className="w-[800px] h-[500px] border-[12px] border-[#2e5d3e] rounded-full" />
            </div>

            {/* EXIT Button (Top Left) */}
            <button
                onClick={onExit}
                className="absolute top-4 left-4 z-[60] px-3 py-1.5 md:px-4 md:py-2 bg-red-600/50 hover:bg-red-600 text-white rounded-lg text-xs md:text-sm font-bold backdrop-blur-md transition-all border border-white/10"
            >
                🚪 退出
            </button>

            {/* Score Display (Top Right) */}
            <div className="absolute top-4 right-4 z-[60] bg-black/60 backdrop-blur-md px-3 py-1.5 md:px-6 md:py-2 rounded-xl border border-white/10 shadow-xl flex flex-col items-end">
                <span className="text-white/60 text-[8px] md:text-[10px] font-black tracking-widest uppercase">Score</span>
                <span className="text-lg md:text-2xl text-yellow-500 font-black tabular-nums leading-none">
                    {gameState.players[playerIndex].score.toLocaleString()}
                </span>
            </div>

            {/* Top Area: Opponent 2 (Opposite) */}
            <div className="w-full pt-16 flex flex-col items-center z-20">
                {(() => {
                    const p = getPlayerAtPosition(2);
                    const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                    return (
                        <div className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-110' : 'opacity-80'}`}>
                            <div className="relative mb-2">
                                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-2xl ${isCurrent ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)]' : 'bg-black/50'}`}>
                                    👤
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white flex items-center justify-center font-black text-xs md:text-sm">
                                    {p.hand.length}
                                </div>
                            </div>
                            <div className="text-white font-bold text-sm md:text-base">{p.name}</div>
                            <div className="text-yellow-400 text-xs font-bold">💰 {p.score.toLocaleString()}</div>
                        </div>
                    );
                })()}
            </div>

            {/* Middle Area: Table and Side Opponents */}
            <div className="flex-1 w-full max-w-6xl relative flex items-center justify-center py-8 md:py-12">

                {/* Left Opponent (Absolute) */}
                <div className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col items-center">
                    {(() => {
                        const p = getPlayerAtPosition(1);
                        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                        return (
                            <div className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-110' : 'opacity-70'}`}>
                                <div className="relative mb-2">
                                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl ${isCurrent ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'bg-black/50'}`}>
                                        👤
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-6 h-6 md:w-7 md:h-7 rounded-full border-2 border-white flex items-center justify-center font-black text-[10px] md:text-xs">
                                        {p.hand.length}
                                    </div>
                                </div>
                                <div className="text-white font-bold text-xs md:text-sm max-w-[80px] truncate">{p.name}</div>
                            </div>
                        );
                    })()}
                </div>

                {/* Table Center (THEME) */}
                <div className="relative z-10 bg-black/30 p-6 md:p-10 rounded-[40px] border border-white/10 flex flex-col items-center min-w-[300px] md:min-w-[480px] min-h-[160px] md:min-h-[240px] backdrop-blur-md shadow-2xl">
                    <div className="text-white/20 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-4 border-b border-white/5 w-full text-center pb-2">Table Center</div>
                    {gameState.tableHand ? (
                        <div className="flex space-x-1 md:space-x-3 animate-in fade-in zoom-in duration-300 transform scale-75 md:scale-100">
                            {gameState.tableHand.cards.map((c, i) => (
                                <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-white/30">
                            <div className="text-sm md:text-xl italic mb-3">等待玩家出牌...</div>
                            <div className="w-16 h-1 bg-white/10 rounded-full" />
                        </div>
                    )}

                    {/* Side Opponents Display on Mobile (Numeric only) */}
                    <div className="absolute -left-16 sm:hidden flex flex-col space-y-4">
                        {(() => {
                            const p = getPlayerAtPosition(1);
                            const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                            return (
                                <div className={`flex items-center space-x-2 bg-black/40 p-1.5 rounded-full border ${isCurrent ? 'border-yellow-500' : 'border-white/10'}`}>
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">{p.hand.length}</div>
                                    <span className="text-white text-[10px] pr-2 font-bold max-w-[40px] truncate">{p.name}</span>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="absolute -right-16 sm:hidden flex flex-col space-y-4">
                        {(() => {
                            const p = getPlayerAtPosition(3);
                            const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                            return (
                                <div className={`flex items-center space-x-2 bg-black/40 p-1.5 rounded-full border ${isCurrent ? 'border-yellow-500' : 'border-white/10'} flex-row-reverse`}>
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">{p.hand.length}</div>
                                    <span className="text-white text-[10px] pl-2 font-bold max-w-[40px] truncate text-right">{p.name}</span>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Right Opponent (Absolute) */}
                <div className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col items-center">
                    {(() => {
                        const p = getPlayerAtPosition(3);
                        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                        return (
                            <div className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-110' : 'opacity-70'}`}>
                                <div className="relative mb-2">
                                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl ${isCurrent ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'bg-black/50'}`}>
                                        👤
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-6 h-6 md:w-7 md:h-7 rounded-full border-2 border-white flex items-center justify-center font-black text-[10px] md:text-xs">
                                        {p.hand.length}
                                    </div>
                                </div>
                                <div className="text-white font-bold text-xs md:text-sm max-w-[80px] truncate">{p.name}</div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="absolute top-[45%] bg-red-600/90 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce border border-white/20">
                    ⚠️ {error}
                </div>
            )}

            {/* Bottom Controls Area */}
            <div className="w-full bg-black/20 backdrop-blur-lg border-t border-white/5 py-6 md:py-10 px-4 z-40">
                <div className="max-w-4xl mx-auto flex flex-col items-center">

                    {/* 1. Integrated Info & Organize Bar (Above Hand) */}
                    <div className="w-full max-w-4xl px-2 md:px-4 flex flex-col items-center space-y-2 md:space-y-4 mb-4 md:mb-8">
                        {/* Button Rows */}
                        <div className="flex flex-wrap justify-center gap-2 md:gap-4">
                            {/* Group A: Organize Buttons */}
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner">
                                <button
                                    onClick={handleGroupCards}
                                    disabled={selectedCards.length === 0}
                                    className="px-3 md:px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 text-white rounded-lg text-xs md:text-sm font-black transition-all active:scale-95"
                                >
                                    🧩 組合
                                </button>
                                <button
                                    onClick={handleSmartSort}
                                    className="px-3 md:px-6 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs md:text-sm font-black transition-all ml-2"
                                >
                                    🪄 智能
                                </button>
                            </div>

                            {/* Group B: Quick Hand Helpers (Always Visible) */}
                            <div className="flex bg-white/5 backdrop-blur-sm p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full scrollbar-hide">
                                {[
                                    { type: HandType.Pair, label: '👥 對子', key: 'Pair', color: 'bg-orange-600' },
                                    { type: HandType.Straight, label: '📏 順子', key: 'Straight', color: 'bg-green-600' },
                                    { type: HandType.FullHouse, label: '🏠 葫蘆', key: 'FullHouse', color: 'bg-blue-600' },
                                    { type: HandType.FourOfAKind, label: '💣 鐵支', key: 'FourOfAKind', color: 'bg-red-600' }
                                ].map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => handleAutoPlayCombo(item.type)}
                                        disabled={!(availableCombos as any)[item.key]}
                                        className={`px-3 md:px-5 py-2 rounded-lg font-bold text-[10px] md:text-xs transition-all ml-1.5 first:ml-0 whitespace-nowrap ${(availableCombos as any)[item.key]
                                            ? `${item.color} text-white shadow-lg animate-pulse`
                                            : 'bg-black/40 text-white/20'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. Action Controls (Play/Pass) */}
                    <div className="flex space-x-4 mb-4">
                        <button
                            onClick={() => handlePlay()}
                            disabled={!isMyTurn || selectedCards.length === 0}
                            className="px-8 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-800 disabled:text-white/20 text-black font-black rounded-lg shadow-[0_4px_0_rgb(200,200,200)] disabled:shadow-none transition-all active:translate-y-1 text-base"
                        >
                            出牌
                        </button>
                        <button
                            onClick={handlePass}
                            disabled={!isMyTurn || gameState.tableHand === null}
                            className="px-8 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-white/20 text-white font-black rounded-lg shadow-[0_4px_0_rgb(150,0,0)] disabled:shadow-none transition-all active:translate-y-1 text-base"
                        >
                            PASS
                        </button>
                    </div>

                    {/* 3. Player Hand */}

                    {/* Hand Display */}
                    <div className="flex -space-x-8 md:-space-x-4 hover:-space-x-2 transition-all pb-8 overflow-x-auto max-w-full px-6 md:px-10 scrollbar-hide transform scale-90 md:scale-100">
                        {localHand.map((card, i) => {
                            // Logic to add extra spacing for groups
                            const isBoundary = i > 0 &&
                                // In Smart Sort mode, we might want to visual distance between pairs/5-card hands
                                // For simplicity, just add some margin if the current and previous card ranks are different
                                // ONLY during "Smart Sort" feel
                                false; // We'll skip complex spacing for now to avoid layout issues

                            return (
                                <div key={`${card.rank}-${card.suit}`} className="flex">
                                    <Card
                                        card={card}
                                        selected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)}
                                        onClick={() => toggleCardSelection(card)}
                                        disabled={false}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Finish Screen */}
            {gameState.isFinished && (
                <div className="absolute inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-10 text-white">
                    <div className="text-3xl text-yellow-500 mb-8 font-black animate-bounce">
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
