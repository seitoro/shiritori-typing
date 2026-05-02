const STORAGE_DICTIONARY_KEY = "shiritori-runtime-dictionary";
const AI_VALIDATE_PATH_CANDIDATES = [
  window.SHITORI_VALIDATE_ENDPOINT,
  `${window.location.protocol}//${window.location.hostname}:3000/api/validate-word`,
  "/api/validate-word"
].filter(Boolean);
const STARTER_WORDS = [
  "りんご", "ごりら", "らっぱ", "ぱんだ", "だるま", "まり", "りす", "すいか", "からす", "すずめ",
  "めだか", "かめ", "めろん", "のはら", "らいおん", "きつね", "ねこ", "こあら", "らくだ", "だいこん",
  "こんぺいとう", "うさぎ", "ぎゅうにゅう", "うきわ", "わに", "にんじん", "うし", "しまうま", "まくら", "らーめん",
  "ぼうし", "しんぶん", "ふうせん", "せみ", "みかん", "かさ", "さくら", "らんぷ", "ぷりん",
  "いるか", "かばん", "ばんそうこう", "うみ", "みず", "ずこう", "うどん", "どあ", "あしか", "かぼちゃ",
  "やま", "まど", "どーなつ", "つくえ", "えんぴつ", "つみき", "きりん", "ぬの", "のーと", "とまと",
  "とけい", "いちご", "ごま", "まほう", "うぐいす", "すな", "なす", "すいぞくかん", "かがみ", "みみ",
  "みそ", "そら", "らくがき", "きもの", "のり", "りぼん", "ほん", "たぬき", "きゃべつ", "つばめ",
  "めがね", "ねずみ", "みどり", "りょうり", "りゆう", "うでどけい", "いす", "すもも", "もも", "もち"
];
const WORDS = loadRuntimeDictionary();

const WORD_ALIASES = {};

const SMALL_KANA = new Set(["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "っ"]);
const SOLO_LIMIT_SECONDS = 60;
const BATTLE_LIMIT_SECONDS = 60;
const SOLO_CHAIN_BONUS = 30;
const MAX_LEARNED_WORDS = 2000;
const STORAGE_KEY = "shiritori-battle-rooms";
const CHANNEL_NAME = "shiritori-battle-channel";
const STARTER_WORD_SET = new Set(STARTER_WORDS.map((word) => normalizeWord(word)).filter(Boolean));
const NORMALIZED_WORDS = [...new Set(WORDS.map((word) => normalizeWord(word)).filter(Boolean))];
const DICTIONARY = new Set([
  ...NORMALIZED_WORDS,
  ...Object.values(WORD_ALIASES).map((word) => normalizeWord(word))
]);
const CPU_WORD_INDEX = buildWordIndex(NORMALIZED_WORDS.filter((word) => !word.endsWith("ん")));
let dictionarySaveTimerId = null;

const battleChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
const playerId = crypto.randomUUID();

const state = {
  mode: "solo",
  solo: {
    isPlaying: false,
    isCountingDown: false,
    timeLeft: SOLO_LIMIT_SECONDS,
    score: 0,
    bestScore: Number(localStorage.getItem("shiritori-best-score") || "0"),
    currentWord: "ことば",
    requiredKana: "ば",
    usedWords: new Set(["ことば"]),
    invalidCount: 0,
    timerId: null
  },
  battle: {
    roomId: "",
    keyword: "",
    role: "",
    room: null,
    timerId: null,
    countdownTimerId: null,
    finishTickerId: null
  }
};

const soloTab = document.querySelector("#soloTab");
const battleTab = document.querySelector("#battleTab");
const soloPanel = document.querySelector("#soloPanel");
const battlePanel = document.querySelector("#battlePanel");
const countdownOverlay = document.querySelector("#countdownOverlay");
const countdownNumber = document.querySelector("#countdownNumber");
const heroText = document.querySelector("#heroText");

const metricLabel1 = document.querySelector("#metricLabel1");
const metricLabel2 = document.querySelector("#metricLabel2");
const metricLabel3 = document.querySelector("#metricLabel3");
const timeValueEl = document.querySelector("#timeValue");
const scoreValueEl = document.querySelector("#scoreValue");
const bestValueEl = document.querySelector("#bestValue");

const currentWordEl = document.querySelector("#currentWord");
const startButton = document.querySelector("#startButton");
const typingForm = document.querySelector("#typingForm");
const wordInput = document.querySelector("#wordInput");
const submitButton = document.querySelector("#submitButton");
const statusText = document.querySelector("#statusText");

const battleWordEl = document.querySelector("#battleWord");
const battleStartButton = document.querySelector("#battleStartButton");
const keywordInput = document.querySelector("#keywordInput");
const playerCountSelect = document.querySelector("#playerCountSelect");
const battleTimeLimitInput = document.querySelector("#battleTimeLimitInput");
const battleTimeUpButton = document.querySelector("#battleTimeUpButton");
const battleTimeDownButton = document.querySelector("#battleTimeDownButton");
const joinBattleButton = document.querySelector("#joinBattleButton");
const enterBattleButton = document.querySelector("#enterBattleButton");
const leaveBattleButton = document.querySelector("#leaveBattleButton");
const battleForm = document.querySelector("#battleForm");
const battleInput = document.querySelector("#battleInput");
const battleSubmitButton = document.querySelector("#battleSubmitButton");
const battleStatusText = document.querySelector("#battleStatusText");

soloTab.addEventListener("click", () => switchMode("solo"));
battleTab.addEventListener("click", () => switchMode("battle"));
startButton.addEventListener("click", startSoloGame);
typingForm.addEventListener("submit", submitSoloWord);
joinBattleButton.addEventListener("click", () => joinBattleRoom("create"));
enterBattleButton.addEventListener("click", () => joinBattleRoom("join"));
leaveBattleButton.addEventListener("click", leaveBattleRoom);
battleStartButton.addEventListener("click", startBattleGame);
battleForm.addEventListener("submit", submitBattleWord);
battleTimeLimitInput?.addEventListener("input", updateBattleTimeLimit);
battleTimeUpButton?.addEventListener("click", () => stepBattleTimeLimit(1));
battleTimeDownButton?.addEventListener("click", () => stepBattleTimeLimit(-1));
window.addEventListener("storage", syncBattleRoom);
battleChannel?.addEventListener("message", syncBattleRoom);

initializeModeFromQuery();
render();

function initializeModeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "battle") {
    state.mode = "battle";
    soloTab.classList.remove("is-active");
    battleTab.classList.add("is-active");
    soloTab.setAttribute("aria-selected", "false");
    battleTab.setAttribute("aria-selected", "true");
    soloPanel.classList.add("is-hidden");
    battlePanel.classList.remove("is-hidden");
  }
}

