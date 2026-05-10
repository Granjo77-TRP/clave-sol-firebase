import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const STEP = 8;
const STAFF_TOP = 26;
const STAFF_SPACING = 16;
const SOL_LINE_Y = STAFF_TOP + STAFF_SPACING * 3;
const FIRST_LEDGER_ABOVE = STAFF_TOP - STAFF_SPACING;
const FIRST_LEDGER_BELOW = STAFF_TOP + STAFF_SPACING * 5;
const STORAGE_KEY = "clave-sol-game-scores";

const RAW_NOTES = [
  { id: "sol2", name: "Sol", diatonicFromSol3: -8, level: 3, freq: 196 },
  { id: "la2", name: "Lá", diatonicFromSol3: -7, level: 3, freq: 220 },
  { id: "si2", name: "Si", diatonicFromSol3: -6, level: 3, freq: 246.94 },
  { id: "do3", name: "Dó", diatonicFromSol3: -5, level: 2, freq: 261.63 },
  { id: "re3", name: "Ré", diatonicFromSol3: -4, level: 2, freq: 293.66 },
  { id: "mi3", name: "Mi", diatonicFromSol3: -3, level: 1, freq: 329.63 },
  { id: "fa3", name: "Fá", diatonicFromSol3: -2, level: 1, freq: 349.23 },
  { id: "sol3", name: "Sol", diatonicFromSol3: 0, level: 1, freq: 392 },
  { id: "la3", name: "Lá", diatonicFromSol3: 1, level: 1, freq: 440 },
  { id: "si3", name: "Si", diatonicFromSol3: 2, level: 1, freq: 493.88 },
  { id: "do4", name: "Dó", diatonicFromSol3: 3, level: 1, freq: 523.25 },
  { id: "re4", name: "Ré", diatonicFromSol3: 4, level: 2, freq: 587.33 },
  { id: "mi4", name: "Mi", diatonicFromSol3: 5, level: 2, freq: 659.25 },
  { id: "fa4", name: "Fá", diatonicFromSol3: 6, level: 2, freq: 698.46 },
  { id: "sol4", name: "Sol", diatonicFromSol3: 7, level: 2, freq: 783.99 },
  { id: "la4", name: "Lá", diatonicFromSol3: 8, level: 3, freq: 880 },
  { id: "si4", name: "Si", diatonicFromSol3: 9, level: 3, freq: 987.77 }
];

const LEVELS = {
  1: { title: "Pentagrama", description: "Notas centrais", defaultTime: 60 },
  2: { title: "Alargamento", description: "Mais notas graves e agudas", defaultTime: 50 },
  3: { title: "Extensão completa", description: "Do Sol grave ao Si agudo", defaultTime: 45 }
};

const ANSWER_NAMES = ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"];

function hasFirebaseConfig(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

function createDatabase(config) {
  try {
    if (!hasFirebaseConfig(config)) return null;
    return getFirestore(initializeApp(config));
  } catch {
    return null;
  }
}

const db = createDatabase(FIREBASE_CONFIG);

function Icon({ children, size = 18 }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, fontSize: size }}>
      {children}
    </span>
  );
}

function getNoteY(diatonicFromSol3) {
  return SOL_LINE_Y - diatonicFromSol3 * STEP;
}

function isLinePosition(y) {
  return Math.round((y - STAFF_TOP) / STEP) % 2 === 0;
}

function getLedgerLines(y) {
  const ledgers = [];

  for (let ledgerY = FIRST_LEDGER_ABOVE; ledgerY >= y; ledgerY -= STAFF_SPACING) {
    ledgers.push(ledgerY);
  }

  for (let ledgerY = FIRST_LEDGER_BELOW; ledgerY <= y; ledgerY += STAFF_SPACING) {
    ledgers.push(ledgerY);
  }

  return ledgers;
}

const ALL_NOTES = RAW_NOTES.map((note) => {
  const y = getNoteY(note.diatonicFromSol3);
  return {
    ...note,
    label: note.name,
    y,
    type: isLinePosition(y) ? "line" : "space",
    ledgers: getLedgerLines(y)
  };
});

