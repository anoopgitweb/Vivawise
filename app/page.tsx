"use client";

import { ChangeEvent, useMemo, useState } from "react";

type View = "home" | "practice" | "progress" | "settings";
type Difficulty = "Foundation" | "Standard" | "Challenge";

const subjects = [
  { name: "Data Structures", unit: "Unit 3", mastery: 74, color: "mint", due: "12 topics" },
  { name: "Database Systems", unit: "Unit 4", mastery: 61, color: "violet", due: "9 topics" },
  { name: "Operating Systems", unit: "Unit 2", mastery: 48, color: "amber", due: "14 topics" },
];

const weakAreas = [
  ["Deadlock prevention", "Operating Systems", "Needs revision"],
  ["Normalization forms", "Database Systems", "Developing"],
  ["AVL tree rotations", "Data Structures", "Developing"],
];

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "practice", label: "Practice", icon: "◉" },
  { id: "progress", label: "Progress", icon: "↗" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function VivaApp() {
  const [view, setView] = useState<View>("home");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Standard");
  const [question, setQuestion] = useState(3);
  const [recording, setRecording] = useState(false);
  const [documents, setDocuments] = useState([
    { name: "B.Tech CSE Semester IV Syllabus.pdf", size: "2.4 MB", status: "Ready", date: "Updated today" },
    { name: "DBMS Reference Notes.pdf", size: "5.8 MB", status: "Ready", date: "Updated 2 days ago" },
  ]);

  function beginPractice() {
    setView("practice");
    setSessionOpen(true);
    setFeedbackOpen(false);
    setQuestion(3);
    setAnswer("");
  }

  function submitAnswer() {
    if (!answer.trim()) return;
    setFeedbackOpen(true);
  }

  function nextQuestion() {
    setQuestion((value) => Math.min(10, value + 1));
    setAnswer("");
    setFeedbackOpen(false);
  }

  function addDocuments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setDocuments((current) => [
      ...files.map((file) => ({
        name: file.name,
        size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`,
        status: "Processing",
        date: "Added just now",
      })),
      ...current,
    ]);
    window.setTimeout(() => {
      setDocuments((current) => current.map((doc) => ({ ...doc, status: "Ready" })));
    }, 1400);
    event.target.value = "";
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => { setView(item.id); if (item.id !== "practice") setSessionOpen(false); }}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-coach">
          <span className="coach-spark">✦</span>
          <strong>AI Coach</strong>
          <p>Your answers are evaluated only against your uploaded syllabus.</p>
          <button onClick={beginPractice}>Start a quick viva</button>
        </div>
        <div className="profile-chip">
          <div className="avatar">AS</div>
          <div><strong>Arjun Sharma</strong><span>B.Tech · Semester IV</span></div>
          <button aria-label="Profile options">•••</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div className="topbar-actions">
            <div className="streak"><span>🔥</span><strong>8</strong><span>day streak</span></div>
            <button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button>
          </div>
        </header>

        {view === "home" && <Dashboard onStart={beginPractice} setView={setView} />}
        {view === "practice" && !sessionOpen && <PracticeSetup difficulty={difficulty} setDifficulty={setDifficulty} onStart={beginPractice} />}
        {view === "progress" && <Progress />}
        {view === "settings" && <Settings documents={documents} addDocuments={addDocuments} />}
        {view === "practice" && sessionOpen && (
          <VivaSession
            answer={answer}
            setAnswer={setAnswer}
            question={question}
            recording={recording}
            setRecording={setRecording}
            feedbackOpen={feedbackOpen}
            submitAnswer={submitAnswer}
            nextQuestion={nextQuestion}
            onExit={() => { setSessionOpen(false); setView("home"); }}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setSessionOpen(false); }}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function Brand() {
  return <div className="brand"><span className="brand-mark">V</span><span>Viva<span>wise</span></span></div>;
}

function Dashboard({ onStart, setView }: { onStart: () => void; setView: (view: View) => void }) {
  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div><span className="eyebrow">WEDNESDAY, 22 JULY</span><h1>Good afternoon, Arjun.</h1><p>One focused session today will keep your momentum going.</p></div>
        <button className="primary-button desktop-action" onClick={onStart}><span>▶</span> Start practice</button>
      </div>

      <section className="readiness-card">
        <div className="readiness-copy">
          <span className="card-kicker">YOUR VIVA READINESS</span>
          <div className="score-row"><strong>68</strong><span>/100</span><em>+6 this week</em></div>
          <h2>You&apos;re building strong foundations.</h2>
          <p>Focus on Operating Systems and concise explanations to move into the exam-ready zone.</p>
          <button className="light-button" onClick={onStart}>Continue today&apos;s plan <span>→</span></button>
        </div>
        <div className="readiness-visual">
          <div className="orbital-score"><span>68%</span><small>READY</small></div>
          <div className="floating-note note-one"><span>✓</span><div><strong>32 answers</strong><small>evaluated</small></div></div>
          <div className="floating-note note-two"><span>↗</span><div><strong>74%</strong><small>best topic</small></div></div>
        </div>
      </section>

      <div className="section-title"><div><h2>Your subjects</h2><p>Practice by syllabus topic</p></div><button onClick={() => setView("settings")}>Manage syllabus →</button></div>
      <div className="subject-grid">
        {subjects.map((subject) => (
          <button className="subject-card" key={subject.name} onClick={onStart}>
            <div className={`subject-icon ${subject.color}`}>{subject.name.slice(0, 2).toUpperCase()}</div>
            <div className="subject-meta"><span>{subject.unit}</span><span>•</span><span>{subject.due}</span></div>
            <h3>{subject.name}</h3>
            <div className="mastery-label"><span>Mastery</span><strong>{subject.mastery}%</strong></div>
            <div className="progress-track"><i style={{ width: `${subject.mastery}%` }} /></div>
            <div className="card-link">Practice this subject <span>→</span></div>
          </button>
        ))}
      </div>

      <div className="dashboard-lower">
        <section className="activity-panel">
          <div className="section-title compact"><div><h2>Practice activity</h2><p>Last 7 days</p></div><button onClick={() => setView("progress")}>View report</button></div>
          <div className="chart" aria-label="Seven day practice activity chart">
            {[42, 68, 34, 84, 60, 92, 55].map((height, index) => <div className="bar-column" key={index}><i style={{ height: `${height}%` }} className={index === 5 ? "peak" : ""} /><span>{["T", "F", "S", "S", "M", "T", "W"][index]}</span></div>)}
          </div>
        </section>
        <section className="next-panel">
          <span className="card-kicker dark">NEXT MILESTONE</span>
          <div className="milestone-icon">◎</div>
          <h3>Confident Speaker</h3><p>Complete 3 more voice-based answers with a clarity score above 75%.</p>
          <div className="progress-track"><i style={{ width: "60%" }} /></div><small>6 of 10 completed</small>
        </section>
      </div>
    </div>
  );
}

function PracticeSetup({ difficulty, setDifficulty, onStart }: { difficulty: Difficulty; setDifficulty: (value: Difficulty) => void; onStart: () => void }) {
  return <div className="page narrow-page">
    <div className="page-heading"><div><span className="eyebrow">PERSONALISED PRACTICE</span><h1>Build your next viva</h1><p>Choose a subject and let your AI examiner adapt to every answer.</p></div></div>
    <section className="setup-card">
      <div className="setup-step"><span>1</span><div><h3>Choose a subject</h3><p>Your uploaded syllabus controls the scope.</p></div></div>
      <div className="choice-grid">{subjects.map((subject, i) => <button className={i === 0 ? "choice selected" : "choice"} key={subject.name}><span className={`subject-icon ${subject.color}`}>{subject.name.slice(0, 2).toUpperCase()}</span><div><strong>{subject.name}</strong><small>{subject.unit} · {subject.due}</small></div><i>✓</i></button>)}</div>
      <div className="setup-step"><span>2</span><div><h3>Set the challenge</h3><p>You can change this during the session.</p></div></div>
      <div className="difficulty-row">{(["Foundation", "Standard", "Challenge"] as Difficulty[]).map((value) => <button className={difficulty === value ? "selected" : ""} key={value} onClick={() => setDifficulty(value)}><strong>{value}</strong><small>{value === "Foundation" ? "Recall & explain" : value === "Standard" ? "Apply & compare" : "Defend & analyse"}</small></button>)}</div>
      <div className="session-summary"><div><span>10</span><small>questions</small></div><div><span>~18</span><small>minutes</small></div><div><span>Voice</span><small>or keyboard</small></div><button className="primary-button" onClick={onStart}>Begin viva <span>→</span></button></div>
    </section>
  </div>;
}

function VivaSession(props: { answer: string; setAnswer: (value: string) => void; question: number; recording: boolean; setRecording: (value: boolean) => void; feedbackOpen: boolean; submitAnswer: () => void; nextQuestion: () => void; onExit: () => void }) {
  const progress = props.question * 10;
  return <div className="session-page">
    <header className="session-header"><button onClick={props.onExit}>← <span>Exit session</span></button><div><strong>Data Structures</strong><span>Standard practice</span></div><span className="session-counter">{props.question} / 10</span></header>
    <div className="session-progress"><i style={{ width: `${progress}%` }} /></div>
    <div className="session-content">
      <div className="examiner"><div className="examiner-avatar">AI<span /></div><div><strong>Your examiner</strong><span>Listening carefully</span></div></div>
      <div className="question-label">QUESTION {props.question}</div>
      <h1>Why is the time complexity of searching in a balanced binary search tree logarithmic?</h1>
      <p className="question-hint">Explain the relationship between the tree height and the number of nodes. Use an example if helpful.</p>
      {!props.feedbackOpen ? <>
        <div className={props.recording ? "answer-box recording" : "answer-box"}>
          <textarea value={props.answer} onChange={(e) => props.setAnswer(e.target.value)} placeholder="Explain your answer here, or tap the microphone to speak…" aria-label="Your viva answer" />
          <div className="answer-tools"><span>{props.answer.length} characters</span><button className="mic-button" onClick={() => props.setRecording(!props.recording)} aria-label="Record answer">{props.recording ? "■" : "●"}</button><button className="submit-button" disabled={!props.answer.trim()} onClick={props.submitAnswer}>Submit answer →</button></div>
        </div>
        <div className="session-help"><button>💡 Give me a hint</button><button>↷ Skip this question</button></div>
      </> : <Feedback onNext={props.nextQuestion} />}
    </div>
  </div>;
}

function Feedback({ onNext }: { onNext: () => void }) {
  return <section className="feedback-card">
    <div className="feedback-top"><div className="feedback-score"><strong>8.2</strong><span>/10</span></div><div><span className="result-pill">STRONG ANSWER</span><h3>Clear concept, with one missing detail.</h3></div></div>
    <div className="feedback-columns"><div><h4><span>✓</span> What you explained well</h4><ul><li>Connected search time directly to tree height.</li><li>Correctly stated that each comparison removes half the search space.</li></ul></div><div><h4><span>+</span> Add this to make it complete</h4><p>Mention that a balanced tree with <em>n</em> nodes has height proportional to log₂(n), which formally establishes O(log n).</p></div></div>
    <div className="delivery-scores"><span>Concept <strong>88%</strong></span><span>Clarity <strong>82%</strong></span><span>Completeness <strong>76%</strong></span></div>
    <div className="feedback-actions"><button className="ghost-button">View model answer</button><button className="primary-button" onClick={onNext}>Next question →</button></div>
  </section>;
}

function Progress() {
  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">LEARNING ANALYTICS</span><h1>Your progress</h1><p>Understand what is improving and exactly where to focus next.</p></div><select aria-label="Report period"><option>Last 30 days</option><option>This semester</option></select></div>
    <div className="metric-grid"><Metric value="68" label="Readiness score" change="+6 this week" /><Metric value="142" label="Questions practised" change="23 this week" /><Metric value="81%" label="Average clarity" change="+4% this month" /><Metric value="7h 24m" label="Focused practice" change="12 sessions" /></div>
    <div className="analytics-grid">
      <section className="analytics-card span-two"><div className="section-title compact"><div><h2>Readiness trend</h2><p>Your score is moving toward exam-ready</p></div><span className="result-pill">ON TRACK</span></div><div className="line-chart"><div className="grid-line g1"/><div className="grid-line g2"/><div className="trend-fill"/><div className="trend-line"/><span className="trend-point p1"/><span className="trend-point p2"/><span className="trend-point p3"/><span className="trend-point p4"/><div className="chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>This week</span></div></div></section>
      <section className="analytics-card"><h2>Answer quality</h2><p className="muted">Average across all sessions</p><div className="quality-ring"><strong>7.8</strong><span>out of 10</span></div><div className="quality-legend"><span><i className="green"/>Concept accuracy <strong>84%</strong></span><span><i className="blue"/>Clarity <strong>81%</strong></span><span><i className="yellow"/>Completeness <strong>70%</strong></span></div></section>
      <section className="analytics-card span-two"><h2>Topics needing attention</h2><p className="muted">Prioritised from your recent answers</p><div className="weak-list">{weakAreas.map(([title, subject, state], index) => <div key={title}><span className="weak-rank">0{index + 1}</span><div><strong>{title}</strong><small>{subject}</small></div><span className={`status status-${index}`}>{state}</span><button>Practice →</button></div>)}</div></section>
      <section className="analytics-card insight"><span>✦</span><h2>Coach&apos;s insight</h2><p>Your accuracy is strong. To improve viva performance, practise giving the key definition in your first sentence before adding examples.</p><button>Try a clarity drill →</button></section>
    </div>
  </div>;
}

function Metric({ value, label, change }: { value: string; label: string; change: string }) { return <div className="metric-card"><strong>{value}</strong><span>{label}</span><small>↗ {change}</small></div>; }

function Settings({ documents, addDocuments }: { documents: { name: string; size: string; status: string; date: string }[]; addDocuments: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const [tab, setTab] = useState("syllabus");
  const totalSize = useMemo(() => documents.length, [documents]);
  return <div className="page settings-page">
    <div className="page-heading"><div><span className="eyebrow">COURSE CONFIGURATION</span><h1>Settings & syllabus</h1><p>Control what your examiner can ask and how your practice sessions behave.</p></div><span className="save-state">✓ All changes saved</span></div>
    <div className="settings-layout">
      <aside className="settings-nav">{[["syllabus","▤","Syllabus & documents"],["examiner","✦","AI examiner"],["practice","◷","Practice preferences"],["profile","○","Student profile"],["privacy","◇","Privacy & data"]].map(([id, icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>)}</aside>
      <section className="settings-content">
        {tab === "syllabus" ? <>
          <div className="content-heading"><div><h2>Syllabus & learning material</h2><p>Questions and evaluations will be grounded in these documents.</p></div><span className="document-count">{totalSize} documents</span></div>
          <label className="upload-zone"><input type="file" multiple accept=".pdf,.doc,.docx,.txt" onChange={addDocuments}/><span className="upload-icon">⇧</span><strong>Drop documents here or <u>browse files</u></strong><small>PDF, DOCX or TXT · Maximum 25 MB per file</small></label>
          <div className="document-list"><div className="document-list-head"><span>DOCUMENT</span><span>STATUS</span><span>LAST UPDATED</span><span /></div>{documents.map((doc) => <div className="document-row" key={`${doc.name}-${doc.date}`}><div className="file-cell"><span className="file-icon">PDF</span><div><strong>{doc.name}</strong><small>{doc.size}</small></div></div><span className={doc.status === "Ready" ? "ready-status" : "processing-status"}>{doc.status === "Ready" ? "✓" : "◌"} {doc.status}</span><span className="date-cell">{doc.date}</span><button aria-label={`Options for ${doc.name}`}>•••</button></div>)}</div>
          <div className="knowledge-card"><span>✦</span><div><strong>Knowledge base is ready</strong><p>{documents.length} documents have been organised into 35 topics. New uploads are automatically indexed and connected to the correct unit.</p></div><button>Review topics →</button></div>
        </> : <PreferencePanel tab={tab} />}
      </section>
    </div>
  </div>;
}

function PreferencePanel({ tab }: { tab: string }) {
  const titles: Record<string, [string,string]> = { examiner: ["AI examiner", "Choose how the examiner questions and evaluates you."], practice: ["Practice preferences", "Set comfortable defaults for every session."], profile: ["Student profile", "Keep course and learning information accurate."], privacy: ["Privacy & data", "Control your documents, answers and stored progress."] };
  const [title, description] = titles[tab];
  return <><div className="content-heading"><div><h2>{title}</h2><p>{description}</p></div></div><div className="preference-form">
    <label><span>Examiner style</span><select><option>Supportive but rigorous</option><option>Neutral university examiner</option><option>Strict external examiner</option></select></label>
    <label><span>Response language</span><select><option>English</option><option>English + Hindi support</option><option>Hindi</option></select></label>
    <label className="toggle-row"><div><strong>Adaptive follow-up questions</strong><small>Probe deeper when an answer is incomplete or especially strong.</small></div><input type="checkbox" defaultChecked /></label>
    <label className="toggle-row"><div><strong>Show feedback after every answer</strong><small>Turn off to simulate a formal uninterrupted viva.</small></div><input type="checkbox" defaultChecked /></label>
    <label className="toggle-row"><div><strong>Save voice transcripts</strong><small>Keep transcripts with session history for later review.</small></div><input type="checkbox" /></label>
    <button className="primary-button">Save preferences</button>
  </div></>;
}
