"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type View =
  | "home"
  | "practice"
  | "progress"
  | "settings"
  | "admin"
  | "admin_vivas"
  | "admin_assign"
  | "admin_users"
  | "admin_results"
  | "admin_usage";
type Difficulty = "Foundation" | "Standard" | "Challenge";
type DocumentRecord = {
  id?: string;
  name: string;
  size: string;
  status: string;
  date: string;
  error?: string;
};
type VivaFeedback = {
  score: number;
  maxScore: number;
  verdict: string;
  summary: string;
  correctPoints: string[];
  missingPoints: string[];
  incorrectClaims: string[];
  conceptScore: number;
  clarityScore: number;
  completenessScore: number;
  modelAnswer: string;
  nextQuestion: string;
  nextHint: string;
  nextTopic: string;
  sourceBasis: string;
  completed?: boolean;
  demo?: boolean;
};
type AssignedTopic = {
  id: string;
  title: string;
  subject: string;
  description: string;
  difficulty: Difficulty;
  documentCount: number;
};

const subjects = [
  {
    name: "Data Structures",
    unit: "Unit 3",
    mastery: 74,
    color: "mint",
    due: "12 topics",
  },
  {
    name: "Database Systems",
    unit: "Unit 4",
    mastery: 61,
    color: "violet",
    due: "9 topics",
  },
  {
    name: "Operating Systems",
    unit: "Unit 2",
    mastery: 48,
    color: "amber",
    due: "14 topics",
  },
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
  { id: "admin", label: "Create Viva", icon: "+" },
  { id: "admin_vivas", label: "Existing Vivas", icon: "V" },
  { id: "admin_assign", label: "Assign Vivas", icon: "A" },
  { id: "admin_users", label: "Users", icon: "U" },
  { id: "admin_results", label: "Results", icon: "R" },
  { id: "admin_usage", label: "Usage", icon: "↗" },
];