function getRandomNote(pool, previousId) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const available = pool.filter((note) => note.id !== previousId);
  const source = available.length ? available : pool;
  return source[Math.floor(Math.random() * source.length)];
}

function runLogicTests() {
  const sol3 = ALL_NOTES.find((note) => note.id === "sol3");
  const si4 = ALL_NOTES.find((note) => note.id === "si4");
  const sol2 = ALL_NOTES.find((note) => note.id === "sol2");
  const do4 = ALL_NOTES.find((note) => note.id === "do4");
  const mi3 = ALL_NOTES.find((note) => note.id === "mi3");
  const oneNote = getRandomNote([sol3].filter(Boolean), sol3?.id);
  const differentNote = getRandomNote([sol3, si4].filter(Boolean), sol3?.id);
  const allYPositionsAreNumbers = ALL_NOTES.every((note) => Number.isFinite(note.y));
  const allNotesHaveNames = ALL_NOTES.every((note) => ANSWER_NAMES.includes(note.name));
  const allFrequenciesAreValid = ALL_NOTES.every((note) => Number.isFinite(note.freq) && note.freq > 0);
  const uniqueIds = new Set(ALL_NOTES.map((note) => note.id)).size === ALL_NOTES.length;
  const allLevelsAreValid = ALL_NOTES.every((note) => [1, 2, 3].includes(note.level));
  const sortedFromLowToHigh = ALL_NOTES.every((note, index, array) => index === 0 || note.diatonicFromSol3 > array[index - 1].diatonicFromSol3);

  return [
    sol3?.y === SOL_LINE_Y,
    sol3?.type === "line",
    do4?.type === "space",
    mi3?.type === "space",
    si4?.ledgers.includes(FIRST_LEDGER_ABOVE),
    sol2?.ledgers.includes(FIRST_LEDGER_BELOW),
    oneNote?.id === sol3?.id,
    differentNote?.id !== sol3?.id,
    allYPositionsAreNumbers,
    allNotesHaveNames,
    allFrequenciesAreValid,
    uniqueIds,
    allLevelsAreValid,
    sortedFromLowToHigh
  ].every(Boolean);
}

function getLocalScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveLocalScore(scoreEntry) {
  const scores = getLocalScores();
  const updated = [{ ...scoreEntry, id: createLocalId(), createdAtLocal: new Date().toISOString() }, ...scores];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

function filterAndSortScores(scores, mode, level) {
  return scores
    .filter((item) => item.mode === mode && item.level === level)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 20);
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Staff({ note, reveal }) {
  return (
    <div className="staffCard">
      <svg viewBox="0 -20 520 180" className="staff" aria-label="Pentagrama em clave de sol">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="40" x2="490" y1={STAFF_TOP + i * STAFF_SPACING} y2={STAFF_TOP + i * STAFF_SPACING} className="staffLine" />
        ))}

        <text x="54" y="83" className="clef">𝄞</text>

        {note?.ledgers?.map((ledgerY) => (
          <line key={ledgerY} x1="248" x2="312" y1={ledgerY} y2={ledgerY} className="ledger" />
        ))}

        {note && (
          <>
            <ellipse cx="275" cy={note.y} rx="15" ry="10" className="noteHead" transform={`rotate(-18 275 ${note.y})`} />
            <line x1="288" x2="288" y1={note.y - 4} y2={note.y - 55} className="stem" />
          </>
        )}
      </svg>

      <div className={`answerReveal ${reveal ? "show" : ""}`}>
        {reveal && note ? `Era: ${note.label}` : "Identifica a nota no pentagrama"}
      </div>
    </div>
  );
}