function switchMode(mode) {
  state.mode = mode;
  soloTab.classList.toggle("is-active", mode === "solo");
  battleTab.classList.toggle("is-active", mode === "battle");
  soloTab.setAttribute("aria-selected", String(mode === "solo"));
  battleTab.setAttribute("aria-selected", String(mode === "battle"));
  soloPanel.classList.toggle("is-hidden", mode !== "solo");
  battlePanel.classList.toggle("is-hidden", mode !== "battle");
  render();
}

function startSoloGame() {
  if (!NORMALIZED_WORDS.length) {
    statusText.textContent = "辞書が未設定です。";
    return;
  }

  stopSoloTimer();
  state.solo.isPlaying = false;
  state.solo.isCountingDown = true;
  state.solo.timeLeft = SOLO_LIMIT_SECONDS;
  state.solo.score = 0;
  state.solo.currentWord = chooseOpeningWord();
  state.solo.requiredKana = getLastKana(state.solo.currentWord);
  state.solo.usedWords = new Set([state.solo.currentWord]);
  state.solo.invalidCount = 0;
  wordInput.disabled = true;
  submitButton.disabled = true;
  wordInput.value = "";
  runSoloCountdown();
  render();
}

function finishSoloGame(message) {
  stopSoloTimer();
  state.solo.isPlaying = false;
  state.solo.isCountingDown = false;
  wordInput.disabled = true;
  submitButton.disabled = true;
  statusText.textContent = message;
  countdownOverlay?.classList.add("is-hidden");
  countdownOverlay?.setAttribute("aria-hidden", "true");
  if (state.solo.score > state.solo.bestScore) {
    state.solo.bestScore = state.solo.score;
    localStorage.setItem("shiritori-best-score", String(state.solo.bestScore));
  }
  render();
}

function stopSoloTimer() {
  if (state.solo.timerId) {
    window.clearInterval(state.solo.timerId);
    state.solo.timerId = null;
  }
}

function runSoloCountdown() {
  let count = 3;
  statusText.textContent = "";
  countdownOverlay?.classList.remove("is-hidden");
  countdownOverlay?.setAttribute("aria-hidden", "false");
  if (countdownNumber) {
    countdownNumber.textContent = String(count);
  }
  render();

  const countdownId = window.setInterval(() => {
    count -= 1;

    if (count > 0) {
      if (countdownNumber) {
        countdownNumber.textContent = String(count);
      }
      render();
      return;
    }

    window.clearInterval(countdownId);
    beginSoloRound();
  }, 1000);
}

function beginSoloRound() {
  const opening = chooseOpeningWord();
  state.solo.currentWord = opening;
  state.solo.requiredKana = getLastKana(opening);
  state.solo.usedWords = new Set([opening]);
  state.solo.isPlaying = true;
  state.solo.isCountingDown = false;
  wordInput.disabled = false;
  submitButton.disabled = false;
  statusText.textContent = "";
  countdownOverlay?.classList.add("is-hidden");
  countdownOverlay?.setAttribute("aria-hidden", "true");
  wordInput.focus();

  state.solo.timerId = window.setInterval(() => {
    state.solo.timeLeft -= 1;
    if (state.solo.timeLeft <= 0) {
      finishSoloGame("時間切れです。もう一度挑戦しよう。");
    }
    render();
  }, 1000);

  render();
}

