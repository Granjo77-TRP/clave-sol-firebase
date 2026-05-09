import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  limit
} from "firebase/firestore";
import { Trophy, Music, GraduationCap, Timer, Download, RotateCcw } from "lucide-react";
import { db } from "./firebase";

const ALL_NOTES = [
  { id: "mi1", name: "Mi", octave: 1, y: 90, type: "linha", level: 1, freq: 329.63 },
  { id: "fa1", name: "Fá", octave: 1, y: 82, type: "espaco", level: 1, freq: 349.23 },
  { id: "sol1", name: "Sol", octave: 1, y: 74, type: "linha", level: 1, freq: 392.0 },
  { id: "la1", name: "Lá", octave: 1, y: 66, type: "espaco", level: 2, freq: 440.0 },
  { id: "si1", name: "Si", octave: 1, y: 58, type: "linha", level: 2, freq: 493.88 },
  { id: "do2", name: "Dó", octave: 2, y: 50, type: "espaco", level: 2, freq: 523.25 },
  { id: "re2", name: "Ré", octave: 2, y: 42, type: "linha", level: 3, freq: 587.33 },
  { id: "mi2", name: "Mi", octave: 2, y: 34, type: "espaco", level: 3, freq: 659.25 },
  { id: "fa2", name: "Fá", octave: 2, y: 26, type: "linha", level: 3, freq: 698.46 }
];

const LEVELS = {
  1: { title: "Explorador", description: "Notas iniciais", defaultTime: 60 },
  2: { title: "Leitor Musical", description: "Mais notas no pentagrama", defaultTime: 50 },
  3: { title: "Mestre da Clave", description: "Pentagrama completo", defaultTime: 40 }
};

const ANSWER_NAMES = ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"];