export default function App() {
  const [studentInput, setStudentInput] = useState("");
  const [studentName, setStudentName] = useState("");
  const [mode, setMode] = useState("learn");
  const [level, setLevel] = useState(1);
  const [filter, setFilter] = useState("all");
  const [timeSettings, setTimeSettings] = useState({
    1: LEVELS[1].defaultTime,
    2: LEVELS[2].defaultTime,
    3: LEVELS[3].defaultTime
  });
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [waitingForNextNote, setWaitingForNextNote] = useState(false);
  const [timeLeft, setTimeLeft] = useState(LEVELS[1].defaultTime);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [rankingError, setRankingError] = useState("");

  const audioContextRef = useRef(null);
  const nextNoteTimeoutRef = useRef(null);
  const lastNoteIdRef = useRef(null);
  const answersRef = useRef([]);
  const scoreRef = useRef(0);
  const finishingRef = useRef(false);

  const notePool = useMemo(() => {
    let pool = ALL_NOTES.filter((note) => note.level <= level);

    if (filter === "lines") pool = pool.filter((note) => note.type === "line");
    if (filter === "spaces") pool = pool.filter((note) => note.type === "space");

    return pool.length ? pool : ALL_NOTES.filter((note) => note.level <= level);
  }, [level, filter]);

  const correctCount = useMemo(() => answers.filter((answerItem) => answerItem.correto).length, [answers]);
  const accuracy = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;

  const updateLocalLeaderboard = useCallback(() => {
    setLeaderboard(filterAndSortScores(getLocalScores(), mode, level));
  }, [level, mode]);

  const playTone = useCallback((freq) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioContext();

      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }, []);

  const clearNextNoteTimeout = useCallback(() => {
    if (nextNoteTimeoutRef.current) {
      clearTimeout(nextNoteTimeoutRef.current);
      nextNoteTimeoutRef.current = null;
    }
  }, []);

  const pickAndSetNote = useCallback((pool = notePool) => {
    const next = getRandomNote(pool, lastNoteIdRef.current);
    if (!next) return;

    lastNoteIdRef.current = next.id;
    setCurrent(next);
    setLastAnswer(null);
    setWaitingForNextNote(false);
    playTone(next.freq);
  }, [notePool, playTone]);

  const finishGame = useCallback(async () => {
    if (finishingRef.current) return;

    finishingRef.current = true;
    clearNextNoteTimeout();
    setRunning(false);
    setSaving(true);
    setWaitingForNextNote(false);
    setSaveError("");

    const finalAnswers = answersRef.current;
    const total = finalAnswers.length;
    const correct = finalAnswers.filter((answerItem) => answerItem.correto).length;
    const finalAccuracy = total ? Math.round((correct / total) * 100) : 0;
    const scoreEntry = {
      studentName,
      score: scoreRef.current,
      mode,
      level,
      filter,
      totalAnswers: total,
      correctAnswers: correct,
      accuracy: finalAccuracy
    };

    try {
      if (studentName && total > 0) {
        if (db) {
          await addDoc(collection(db, "scores"), { ...scoreEntry, createdAt: serverTimestamp() });
        } else {
          saveLocalScore(scoreEntry);
          updateLocalLeaderboard();
        }
      }
    } catch {
      try {
        saveLocalScore(scoreEntry);
        updateLocalLeaderboard();
        setSaveError("Não foi possível guardar no Firebase. O resultado foi guardado localmente neste computador.");
      } catch {
        setSaveError("Não foi possível guardar o resultado. Exporta o relatório para não perder os dados.");
      }
    } finally {
      setSaving(false);
      setCurrent(null);
      setLastAnswer(null);
    }
  }, [clearNextNoteTimeout, filter, level, mode, studentName, updateLocalLeaderboard]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (!runLogicTests()) {
      setRankingError("Foram detetadas inconsistências internas nas posições das notas.");
    }
  }, []);

  useEffect(() => {
    setRankingError("");

    if (!db) {
      setRankingError("Firebase não configurado. O ranking está a usar apenas este computador.");
      updateLocalLeaderboard();
      return undefined;
    }

    const scoresQuery = query(
      collection(db, "scores"),
      where("mode", "==", mode),
      where("level", "==", level),
      orderBy("score", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      scoresQuery,
      (snapshot) => {
        setLeaderboard(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      () => {
        setRankingError("Não foi possível carregar o ranking online. Verifica as regras/índices do Firestore.");
        updateLocalLeaderboard();
      }
    );

    return unsubscribe;
  }, [level, mode, updateLocalLeaderboard]);

  useEffect(() => {
    if (!running || mode !== "test") return undefined;

    if (timeLeft <= 0) {
      finishGame();
      return undefined;
    }

    const timer = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [finishGame, mode, running, timeLeft]);

  useEffect(() => () => clearNextNoteTimeout(), [clearNextNoteTimeout]);

  function handleLogin(event) {
    event.preventDefault();
    const clean = studentInput.trim().replace(/\s+/g, " ");
    if (clean.length < 2) return;
    setStudentName(clean);
  }

  function startGame() {
    clearNextNoteTimeout();
    finishingRef.current = false;
    answersRef.current = [];
    scoreRef.current = 0;
    lastNoteIdRef.current = null;
    setSaveError("");
    setScore(0);
    setStreak(0);
    setAnswers([]);
    setTimeLeft(timeSettings[level]);
    setRunning(true);
    setLastAnswer(null);
    setWaitingForNextNote(false);
    pickAndSetNote(notePool);
  }

  function answer(noteName) {
    if (!running || !current || waitingForNextNote) return;

    clearNextNoteTimeout();
    setWaitingForNextNote(true);

    const correct = noteName === current.name;
    const gained = correct ? 10 + Math.min(streak, 5) * 2 : 0;
    const entry = {
      aluno: studentName,
      modo: mode,
      nivel: level,
      filtro: filter,
      nota: current.name,
      notaId: current.id,
      resposta: noteName,
      correto: correct,
      data: new Date().toISOString()
    };

    setLastAnswer({ selected: noteName, correct, expected: current.name });
    setAnswers((previous) => {
      const updated = [...previous, entry];
      answersRef.current = updated;
      return updated;
    });

    if (correct) {
      setScore((previous) => {
        const updated = previous + gained;
        scoreRef.current = updated;
        return updated;
      });
      setStreak((previous) => previous + 1);
    } else {
      setStreak(0);
    }

    nextNoteTimeoutRef.current = setTimeout(() => {
      pickAndSetNote(notePool);
    }, mode === "learn" ? 750 : 450);
  }

  function exportReport() {
    const rows = [
      ["Aluno", "Modo", "Nível", "Filtro", "Nota apresentada", "ID da nota", "Resposta", "Correto", "Data"],
      ...answers.map((answerItem) => [
        answerItem.aluno,
        answerItem.modo,
        answerItem.nivel,
        answerItem.filtro,
        answerItem.nota,
        answerItem.notaId,
        answerItem.resposta,
        answerItem.correto ? "Sim" : "Não",
        answerItem.data
      ])
    ];

    downloadCsv(`${studentName.replaceAll(" ", "_")}_relatorio_clave_sol.csv`, rows);
  }

  function changeStudent() {
    clearNextNoteTimeout();
    finishingRef.current = false;
    answersRef.current = [];
    scoreRef.current = 0;
    lastNoteIdRef.current = null;
    setRunning(false);
    setSaving(false);
    setSaveError("");
    setStudentName("");
    setStudentInput("");
    setCurrent(null);
    setLastAnswer(null);
    setWaitingForNextNote(false);
    setScore(0);
    setStreak(0);
    setAnswers([]);
  }

  if (!studentName) {
    return (
      <main className="loginPage">
        <form className="loginCard" onSubmit={handleLogin}>
          <div className="logoCircle"><Icon size={28}>🎵</Icon></div>
          <h1>Clave de Sol Game</h1>
          <p>Escreve o teu nome completo antes de começares.</p>
          <input
            value={studentInput}
            onChange={(event) => setStudentInput(event.target.value)}
            placeholder="Nome do aluno"
            autoFocus
          />
          <button type="submit" disabled={studentInput.trim().length < 2}>
            Entrar no jogo
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow"><Icon>🎓</Icon> Aluno: {studentName}</p>
          <h1>Clave de Sol Game</h1>
          <p>Notas entre o Sol grave e o Si agudo, com ranking online e relatório individual.</p>
        </div>

        <div className="scoreBox">
          <Icon size={24}>🏆</Icon>
          <strong>{score}</strong>
          <span>pontos</span>
        </div>
      </header>

      <section className="grid">
        <aside className="panel">
          <h2>Configuração</h2>

          <label>Modo</label>
          <div className="segmented">
            <button className={mode === "learn" ? "active" : ""} onClick={() => setMode("learn")} disabled={running}>Aprender</button>
            <button className={mode === "test" ? "active" : ""} onClick={() => setMode("test")} disabled={running}>Teste</button>
          </div>

          <label>Nível</label>
          <div className="levelCards">
            {[1, 2, 3].map((levelNumber) => (
              <button key={levelNumber} className={level === levelNumber ? "level active" : "level"} onClick={() => setLevel(levelNumber)} disabled={running}>
                <strong>{levelNumber}</strong>
                <span>{LEVELS[levelNumber].title}</span>
              </button>
            ))}
          </div>

          <label>Notas</label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} disabled={running}>
            <option value="all">Todas</option>
            <option value="lines">Só linhas</option>
            <option value="spaces">Só espaços</option>
          </select>

          <label>Tempo por nível</label>
          {[1, 2, 3].map((levelNumber) => (
            <div className="timeRow" key={levelNumber}>
              <span>Nível {levelNumber}</span>
              <input
                type="number"
                min="10"
                max="180"
                value={timeSettings[levelNumber]}
                onChange={(event) => {
                  const value = Math.min(180, Math.max(10, Number(event.target.value) || 10));
                  setTimeSettings((previous) => ({ ...previous, [levelNumber]: value }));
                }}
                disabled={running}
              />
              <small>s</small>
            </div>
          ))}

          {!running ? (
            <button className="primary" onClick={startGame} disabled={saving}>Começar</button>
          ) : (
            <button className="danger" onClick={finishGame} disabled={saving}>{saving ? "A guardar..." : "Terminar"}</button>
          )}

          <button className="secondary" onClick={exportReport} disabled={!answers.length}>
            <Icon>⬇️</Icon> Exportar relatório
          </button>

          <button className="ghost" onClick={changeStudent} disabled={running}>
            <Icon>↩️</Icon> Trocar aluno
          </button>

          {saveError && <p className="errorMessage">{saveError}</p>}
        </aside>

        <section className="gamePanel">
          <div className="hud">
            <div><Icon>⏱️</Icon> {mode === "test" ? `${timeLeft}s` : "Sem limite"}</div>
            <div>Sequência: {streak}</div>
            <div>Acerto: {accuracy}%</div>
          </div>

          <Staff note={current} reveal={Boolean(lastAnswer)} />

          {lastAnswer && (
            <div className={lastAnswer.correct ? "feedback ok" : "feedback bad"}>
              {lastAnswer.correct ? "Correto!" : `Ainda não. A resposta certa era ${lastAnswer.expected}.`}
            </div>
          )}

          <div className="answerGrid">
            {ANSWER_NAMES.map((name) => (
              <button key={name} onClick={() => answer(name)} disabled={!running || !current || waitingForNextNote}>
                {name}
              </button>
            ))}
          </div>
        </section>

        <aside className="panel leaderboard">
          <h2><Icon>🏆</Icon> Ranking</h2>
          {rankingError && <p className="errorMessage">{rankingError}</p>}
          {!leaderboard.length && <p>Ainda não há resultados para este modo e nível.</p>}
          {leaderboard.map((item, index) => (
            <div className="rankItem" key={item.id || `${item.studentName}-${index}`}>
              <strong>{index + 1}</strong>
              <div>
                <span>{item.studentName}</span>
                <small>Nível {item.level} · {item.mode === "test" ? "Teste" : "Aprender"} · {item.accuracy ?? 0}%</small>
              </div>
              <b>{item.score}</b>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
