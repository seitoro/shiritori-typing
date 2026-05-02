import { calculatePoints, getLastKana, normalizeWord, pickAiWord, validateWord, type LogEntry } from "@/lib/shiritori";

export type PlayerRole = "player1" | "player2";

export type MatchPlayer = {
  id: string;
  role: PlayerRole;
};

export type MatchState = {
  id: string;
  keyword: string;
  players: MatchPlayer[];
  status: "waiting" | "playing" | "finished";
  currentWord: string;
  turn: PlayerRole;
  usedWords: string[];
  score: Record<PlayerRole, number>;
  logs: LogEntry[];
  winner?: PlayerRole | "draw";
};

const store = new Map<string, MatchState>();

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function joinOrCreateRoom(keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const waitingRoom = [...store.values()].find(
    (room) => room.keyword === normalizedKeyword && room.status === "waiting"
  );

  if (waitingRoom) {
    const player: MatchPlayer = { id: makeId(), role: "player2" };
    waitingRoom.players.push(player);
    waitingRoom.status = "playing";
    waitingRoom.logs.unshift({ actor: "SYSTEM", word: waitingRoom.currentWord, note: "対戦開始" });
    return { room: waitingRoom, player };
  }

  const room: MatchState = {
    id: makeId(),
    keyword: normalizedKeyword,
    players: [],
    status: "waiting",
    currentWord: pickAiWord("りんご", []) || "りんご",
    turn: "player1",
    usedWords: [],
    score: { player1: 0, player2: 0 },
    logs: [{ actor: "SYSTEM", word: "待機中", note: "対戦相手を待っています" }]
  };

  const player: MatchPlayer = { id: makeId(), role: "player1" };
  room.players.push(player);
  room.usedWords.push(normalizeWord(room.currentWord));
  store.set(room.id, room);

  return { room, player };
}

export function getRoom(roomId: string) {
  return store.get(roomId) ?? null;
}

export function submitBattleWord(params: { roomId: string; playerId: string; word: string }) {
  const room = store.get(params.roomId);
  if (!room) {
    return { ok: false, message: "部屋が見つかりません。" };
  }

  const player = room.players.find((entry) => entry.id === params.playerId);
  if (!player) {
    return { ok: false, message: "参加者情報が見つかりません。" };
  }

  if (room.status !== "playing") {
    return { ok: false, message: "まだ対戦を開始できません。" };
  }

  if (room.turn !== player.role) {
    return { ok: false, message: "いまは相手のターンです。" };
  }

  const validation = validateWord({
    previousWord: room.currentWord,
    candidateWord: params.word,
    usedWords: room.usedWords
  });

  if (!validation.ok) {
    room.status = "finished";
    room.winner = player.role === "player1" ? "player2" : "player1";
    room.logs.unshift({ actor: player.role === "player1" ? "PLAYER1" : "PLAYER2", word: params.word, note: validation.reason ?? "失敗" });
    return { ok: false, message: validation.reason ?? "入力失敗", room };
  }

  room.currentWord = validation.normalized;
  room.usedWords.push(validation.normalized);
  room.score[player.role] += calculatePoints(validation.normalized);
  room.logs.unshift({
    actor: player.role === "player1" ? "PLAYER1" : "PLAYER2",
    word: validation.normalized,
    note: `+${calculatePoints(validation.normalized)}`
  });
  room.turn = player.role === "player1" ? "player2" : "player1";

  return { ok: true, room };
}