function playTone(freq) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
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
  } catch {
    // Sem som se o browser bloquear áudio.
  }
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Staff({ note, reveal }) {
  return (
    <div className="staffCard">
      <svg viewBox="0 0 520 140" className="staff">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="40" x2="490" y1={42 + i * 16} y2={42 + i * 16} />
        ))}

        <text x="54" y="99" className="clef">𝄞</text>

        {note && (
          <>
            <ellipse cx="275" cy={note.y} rx="15" ry="10" className="noteHead" transform={`rotate(-18 275 ${note.y})`} />
            <line x1="288" x2="288" y1={note.y - 4} y2={note.y - 55} className="stem" />
            {note.y < 42 && <line x1="252" x2="310" y1="26" y2="26" className="ledger" />}
          </>
        )}
      </svg>

      <div className={`answerReveal ${reveal ? "show" : ""}`}>
        {reveal && note ? `Era: ${note.name}` : "Identifica a nota no pentagrama"}
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
  const [timeLeft, setTimeLeft] = useState(timeSettings[1]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [saving, setSaving] = useState(false);

  const notePool = useMemo(() => {
    let pool = ALL_NOTES.filter((n) => n.level <= level);
    if (filter === "lines") pool = pool.filter((n) => n.type === "linha");
    if (filter === "spaces") pool = pool.filter((n) => n.type === "espaco");
    return pool.length ? pool : ALL_NOTES.filter((n) => n.level <= level);
  }, [level, filter]);

  useEffect(() => {
    const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      setLeaderboard(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!running || mode !== "test") return;

    if (timeLeft <= 0) {
      finishGame();
      return;
    }

    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [running, mode, timeLeft]);

  function pickNote() {
    const next = notePool[Math.floor(Math.random() * notePool.length)];
    setCurrent(next);
    setLastAnswer(null);
    playTone(next.freq);
  }

  function handleLogin(e) {
    e.preventDefault();
    const clean = studentInput.trim();
    if (clean.length < 2) return;
    setStudentName(clean);
  }

  function startGame() {
    setScore(0);
    setStreak(0);
    setAnswers([]);
    setTimeLeft(timeSettings[level]);
    setRunning(true);
    setLastAnswer(null);
    setTimeout(pickNote, 0);
  }

  function answer(noteName) {
    if (!running || !current) return;

    const correct = noteName === current.name;
    const gained = correct ? 10 + Math.min(streak, 5) * 2 : 0;

    setLastAnswer({ selected: noteName, correct, expected: current.name });
    setAnswers((prev) => [
      ...prev,
      {
        aluno: studentName,
        modo: mode,
        nivel: level,
        filtro: filter,
        nota: current.name,
        resposta: noteName,
        correto: correct,
        data: new Date().toISOString()
      }
    ]);

    if (correct) {
      setScore((s) => s + gained);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    setTimeout(pickNote, mode === "learn" ? 750 : 450);
  }

  async function finishGame() {
    setRunning(false);
    setSaving(true);

    const total = answers.length;
    const correct = answers.filter((a) => a.correto).length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    try {
      await addDoc(collection(db, "scores"), {
        studentName,
        score,
        mode,
        level,
        filter,
        totalAnswers: total,
        correctAnswers: correct,
        accuracy,
        createdAt: serverTimestamp()
      });
    } finally {
      setSaving(false);
    }
  }

  function exportReport() {
    const rows = [
      ["Aluno", "Modo", "Nível", "Filtro", "Nota apresentada", "Resposta", "Correto", "Data"],
      ...answers.map((a) => [
        a.aluno,
        a.modo,
        a.nivel,
        a.filtro,
        a.nota,
        a.resposta,
        a.correto ? "Sim" : "Não",
        a.data
      ])
    ];

    downloadCsv(`${studentName.replaceAll(" ", "_")}_relatorio_clave_sol.csv`, rows);
  }

  const correctCount = answers.filter((a) => a.correto).length;
  const accuracy = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;

  if (!studentName) {
    return (
      <main className="loginPage">
        <form className="loginCard" onSubmit={handleLogin}>
          <div className="logoCircle"><Music /></div>
          <h1>Clave de Sol Game</h1>
          <p>Escreve o teu nome completo antes de começares.</p>
          <input
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
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
          <p className="eyebrow"><GraduationCap size={16} /> Aluno: {studentName}</p>
          <h1>Clave de Sol Game</h1>
          <p>Treina a identificação das notas no pentagrama, com ranking online e relatório individual.</p>
        </div>

        <div className="scoreBox">
          <Trophy />
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
            {[1, 2, 3].map((n) => (
              <button key={n} className={level === n ? "level active" : "level"} onClick={() => setLevel(n)} disabled={running}>
                <strong>{n}</strong>
                <span>{LEVELS[n].title}</span>
              </button>
            ))}
          </div>

          <label>Notas</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} disabled={running}>
            <option value="all">Todas</option>
            <option value="lines">Só linhas</option>
            <option value="spaces">Só espaços</option>
          </select>

          <label>Tempo por nível</label>
          {[1, 2, 3].map((n) => (
            <div className="timeRow" key={n}>
              <span>Nível {n}</span>
              <input
                type="number"
                min="10"
                max="180"
                value={timeSettings[n]}
                onChange={(e) =>
                  setTimeSettings((prev) => ({ ...prev, [n]: Number(e.target.value) }))
                }
                disabled={running}
              />
              <small>s</small>
            </div>
          ))}

          {!running ? (
            <button className="primary" onClick={startGame}>Começar</button>
          ) : (
            <button className="danger" onClick={finishGame}>Terminar</button>
          )}

          <button className="secondary" onClick={exportReport} disabled={!answers.length}>
            <Download size={16} /> Exportar relatório
          </button>

          <button className="ghost" onClick={() => setStudentName("")} disabled={running}>
            <RotateCcw size={16} /> Trocar aluno
          </button>
        </aside>

        <section className="gamePanel">
          <div className="hud">
            <div><Timer size={16} /> {mode === "test" ? `${timeLeft}s` : "Sem limite"}</div>
            <div>Sequência: {streak}</div>
            <div>Acerto: {accuracy}%</div>
          </div>

          <Staff note={current} reveal={Boolean(lastAnswer)} />

          {lastAnswer && (
            <div className={lastAnswer.correct ? "feedback ok" : "feedback bad"}>
              {lastAnswer.correct
                ? "Correto!"
                : `Ainda não. A resposta certa era ${lastAnswer.expected}.`}
            </div>
          )}

          <div className="answerGrid">
            {ANSWER_NAMES.map((name) => (
              <button key={name} onClick={() => answer(name)} disabled={!running}>
                {name}
              </button>
            ))}
          </div>
        </section>

        <aside className="panel leaderboard">
          <h2><Trophy size={18} /> Ranking online</h2>
          {!leaderboard.length && <p>Ainda não há resultados.</p>}
          {leaderboard.map((item, index) => (
            <div className="rankItem" key={item.id}>
              <strong>{index + 1}</strong>
              <div>
                <span>{item.studentName}</span>
                <small>Nível {item.level} · {item.accuracy ?? 0}%</small>
              </div>
              <b>{item.score}</b>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