async function submitSoloWord(event) {
  event.preventDefault();
  if (!state.solo.isPlaying) {
    return;
  }

  const rawWord = wordInput.value.trim();
  const normalizedWord = normalizeWord(rawWord);
  if (!normalizedWord) {
    statusText.textContent = "ことばを入力してね。";
    return;
  }

  if (state.solo.usedWords.has(normalizedWord)) {
    statusText.textContent = "そのことばはもう使っています。";
    return;
  }

  const blockedReason = getBlockedReason(normalizedWord);
  if (blockedReason) {
    registerSoloInvalid(blockedReason);
    return;
  }

  if (normalizedWord[0] !== state.solo.requiredKana) {
    registerSoloInvalid(`「${state.solo.requiredKana}」から始まることばを入れてね。`);
    return;
  }

  if (normalizedWord.endsWith("ん")) {
    finishSoloGame("「ん」で終わったのでゲーム終了です。");
    return;
  }

  if (!isHiraganaOnly(rawWord)) {
    registerSoloInvalid("ひらがなで入力してください。");
    return;
  }

  let acceptedWord = normalizedWord;
  if (!isKnownWord(normalizedWord)) {
    statusText.textContent = "AIが確認中です。";
    submitButton.disabled = true;
    const aiResult = await validateUnknownWordWithAI({
      previousWord: state.solo.currentWord,
      candidateWord: rawWord
    });
    submitButton.disabled = false;

    if (!aiResult.ok) {
      registerSoloInvalid("存在しません。");
      return;
    }

    acceptedWord = aiResult.normalized;
    rememberWord(acceptedWord);
  }

  if (state.solo.usedWords.has(acceptedWord)) {
    statusText.textContent = "そのことばはもう使っています。";
    return;
  }

  const earnedPoints = calculatePoints(acceptedWord) + SOLO_CHAIN_BONUS;
  state.solo.score += earnedPoints;
  state.solo.usedWords.add(acceptedWord);
  rememberWord(acceptedWord);
  const cpuWord = pickCpuWord(acceptedWord, [...state.solo.usedWords]);

  if (!cpuWord) {
    state.solo.currentWord = acceptedWord;
    state.solo.requiredKana = getLastKana(acceptedWord);
    finishSoloGame("つなげることばがなくなりました。あなたの勝ちです。");
    return;
  }

  state.solo.usedWords.add(cpuWord);
  rememberWord(cpuWord);
  state.solo.currentWord = cpuWord;
  state.solo.requiredKana = getLastKana(cpuWord);
  wordInput.value = "";
  statusText.textContent = "";
  render();
}

function joinBattleRoom(mode) {
  if (!NORMALIZED_WORDS.length) {
    battleStatusText.textContent = "辞書が未設定です。";
    return;
  }

  const keyword = keywordInput.value.trim().toLowerCase();
  const capacity = Math.max(2, Math.min(4, Number(playerCountSelect.value || "2")));
  const timeLimit = getBattleTimeLimitValue();
  if (!keyword) {
    battleStatusText.textContent = "合言葉を入れてください。";
    return;
  }

  const rooms = loadRooms();
  const existingRoom = rooms.find(
    (room) =>
      room.keyword === keyword &&
      room.status === "waiting" &&
      (room.capacity ?? 2) === capacity
  );

  if (mode === "join" && existingRoom) {
    if (existingRoom.players.length >= (existingRoom.capacity ?? 2)) {
      battleStatusText.textContent = "その部屋は満員です。";
      return;
    }
    const role = `player${existingRoom.players.length + 1}`;
    existingRoom.players.push({ id: playerId, role });
    existingRoom.capacity ??= 2;
    existingRoom.turnOrder ??= existingRoom.players.map((player) => player.role);
    existingRoom.turnOrder = existingRoom.players.map((player) => player.role);
    existingRoom.turn = existingRoom.turnOrder[0];
    existingRoom.remainingTime ??= {};
    existingRoom.invalidCount ??= {};
    existingRoom.eliminatedOrder ??= [];
    existingRoom.finalRanks ??= {};
    existingRoom.playerTimeLimits ??= {};
    existingRoom.playerTimeLimits[role] ??= timeLimit;
    existingRoom.remainingTime[role] ??= existingRoom.playerTimeLimits[role];
    existingRoom.invalidCount[role] ??= 0;
    if (existingRoom.players.length >= existingRoom.capacity) {
      existingRoom.status = "waiting";
      existingRoom.logs.unshift({ actor: "SYSTEM", word: existingRoom.currentWord, note: "人数がそろいました" });
    } else {
      existingRoom.logs.unshift({ actor: "SYSTEM", word: existingRoom.currentWord, note: `${existingRoom.players.length}/${existingRoom.capacity}人` });
    }
    saveRooms(rooms);
    state.battle.role = role;
    state.battle.roomId = existingRoom.id;
    state.battle.keyword = keyword;
    state.battle.room = existingRoom;
    battleStatusText.textContent = existingRoom.status === "playing"
      ? "人数がそろいました。対戦開始です。"
      : existingRoom.players.length >= existingRoom.capacity
        ? "人数がそろいました。スタートを押してください。"
        : `入室しました。あと${existingRoom.capacity - existingRoom.players.length}人で開始です。`;
  } else if (mode === "join" && !existingRoom) {
    battleStatusText.textContent = "その条件の部屋はありません。";
  } else {
    const opening = chooseOpeningWord();
    const room = {
      id: crypto.randomUUID().slice(0, 8),
      keyword,
      status: "waiting",
      capacity,
      currentWord: opening,
      turn: "player1",
      turnOrder: ["player1"],
      players: [{ id: playerId, role: "player1" }],
      playerTimeLimits: { player1: timeLimit },
      remainingTime: { player1: timeLimit },
      invalidCount: { player1: 0 },
      eliminatedOrder: [],
      finalRanks: {},
      usedWords: [opening],
      logs: [{ actor: "SYSTEM", word: opening, note: `あと${capacity - 1}人で開始` }]
    };
    room.currentWord = room.usedWords[0];
    rooms.push(room);
    saveRooms(rooms);
    state.battle.role = "player1";
    state.battle.roomId = room.id;
    state.battle.keyword = keyword;
    state.battle.room = room;
    battleStatusText.textContent = `部屋を作りました。あと${capacity - 1}人で開始です。`;
  }

  render();
}

