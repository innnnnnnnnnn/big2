"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, Suspense } from "react";
import { useAppSession } from "../../hooks/useAppSession";
import { io, Socket } from "socket.io-client";
import GameBoard from "@/components/GameBoard";
import { GameState } from "@/logic/types";

let socket: Socket;

const RoomContent = () => {
    const { session } = useAppSession();
    const searchParams = useSearchParams();
    const roomId = searchParams.get("id");
    const router = useRouter();

    const [players, setPlayers] = useState<{ name: string, isHost: boolean, ready: boolean }[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerIndex, setPlayerIndex] = useState<number>(-1);
    const [isHost, setIsHost] = useState(false);
    const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master'>('Medium');

    useEffect(() => {
        if (!session) return;

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";
        socket = io(wsUrl);

        socket.emit("join_room", {
            roomId,
            name: session.user?.name,
            userId: (session.user as any).id
        });

        socket.on("room_update", (data) => {
            setPlayers(data.players);
            if (data.difficulty) setDifficulty(data.difficulty);
            const me = data.players.find((p: any) => p.name === session.user?.name);
            if (me) setIsHost(me.isHost);
        });

        socket.on("difficulty_update", (newDiff: any) => {
            setDifficulty(newDiff);
        });

        socket.on("game_start", (data: { state: GameState, playerIndex: number }) => {
            setGameState(data.state);
            setPlayerIndex(data.playerIndex);
        });

        socket.on("state_update", (state: GameState) => {
            setGameState(state);
        });

        return () => {
            socket.disconnect();
        };
    }, [session, roomId]);

    if (!session) return null;

    const startGame = () => {
        socket.emit("start_game", { roomId });
    };

    const handleDifficultyChange = (newDiff: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master') => {
        setDifficulty(newDiff);
        socket.emit("set_difficulty", { roomId, difficulty: newDiff });
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Copied room link!");
    };

    const difficulties = [
        { id: 'Easy', name: '簡單', color: 'bg-green-500' },
        { id: 'Medium', name: '中等', color: 'bg-blue-500' },
        { id: 'Hard', name: '困難', color: 'bg-orange-500' },
        { id: 'Expert', name: '專家', color: 'bg-red-500' },
        { id: 'Master', name: '大師', color: 'bg-purple-600' },
    ];

    if (gameState) {
        return (
            <GameBoard
                initialGameState={gameState}
                playerIndex={playerIndex}
                socket={socket}
                roomId={roomId as string}
                onExit={() => router.push("/lobby")}
                onNextGame={startGame}
                isHost={isHost}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#0a4d2e] flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-2xl bg-black/30 rounded-3xl p-10 border border-white/10 shadow-2xl backdrop-blur-xl">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2">房號: {roomId}</h1>
                        <p className="text-yellow-500 font-bold">等待玩家加入中... ({players.length}/4)</p>
                    </div>
                    <button
                        onClick={copyLink}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-bold border border-white/10 transition-all"
                    >
                        📋 複製邀請連結
                    </button>
                </div>

                <div className="space-y-4 mb-10">
                    {[0, 1, 2, 3].map((i) => {
                        const p = players[i];
                        return (
                            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${p ? 'bg-black/40 border-white/20' : 'bg-black/10 border-white/5 border-dashed'}`}>
                                <div className="flex items-center space-x-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${p ? 'bg-yellow-500' : 'bg-white/5'}`}>
                                        {p ? '👤' : ''}
                                    </div>
                                    <div>
                                        <div className={`font-bold ${p ? 'text-white' : 'text-white/20'}`}>
                                            {p ? p.name : '等待加入...'}
                                        </div>
                                        {p?.isHost && <span className="text-[10px] bg-yellow-600 text-white px-2 py-0.5 rounded-full uppercase font-black">房主</span>}
                                    </div>
                                </div>
                                {p && <div className="text-green-500 font-bold">已就緒</div>}
                            </div>
                        );
                    })}
                </div>

                {/* AI Difficulty Selector */}
                <div className="mb-10 bg-black/20 p-6 rounded-2xl border border-white/5">
                    <h2 className="text-white font-bold mb-4 flex items-center">
                        🤖 電腦難度設定
                        {!isHost && <span className="ml-2 text-xs text-white/40 font-normal">(由房主設定)</span>}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {difficulties.map((diff) => (
                            <button
                                key={diff.id}
                                disabled={!isHost}
                                onClick={() => handleDifficultyChange(diff.id as any)}
                                className={`flex-1 min-w-[80px] py-3 rounded-xl font-black text-sm transition-all border-2 ${difficulty === diff.id
                                    ? `${diff.color} border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]`
                                    : 'bg-black/40 border-transparent text-white/40 hover:bg-black/60'
                                    } ${!isHost && 'cursor-default opacity-80'}`}
                            >
                                {diff.name}
                            </button>
                        ))}
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={startGame}
                        className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl text-xl shadow-[0_6px_0_rgb(180,100,0)] transition-all active:translate-y-1"
                    >
                        開始遊戲 (START GAME)
                    </button>
                ) : (
                    <div className="text-white/40 text-center font-bold">只有房主可以開始遊戲</div>
                )}

                <p className="mt-6 text-center text-white/20 text-sm">
                    真人人數不足四人時，系統將會自動由電腦補滿。
                </p>
            </div>
        </div>
    );
};

const RoomPage = () => {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black/50" />}>
            <RoomContent />
        </Suspense>
    );
};

export default RoomPage;
