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
        <div className="relative w-full h-screen bg-[#1a472a] overflow-hidden flex flex-col items-center justify-center p-4">
            {/* Table Background Decoration */}
            <div className="absolute w-[800px] h-[500px] border-8 border-[#2e5d3e] rounded-full opacity-50 pointer-events-none" />

            {/* EXIT Button (Top Left) */}
            <button
                onClick={onExit}
                className="absolute top-4 left-4 z-20 px-4 py-2 bg-red-600/50 hover:bg-red-600 text-white rounded-lg font-bold backdrop-blur-md transition-all border border-white/10"
            >
                🚪 退出房間
            </button>

            {/* Opponents */}
            {[2, 1, 3].map((pos, i) => {
                const p = getPlayerAtPosition(pos);
                const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                const layoutClasses = [
                    "absolute top-8 flex-col items-center", // Top
                    "absolute left-8 top-1/2 -translate-y-1/2 flex-col items-center rotate-90 origin-center", // Left
                    "absolute right-8 top-1/2 -translate-y-1/2 flex-col items-center -rotate-90 origin-center" // Right
                ][i];

                return (
                    <div key={pos} className={`${layoutClasses} flex text-white transition-all ${isCurrent ? 'scale-110' : 'opacity-80'}`}>
                        <div className="flex flex-col items-center mb-2">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-1 ${isCurrent ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'bg-black/40'}`}>
                                👤
                            </div>
                            <div className="font-bold flex flex-col items-center">
                                <span>{p.name}</span>
                                <span className="text-yellow-400 text-sm">💰 {p.score || 0}</span>
                            </div>
                        </div>
                        <div className="flex -space-x-8">
                            {Array(p.hand.length).fill(0).map((_, cardIdx) => (
                                <div key={cardIdx} className="w-10 h-14 bg-blue-800 border border-white/20 rounded-md shadow-sm" />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Table Center (Moved Up) */}
            <div className="absolute top-[28%] z-10 bg-black/20 p-8 rounded-2xl border border-white/10 flex flex-col items-center min-w-[350px] min-h-[220px] backdrop-blur-sm">
                <div className="text-white/20 text-xs font-bold uppercase tracking-wider mb-4 border-b border-white/5 w-full text-center pb-2">Table</div>
                {gameState.tableHand ? (
                    <div className="flex space-x-2 animate-in fade-in zoom-in duration-300">
                        {gameState.tableHand.cards.map((c, i) => (
                            <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="text-white/30 italic text-lg mb-2">等待出牌...</div>
                        <div className="w-12 h-1 bg-white/5 rounded-full" />
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="absolute top-[45%] bg-red-600/90 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce border border-white/20">
                    ⚠️ {error}
                </div>
            )}

            {/* Bottom Player Area (Consolidated Controls & Hand) */}
            <div className="absolute bottom-4 flex flex-col items-center max-w-full w-full">

                {/* 1. Integrated Info & Organize Bar (Above Hand) */}
                <div className="w-full max-w-4xl px-4 flex flex-col items-center space-y-3 mb-6">
                    {/* Score Display (Centered) */}
                    <div className="bg-black/60 backdrop-blur-md px-8 py-2 rounded-2xl border border-white/10 shadow-xl flex items-center space-x-4">
                        <span className="text-white/60 text-xs font-bold tracking-widest">PERSONAL SCORE</span>
                        <span className="text-3xl text-yellow-500 font-extrabold tabular-nums">
                            {gameState.players[playerIndex].score.toLocaleString()}
                        </span>
                    </div>

                    {/* Button Rows */}
                    <div className="flex flex-wrap justify-center gap-3">
                        {/* Group A: Organize Buttons */}
                        <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
                            <button
                                onClick={handleGroupCards}
                                disabled={selectedCards.length === 0}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 text-white rounded-lg text-sm font-black transition-all active:scale-95"
                            >
                                🧩 組合
                            </button>
                            <button
                                onClick={handleSmartSort}
                                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-black transition-all ml-2"
                            >
                                🪄 智能
                            </button>
                            <button
                                onClick={handleNormalSort}
                                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-black transition-all ml-2"
                            >
                                🔢 排序
                            </button>
                        </div>

                        {/* Group B: Quick Hand Helpers (Always Visible) */}
                        <div className="flex bg-white/5 backdrop-blur-sm p-1.5 rounded-xl border border-white/10">
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
                                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ml-1.5 first:ml-0 ${(availableCombos as any)[item.key]
                                        ? `${item.color} text-white shadow-lg shadow-black/50 animate-pulse`
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
                <div className="flex -space-x-6 hover:-space-x-4 transition-all pb-8 overflow-x-auto max-w-full px-10 scrollbar-hide">
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

            {/* Finish Screen */}
            {gameState.isFinished && (
                <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-10 text-white">
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