function startBattleGame() {
  const rooms = loadRooms();
  const room = rooms.find((entry) => entry.id === state.battle.roomId);
  if (!room) {
    battleStatusText.textContent = "部屋が見つかりません。";
    return;
  }

  if (room.status !== "waiting" || room.players.length < (room.capacity ?? room.players.length)) {
    battleStatusText.textContent = "まだスタートできません。";
    return;
  }

  room.status = "countdown";
  room.countdownEndsAt = Date.now() + 3000;
  room.logs.unshift({ actor: "SYSTEM", word: room.currentWord, note: "3,2,1" });
  saveRooms(rooms);
  state.battle.room = room;
  battleStatusText.textContent = "スタートします。";
  startBattleCountdownTicker();
  render();
}

function leaveBattleRoom() {
  if (!state.battle.roomId) {
    keywordInput.value = "";
    battleStatusText.textContent = "合言葉を入力して対戦相手を待ちます。";
    return;
  }

  const rooms = loadRooms();
  const room = rooms.find((entry) => entry.id === state.battle.roomId);
  if (room) {
    room.players = room.players.filter((player) => player.id !== playerId);
    room.turnOrder = (room.turnOrder ?? []).filter((role) => role !== state.battle.role);
    if (room.players.length === 0) {
      rooms.splice(rooms.findIndex((entry) => entry.id === room.id), 1);
    } else if (room.status === "playing") {
      room.status = "finished";
      room.logs.unshift({ actor: "SYSTEM", word: room.currentWord, note: "途中退出で終了" });
    } else {
      room.logs.unshift({ actor: "SYSTEM", word: room.currentWord, note: `${room.players.length}/${room.capacity ?? room.players.length}人` });
    }
  }
  saveRooms(rooms);
  state.battle.roomId = "";
  state.battle.keyword = "";
  state.battle.role = "";
  state.battle.room = null;
  keywordInput.value = "";
  battleInput.value = "";
  battleStatusText.textContent = "部屋を出ました。";
  stopBattleTimer();
  stopBattleCountdownTicker();
  stopBattleFinishTicker();
  render();
}

function updateBattleTimeLimit() {
  const room = getCurrentBattleRoom();
  if (!room || room.status !== "waiting") {
    return;
  }

  const nextTimeLimit = getBattleTimeLimitValue();
  const rooms = loadRooms();
  const targetRoom = rooms.find((entry) => entry.id === room.id);
  if (!targetRoom || targetRoom.status !== "waiting") {
    return;
  }

  targetRoom.playerTimeLimits ??= {};
  targetRoom.playerTimeLimits[state.battle.role] = nextTimeLimit;
  targetRoom.remainingTime ??= {};
  targetRoom.remainingTime[state.battle.role] = nextTimeLimit;

  saveRooms(rooms);
  state.battle.room = targetRoom;
  battleStatusText.textContent = `持ち時間を${nextTimeLimit}秒に変更しました。`;
  render();
}

function stepBattleTimeLimit(delta) {
  const currentValue = getBattleTimeLimitValue();
  battleTimeLimitInput.value = String(Math.max(1, currentValue + delta));
  updateBattleTimeLimit();
}

async function submitBattleWord(event) {
  event.preventDefault();
  const room = getCurrentBattleRoom();
  if (!room || room.status !== "playing") {
    return;
  }

  const role = state.battle.role;
  if (room.turn !== role) {
    battleStatusText.textContent = "いまは相手のターンです。";
    return;
  }

  const rawWord = battleInput.value.trim();
  const normalizedWord = normalizeWord(rawWord);
  if (!normalizedWord) {
    battleStatusText.textContent = "ことばを入力してね。";
    return;
  }

  if (room.usedWords.includes(normalizedWord)) {
    battleStatusText.textContent = "そのことばはもう使っています。";
    return;
  }

  const blockedReason = getBlockedReason(normalizedWord);
  if (blockedReason) {
    registerBattleInvalid(room, role, blockedReason);
    return;
  }

  const requiredKana = getLastKana(room.currentWord);
  if (normalizedWord[0] !== requiredKana) {
    registerBattleInvalid(room, role, `「${requiredKana}」から始めてください。`);
    return;
  }

  const rooms = loadRooms();
  const targetRoom = rooms.find((entry) => entry.id === room.id);
  if (!targetRoom) {
    battleStatusText.textContent = "部屋が見つかりません。";
    return;
  }

  targetRoom.invalidCount ??= {};
  targetRoom.invalidCount[role] ??= 0;
  if (!isHiraganaOnly(rawWord)) {
    registerBattleInvalid(targetRoom, role, "ひらがなで入力してください。", normalizedWord, rooms);
    return;
  }
  let acceptedWord = normalizedWord;
  if (!isKnownWord(normalizedWord)) {
    battleStatusText.textContent = "AIが確認中です。";
    battleSubmitButton.disabled = true;
    const aiResult = await validateUnknownWordWithAI({
      previousWord: room.currentWord,
      candidateWord: rawWord
    });
    battleSubmitButton.disabled = false;

    if (!aiResult.ok) {
      registerBattleInvalid(targetRoom, role, "存在しません。", normalizedWord, rooms);
      return;
    }

    acceptedWord = aiResult.normalized;
    rememberWord(acceptedWord);
  }

  if (targetRoom.usedWords.includes(acceptedWord)) {
    battleStatusText.textContent = "そのことばはもう使っています。";
    return;
  }

  targetRoom.currentWord = acceptedWord;
  targetRoom.usedWords.push(acceptedWord);
  rememberWord(acceptedWord);
  targetRoom.playerTimeLimits ??= {};
  targetRoom.remainingTime ??= {};
  targetRoom.remainingTime[role] ??= targetRoom.playerTimeLimits[role] ?? BATTLE_LIMIT_SECONDS;
  targetRoom.logs.unshift({
    actor: formatBattleActor(role),
    word: acceptedWord,
    note: `${targetRoom.remainingTime[role]}秒`
  });

  if (acceptedWord.endsWith("ん")) {
    eliminateBattlePlayer(targetRoom, role, "んで負け");
  } else {
    targetRoom.turn = getNextActiveBattleRole(targetRoom, role);
  }

  saveRooms(rooms);
  state.battle.room = targetRoom;
  battleInput.value = "";
  battleStatusText.textContent =
    targetRoom.status === "finished"
      ? getBattleResultMessage(targetRoom, role)
      : "送信しました。相手のターンです。";
  if (targetRoom.status === "finished") {
    startBattleFinishTicker();
  }
  render();
}

