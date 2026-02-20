import { createServer } from "http";
import { Server } from "socket.io";
import { initializeGame, playTurn } from "../logic/game";
import { GameState, Card, HandType } from "../logic/types";
import { findValidPairs, findValidFiveCardHands } from "../logic/bigTwo";

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for local dev
        methods: ["GET", "POST"]
    }
});

interface Room {
    id: string;
    players: { id: string, name: string, socketId: string, isHost: boolean, isAI?: boolean }[];
    state: GameState | null;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
}

const rooms: Record<string, Room> = {};
const playerRoomMap: Record<string, string> = {}; // socketId -> roomId

const DIFFICULTY_MAP = {
    'Easy': '簡單',
    'Medium': '中等',
    'Hard': '困難',
    'Expert': '專家',
    'Master': '大師'
};

io.on("connection", (socket) => {
    socket.on("join_room", (data: { roomId: string, name: string, userId: string }) => {
        const { roomId, name } = data;

        if (!rooms[roomId]) {
            rooms[roomId] = { id: roomId, players: [], state: null, difficulty: 'Medium' };
        }

        const room = rooms[roomId];
        if (room.players.length >= 4) {
            socket.emit("error", "房間已滿");
            return;
        }

        const isHost = room.players.length === 0;
        room.players.push({ id: data.userId, name, socketId: socket.id, isHost });
        playerRoomMap[socket.id] = roomId;
        socket.join(roomId);

        console.log(`Player ${name} joined room ${roomId} (Host: ${isHost})`);

        io.to(roomId).emit("room_update", {
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, ready: true })),
            count: room.players.length,
            difficulty: room.difficulty
        });
    });

    socket.on("set_difficulty", (data: { roomId: string, difficulty: any }) => {
        const room = rooms[data.roomId];
        if (!room) return;
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        room.difficulty = data.difficulty;
        io.to(data.roomId).emit("difficulty_update", room.difficulty);
        console.log(`[Room] ${data.roomId} difficulty set to ${room.difficulty}`);
    });

    socket.on("start_game", (data: { roomId: string }) => {
        const room = rooms[data.roomId];
        if (!room) return;
        if (room.state && !room.state.isFinished) return;

        // Verify host
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        // BACKFILL AI if < 4 players
        const currentCount = room.players.length;
        if (currentCount < 4) {
            for (let i = currentCount; i < 4; i++) {
                room.players.push({
                    id: `ai_${i}`,
                    name: `神貓 AI (${DIFFICULTY_MAP[room.difficulty]})`,
                    socketId: "",
                    isHost: false,
                    isAI: true
                });
            }
        }

        // Broadcast room update so everyone sees AI players join
        io.to(data.roomId).emit("room_update", {
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, ready: true, isAI: p.isAI })),
            count: room.players.length,
            difficulty: room.difficulty
        });

        const playerInfos = room.players.map((p, i) => ({
            name: p.name,
            isHuman: !p.isAI,
            score: room.state ? room.state.players[i].score : 0
        }));
        room.state = initializeGame(playerInfos);

        console.log(`[Game] Room ${data.roomId} started. Starter: ${room.state.players[room.state.currentPlayerIndex].name}`);

        // Send individual hands to human players
        room.players.forEach((p, index) => {
            if (p.socketId) {
                io.to(p.socketId).emit("game_start", {
                    state: room.state,
                    playerIndex: index
                });
            }
        });

        // Trigger AI with a delay if it's the starter
        if (room.state && !room.state.players[room.state.currentPlayerIndex].isHuman) {
            const delay = room.difficulty === 'Easy' ? 2500 : room.difficulty === 'Hard' ? 800 : room.difficulty === 'Medium' ? 1500 : 400;
            setTimeout(() => triggerAI(data.roomId), delay);
        }
    });

    socket.on("play_hand", (data: { cards: Card[] | null, roomId: string }) => {
        const room = rooms[data.roomId];
        if (!room || !room.state) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1 || playerIndex !== room.state.currentPlayerIndex) return;

        const result = playTurn(room.state, playerIndex, data.cards);
        if (typeof result !== "string") {
            room.state = result;
            io.to(data.roomId).emit("state_update", result);

            // Check if next player is AI
            if (!result.isFinished && !result.players[result.currentPlayerIndex].isHuman) {
                const delay = room.difficulty === 'Easy' ? 2000 : room.difficulty === 'Hard' ? 600 : room.difficulty === 'Medium' ? 1000 : 300;
                setTimeout(() => triggerAI(data.roomId), delay);
            }
        } else {
            socket.emit("error", result);
        }
    });

    const triggerAI = (roomId: string) => {
        const room = rooms[roomId];
        if (!room || !room.state || room.state.isFinished) return;

        const aiIndex = room.state.currentPlayerIndex;
        const aiPlayer = room.state.players[aiIndex];

        if (aiPlayer.isHuman) return;

        console.log(`[AI] ${aiPlayer.name} is thinking...`);

        const hand = aiPlayer.hand;
        let cardsToPlay: Card[] | null = null;

        if (room.state.tableHand === null) {
            if (room.state.history.length === 0) {
                // 第一手牌：必須包含梅花三
                const threeOfClubs = hand.find(c => c.rank === 3 && c.suit === 0);
                if (threeOfClubs) {
                    // 優先找包含梅花三的 5 張組合
                    const straights = findValidFiveCardHands(hand, null, HandType.Straight);
                    const fullHouses = findValidFiveCardHands(hand, null, HandType.FullHouse);
                    const allFives = [...straights, ...fullHouses].filter(f => f.some(c => c.rank === 3 && c.suit === 0));

                    if (allFives.length > 0) {
                        cardsToPlay = allFives[0];
                    } else {
                        const threes = hand.filter(c => c.rank === 3);
                        if (threes.length >= 2) {
                            cardsToPlay = [threes[0], threes[1]];
                        } else {
                            cardsToPlay = [threeOfClubs];
                        }
                    }
                } else {
                    cardsToPlay = [hand[0]];
                }
            } else {
                // 新回合領先出牌：優先出 5 張組合（順子、葫蘆等）
                const fullHouses = findValidFiveCardHands(hand, null, HandType.FullHouse);
                const straights = findValidFiveCardHands(hand, null, HandType.Straight);

                if (fullHouses.length > 0) cardsToPlay = fullHouses[0];
                else if (straights.length > 0) cardsToPlay = straights[0];
                else {
                    const pairs = findValidPairs(hand, null);
                    if (pairs.length > 0) cardsToPlay = pairs[0];
                    else cardsToPlay = [hand[0]];
                }
            }
        } else {
            // 跟牌邏輯
            const tableLen = room.state.tableHand.cards.length;
            const tableType = room.state.tableHand.type;

            if (tableLen === 5) {
                // 尋找能壓過的 5 張牌
                const typesToCheck = [HandType.Straight, HandType.FullHouse, HandType.FourOfAKind, HandType.StraightFlush];
                for (const t of typesToCheck) {
                    const combos = findValidFiveCardHands(hand, room.state.tableHand, t);
                    if (combos.length > 0) {
                        cardsToPlay = combos[0];
                        break;
                    }
                }
            } else if (tableLen === 2) {
                const pairs = findValidPairs(hand, room.state.tableHand);
                if (pairs.length > 0) cardsToPlay = pairs[0];
                else {
                    // 困難難度以上考慮用鐵支/同花順攔截 (Monsters)
                    if (room.difficulty !== 'Easy' && room.difficulty !== 'Medium') {
                        const monsters = [
                            ...findValidFiveCardHands(hand, room.state.tableHand, HandType.FourOfAKind),
                            ...findValidFiveCardHands(hand, room.state.tableHand, HandType.StraightFlush)
                        ];
                        if (monsters.length > 0) cardsToPlay = monsters[0];
                    }
                }
            } else if (tableLen === 1) {
                const tableVal = room.state.tableHand.value;
                const tableSuit = room.state.tableHand.suitValue || 0;
                const beat = hand.find(c => c.rank > tableVal || (c.rank === tableVal && c.suit > tableSuit));

                if (beat) cardsToPlay = [beat];
                else {
                    // 攔截規則
                    if (room.difficulty === 'Expert' || room.difficulty === 'Master') {
                        const monsters = [
                            ...findValidFiveCardHands(hand, room.state.tableHand, HandType.FourOfAKind),
                            ...findValidFiveCardHands(hand, room.state.tableHand, HandType.StraightFlush)
                        ];
                        if (monsters.length > 0) cardsToPlay = monsters[0];
                    }
                }
            }
        }

        const result = playTurn(room.state, aiIndex, cardsToPlay);
        if (typeof result !== "string") {
            room.state = result;
            io.to(roomId).emit("state_update", result);

            if (!result.isFinished && !result.players[result.currentPlayerIndex].isHuman) {
                const delay = room.difficulty === 'Easy' ? 2000 : room.difficulty === 'Hard' ? 600 : room.difficulty === 'Medium' ? 1000 : 300;
                setTimeout(() => triggerAI(roomId), delay);
            }
        } else {
            const passResult = playTurn(room.state, aiIndex, null);
            if (typeof passResult !== "string") {
                room.state = passResult;
                io.to(roomId).emit("state_update", passResult);
                if (!passResult.isFinished && !passResult.players[passResult.currentPlayerIndex].isHuman) {
                    const delay = room.difficulty === 'Easy' ? 2000 : room.difficulty === 'Hard' ? 600 : room.difficulty === 'Medium' ? 1000 : 300;
                    setTimeout(() => triggerAI(roomId), delay);
                }
            }
        }
    };

    socket.on("disconnect", () => {
        const roomId = playerRoomMap[socket.id];
        if (roomId) {
            const room = rooms[roomId];
            room.players = room.players.filter(p => p.socketId !== socket.id);
            delete playerRoomMap[socket.id];
            if (room.players.length === 0) delete rooms[roomId];
        }
    });
});

httpServer.listen(3002);
