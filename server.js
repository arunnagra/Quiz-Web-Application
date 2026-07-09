const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'storage.json');

function ensureStorageFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], sessions: {} }, null, 2));
  }
}

function readStorage() {
  ensureStorageFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStorage(data) {
  ensureStorageFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function normalizeAnswer(value) {
  return String(value ?? '').trim().toLowerCase();
}

function buildAttemptSummary(questions = [], selectedAnswers = [], fallbackScore = 0, fallbackTotal = 0) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeAnswers = Array.isArray(selectedAnswers) ? selectedAnswers : [];
  const total = Number(fallbackTotal) || safeQuestions.length || 0;

  let correctCount = 0;
  let attemptedCount = 0;

  safeQuestions.forEach((question, index) => {
    const userAnswer = safeAnswers[index];
    const hasAnswer = userAnswer !== undefined && userAnswer !== null && String(userAnswer).trim() !== '';

    if (hasAnswer) {
      attemptedCount += 1;
      if (normalizeAnswer(userAnswer) === normalizeAnswer(question?.answer)) {
        correctCount += 1;
      }
    }
  });

  const unansweredCount = Math.max(total - attemptedCount, 0);
  const score = Number(fallbackScore) || correctCount;
  const computedTotal = total || safeQuestions.length || 0;
  const percentage = computedTotal ? Math.round((score / computedTotal) * 100) : 0;

  return {
    score,
    total: computedTotal,
    correctCount,
    incorrectCount: attemptedCount - correctCount,
    unansweredCount,
    attemptedCount,
    percentage,
  };
}

function getSessionEntry(req) {
  const data = readStorage();
  const sessionId = req.session.id;
  if (!data.sessions[sessionId]) {
    data.sessions[sessionId] = {
      authenticated: false,
      currentUser: null,
      testCompleted: false,
      selectedSubject: '',
      questions: [],
      selectedAnswers: [],
      score: 0,
      total: 0,
      attempts: [],
    };
    writeStorage(data);
  }
  return data.sessions[sessionId];
}

function saveSessionEntry(req, updates) {
  const data = readStorage();
  const sessionId = req.session.id;
  const current = data.sessions[sessionId] || {};
  data.sessions[sessionId] = { ...current, ...updates };
  writeStorage(data);
  return data.sessions[sessionId];
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'mySecretKey12345',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/register', (req, res) => {
  const userdetails = req.body;

  if (!userdetails || !userdetails.username || !userdetails.useremail || !userdetails.userphone || !userdetails.usergender || !userdetails.userdob) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const data = readStorage();
  const duplicate = data.users.some(
    (user) => user.useremail === userdetails.useremail || user.userphone === userdetails.userphone
  );

  if (duplicate) {
    return res.status(409).json({ error: 'Email or Phone number already registered.' });
  }

  data.users.push(userdetails);
  writeStorage(data);

  req.session.authenticated = true;
  req.session.testCompleted = false;
  req.session.currentUser = userdetails;
  saveSessionEntry(req, {
    authenticated: true,
    currentUser: userdetails,
    testCompleted: false,
    selectedSubject: '',
    questions: [],
    selectedAnswers: [],
    score: 0,
    total: 0,
    attempts: [],
  });

  res.status(200).json({ ok: true, user: userdetails });
});

app.post('/start', (req, res) => {
  req.session.authenticated = true;
  req.session.testCompleted = false;
  saveSessionEntry(req, { authenticated: true, testCompleted: false });
  res.status(200).send('Session started');
});

function isAuthenticated(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/session', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const entry = getSessionEntry(req);
  res.json({
    authenticated: true,
    currentUser: entry.currentUser || req.session.currentUser || null,
    testCompleted: !!entry.testCompleted,
  });
});

app.post('/api/quiz/progress', isAuthenticated, (req, res) => {
  const { subject, questions, selectedAnswers } = req.body || {};
  const entry = saveSessionEntry(req, {
    selectedSubject: subject || '',
    questions: questions || [],
    selectedAnswers: selectedAnswers || [],
    testCompleted: false,
  });
  res.json({ ok: true, state: entry });
});

app.get('/api/quiz/progress', isAuthenticated, (req, res) => {
  const entry = getSessionEntry(req);
  res.json({ state: entry });
});

app.post('/api/quiz/submit', isAuthenticated, (req, res) => {
  const { subject, questions, selectedAnswers } = req.body || {};
  const entry = getSessionEntry(req);
  const safeQuestions = questions || entry.questions || [];
  const safeAnswers = selectedAnswers || entry.selectedAnswers || [];
  const summary = buildAttemptSummary(safeQuestions, safeAnswers);
  const completedAttempt = {
    score: summary.score,
    total: summary.total,
    correctCount: summary.correctCount,
    incorrectCount: summary.incorrectCount,
    unansweredCount: summary.unansweredCount,
    attemptedCount: summary.attemptedCount,
    percentage: summary.percentage,
    timestamp: new Date().toLocaleString(),
    selectedSubject: subject || entry.selectedSubject || '',
    questions: safeQuestions,
    selectedAnswers: safeAnswers,
  };

  const attempts = [completedAttempt, ...(entry.attempts || [])].slice(0, 10);

  saveSessionEntry(req, {
    selectedSubject: completedAttempt.selectedSubject,
    questions: completedAttempt.questions,
    selectedAnswers: completedAttempt.selectedAnswers,
    score: completedAttempt.score,
    total: completedAttempt.total,
    correctCount: completedAttempt.correctCount,
    incorrectCount: completedAttempt.incorrectCount,
    unansweredCount: completedAttempt.unansweredCount,
    attemptedCount: completedAttempt.attemptedCount,
    percentage: completedAttempt.percentage,
    attempts,
    testCompleted: true,
  });

  res.json({ ok: true, attempt: completedAttempt });
});

app.get('/api/result', isAuthenticated, (req, res) => {
  const entry = getSessionEntry(req);
  const attempts = entry.attempts || [];
  const summary = buildAttemptSummary(entry.questions || [], entry.selectedAnswers || [], entry.score, entry.total);
  const bestScore = attempts.reduce((best, attempt) => Math.max(best, Number(attempt.score) || 0), summary.score);

  res.json({
    currentUser: entry.currentUser || req.session.currentUser || null,
    score: summary.score,
    total: summary.total,
    correctCount: summary.correctCount,
    incorrectCount: summary.incorrectCount,
    unansweredCount: summary.unansweredCount,
    attemptedCount: summary.attemptedCount,
    percentage: summary.percentage,
    selectedSubject: entry.selectedSubject || '',
    selectedAnswers: entry.selectedAnswers || [],
    questions: entry.questions || [],
    attempts,
    bestScore,
    testCompleted: !!entry.testCompleted,
  });
});

app.post('/complete-test', isAuthenticated, (req, res) => {
  saveSessionEntry(req, { testCompleted: true });
  res.status(200).send('Test completion recorded');
});

app.get('/test', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected', 'test.html'));
});

app.get('/result', isAuthenticated, (req, res) => {
  const entry = getSessionEntry(req);
  if (entry.testCompleted) {
    res.sendFile(path.join(__dirname, 'protected', 'result.html'));
  } else {
    res.redirect('/test');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});