function syncBattleRoom() {
  if (!state.battle.roomId) {
    return;
  }
  state.battle.room = getCurrentBattleRoom();
  if (state.battle.room?.status === "countdown") {
    startBattleCountdownTicker();
  }
  if (state.battle.room?.status === "finished") {
    startBattleFinishTicker();
  }
  maybeBeginBattleFromCountdown();
  maybeResetBattleAfterFinish();
  render();
}

function getCurrentBattleRoom() {
  return loadRooms().find((room) => room.id === state.battle.roomId) ?? null;
}

function loadRooms() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRooms(rooms) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  battleChannel?.postMessage({ type: "rooms-updated" });
}

function normalizeWord(word) {
  const compactWord = word
    .replace(/\s+/g, "")
    .replace(/ー/g, "")
    .replace(/を/g, "お")
    .replace(/づ/g, "ず")
    .replace(/ぢ/g, "じ");

  const alias = WORD_ALIASES[compactWord] ?? WORD_ALIASES[compactWord.toUpperCase()];
  const source = alias ?? compactWord;

  return [...source]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCharCode(code - 0x60);
      }
      return char;
    })
    .join("")
    .toLowerCase();
}

function loadRuntimeDictionary() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_DICTIONARY_KEY) || "[]");
    const learnedWords = compactLearnedWords(saved);
    const merged = [...new Set([...STARTER_WORDS, ...learnedWords].map((word) => normalizeSeedWord(word)).filter(Boolean))];
    localStorage.setItem(STORAGE_DICTIONARY_KEY, JSON.stringify(learnedWords));
    return merged;
  } catch {
    return [...STARTER_WORDS];
  }
}

function normalizeSeedWord(word) {
  return String(word).trim();
}

function rememberWord(word) {
  const normalized = normalizeWord(word);
  if (!normalized || WORDS.includes(normalized)) {
    return;
  }
  WORDS.push(normalized);
  NORMALIZED_WORDS.push(normalized);
  DICTIONARY.add(normalized);
  if (!normalized.endsWith("ん")) {
    const bucket = CPU_WORD_INDEX.get(normalized[0]);
    if (bucket) {
      bucket.push(normalized);
    } else {
      CPU_WORD_INDEX.set(normalized[0], [normalized]);
    }
  }
  scheduleDictionarySave();
}

function compactLearnedWords(words) {
  const normalizedWords = [];
  const seen = new Set();

  for (const rawWord of words ?? []) {
    const normalized = normalizeWord(String(rawWord).trim());
    if (!normalized || STARTER_WORD_SET.has(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    normalizedWords.push(normalized);
  }

  return normalizedWords.slice(-MAX_LEARNED_WORDS);
}

function scheduleDictionarySave() {
  if (dictionarySaveTimerId) {
    window.clearTimeout(dictionarySaveTimerId);
  }

  dictionarySaveTimerId = window.setTimeout(() => {
    const learnedWords = compactLearnedWords(WORDS);
    localStorage.setItem(STORAGE_DICTIONARY_KEY, JSON.stringify(learnedWords));
    dictionarySaveTimerId = null;
  }, 250);
}

async function validateUnknownWordWithAI({ previousWord, candidateWord }) {
  for (const endpoint of AI_VALIDATE_PATH_CANDIDATES) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          previousWord,
          candidateWord
        })
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      if (payload?.ok && payload?.normalized) {
        return {
          ok: true,
          normalized: normalizeWord(payload.normalized)
        };
      }
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    normalized: normalizeWord(candidateWord)
  };
}

function getLastKana(word) {
  const chars = [...normalizeWord(word)];
  const last = chars.at(-1) ?? "";
  const prev = chars.at(-2) ?? "";
  return SMALL_KANA.has(last) && prev ? prev : last;
}

function calculatePoints(word) {
  return [...normalizeWord(word)].length * 10;
}

function registerSoloInvalid(message) {
  state.solo.invalidCount += 1;
  wordInput.value = "";
  if (state.solo.invalidCount >= 3) {
    finishSoloGame("3回達したので強制終了です。");
    return;
  }
  statusText.textContent = `${message} あと${3 - state.solo.invalidCount}回で終了します。`;
  render();
}

