const resultContainer = document.getElementById("result-container");
let resultData = {
  currentUser: { username: "Guest" },
  score: 0,
  total: 10,
  selectedAnswers: [],
  questions: [],
  attempts: [],
  bestScore: 0,
};

async function loadResult() {
  try {
    const res = await fetch('/api/result');
    if (!res.ok) throw new Error('Unable to load result');
    resultData = await res.json();
    renderResult();
  } catch (err) {
    console.error('Failed to load result:', err);
    renderResult();
  }
}

function renderResult() {
  const userName = resultData.currentUser?.username || 'Guest';
  const score = Number(resultData.score) || 0;
  const total = Number(resultData.total) || resultData.questions.length || 10;
  const selectedAnswers = resultData.selectedAnswers || [];
  const questions = resultData.questions || [];
  const history = resultData.attempts || [];
  const userBestScore = Number(resultData.bestScore) || score;

  let resultTable = `
    <table style="width:100%; border-collapse: collapse; margin-top: 20px;">
      <tr style="background-color: #eee;">
        <th style="padding: 8px; border: 1px solid #ccc;">Sr. No.</th>
        <th style="padding: 8px; border: 1px solid #ccc;">Status</th>
      </tr>
  `;

  questions.forEach((q, index) => {
    const userAnswer = selectedAnswers[index];
    let status = 'Not Attempted';

    if (userAnswer !== undefined && userAnswer !== null) {
      status = userAnswer === q.answer ? 'Correct' : 'Wrong';
    }

    const rowColor = status === 'Correct'
      ? '#d4edda'
      : status === 'Wrong'
      ? '#f8d7da'
      : '#fff3cd';

    resultTable += `
      <tr style="background-color: ${rowColor};">
        <td style="padding: 8px; border: 1px solid #ccc; text-align:center;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align:center;">${status}</td>
      </tr>
    `;
  });
  resultTable += '</table>';

  resultContainer.innerHTML = `
    <h2>Quiz Result for <span class="highlight">${userName}</span></h2>
    <p>Your Score: <strong>${score} / ${total}</strong></p>
    <p>Best Score: <strong>${Math.max(userBestScore, score)} / ${total}</strong></p>

    ${resultTable}
    <div class="button-group" style="margin-bottom: 20px;">
      <button class="retake-btn" onclick="toggleReport()">View Last 10 Attempts</button>
      <button class="retake-btn" onclick="toggleAnswerKey()">View Answer Key</button>
    </div>

    <div id="history-report" style="display: none; margin-top: 25px;">
      <h3>Last 10 Attempts</h3>
      <table border="1" cellpadding="8" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #eee;">
            <th>#</th>
            <th>Date & Time</th>
            <th>Score</th>
            <th>Report</th>
          </tr>
        </thead>
        <tbody>
          ${history.map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.timestamp}</td>
              <td>${item.score} / ${item.total}</td>
              <td><button class="view-btn" onclick="showAttemptAnswerKey(${idx})">View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div id="answer-key" style="display: none; margin-top: 25px;">
      <h3>Answer Key</h3>
      ${questions.map((q, i) => {
        const userAns = selectedAnswers[i];
        const isCorrect = userAns === q.answer;
        const userDisplay = userAns
          ? `<span style="color: ${isCorrect ? 'green' : 'red'};">${userAns}</span>`
          : '<span style="color: orange;">Not Attempted</span>';

        return `
          <div style="margin-bottom: 15px; padding: 10px; background-color: #f4f4f4; border-radius: 8px;">
            <p><strong>Q${i + 1}: ${q.question}</strong></p>
            <p>Correct Answer: <span style="color: green;">${q.answer}</span></p>
            <p>Your Answer: ${userDisplay}</p>
          </div>
        `;
      }).join('')}
    </div>

    <div id="attempt-answer-key" style="display: none; margin-top: 25px;">
      <h3>Answer Key for Selected Attempt</h3>
      <div id="attempt-key-content"></div>
    </div>

    <div class="button-group" style="margin-top: 30px;">
      <button class="retake-btn" onclick="window.location.href='/test'">Retake Quiz</button>
      <button class="retake-btn" onclick="window.location.href='/'">Add Another Response</button>
    </div>
  `;
}

function toggleReport() {
  const report = document.getElementById('history-report');
  report.style.display = report.style.display === 'none' ? 'block' : 'none';
}

function toggleAnswerKey() {
  const key = document.getElementById('answer-key');
  key.style.display = key.style.display === 'none' ? 'block' : 'none';
}

function showAttemptAnswerKey(index) {
  const attempt = resultData.attempts[index];
  const wrapper = document.getElementById('attempt-answer-key');
  const container = document.getElementById('attempt-key-content');

  if (wrapper.dataset.shownIndex === String(index)) {
    wrapper.style.display = 'none';
    wrapper.dataset.shownIndex = '';
    container.innerHTML = '';
    return;
  }

  if (!attempt || !attempt.questions || !attempt.selectedAnswers) return;

  container.innerHTML = attempt.questions
    .map((q, i) => {
      const userAns = attempt.selectedAnswers[i];
      const isCorrect = userAns === q.answer;
      const userDisplay = userAns
        ? `<span style="color: ${isCorrect ? 'green' : 'red'};">${userAns}</span>`
        : '<span style="color: orange;">Not Attempted</span>';

      return `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #f0f0f0; border-radius: 8px;">
          <p><strong>Q${i + 1}: ${q.question}</strong></p>
          <p>Correct Answer: <span style="color: green;">${q.answer}</span></p>
          <p>Your Answer: ${userDisplay}</p>
        </div>
      `;
    })
    .join('');

  wrapper.style.display = 'block';
  wrapper.dataset.shownIndex = String(index);
}

window.addEventListener('DOMContentLoaded', loadResult);