export default function VivaApp() {
  const [role, setRole] = useState<"student" | "admin" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    fullName: string;
    role: "student" | "admin";
  } | null>(null);
  const [view, setView] = useState<View>("home");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Standard");
  const [question, setQuestion] = useState(1);
  const [recording, setRecording] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentError, setDocumentError] = useState("");
  const [assignedTopics, setAssignedTopics] = useState<AssignedTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<AssignedTopic | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/documents")
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Could not load documents",
          );
        return response.json();
      })
      .then((data) =>
        setDocuments(
          (data.documents ?? []).map(
            (doc: {
              id: string;
              fileName: string;
              sizeBytes: number;
              status: string;
              createdAt: number;
              errorMessage?: string;
            }) => ({
              id: doc.id,
              name: doc.fileName,
              size: formatBytes(doc.sizeBytes),
              status: titleCase(doc.status),
              date: formatDate(doc.createdAt),
              error: doc.errorMessage,
            }),
          ),
        ),
      )
      .catch(() => {
        /* Local bindings are unavailable until configured; upload will show the actionable error. */
      });
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setCurrentUser(d.user);
        setRole(d.user.role);
        setView(d.user.role === "admin" ? "admin" : "home");
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/assignments")
      .then((r) => r.json())
      .then((data) => {
        setAssignedTopics(data.topics ?? []);
        setSelectedTopic((current) => current ?? data.topics?.[0] ?? null);
      })
      .catch(() => {});
  }, [view]);

  function beginPractice(topic?: AssignedTopic) {
    const chosen = topic ?? selectedTopic ?? assignedTopics[0];
    if (!chosen) {
      setView("practice");
      setSessionOpen(false);
      return;
    }
    setSelectedTopic(chosen);
    setView("practice");
    setSessionOpen(true);
    setFeedbackOpen(false);
    setQuestion(1);
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

  async function addDocuments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setDocumentError("");
    setDocuments((current) => [
      ...files.map((file) => ({
        name: file.name,
        size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`,
        status: "Processing",
        date: "Added just now",
      })),
      ...current,
    ]);
    event.target.value = "";
    for (const file of files) {
      try {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/documents", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");
        setDocuments((current) =>
          current.map((doc) =>
            doc.name === file.name && doc.status === "Processing"
              ? {
                  id: data.document.id,
                  name: data.document.fileName,
                  size: formatBytes(data.document.sizeBytes),
                  status: "Ready",
                  date: "Added just now",
                }
              : doc,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        setDocumentError(message);
        setDocuments((current) =>
          current.map((doc) =>
            doc.name === file.name && doc.status === "Processing"
              ? { ...doc, status: "Failed", error: message }
              : doc,
          ),
        );
      }
    }
  }

  if (authLoading)
    return (
      <main className="role-page">
        <div className="role-panel">
          <Brand />
          <p>Checking your Vivawise account…</p>
        </div>
      </main>
    );
  if (!role)
    return (
      <AuthScreen
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setRole(user.role);
          setView(user.role === "admin" ? "admin" : "home");
        }}
      />
    );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          {navItems
            .filter((item) =>
              role === "admin"
                ? item.id.startsWith("admin")
                : !item.id.startsWith("admin"),
            )
            .map((item) => (
              <button
                className={view === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  if (item.id !== "practice") setSessionOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
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
          <div>
            <strong>{currentUser?.fullName || "Vivawise User"}</strong>
            <span>
              {currentUser?.role === "admin"
                ? "Administrator"
                : currentUser?.email}
            </span>
          </div>
          <button aria-label="Profile options">•••</button>
        </div>
        <button
          className="switch-role"
          onClick={async () => {
            await fetch("/api/auth", { method: "DELETE" });
            setCurrentUser(null);
            setRole(null);
            setSessionOpen(false);
          }}
        >
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="topbar-actions">
            <div className="streak">
              <span>🔥</span>
              <strong>8</strong>
              <span>day streak</span>
            </div>
            <button className="icon-button" aria-label="Notifications">
              ♢<span className="notification-dot" />
            </button>
          </div>
        </header>

        {view === "home" && (
          <Dashboard onStart={() => beginPractice()} setView={setView} />
        )}
        {view === "practice" && !sessionOpen && (
          <PracticeSetup
            topics={assignedTopics}
            selected={selectedTopic}
            setSelected={setSelectedTopic}
            onStart={() => beginPractice()}
          />
        )}
        {view === "progress" && <Progress />}
        {view === "settings" && (
          <Settings
            documents={documents}
            addDocuments={addDocuments}
            documentError={documentError}
          />
        )}
        {view === "admin" && <AdminPanel mode="create" />}
        {view === "admin_vivas" && <AdminPanel mode="existing" />}
        {view === "admin_assign" && <AdminPanel mode="assign" />}
        {view === "admin_users" && <AdminSummaryPanel section="users" />}
        {view === "admin_results" && <AdminSummaryPanel section="results" />}
        {view === "admin_usage" && <AdminSummaryPanel section="usage" />}
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
            onExit={() => {
              setSessionOpen(false);
              setView("home");
            }}
            topic={selectedTopic!}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems
          .filter((item) =>
            role === "admin"
              ? item.id.startsWith("admin")
              : !item.id.startsWith("admin"),
          )
          .map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setSessionOpen(false);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
      </nav>
    </main>
  );
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: {
    email: string;
    fullName: string;
    role: "student" | "admin";
  }) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, fullName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (!d.ok) {
        setError(d.message || "Please confirm your email.");
        return;
      }
      const s = await fetch("/api/auth");
      const session = await s.json();
      if (!s.ok) throw new Error(session.error || "Could not load profile");
      onAuthenticated(session.user);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="role-page">
      <form className="role-panel auth-panel" onSubmit={submit}>
        <Brand />
        <span className="eyebrow">
          {mode === "login" ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}
        </span>
        <h1>{mode === "login" ? "Sign in to Vivawise" : "Join Vivawise"}</h1>
        <p>
          The first account registered becomes the administrator. Later accounts
          are students.
        </p>
        {mode === "signup" && (
          <label>
            Full name
            <input
              value={fullName}
              required
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            minLength={8}
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="settings-error">{error}</div>}
        <button className="primary-button" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "New to Vivawise? Create an account"
            : "Already registered? Sign in"}
        </button>
      </form>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">V</span>
      <span>
        Viva<span>wise</span>
      </span>
    </div>
  );
}

function Dashboard({
  onStart,
  setView,
}: {
  onStart: () => void;
  setView: (view: View) => void;
}) {
  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WEDNESDAY, 22 JULY</span>
          <h1>Good afternoon, Arjun.</h1>
          <p>One focused session today will keep your momentum going.</p>
        </div>
        <button className="primary-button desktop-action" onClick={onStart}>
          <span>▶</span> Start practice
        </button>
      </div>

      <section className="readiness-card">
        <div className="readiness-copy">
          <span className="card-kicker">YOUR VIVA READINESS</span>
          <div className="score-row">
            <strong>68</strong>
            <span>/100</span>
            <em>+6 this week</em>
          </div>
          <h2>You&apos;re building strong foundations.</h2>
          <p>
            Focus on Operating Systems and concise explanations to move into the
            exam-ready zone.
          </p>
          <button className="light-button" onClick={onStart}>
            Continue today&apos;s plan <span>→</span>
          </button>
        </div>
        <div className="readiness-visual">
          <div className="orbital-score">
            <span>68%</span>
            <small>READY</small>
          </div>
          <div className="floating-note note-one">
            <span>✓</span>
            <div>
              <strong>32 answers</strong>
              <small>evaluated</small>
            </div>
          </div>
          <div className="floating-note note-two">
            <span>↗</span>
            <div>
              <strong>74%</strong>
              <small>best topic</small>
            </div>
          </div>
        </div>
      </section>

      <div className="section-title">
        <div>
          <h2>Your subjects</h2>
          <p>Practice by syllabus topic</p>
        </div>
        <button onClick={() => setView("settings")}>Manage syllabus →</button>
      </div>
      <div className="subject-grid">
        {subjects.map((subject) => (
          <button className="subject-card" key={subject.name} onClick={onStart}>
            <div className={`subject-icon ${subject.color}`}>
              {subject.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="subject-meta">
              <span>{subject.unit}</span>
              <span>•</span>
              <span>{subject.due}</span>
            </div>
            <h3>{subject.name}</h3>
            <div className="mastery-label">
              <span>Mastery</span>
              <strong>{subject.mastery}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: `${subject.mastery}%` }} />
            </div>
            <div className="card-link">
              Practice this subject <span>→</span>
            </div>
          </button>
        ))}
      </div>

      <div className="dashboard-lower">
        <section className="activity-panel">
          <div className="section-title compact">
            <div>
              <h2>Practice activity</h2>
              <p>Last 7 days</p>
            </div>
            <button onClick={() => setView("progress")}>View report</button>
          </div>
          <div className="chart" aria-label="Seven day practice activity chart">
            {[42, 68, 34, 84, 60, 92, 55].map((height, index) => (
              <div className="bar-column" key={index}>
                <i
                  style={{ height: `${height}%` }}
                  className={index === 5 ? "peak" : ""}
                />
                <span>{["T", "F", "S", "S", "M", "T", "W"][index]}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="next-panel">
          <span className="card-kicker dark">NEXT MILESTONE</span>
          <div className="milestone-icon">◎</div>
          <h3>Confident Speaker</h3>
          <p>
            Complete 3 more voice-based answers with a clarity score above 75%.
          </p>
          <div className="progress-track">
            <i style={{ width: "60%" }} />
          </div>
          <small>6 of 10 completed</small>
        </section>
      </div>
    </div>
  );
}

function PracticeSetup({
  topics,
  selected,
  setSelected,
  onStart,
}: {
  topics: AssignedTopic[];
  selected: AssignedTopic | null;
  setSelected: (topic: AssignedTopic) => void;
  onStart: () => void;
}) {
  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PERSONALISED PRACTICE</span>
          <h1>Build your next viva</h1>
          <p>
            Choose a subject and let your AI examiner adapt to every answer.
          </p>
        </div>
      </div>
      <section className="setup-card">
        <div className="setup-step">
          <span>1</span>
          <div>
            <h3>Your assigned mock vivas</h3>
            <p>Only topics assigned to your signed-in email appear here.</p>
          </div>
        </div>
        {topics.length ? (
          <div className="choice-grid">
            {topics.map((topic) => (
              <button
                className={
                  selected?.id === topic.id ? "choice selected" : "choice"
                }
                onClick={() => setSelected(topic)}
                key={topic.id}
              >
                <span className="subject-icon mint">
                  {topic.subject.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{topic.title}</strong>
                  <small>
                    {topic.subject} · {topic.difficulty} · {topic.documentCount}{" "}
                    docs
                  </small>
                </div>
                <i>✓</i>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-assignment">
            <strong>No mock viva assigned yet</strong>
            <span>
              Ask your administrator to assign a topic to your signed-in email.
            </span>
          </div>
        )}
        <div className="session-summary">
          <div>
            <span>10</span>
            <small>questions</small>
          </div>
          <div>
            <span>~18</span>
            <small>minutes</small>
          </div>
          <div>
            <span>{selected?.difficulty ?? "—"}</span>
            <small>admin-selected</small>
          </div>
          <button
            className="primary-button"
            disabled={!selected}
            onClick={onStart}
          >
            Begin viva <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function VivaSession(props: {
  topic: AssignedTopic;
  answer: string;
  setAnswer: (value: string) => void;
  question: number;
  recording: boolean;
  setRecording: (value: boolean) => void;
  feedbackOpen: boolean;
  submitAnswer: () => void;
  nextQuestion: () => void;
  onExit: () => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [questionText, setQuestionText] = useState(
    "Preparing a syllabus-grounded question…",
  );
  const [hint, setHint] = useState(
    "Your examiner is reviewing the relevant learning material.",
  );
  const [sourceBasis, setSourceBasis] = useState("");
  const [feedback, setFeedback] = useState<VivaFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", topicId: props.topic.id }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not start the viva");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setSessionId(data.sessionId);
        setQuestionText(data.question);
        setHint(data.hint);
        setSourceBasis(data.sourceBasis);
        setMaxQuestions(data.settings?.questionCount || 10);
        setDemoMode(Boolean(data.demo));
      })
      .catch((error) => {
        if (active)
          setApiError(
            error instanceof Error ? error.message : "Could not start the viva",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [props.topic.id]);

  async function evaluateAnswer() {
    if (!props.answer.trim() || loading) return;
    if (!sessionId) {
      setApiError("This viva session could not be started.");
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          sessionId,
          question: questionText,
          answer: props.answer,
          questionNumber: props.question,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Evaluation failed");
      setFeedback(data as VivaFeedback);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  function advance() {
    if (!feedback) return;
    if (feedback.completed) {
      props.onExit();
      return;
    }
    setQuestionText(feedback.nextQuestion);
    setHint(feedback.nextHint);
    setSourceBasis(feedback.sourceBasis);
    setFeedback(null);
    props.nextQuestion();
  }

  const progress = Math.min(100, (props.question / maxQuestions) * 100);
  return (
    <div className="session-page">
      <header className="session-header">
        <button onClick={props.onExit}>
          ← <span>Exit session</span>
        </button>
        <div>
          <strong>{props.topic.title}</strong>
          <span>
            {demoMode ? "Demo mode" : props.topic.difficulty} ·{" "}
            {props.topic.subject}
          </span>
        </div>
        <span className="session-counter">
          {props.question} / {maxQuestions}
        </span>
      </header>
      <div className="session-progress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="session-content">
        <div className="examiner">
          <div className="examiner-avatar">
            AI
            <span />
          </div>
          <div>
            <strong>Your examiner</strong>
            <span>Listening carefully</span>
          </div>
        </div>
        <div className="question-label">QUESTION {props.question}</div>
        <h1>{questionText}</h1>
        <p className="question-hint">{hint}</p>
        {sourceBasis && (
          <p className="source-basis">Grounded in: {sourceBasis}</p>
        )}
        {apiError && (
          <div className="api-notice">
            <strong>Setup needed</strong>
            <span>{apiError}</span>
          </div>
        )}
        {!feedback ? (
          <>
            <div
              className={
                props.recording ? "answer-box recording" : "answer-box"
              }
            >
              <textarea
                value={props.answer}
                onChange={(e) => props.setAnswer(e.target.value)}
                placeholder="Explain your answer here, or tap the microphone to speak…"
                aria-label="Your viva answer"
              />
              <div className="answer-tools">
                <span>{props.answer.length} characters</span>
                <button
                  className="mic-button"
                  onClick={() => props.setRecording(!props.recording)}
                  aria-label="Record answer"
                >
                  {props.recording ? "■" : "●"}
                </button>
                <button
                  className="submit-button"
                  disabled={!props.answer.trim() || loading}
                  onClick={evaluateAnswer}
                >
                  {loading ? "Working…" : "Submit answer →"}
                </button>
              </div>
            </div>
            <div className="session-help">
              <button>💡 Give me a hint</button>
              <button>↷ Skip this question</button>
            </div>
          </>
        ) : (
          <Feedback feedback={feedback} onNext={advance} />
        )}
      </div>
    </div>
  );
}

function Feedback({
  feedback,
  onNext,
}: {
  feedback: VivaFeedback;
  onNext: () => void;
}) {
  if (feedback.completed)
    return (
      <section className="feedback-card completion-card">
        <div className="completion-mark">✓</div>
        <span className="eyebrow">VIVA COMPLETED</span>
        <h2>{feedback.demo ? "Demo attempt completed" : "Test completed"}</h2>
        <div className="completion-score">
          {Number(feedback.score).toFixed(1)}
          <small>/10 on final answer</small>
        </div>
        <p>{feedback.summary}</p>
        {feedback.demo && (
          <div className="api-notice">
            <strong>Demo result</strong>
            <span>
              This demonstrates the completed-test experience and is not
              document-grounded evaluation.
            </span>
          </div>
        )}
        <button className="primary-button" onClick={onNext}>
          Return to dashboard
        </button>
      </section>
    );
  return (
    <section className="feedback-card">
      <div className="feedback-top">
        <div className="feedback-score">
          <strong>{Number(feedback.score).toFixed(1)}</strong>
          <span>/{feedback.maxScore}</span>
        </div>
        <div>
          <span className="result-pill">{feedback.verdict.toUpperCase()}</span>
          <h3>{feedback.summary}</h3>
        </div>
      </div>
      <div className="feedback-columns">
        <div>
          <h4>
            <span>✓</span> What you explained well
          </h4>
          <ul>
            {feedback.correctPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>
            <span>+</span> Add this to make it complete
          </h4>
          {feedback.missingPoints.length ? (
            <ul>
              {feedback.missingPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : (
            <p>Your answer covered the required points.</p>
          )}
          {feedback.incorrectClaims.map((claim) => (
            <p className="incorrect-claim" key={claim}>
              Correction: {claim}
            </p>
          ))}
        </div>
      </div>
      <div className="delivery-scores">
        <span>
          Concept <strong>{Math.round(feedback.conceptScore)}%</strong>
        </span>
        <span>
          Clarity <strong>{Math.round(feedback.clarityScore)}%</strong>
        </span>
        <span>
          Completeness{" "}
          <strong>{Math.round(feedback.completenessScore)}%</strong>
        </span>
      </div>
      <div className="feedback-actions">
        <button className="ghost-button">View model answer</button>
        <button className="primary-button" onClick={onNext}>
          Next question →
        </button>
      </div>
    </section>
  );
}

function Progress() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LEARNING ANALYTICS</span>
          <h1>Your progress</h1>
          <p>Understand what is improving and exactly where to focus next.</p>
        </div>
        <select aria-label="Report period">
          <option>Last 30 days</option>
          <option>This semester</option>
        </select>
      </div>
      <div className="metric-grid">
        <Metric value="68" label="Readiness score" change="+6 this week" />
        <Metric value="142" label="Questions practised" change="23 this week" />
        <Metric value="81%" label="Average clarity" change="+4% this month" />
        <Metric value="7h 24m" label="Focused practice" change="12 sessions" />
      </div>
      <div className="analytics-grid">
        <section className="analytics-card span-two">
          <div className="section-title compact">
            <div>
              <h2>Readiness trend</h2>
              <p>Your score is moving toward exam-ready</p>
            </div>
            <span className="result-pill">ON TRACK</span>
          </div>
          <div className="line-chart">
            <div className="grid-line g1" />
            <div className="grid-line g2" />
            <div className="trend-fill" />
            <div className="trend-line" />
            <span className="trend-point p1" />
            <span className="trend-point p2" />
            <span className="trend-point p3" />
            <span className="trend-point p4" />
            <div className="chart-labels">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>This week</span>
            </div>
          </div>
        </section>
        <section className="analytics-card">
          <h2>Answer quality</h2>
          <p className="muted">Average across all sessions</p>
          <div className="quality-ring">
            <strong>7.8</strong>
            <span>out of 10</span>
          </div>
          <div className="quality-legend">
            <span>
              <i className="green" />
              Concept accuracy <strong>84%</strong>
            </span>
            <span>
              <i className="blue" />
              Clarity <strong>81%</strong>
            </span>
            <span>
              <i className="yellow" />
              Completeness <strong>70%</strong>
            </span>
          </div>
        </section>
        <section className="analytics-card span-two">
          <h2>Topics needing attention</h2>
          <p className="muted">Prioritised from your recent answers</p>
          <div className="weak-list">
            {weakAreas.map(([title, subject, state], index) => (
              <div key={title}>
                <span className="weak-rank">0{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{subject}</small>
                </div>
                <span className={`status status-${index}`}>{state}</span>
                <button>Practice →</button>
              </div>
            ))}
          </div>
        </section>
        <section className="analytics-card insight">
          <span>✦</span>
          <h2>Coach&apos;s insight</h2>
          <p>
            Your accuracy is strong. To improve viva performance, practise
            giving the key definition in your first sentence before adding
            examples.
          </p>
          <button>Try a clarity drill →</button>
        </section>
      </div>
    </div>
  );
}

function Metric({
  value,
  label,
  change,
}: {
  value: string;
  label: string;
  change: string;
}) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>↗ {change}</small>
    </div>
  );
}

type AdminUser = { id: string; email: string; full_name: string };
type AdminAssignment = {
  id: string;
  user_id: string;
  assigned_at: string;
  user?: AdminUser;
};
type AdminAttempt = {
  id: string;
  status: string;
  score?: number;
  started_at: string;
  completed_at?: string;
  user?: AdminUser;
};
type AdminDocument = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  error_message?: string;
};
type AdminTopic = AssignedTopic & {
  instructions?: string;
  document_count?: number;
  assignment_count?: number;
  assignments?: AdminAssignment[];
  attempts?: AdminAttempt[];
  documents?: AdminDocument[];
  question_count?: number;
  time_limit_minutes?: number;
  attempts_allowed?: number;
  pass_mark?: number;
};
function AdminSummaryPanel({
  section,
}: {
  section: "users" | "results" | "usage";
}) {
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/topics")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load admin data");
        return data;
      })
      .then((data) => {
        setTopics(data.topics || []);
        setUsers(data.users || []);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load admin data",
        ),
      );
  }, []);
  const attempts = topics.flatMap((topic) =>
    (topic.attempts || []).map((attempt) => ({
      ...attempt,
      test: topic.title,
    })),
  );
  const completed = attempts.filter(
    (attempt) => attempt.status === "completed",
  );
  const documents = topics.reduce(
    (sum, topic) => sum + (topic.document_count || 0),
    0,
  );
  const assignments = topics.reduce(
    (sum, topic) => sum + (topic.assignment_count || 0),
    0,
  );
  if (error)
    return (
      <div className="page">
        <div className="settings-error">{error}</div>
      </div>
    );
  if (section === "users")
    return (
      <div className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">ADMIN · USERS</span>
            <h1>Registered students</h1>
            <p>
              See each student and the Viva Modules currently assigned to them.
            </p>
          </div>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>STUDENT</span>
            <span>EMAIL</span>
            <span>ASSIGNED MODULES</span>
          </div>
          {users.map((user) => {
            const assigned = topics.filter((topic) =>
              topic.assignments?.some(
                (assignment) => assignment.user_id === user.id,
              ),
            );
            return (
              <div className="admin-table-row" key={user.id}>
                <strong>{user.full_name || "Student"}</strong>
                <span>{user.email}</span>
                <span>
                  {assigned.length
                    ? assigned.map((topic) => topic.title).join(", ")
                    : "None"}
                </span>
              </div>
            );
          })}
          {!users.length && (
            <div className="empty-documents">
              No student accounts registered yet.
            </div>
          )}
        </div>
      </div>
    );
  if (section === "results")
    return (
      <div className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">ADMIN · RESULTS</span>
            <h1>Viva results</h1>
            <p>Review all attempts across students and modules.</p>
          </div>
        </div>
        <div className="admin-table">
          <div className="admin-table-head results">
            <span>STUDENT</span>
            <span>MODULE</span>
            <span>STATUS</span>
            <span>SCORE</span>
            <span>DATE</span>
          </div>
          {attempts.map((attempt) => (
            <div className="admin-table-row results" key={attempt.id}>
              <strong>
                {attempt.user?.full_name || attempt.user?.email || "Student"}
              </strong>
              <span>{attempt.test}</span>
              <span>{attempt.status}</span>
              <span>
                {attempt.status === "completed"
                  ? `${Math.round(Number(attempt.score || 0))}%`
                  : "—"}
              </span>
              <span>
                {new Date(
                  attempt.completed_at || attempt.started_at,
                ).toLocaleString()}
              </span>
            </div>
          ))}
          {!attempts.length && (
            <div className="empty-documents">No attempts recorded yet.</div>
          )}
        </div>
      </div>
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMIN · USAGE</span>
          <h1>Application usage</h1>
          <p>
            Operational activity stored in Supabase. Exact OpenAI token cost
            tracking will be added separately.
          </p>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          value={String(users.length)}
          label="Registered students"
          change="current total"
        />
        <Metric
          value={String(topics.length)}
          label="Viva modules"
          change="current total"
        />
        <Metric
          value={String(assignments)}
          label="Assignments"
          change="student access grants"
        />
        <Metric
          value={String(documents)}
          label="Documents"
          change="supporting files"
        />
      </div>
      <div className="metric-grid usage-second">
        <Metric
          value={String(attempts.length)}
          label="Attempts started"
          change="all modules"
        />
        <Metric
          value={String(completed.length)}
          label="Attempts completed"
          change="saved results"
        />
        <Metric
          value={
            completed.length
              ? `${Math.round(completed.reduce((sum, item) => sum + Number(item.score || 0), 0) / completed.length)}%`
              : "—"
          }
          label="Average score"
          change="completed attempts"
        />
        <Metric
          value="Pending"
          label="OpenAI cost"
          change="token logging required"
        />
      </div>
    </div>
  );
}
function AdminPanel({ mode }: { mode: "create" | "existing" | "assign" }) {
  const [authenticated, setAuthenticated] = useState(true);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Standard");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(20);
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [passMark, setPassMark] = useState(60);
  const [availableFrom, setAvailableFrom] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [feedbackTiming, setFeedbackTiming] = useState("after_each");
  const [hintsAllowed, setHintsAllowed] = useState(true);
  const [skippingAllowed, setSkippingAllowed] = useState(false);
  const [answerMode, setAnswerMode] = useState("both");
  const [instructions, setInstructions] = useState("");
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [savedInstructions, setSavedInstructions] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleSubject, setModuleSubject] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [moduleDifficulty, setModuleDifficulty] =
    useState<Difficulty>("Standard");
  const [moduleQuestions, setModuleQuestions] = useState(10);
  const [moduleTime, setModuleTime] = useState(20);
  const [moduleAttempts, setModuleAttempts] = useState(1);
  const [modulePassMark, setModulePassMark] = useState(60);
  const load = () =>
    fetch("/api/admin/topics")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setAuthenticated(true);
        setTopics(d.topics ?? []);
        setUsers(d.users ?? []);
        setSelected((v) => v || d.topics?.[0]?.id || "");
      })
      .catch(() => setAuthenticated(false));
  useEffect(() => {
    void load();
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage("Creating viva…");
    const r = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        title,
        subject,
        description,
        difficulty,
        questionCount,
        timeLimitMinutes: timeLimit,
        attemptsAllowed,
        passMark,
        availableFrom: availableFrom
          ? new Date(availableFrom).toISOString()
          : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        feedbackTiming,
        hintsAllowed,
        skippingAllowed,
        answerMode,
        instructions,
        groundingMode: "documents_only",
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setCreating(false);
      return setMessage(d.error);
    }
    let ready = 0;
    let pending = 0;
    for (const file of createFiles) {
      setMessage(`Uploading ${file.name}…`);
      const form = new FormData();
      form.set("topicId", d.id);
      form.set("file", file);
      const uploadResponse = await fetch("/api/admin/topics", {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadResponse.json();
      if (uploadResponse.ok && uploadData.status === "ready") ready += 1;
      else pending += 1;
    }
    setTitle("");
    setSubject("");
    setDescription("");
    setInstructions("");
    setCreateFiles([]);
    setCreating(false);
    setMessage(
      createFiles.length
        ? `Viva created with ${ready} ready document${ready === 1 ? "" : "s"}${pending ? ` and ${pending} requiring retry` : ""}.`
        : "Viva created. Add a supporting document from Existing Vivas before assigning students.",
    );
    await load();
  }
  async function assign(event: React.FormEvent) {
    event.preventDefault();
    const r = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        topicId: selected,
        userId: selectedUser,
      }),
    });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error);
    setSelectedUser("");
    setMessage("Student assigned successfully.");
    load();
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    setMessage("Indexing document…");
    const form = new FormData();
    form.set("topicId", selected);
    form.set("file", file);
    const r = await fetch("/api/admin/topics", { method: "POST", body: form });
    const d = await r.json();
    setMessage(r.ok ? "Document uploaded and indexed." : d.error);
    if (r.ok) load();
    event.target.value = "";
  }
  async function manageDocument(
    action: "retry_document" | "delete_document",
    document: AdminDocument,
  ) {
    if (
      action === "delete_document" &&
      !window.confirm(`Delete ${document.file_name}? This cannot be undone.`)
    )
      return;
    setMessage(
      action === "retry_document"
        ? "Retrying document indexing…"
        : "Deleting document…",
    );
    const response = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, documentId: document.id }),
    });
    const data = await response.json();
    setMessage(
      response.ok
        ? action === "retry_document"
          ? "Document indexed and ready for viva questions."
          : "Document deleted."
        : data.error || "Document operation failed.",
    );
    await load();
  }
  useEffect(() => {
    const module = topics.find((topic) => topic.id === selected);
    setSavedInstructions(module?.instructions || "");
    setModuleTitle(module?.title || "");
    setModuleSubject(module?.subject || "");
    setModuleDescription(module?.description || "");
    setModuleDifficulty(module?.difficulty || "Standard");
    setModuleQuestions(module?.question_count || 10);
    setModuleTime(module?.time_limit_minutes || 20);
    setModuleAttempts(module?.attempts_allowed || 1);
    setModulePassMark(module?.pass_mark ?? 60);
  }, [selected, topics]);
  async function updateInstructions() {
    if (!selected) return;
    const response = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_instructions",
        topicId: selected,
        instructions: savedInstructions,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return setMessage(data.error || "Could not save instructions.");
    setMessage("Examiner instructions updated.");
    load();
  }
  async function updateModule() {
    if (!selected) return;
    const response = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_module",
        topicId: selected,
        title: moduleTitle,
        subject: moduleSubject,
        description: moduleDescription,
        difficulty: moduleDifficulty,
        questionCount: moduleQuestions,
        timeLimitMinutes: moduleTime,
        attemptsAllowed: moduleAttempts,
        passMark: modulePassMark,
        instructions: savedInstructions,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return setMessage(data.error || "Could not update module.");
    setMessage("Viva module updated successfully.");
    load();
  }
  async function unassign(userId: string, topicId = selected) {
    const response = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unassign", topicId, userId }),
    });
    const data = await response.json();
    if (!response.ok)
      return setMessage(data.error || "Could not remove student.");
    setMessage("Student removed from the module.");
    load();
  }
  if (!authenticated)
    return (
      <div className="page narrow-page">
        <div className="settings-error">
          Your Supabase account does not have administrator access.
        </div>
      </div>
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMIN CONTROL CENTRE</span>
          <h1>
            {mode === "create"
              ? "Create a new viva"
              : mode === "existing"
                ? "Existing vivas"
                : "Assign vivas to students"}
          </h1>
          <p>
            {mode === "create"
              ? "Configure a new viva module and its assessment rules."
              : mode === "existing"
                ? "Edit viva modules and manage their supporting documents."
                : "Choose a viva and grant or remove access for registered students."}
          </p>
        </div>
      </div>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-grid">
        {mode === "create" && (
          <form className="admin-card" onSubmit={create}>
            <h2>Create mock viva</h2>
            <label>
              Title
              <input
                value={title}
                required
                onChange={(e) => setTitle(e.target.value)}
                placeholder="DBMS Semester Viva"
              />
            </label>
            <label>
              Subject
              <input
                value={subject}
                required
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Database Systems"
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option>Foundation</option>
                <option>Standard</option>
                <option>Challenge</option>
              </select>
            </label>
            <div className="control-grid">
              <label>
                Questions
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                />
              </label>
              <label>
                Time limit (minutes)
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                />
              </label>
              <label>
                Attempts allowed
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={attemptsAllowed}
                  onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
                />
              </label>
              <label>
                Pass mark (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passMark}
                  onChange={(e) => setPassMark(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="control-grid">
              <label>
                Available from
                <input
                  type="datetime-local"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />
              </label>
              <label>
                Deadline
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </label>
            </div>
            <label>
              Feedback
              <select
                value={feedbackTiming}
                onChange={(e) => setFeedbackTiming(e.target.value)}
              >
                <option value="after_each">After every answer</option>
                <option value="after_completion">After completion</option>
              </select>
            </label>
            <label>
              Answer mode
              <select
                value={answerMode}
                onChange={(e) => setAnswerMode(e.target.value)}
              >
                <option value="both">Voice or typed</option>
                <option value="typed">Typed only</option>
                <option value="voice">Voice only</option>
              </select>
            </label>
            <div className="admin-checks">
              <label>
                <input
                  type="checkbox"
                  checked={hintsAllowed}
                  onChange={(e) => setHintsAllowed(e.target.checked)}
                />{" "}
                Allow hints
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={skippingAllowed}
                  onChange={(e) => setSkippingAllowed(e.target.checked)}
                />{" "}
                Allow skipping
              </label>
            </div>
            <label>
              Student instructions
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions shown during this viva"
              />
            </label>
            <label className="admin-upload">
              Supporting documents
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                onChange={(event) =>
                  setCreateFiles(Array.from(event.target.files || []))
                }
              />
            </label>
            {createFiles.length > 0 && (
              <div className="module-documents create-document-list">
                <strong>
                  {createFiles.length} document
                  {createFiles.length === 1 ? "" : "s"} selected
                </strong>
                {createFiles.map((file) => (
                  <span key={`${file.name}-${file.size}`}>
                    <b>{file.name}</b>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateFiles((files) =>
                          files.filter((item) => item !== file),
                        )
                      }
                    >
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="grounding-lock">
              Document-only questions are enforced. Students cannot start until
              a document is indexed.
            </div>
            <button className="primary-button" disabled={creating}>
              {creating ? "Creating & indexing…" : "Create Viva"}
            </button>
          </form>
        )}
        {(mode === "existing" || mode === "assign") && (
          <section className="admin-card">
            <h2>
              {mode === "assign" ? "Assign students" : "Edit viva module"}
            </h2>
            <label>
              Mock viva
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose test</option>
                {topics.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            {mode === "assign" && (
              <form onSubmit={assign}>
                <label>
                  Registered student
                  <select
                    value={selectedUser}
                    required
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">Choose student</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email} — {user.email}
                      </option>
                    ))}
                  </select>
                </label>
                {!users.length && (
                  <small>No student accounts have registered yet.</small>
                )}
                <button
                  className="primary-button"
                  disabled={!selected || !selectedUser}
                >
                  Assign student
                </button>
              </form>
            )}
            {mode === "existing" && (
              <>
                <label className="admin-upload">
                  Supporting document
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={upload}
                    disabled={!selected}
                  />
                </label>
                <div className="module-documents">
                  <strong>Attached documents</strong>
                  {topics.find((topic) => topic.id === selected)?.documents
                    ?.length ? (
                    topics
                      .find((topic) => topic.id === selected)!
                      .documents!.map((document) => (
                        <span className="document-row" key={document.id}>
                          <b title={document.error_message || undefined}>
                            {document.file_name}
                          </b>
                          <em className={document.status}>{document.status}</em>
                          {document.status !== "ready" && (
                            <button
                              type="button"
                              onClick={() =>
                                manageDocument("retry_document", document)
                              }
                            >
                              Retry
                            </button>
                          )}
                          <button
                            className="delete-document"
                            type="button"
                            onClick={() =>
                              manageDocument("delete_document", document)
                            }
                          >
                            Delete
                          </button>
                          {document.error_message && (
                            <small>{document.error_message}</small>
                          )}
                        </span>
                      ))
                  ) : (
                    <small>No documents attached to this module.</small>
                  )}
                </div>
                <div className="prompt-editor">
                  <h3>Edit selected viva module</h3>
                  <label>
                    Module name
                    <input
                      value={moduleTitle}
                      onChange={(e) => setModuleTitle(e.target.value)}
                      disabled={!selected}
                    />
                  </label>
                  <label>
                    Subject
                    <input
                      value={moduleSubject}
                      onChange={(e) => setModuleSubject(e.target.value)}
                      disabled={!selected}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={moduleDescription}
                      onChange={(e) => setModuleDescription(e.target.value)}
                      disabled={!selected}
                    />
                  </label>
                  <div className="control-grid">
                    <label>
                      Difficulty
                      <select
                        value={moduleDifficulty}
                        onChange={(e) =>
                          setModuleDifficulty(e.target.value as Difficulty)
                        }
                      >
                        <option>Foundation</option>
                        <option>Standard</option>
                        <option>Challenge</option>
                      </select>
                    </label>
                    <label>
                      Questions
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={moduleQuestions}
                        onChange={(e) =>
                          setModuleQuestions(Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Minutes
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={moduleTime}
                        onChange={(e) => setModuleTime(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Attempts
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={moduleAttempts}
                        onChange={(e) =>
                          setModuleAttempts(Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Pass mark (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={modulePassMark}
                        onChange={(e) =>
                          setModulePassMark(Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Examiner instructions / Prompt
                    <textarea
                      value={savedInstructions}
                      onChange={(e) => setSavedInstructions(e.target.value)}
                      disabled={!selected}
                      placeholder="Example: Ask only from Chapters 2–4. Focus on definitions, comparisons and practical examples. Avoid historical questions."
                    />
                  </label>
                  <small>
                    These instructions guide question selection, but questions
                    remain restricted to this test&apos;s attached documents.
                  </small>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!selected}
                    onClick={updateModule}
                  >
                    Save module changes
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
      {(mode === "existing" || mode === "assign") && (
        <section className="admin-topic-list">
          <h2>
            {mode === "assign"
              ? "Current student assignments"
              : "Viva module overview"}
          </h2>
          {topics.length ? (
            topics.map((t) => (
              <div className="assignment-group" key={t.id}>
                <button onClick={() => setSelected(t.id)}>
                  <div>
                    <strong>{t.title}</strong>
                    <span>
                      {t.subject} · {t.difficulty}
                    </span>
                  </div>
                  <span>
                    {t.document_count ?? 0} docs · {t.assignment_count ?? 0}{" "}
                    students
                  </span>
                </button>
                <div className="assigned-users">
                  {t.assignments?.length ? (
                    t.assignments.map((a) => (
                      <span key={a.id}>
                        <b>{a.user?.full_name || "Student"}</b>
                        {a.user?.email}
                        {mode === "assign" && (
                          <button
                            type="button"
                            aria-label={`Remove ${a.user?.email}`}
                            onClick={() => {
                              setSelected(t.id);
                              unassign(a.user_id, t.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <em>No students assigned</em>
                  )}
                </div>
                {mode === "existing" && (
                  <div className="attempt-results">
                    {t.attempts?.length ? (
                      t.attempts.map((attempt) => (
                        <div key={attempt.id}>
                          <span>
                            <b>
                              {attempt.user?.full_name ||
                                attempt.user?.email ||
                                "Student"}
                            </b>
                            <small>
                              {attempt.status === "completed"
                                ? "Completed"
                                : "In progress"}
                            </small>
                          </span>
                          <strong>
                            {attempt.status === "completed"
                              ? `${Math.round(Number(attempt.score || 0))}%`
                              : "—"}
                          </strong>
                          <time>
                            {new Date(
                              attempt.completed_at || attempt.started_at,
                            ).toLocaleString()}
                          </time>
                        </div>
                      ))
                    ) : (
                      <em>No attempts yet</em>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p>No mock vivas created yet.</p>
          )}
        </section>
      )}
    </div>
  );
}

function Settings({
  documents,
  addDocuments,
  documentError,
}: {
  documents: DocumentRecord[];
  addDocuments: (event: ChangeEvent<HTMLInputElement>) => void;
  documentError: string;
}) {
  const [tab, setTab] = useState("syllabus");
  const totalSize = useMemo(() => documents.length, [documents]);
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">COURSE CONFIGURATION</span>
          <h1>Settings & syllabus</h1>
          <p>
            Control what your examiner can ask and how your practice sessions
            behave.
          </p>
        </div>
        <span className="save-state">✓ All changes saved</span>
      </div>
      <div className="settings-layout">
        <aside className="settings-nav">
          {[
            ["syllabus", "▤", "Syllabus & documents"],
            ["examiner", "✦", "AI examiner"],
            ["practice", "◷", "Practice preferences"],
            ["profile", "○", "Student profile"],
            ["privacy", "◇", "Privacy & data"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </aside>
        <section className="settings-content">
          {tab === "syllabus" ? (
            <>
              <div className="content-heading">
                <div>
                  <h2>Syllabus & learning material</h2>
                  <p>
                    Questions and evaluations will be grounded in these
                    documents.
                  </p>
                </div>
                <span className="document-count">{totalSize} documents</span>
              </div>
              <label className="upload-zone">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={addDocuments}
                />
                <span className="upload-icon">⇧</span>
                <strong>
                  Drop documents here or <u>browse files</u>
                </strong>
                <small>PDF, DOCX or TXT · Maximum 25 MB per file</small>
              </label>
              {documentError && (
                <div className="settings-error">
                  <strong>Upload needs attention</strong>
                  <span>{documentError}</span>
                </div>
              )}
              <div className="document-list">
                <div className="document-list-head">
                  <span>DOCUMENT</span>
                  <span>STATUS</span>
                  <span>LAST UPDATED</span>
                  <span />
                </div>
                {documents.length ? (
                  documents.map((doc) => (
                    <div
                      className="document-row"
                      key={`${doc.id ?? doc.name}-${doc.date}`}
                      title={doc.error}
                    >
                      <div className="file-cell">
                        <span className="file-icon">
                          {doc.name.split(".").pop()?.slice(0, 4).toUpperCase()}
                        </span>
                        <div>
                          <strong>{doc.name}</strong>
                          <small>{doc.size}</small>
                        </div>
                      </div>
                      <span
                        className={
                          doc.status === "Ready"
                            ? "ready-status"
                            : doc.status === "Failed"
                              ? "failed-status"
                              : "processing-status"
                        }
                      >
                        {doc.status === "Ready"
                          ? "✓"
                          : doc.status === "Failed"
                            ? "!"
                            : "◌"}{" "}
                        {doc.status}
                      </span>
                      <span className="date-cell">{doc.date}</span>
                      <button aria-label={`Options for ${doc.name}`}>
                        •••
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-documents">
                    <strong>No syllabus documents yet</strong>
                    <span>
                      Upload the first document to create your private knowledge
                      base.
                    </span>
                  </div>
                )}
              </div>
              <div className="knowledge-card">
                <span>✦</span>
                <div>
                  <strong>
                    {documents.some((doc) => doc.status === "Ready")
                      ? "Private knowledge base is ready"
                      : "Your private knowledge base"}
                  </strong>
                  <p>
                    {documents.filter((doc) => doc.status === "Ready").length}{" "}
                    indexed documents. Every user receives an isolated document
                    store and syllabus search index.
                  </p>
                </div>
                <button>Review topics →</button>
              </div>
            </>
          ) : (
            <PreferencePanel tab={tab} />
          )}
        </section>
      </div>
    </div>
  );
}

function PreferencePanel({ tab }: { tab: string }) {
  const titles: Record<string, [string, string]> = {
    examiner: [
      "AI examiner",
      "Choose how the examiner questions and evaluates you.",
    ],
    practice: [
      "Practice preferences",
      "Set comfortable defaults for every session.",
    ],
    profile: [
      "Student profile",
      "Keep course and learning information accurate.",
    ],
    privacy: [
      "Privacy & data",
      "Control your documents, answers and stored progress.",
    ],
  };
  const [title, description] = titles[tab];
  return (
    <>
      <div className="content-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="preference-form">
        <label>
          <span>Examiner style</span>
          <select>
            <option>Supportive but rigorous</option>
            <option>Neutral university examiner</option>
            <option>Strict external examiner</option>
          </select>
        </label>
        <label>
          <span>Response language</span>
          <select>
            <option>English</option>
            <option>English + Hindi support</option>
            <option>Hindi</option>
          </select>
        </label>
        <label className="toggle-row">
          <div>
            <strong>Adaptive follow-up questions</strong>
            <small>
              Probe deeper when an answer is incomplete or especially strong.
            </small>
          </div>
          <input type="checkbox" defaultChecked />
        </label>
        <label className="toggle-row">
          <div>
            <strong>Show feedback after every answer</strong>
            <small>Turn off to simulate a formal uninterrupted viva.</small>
          </div>
          <input type="checkbox" defaultChecked />
        </label>
        <label className="toggle-row">
          <div>
            <strong>Save voice transcripts</strong>
            <small>
              Keep transcripts with session history for later review.
            </small>
          </div>
          <input type="checkbox" />
        </label>
        <button className="primary-button">Save preferences</button>
      </div>
    </>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "0 MB";
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: number) {
  if (!value) return "Recently";
  const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "Processing";
}