function registerBattleInvalid(room, role, message, word = "", rooms = null) {
  const allRooms = rooms ?? loadRooms();
  const targetRoom = allRooms.find((entry) => entry.id === room.id);
  if (!targetRoom) {
    battleStatusText.textContent = "部屋が見つかりません。";
    return;
  }

  targetRoom.invalidCount ??= {};
  targetRoom.invalidCount[role] ??= 0;
  targetRoom.invalidCount[role] += 1;
  targetRoom.logs.unshift({
    actor: formatBattleActor(role),
    word: word || "無効",
    note: `無効 ${targetRoom.invalidCount[role]}/3`
  });

  if (targetRoom.invalidCount[role] >= 3) {
    eliminateBattlePlayer(targetRoom, role, "無効入力3回で負け");
    saveRooms(allRooms);
    state.battle.room = targetRoom;
    battleInput.value = "";
    battleStatusText.textContent = getBattleResultMessage(targetRoom, role);
    if (targetRoom.status === "finished") {
      startBattleFinishTicker();
    }
    render();
    return;
  }

  saveRooms(allRooms);
  state.battle.room = targetRoom;
  battleInput.value = "";
  battleStatusText.textContent = `${message} あと${3 - targetRoom.invalidCount[role]}回ミスすると負けです。`;
  render();
}

function isKnownWord(word) {
  return DICTIONARY.has(normalizeWord(word));
}

function isHiraganaOnly(word) {
  const compactWord = String(word).trim().replace(/\s+/g, "");
  if (!compactWord) {
    return false;
  }
  return /^[ぁ-ゖー]+$/u.test(compactWord);
}

function getBlockedReason(word) {
  if ([...word].length === 1) {
    return "1文字のことばでは続けられません。";
  }

  if (/([ぁ-ゖ])\1\1/u.test(word)) {
    return "存在しません。";
  }

  return "";
}

