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
        <div className="fixed inset-0 w-full h-screen bg-[#1a472a] flex flex-col items-center overflow-hidden touch-none select-none">
            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-10">
                <div className="w-[120vw] h-[120vw] max-w-[1000px] border-[12px] border-[#2e5d3e] rounded-full" />
            </div>

            {/* Top Area: All Opponents (20%) */}
            <div className="w-full bg-black/20 backdrop-blur-md border-b border-white/5 z-20 flex-none h-[20vh] flex items-center justify-around px-2 relative">
                {/* EXIT Button (Top Left) */}
                <button onClick={onExit} className="absolute left-2 top-2 z-[60] px-3 py-1 bg-red-900/40 hover:bg-red-800 text-white rounded-lg text-[10px] font-black border border-red-500/30 flex items-center shadow-lg active:scale-90">
                    🚪 <span className="ml-1">退出</span>
                </button>

                {/* Score Display (Top Right) */}
                <div className="absolute right-2 top-2 z-[60] bg-black/60 px-2 py-1 rounded-lg border border-white/10 flex flex-col items-end">
                    <span className="text-[8px] text-white/50 font-black uppercase tracking-widest">Score</span>
                    <span className="text-xs md:text-sm text-yellow-500 font-black tabular-nums leading-none">
                        {gameState.players[playerIndex].score.toLocaleString()}
                    </span>
                </div>

                {/* Opponents Row */}
                <div className="flex w-full max-w-5xl justify-around items-center pt-2">
                    {[1, 2, 3].map((pos) => {
                        const p = getPlayerAtPosition(pos);
                        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                        return (
                            <div key={pos} className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-105 md:scale-110' : 'opacity-70 scale-90'}`}>
                                <div className="relative mb-0.5">
                                    <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-xl ${isCurrent ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-black/50 border border-white/10'}`}>
                                        👤
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-5 h-5 md:w-6 md:h-6 rounded-full border border-white flex items-center justify-center font-black text-[10px]">
                                        {p.hand.length}
                                    </div>
                                </div>
                                <div className="text-white font-bold text-[8px] md:text-[10px] text-center max-w-[60px] md:max-w-[100px] truncate leading-tight">{p.name}</div>
                                <div className="text-yellow-400 text-[8px] md:text-[9px] font-bold">💰 {p.score.toLocaleString()}</div>
                                <div className="flex -space-x-12 mt-0.5 transform scale-[0.25] md:scale-[0.4] origin-top">
                                    {Array(Math.min(p.hand.length, 10)).fill(0).map((_, i) => (
                                        <div key={i} className="w-8 h-12 bg-blue-800 border border-white/20 rounded-md shadow-sm" />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Middle Area: Table Center (30%) */}
            <div className="flex-none w-full h-[30vh] relative flex items-center justify-center px-4 z-10 overflow-hidden">
                <div className="w-full max-w-4xl h-[90%] bg-black/10 rounded-[30px] border border-white/5 flex items-center justify-center relative shadow-inner">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                        <span className="text-4xl font-black italic tracking-[1em] text-white">SHENMAO</span>
                    </div>
                    {gameState.tableHand ? (
                        <div className="flex space-x-1 md:space-x-4 animate-in fade-in zoom-in duration-300 transform scale-[0.7] sm:scale-100 md:scale-110">
                            {gameState.tableHand.cards.map((c, i) => (
                                <Card key={`${c.rank}-${c.suit}-${i}`} card={c} disabled />
                            ))}
                        </div>
                    ) : (
                        <div className="text-white/10 text-xs italic">Waiting for turn...</div>
                    )}
                </div>

                {/* Error Message integrated here to not break layout */}
                {error && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-2 rounded-xl shadow-2xl z-50 animate-bounce text-xs font-bold border border-white/20">
                        {error}
                    </div>
                )}
            </div>

            {/* Bottom Controls Area (50%) */}
            <div className="flex-1 w-full flex flex-col items-center justify-between py-2 px-2 z-40 bg-gradient-to-t from-black/80 to-transparent">
                <div className="w-full max-w-5xl h-full flex flex-col items-center">

                    {/* Step 1: Organize Tools */}
                    <div className="w-full flex flex-wrap justify-center gap-1.5 mb-2">
                        <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 shadow-lg">
                            <button onClick={handleGroupCards} disabled={selectedCards.length === 0} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] md:text-sm font-black active:scale-95 disabled:opacity-20">🧩 組合</button>
                            <button onClick={handleSmartSort} className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-[10px] md:text-sm font-black ml-1.5 active:scale-95">🪄 智能</button>
                        </div>
                        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/10 overflow-x-auto scrollbar-hide max-w-[65vw]">
                            {[
                                { type: HandType.Pair, label: '對子', key: 'Pair', color: 'bg-orange-600' },
                                { type: HandType.Straight, label: '順子', key: 'Straight', color: 'bg-green-600' },
                                { type: HandType.FullHouse, label: '葫蘆', key: 'FullHouse', color: 'bg-blue-600' },
                                { type: HandType.FourOfAKind, label: '鐵支', key: 'FourOfAKind', color: 'bg-red-600' }
                            ].map((item) => (
                                <button key={item.key} onClick={() => handleAutoPlayCombo(item.type)} disabled={!(availableCombos as any)[item.key]} className={`px-3 py-1.5 rounded-lg font-bold text-[9px] md:text-xs ml-1 first:ml-0 whitespace-nowrap ${(availableCombos as any)[item.key] ? `${item.color} text-white animate-pulse shadow-md` : 'bg-black/40 text-white/5'}`}>{item.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Main Actions (Big) */}
                    <div className="flex justify-center space-x-4 md:space-x-16 my-2">
                        <button onClick={() => handlePlay()} disabled={!isMyTurn || selectedCards.length === 0} className="px-12 md:px-24 py-3 md:py-5 bg-white text-black font-black rounded-2xl shadow-[0_6px_0_rgb(180,180,180)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-20 text-sm md:text-2xl">出 牌</button>
                        <button onClick={handlePass} disabled={!isMyTurn || gameState.tableHand === null} className="px-12 md:px-24 py-3 md:py-5 bg-red-600 text-white font-black rounded-2xl shadow-[0_6px_0_rgb(150,0,0)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-20 text-sm md:text-2xl">PASS</button>
                    </div>

                    {/* Step 3: Player's Hand (Maximised) */}
                    <div className="flex-1 w-full flex items-end justify-center pb-4 md:pb-8">
                        <div className="flex -space-x-12 md:-space-x-8 transform scale-[0.85] sm:scale-100 lg:scale-125 origin-bottom">
                            {localHand.map((card) => (
                                <Card key={`${card.rank}-${card.suit}`} card={card} selected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)} onClick={() => toggleCardSelection(card)} />
                            ))}
                        </div>
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
