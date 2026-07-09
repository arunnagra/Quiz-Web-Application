const titleContainer = document.querySelector(".title");
const questionContainer = document.querySelector(".question");
const navContainer = document.querySelector(".navigation");

const timerDisplay = document.createElement("div");
timerDisplay.id = "timer";
timerDisplay.style.fontWeight = "bold";
timerDisplay.style.fontSize = "18px";
timerDisplay.style.marginBottom = "10px";
titleContainer.after(timerDisplay);

let currentUser = { username: "Guest" };
let selectedSubject = "";
let questions = [];
let selectedAnswers = [];
let visited = [];
let timerInterval;
let timeLeft = 5 * 60;

function getRandomQuestions(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function loadSession() {
  try {
    const res = await fetch('/api/session');
    if (!res.ok) throw new Error('Session not available');

    const data = await res.json();
    currentUser = data.currentUser || { username: 'Guest' };
    titleContainer.innerText = `Welcome, ${currentUser.username}`;

    const progressRes = await fetch('/api/quiz/progress');
    if (progressRes.ok) {
      const progress = await progressRes.json();
      if (progress.state && progress.state.questions && progress.state.questions.length) {
        selectedSubject = progress.state.selectedSubject || '';
        questions = progress.state.questions || [];
        selectedAnswers = progress.state.selectedAnswers || [];
        visited = new Array(questions.length).fill(false);
        document.getElementById('subject-selection').style.display = 'none';
        createQuiz();
        showQuestion(0);
      }
    }
  } catch (err) {
    console.error('Failed to load session:', err);
  }
}

window.addEventListener('DOMContentLoaded', loadSession);

async function saveProgress() {
  await fetch('/api/quiz/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: selectedSubject, questions, selectedAnswers }),
  });
}

// Function to start the quiz
async function startQuiz() {
  const dropdown = document.getElementById('subject-dropdown');
  selectedSubject = dropdown.value;

  if (!selectedSubject) {
    alert('Please select a field.');
    return;
  }

  document.getElementById('subject-selection').style.display = 'none';

  try {
    const res = await fetch('/json/questions.json');
    const data = await res.json();
    const allQuestions = data[selectedSubject];

    if (!allQuestions || allQuestions.length === 0) {
      alert('No questions found for this field.');
      return;
    }

    questions = getRandomQuestions(allQuestions, 10);
    selectedAnswers = new Array(questions.length).fill(undefined);
    visited = new Array(questions.length).fill(false);
    timeLeft = 5 * 60;

    await saveProgress();
    createQuiz();
    showQuestion(0);
    startTimer();
  } catch (err) {
    console.error('Failed to load questions:', err);
  }
}