function pickCpuWord(previousWord, usedWords) {
  const requiredKana = getLastKana(previousWord);
  const usedSet = usedWords instanceof Set ? usedWords : new Set(usedWords);
  const candidates = (CPU_WORD_INDEX.get(requiredKana) ?? []).filter((word) => !usedSet.has(word));

  if (!candidates.length) {
    return "";
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function buildWordIndex(words) {
  const index = new Map();
  words.forEach((word) => {
    const start = word[0];
    if (!start) {
      return;
    }
    const bucket = index.get(start);
    if (bucket) {
      bucket.push(word);
    } else {
      index.set(start, [word]);
    }
  });
  return index;
}

function chooseOpeningWord() {
  const candidates = NORMALIZED_WORDS.filter((word) => !word.endsWith("ん"));
  if (!candidates.length) {
    return "ことば";
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function render() {
  maybeBeginBattleFromCountdown();
  maybeResetBattleAfterFinish();
  renderHeaderMetrics();
  renderHeroText();
  renderSolo();
  renderBattle();
}

function renderHeroText() {
  if (!heroText) {
    return;
  }
  heroText.textContent = state.mode === "battle"
    ? "素早いタイピングでしりとりを続けて勝利をつかめ！"
    : "素早いタイピングでしりとりを続けてハイスコアを目指せ！";
}

function renderHeaderMetrics() {
  if (state.mode === "solo") {
    metricLabel1.textContent = "のこり";
    metricLabel2.textContent = "スコア";
    metricLabel3.textContent = "最高";
    timeValueEl.textContent = String(state.solo.timeLeft);
    timeValueEl.classList.toggle("is-danger", state.solo.timeLeft <= 10 && state.solo.isPlaying);
    scoreValueEl.textContent = String(state.solo.score);
    bestValueEl.textContent = String(state.solo.bestScore);
    bestValueEl.classList.remove("is-danger");
    return;
  }

  const room = getCurrentBattleRoom();
  metricLabel1.textContent = "状態";
  metricLabel2.textContent = "人数";
  metricLabel3.textContent = "のこり";
  timeValueEl.textContent = getBattleStatusLabel(room);
  const remainingTime = room?.remainingTime?.[state.battle.role] ?? 0;
  timeValueEl.classList.remove("is-danger");
  scoreValueEl.textContent = room ? `${room.players.length}/${room.capacity ?? room.players.length}` : "0/0";
  bestValueEl.textContent = room ? `${remainingTime}秒` : "0秒";
  bestValueEl.classList.toggle("is-danger", Boolean(room) && remainingTime <= 10 && room.status === "playing" && !isBattleRoleEliminated(room, state.battle.role));
}

function renderSolo() {
  currentWordEl.textContent = state.solo.currentWord;
  startButton.textContent = state.solo.isPlaying ? "リスタート" : "スタート";
  if (state.solo.isPlaying && wordInput.value === "" && !statusText.textContent.includes("終了") && !statusText.textContent.includes("あと") && !statusText.textContent.includes("入れてね") && !statusText.textContent.includes("使って") && !statusText.textContent.includes("入力してね") && !statusText.textContent.includes("勝ち")) {
    statusText.textContent = "";
  }
}

function renderBattle() {
  const room = getCurrentBattleRoom();
  state.battle.room = room;
  battleWordEl.textContent = room?.currentWord ?? "ことば";
  if (room?.status === "waiting") {
    battleTimeLimitInput.value = String(room.playerTimeLimits?.[state.battle.role] ?? room.remainingTime?.[state.battle.role] ?? BATTLE_LIMIT_SECONDS);
  }
  battleStartButton.textContent = room?.status === "countdown"
    ? getBattleCountdownLabel(room)
    : room?.status === "finished"
      ? getBattleFinishedBadge(room)
      : "スタート";
  battleStartButton.disabled = !canStartBattle(room);
  battleInput.disabled = !room || room.status !== "playing" || room.turn !== state.battle.role || isBattleRoleEliminated(room, state.battle.role);
  battleSubmitButton.disabled = battleInput.disabled;
  keywordInput.disabled = Boolean(room);
  playerCountSelect.disabled = Boolean(room);
  battleTimeLimitInput.disabled = Boolean(room && room.status !== "waiting");
  battleTimeUpButton.disabled = Boolean(room && room.status !== "waiting");
  battleTimeDownButton.disabled = Boolean(room && room.status !== "waiting");
  joinBattleButton.disabled = Boolean(room);
  enterBattleButton.disabled = Boolean(room);
  updateBattleTimer(room);
  renderBattleCountdown(room);
  renderBattleFinishAnnouncement(room);
}

function formatBattleRole(role) {
  if (!role) {
    return "未定";
  }
  return `${role.replace("player", "")}人目`;
}

function getBattleTimeLimitValue() {
  const rawValue = Number(battleTimeLimitInput?.value || String(BATTLE_LIMIT_SECONDS));
  if (!Number.isFinite(rawValue)) {
    return BATTLE_LIMIT_SECONDS;
  }
  return Math.max(1, Math.floor(rawValue));
}

function formatBattleActor(role) {
  return `PLAYER${role.replace("player", "")}`;
}

function isBattleRoleEliminated(room, role) {
  return Boolean(room?.finalRanks?.[role] && room.finalRanks[role] > 1);
}

function getActiveBattleRoles(room) {
  const order = room.turnOrder ?? room.players.map((player) => player.role);
  return order.filter((role) => !room.finalRanks?.[role]);
}

function getNextActiveBattleRole(room, currentRole) {
  const activeRoles = getActiveBattleRoles(room);
  if (!activeRoles.length) {
    return "";
  }
  const currentIndex = activeRoles.indexOf(currentRole);
  if (currentIndex === -1) {
    return activeRoles[0];
  }
  return activeRoles[(currentIndex + 1) % activeRoles.length];
}

function eliminateBattlePlayer(room, role, reason) {
  room.finalRanks ??= {};
  room.eliminatedOrder ??= [];
  if (room.finalRanks[role]) {
    return;
  }

  room.eliminatedOrder.push(role);
  const playerCount = room.capacity ?? room.players.length;
  room.finalRanks[role] = playerCount - room.eliminatedOrder.length + 1;
  room.logs.unshift({ actor: "SYSTEM", word: room.currentWord, note: `${formatBattleRole(role)} ${reason}` });

  const activeRoles = getActiveBattleRoles(room);
  if (activeRoles.length <= 1) {
    if (activeRoles.length === 1) {
      room.finalRanks[activeRoles[0]] = 1;
      room.logs.unshift({ actor: "SYSTEM", word: room.currentWord, note: `${formatBattleRole(activeRoles[0])} 1位` });
    }
    room.status = "finished";
    room.turn = "";
    room.rankAnnouncementStartedAt = Date.now();
    return;
  }

  room.turn = getNextActiveBattleRole(room, role);
}

function getBattleStatusLabel(room) {
  if (!room) {
    return "待機";
  }
  if (room.status === "waiting") {
    return room.players.length >= (room.capacity ?? room.players.length) ? "開始前" : "待機";
  }
  if (room.status === "countdown") {
    return "開始前";
  }
  if (room.status === "playing") {
    return "対戦中";
  }
  const rank = room.finalRanks?.[state.battle.role];
  return rank ? `${rank}位` : "終了";
}

function getBattleFinishedBadge(room) {
  const rank = room?.finalRanks?.[state.battle.role];
  return rank ? `${rank}位` : "終了";
}

function getBattleResultMessage(room, role) {
  const rank = room?.finalRanks?.[role];
  if (!rank) {
    return "対戦が終了しました。";
  }
  if ((room.capacity ?? room.players.length) === 2) {
    return rank === 1 ? "あなたの勝ちです。" : "あなたの負けです。";
  }
  return `あなたは${rank}位です。`;
}

function stopBattleTimer() {
  if (state.battle.timerId) {
    window.clearInterval(state.battle.timerId);
    state.battle.timerId = null;
  }
}

function canStartBattle(room) {
  return Boolean(room && room.status === "waiting" && room.players.length >= (room.capacity ?? room.players.length));
}

function getBattleCountdownLabel(room) {
  if (!room?.countdownEndsAt) {
    return "スタート";
  }
  const secondsLeft = Math.max(1, Math.ceil((room.countdownEndsAt - Date.now()) / 1000));
  return String(secondsLeft);
}

function renderBattleCountdown(room) {
  if (state.mode === "solo" && state.solo.isCountingDown) {
    return;
  }

  if (!room || room.status !== "countdown") {
    stopBattleCountdownTicker();
    return;
  }

  showOverlayText(getBattleCountdownLabel(room));
}

function maybeBeginBattleFromCountdown() {
  const room = getCurrentBattleRoom();
  if (!room || room.status !== "countdown" || !room.countdownEndsAt) {
    return;
  }

  if (Date.now() < room.countdownEndsAt) {
    return;
  }

  const rooms = loadRooms();
  const targetRoom = rooms.find((entry) => entry.id === room.id);
  if (!targetRoom || targetRoom.status !== "countdown") {
    return;
  }

  targetRoom.status = "playing";
  delete targetRoom.countdownEndsAt;
  targetRoom.logs.unshift({ actor: "SYSTEM", word: targetRoom.currentWord, note: "対戦開始" });
  saveRooms(rooms);
  state.battle.room = targetRoom;
  battleStatusText.textContent = "対戦開始です。";
  stopBattleCountdownTicker();
}

function startBattleCountdownTicker() {
  stopBattleCountdownTicker();
  state.battle.countdownTimerId = window.setInterval(() => {
    maybeBeginBattleFromCountdown();
    render();
  }, 200);
}

function stopBattleCountdownTicker() {
  if (state.battle.countdownTimerId) {
    window.clearInterval(state.battle.countdownTimerId);
    state.battle.countdownTimerId = null;
  }
}

function getBattleAnnouncementSequence(room) {
  const playerCount = room.capacity ?? room.players.length;
  const sequence = [];
  for (let rank = playerCount; rank >= 2; rank -= 1) {
    sequence.push({ text: `${rank}位`, duration: 1000 });
  }
  sequence.push({ text: "1位", duration: 5000 });
  return sequence;
}

function getBattleAnnouncementState(room) {
  if (!room?.rankAnnouncementStartedAt) {
    return null;
  }
  const elapsed = Date.now() - room.rankAnnouncementStartedAt;
  const sequence = getBattleAnnouncementSequence(room);
  let consumed = 0;

  for (const item of sequence) {
    consumed += item.duration;
    if (elapsed < consumed) {
      return {
        text: item.text,
        done: false,
        totalDuration: sequence.reduce((sum, entry) => sum + entry.duration, 0)
      };
    }
  }

  return {
    text: "1位",
    done: true,
    totalDuration: sequence.reduce((sum, entry) => sum + entry.duration, 0)
  };
}

function renderBattleFinishAnnouncement(room) {
  if (state.mode === "solo" && state.solo.isCountingDown) {
    return;
  }

  if (!room || room.status !== "finished" || !room.rankAnnouncementStartedAt) {
    if (!state.battle.room || state.battle.room.status !== "countdown") {
      hideOverlay();
    }
    stopBattleFinishTicker();
    return;
  }

  const announcement = getBattleAnnouncementState(room);
  if (!announcement) {
    return;
  }
  showOverlayText(announcement.text);
}

function maybeResetBattleAfterFinish() {
  const room = getCurrentBattleRoom();
  if (!room || room.status !== "finished" || !room.rankAnnouncementStartedAt) {
    return;
  }

  const announcement = getBattleAnnouncementState(room);
  if (!announcement?.done) {
    return;
  }

  const rooms = loadRooms();
  const targetRoom = rooms.find((entry) => entry.id === room.id);
  if (!targetRoom || targetRoom.status !== "finished") {
    return;
  }

  resetBattleRoom(targetRoom);
  saveRooms(rooms);
  state.battle.room = targetRoom;
  battleStatusText.textContent = "もう一度スタートできます。";
  stopBattleFinishTicker();
  hideOverlay();
}

function resetBattleRoom(room) {
  const opening = chooseOpeningWord();
  room.status = "waiting";
  room.currentWord = opening;
  room.turnOrder = room.players.map((player) => player.role);
  room.turn = room.turnOrder[0] ?? "";
  room.usedWords = [opening];
  room.invalidCount = {};
  room.finalRanks = {};
  room.eliminatedOrder = [];
  room.remainingTime = {};
  room.playerTimeLimits ??= {};
  for (const player of room.players) {
    room.invalidCount[player.role] = 0;
    room.remainingTime[player.role] = room.playerTimeLimits[player.role] ?? BATTLE_LIMIT_SECONDS;
  }
  delete room.rankAnnouncementStartedAt;
  delete room.countdownEndsAt;
  room.logs.unshift({ actor: "SYSTEM", word: opening, note: "再スタート待機" });
}

function startBattleFinishTicker() {
  stopBattleFinishTicker();
  state.battle.finishTickerId = window.setInterval(() => {
    maybeResetBattleAfterFinish();
    render();
  }, 200);
}

function stopBattleFinishTicker() {
  if (state.battle.finishTickerId) {
    window.clearInterval(state.battle.finishTickerId);
    state.battle.finishTickerId = null;
  }
}

function showOverlayText(text) {
  countdownOverlay?.classList.remove("is-hidden");
  countdownOverlay?.setAttribute("aria-hidden", "false");
  if (countdownNumber) {
    countdownNumber.textContent = text;
  }
}

function hideOverlay() {
  countdownOverlay?.classList.add("is-hidden");
  countdownOverlay?.setAttribute("aria-hidden", "true");
}

function updateBattleTimer(room) {
  stopBattleTimer();
  if (!room || room.status !== "playing" || room.turn !== state.battle.role || isBattleRoleEliminated(room, state.battle.role)) {
    return;
  }

  state.battle.timerId = window.setInterval(() => {
    const rooms = loadRooms();
    const targetRoom = rooms.find((entry) => entry.id === state.battle.roomId);
    if (!targetRoom || targetRoom.status !== "playing" || targetRoom.turn !== state.battle.role) {
      stopBattleTimer();
      state.battle.room = getCurrentBattleRoom();
      if (state.battle.room?.status === "finished") {
        startBattleFinishTicker();
      }
      render();
      return;
    }

    targetRoom.remainingTime ??= {};
    targetRoom.playerTimeLimits ??= {};
    targetRoom.remainingTime[state.battle.role] ??= targetRoom.playerTimeLimits[state.battle.role] ?? BATTLE_LIMIT_SECONDS;
    targetRoom.remainingTime[state.battle.role] -= 1;

    if (targetRoom.remainingTime[state.battle.role] <= 0) {
      targetRoom.remainingTime[state.battle.role] = 0;
      eliminateBattlePlayer(targetRoom, state.battle.role, "時間切れ");
      saveRooms(rooms);
      state.battle.room = targetRoom;
      battleStatusText.textContent = getBattleResultMessage(targetRoom, state.battle.role);
      stopBattleTimer();
      startBattleFinishTicker();
      render();
      return;
    }

    saveRooms(rooms);
    state.battle.room = targetRoom;
    render();
  }, 1000);
}