// Function to start the timer
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.innerText = `Time Left: ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("Time's up! Submitting your quiz.");
      calculateScore();
    }
    timeLeft--;
  }, 1000);
}

// Function to create the quiz interface
function createQuiz() {
  navContainer.innerHTML = '';
  questionContainer.innerHTML = '';

  questions.forEach((q, index) => {
    const navBtn = document.createElement('button');
    navBtn.innerText = index + 1;
    navBtn.className = 'nav-btn';
    navBtn.dataset.index = index;
    styleNavBtn(navBtn);
    navContainer.appendChild(navBtn);

    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-box';
    questionDiv.id = `q_${index}`;
    questionDiv.style.display = 'none';

    const questionText = document.createElement('p');
    questionText.innerText = `Q${index + 1}. ${q.question}`;
    questionText.style.fontWeight = 'bold';
    questionDiv.appendChild(questionText);

    q.options.forEach((opt) => {
      const optionLabel = document.createElement('label');
      optionLabel.style.display = 'block';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `question_${index}`;
      radio.value = opt;

      radio.addEventListener('change', async () => {
        selectedAnswers[index] = opt;
        await saveProgress();

        document.querySelector(`.nav-btn[data-index='${index}']`).classList.remove('unanswered', 'visited');
        document.querySelector(`.nav-btn[data-index='${index}']`).classList.add('answered');
      });

      optionLabel.appendChild(radio);
      optionLabel.appendChild(document.createTextNode(' ' + opt));
      questionDiv.appendChild(optionLabel);
    });

    const navControls = document.createElement('div');
    navControls.style.marginTop = '10px';

    if (index > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.innerText = 'Previous';
      prevBtn.onclick = () => showQuestion(index - 1);
      styleNavControlBtn(prevBtn);
      navControls.appendChild(prevBtn);
    }

    if (index < questions.length - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.innerText = 'Save & Next';
      nextBtn.onclick = async () => {
        saveSelectedAnswer(index);
        await saveProgress();
        showQuestion(index + 1);
      };
      styleNavControlBtn(nextBtn);
      navControls.appendChild(nextBtn);
    } else {
      const submitBtn = document.createElement('button');
      submitBtn.innerText = 'Submit';
      submitBtn.onclick = async () => {
        saveSelectedAnswer(index);
        await saveProgress();
        calculateScore();
      };
      styleNavControlBtn(submitBtn);
      submitBtn.style.backgroundColor = '#4CAF50';
      submitBtn.style.color = '#fff';
      navControls.appendChild(submitBtn);
    }

    const skipBtn = document.createElement('button');
    skipBtn.innerText = 'Skip';
    skipBtn.className = 'skip-btn';
    skipBtn.onclick = () => {
      showQuestion(index + 1);
    };
    styleNavControlBtn(skipBtn);
    skipBtn.style.backgroundColor = '#5c6bc0';
    skipBtn.style.color = '#fff';
    navControls.appendChild(skipBtn);

    questionDiv.appendChild(navControls);
    questionContainer.appendChild(questionDiv);
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      showQuestion(index);
    });
  });
}

// Function to show a specific question
function showQuestion(index) {
  visited[index] = true;

  document.querySelectorAll('.question-box').forEach((q) => q.style.display = 'none');

  const currentQuestion = document.getElementById(`q_${index}`);
  if (currentQuestion) {
    currentQuestion.style.display = 'block';

    const selectedOption = selectedAnswers[index];
    if (selectedOption) {
      const radio = currentQuestion.querySelector(`input[type="radio"][value="${selectedOption}"]`);
      if (radio) radio.checked = true;
    }
  }

  document.querySelectorAll('.nav-btn').forEach((btn, i) => {
    btn.classList.remove('active', 'answered', 'unanswered', 'visited');

    if (i === index) {
      btn.classList.add('active');
    } else if (selectedAnswers[i]) {
      btn.classList.add('answered');
    } else if (visited[i]) {
      btn.classList.add('unanswered');
    }
  });
}

// Function to save the selected answer
function saveSelectedAnswer(index) {
  const selectedOption = document.querySelector(`input[name="question_${index}"]:checked`);
  if (selectedOption) {
    selectedAnswers[index] = selectedOption.value;
  }
}

// Function to calculate the score
async function calculateScore() {
  clearInterval(timerInterval);

  let score = 0;
  questions.forEach((q, i) => {
    if (selectedAnswers[i] === q.answer) score++;
  });

  try {
    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: selectedSubject,
        questions,
        selectedAnswers,
        score,
        total: questions.length,
      }),
    });

    if (res.ok) {
      window.location.href = '/result';
    } else {
      alert('Could not complete test. Try again.');
    }
  } catch (err) {
    console.error('Failed to complete test:', err);
    alert('Server error. Try again.');
  }
}

// Function to style navigation buttons
function styleNavBtn(btn) {
  btn.style.margin = '5px';
  btn.style.padding = '8px 12px';
  btn.style.borderRadius = '50%';
  btn.style.cursor = 'pointer';
  btn.style.border = '1px solid #333';
  btn.style.backgroundColor = '#eee';
}

// Function to style navigation control buttons
function styleNavControlBtn(btn) {
  btn.style.marginRight = '10px';
  btn.style.padding = '5px 10px';
  btn.style.borderRadius = '5px';
  btn.style.cursor = 'pointer';
  btn.style.border = '1px solid #333';
}
