const STORAGE_KEY = "germanRewardsAppState.v1";

const ui = {
  newUsername: document.getElementById("new-username"),
  createUserBtn: document.getElementById("create-user-btn"),
  userSelect: document.getElementById("user-select"),
  switchUserBtn: document.getElementById("switch-user-btn"),
  activeUser: document.getElementById("active-user"),
  progressPanel: document.getElementById("progress-panel"),
  exercisePanel: document.getElementById("exercise-panel"),
  referencePanel: document.getElementById("reference-panel"),
  rewardsPanel: document.getElementById("rewards-panel"),
  dueCount: document.getElementById("due-count"),
  masteredCount: document.getElementById("mastered-count"),
  attemptCount: document.getElementById("attempt-count"),
  accuracy: document.getElementById("accuracy"),
  exerciseMeta: document.getElementById("exercise-meta"),
  exercisePrompt: document.getElementById("exercise-prompt"),
  exerciseAnswer: document.getElementById("exercise-answer"),
  checkAnswerBtn: document.getElementById("check-answer-btn"),
  skipBtn: document.getElementById("skip-btn"),
  showSolutionBtn: document.getElementById("show-solution-btn"),
  exerciseFeedback: document.getElementById("exercise-feedback"),
  conjugationTable: document.getElementById("conjugation-table"),
  grammarList: document.getElementById("grammar-list"),
  rewardList: document.getElementById("reward-list")
};

let courseData;
let rewardsData;
let appState = loadState();
let currentExercise = null;

init().catch((error) => {
  console.error(error);
  alert("Could not load course data. Check data/course.json and rewards/rewards.json");
});

async function init() {
  const [courseRes, rewardsRes] = await Promise.all([
    fetch("data/course.json"),
    fetch("rewards/rewards.json")
  ]);
  courseData = await courseRes.json();
  rewardsData = await rewardsRes.json();

  wireEvents();
  renderUserSelect();
  renderReference();
  ensureAllUserProgressShape();
  saveState();
  refresh();
}

function wireEvents() {
  ui.createUserBtn.addEventListener("click", createUser);
  ui.switchUserBtn.addEventListener("click", switchUser);
  ui.checkAnswerBtn.addEventListener("click", submitAnswer);
  ui.skipBtn.addEventListener("click", skipExercise);
  ui.showSolutionBtn.addEventListener("click", showSolution);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { users: {}, activeUser: null };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { users: {}, activeUser: null };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function createUser() {
  const username = ui.newUsername.value.trim();
  if (!username) {
    ui.activeUser.textContent = "Username cannot be empty.";
    return;
  }

  if (appState.users[username]) {
    ui.activeUser.textContent = "Username already exists. Pick another one.";
    return;
  }

  appState.users[username] = makeNewUserProgress();
  appState.activeUser = username;
  ui.newUsername.value = "";

  saveState();
  renderUserSelect();
  refresh();
}

function switchUser() {
  const picked = ui.userSelect.value;
  if (!picked || !appState.users[picked]) {
    return;
  }

  appState.activeUser = picked;
  saveState();
  refresh();
}

function makeNewUserProgress() {
  const now = Date.now();
  const exerciseProgress = {};

  for (const ex of courseData.exercises) {
    exerciseProgress[ex.id] = {
      dueAt: now,
      intervalMinutes: 0,
      correctStreak: 0,
      wrongCount: 0,
      seen: 0,
      mastered: false
    };
  }

  return {
    stats: { correct: 0, wrong: 0 },
    exerciseProgress,
    unlockedRewards: { A1: [], A2: [], B1: [] }
  };
}

function ensureAllUserProgressShape() {
  for (const username of Object.keys(appState.users)) {
    const user = appState.users[username];

    if (!user.unlockedRewards) {
      user.unlockedRewards = { A1: [], A2: [], B1: [] };
    }

    if (!user.stats) {
      user.stats = { correct: 0, wrong: 0 };
    }

    if (!user.exerciseProgress) {
      user.exerciseProgress = {};
    }

    for (const ex of courseData.exercises) {
      if (!user.exerciseProgress[ex.id]) {
        user.exerciseProgress[ex.id] = {
          dueAt: Date.now(),
          intervalMinutes: 0,
          correctStreak: 0,
          wrongCount: 0,
          seen: 0,
          mastered: false
        };
      }
    }
  }
}

function renderUserSelect() {
  const users = Object.keys(appState.users).sort();
  ui.userSelect.innerHTML = users
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");

  if (appState.activeUser && users.includes(appState.activeUser)) {
    ui.userSelect.value = appState.activeUser;
  }
}

function refresh() {
  const user = getActiveUserData();

  if (!user) {
    ui.activeUser.textContent = "No active user. Create one to start learning.";
    toggleLearningPanels(false);
    return;
  }

  ui.activeUser.textContent = `Active user: ${appState.activeUser}`;
  toggleLearningPanels(true);

  maybeUnlockRewards(user);
  renderProgress(user);
  renderRewards(user);
  setNextExercise(user);
  saveState();
}

function toggleLearningPanels(show) {
  for (const panel of [ui.progressPanel, ui.exercisePanel, ui.referencePanel, ui.rewardsPanel]) {
    panel.classList.toggle("hidden", !show);
  }
}

function getActiveUserData() {
  if (!appState.activeUser) {
    return null;
  }
  return appState.users[appState.activeUser] || null;
}

function getDueExercises(user) {
  const now = Date.now();
  return courseData.exercises
    .map((ex) => ({ ex, state: user.exerciseProgress[ex.id] }))
    .filter((row) => row.state.dueAt <= now)
    .sort((a, b) => a.state.dueAt - b.state.dueAt);
}

function renderProgress(user) {
  const due = getDueExercises(user);
  const progressRows = Object.values(user.exerciseProgress);
  const masteredCount = progressRows.filter((r) => r.mastered).length;
  const totalAttempts = user.stats.correct + user.stats.wrong;
  const accuracy = totalAttempts ? Math.round((user.stats.correct / totalAttempts) * 100) : 0;

  ui.dueCount.textContent = String(due.length);
  ui.masteredCount.textContent = String(masteredCount);
  ui.attemptCount.textContent = String(totalAttempts);
  ui.accuracy.textContent = `${accuracy}%`;
}

function setNextExercise(user) {
  const due = getDueExercises(user);

  if (!due.length) {
    currentExercise = null;
    ui.exerciseMeta.textContent = "No due exercises right now. Come back later.";
    ui.exercisePrompt.textContent = "";
    ui.exerciseFeedback.textContent = "";
    return;
  }

  currentExercise = due[0].ex;
  ui.exerciseMeta.textContent = `${currentExercise.tier} • ${currentExercise.type} • ${currentExercise.note}`;
  ui.exercisePrompt.textContent = currentExercise.prompt;
  ui.exerciseFeedback.textContent = "";
  ui.exerciseAnswer.value = "";
  ui.exerciseAnswer.focus();
}

function normalize(input) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function submitAnswer() {
  const user = getActiveUserData();
  if (!user || !currentExercise) {
    return;
  }

  const given = normalize(ui.exerciseAnswer.value);
  const validAnswers = currentExercise.answers.map((a) => normalize(a));
  const row = user.exerciseProgress[currentExercise.id];
  row.seen += 1;

  if (validAnswers.includes(given)) {
    user.stats.correct += 1;
    row.correctStreak += 1;
    const nextIntervals = [10, 60, 360, 1440, 2880];
    row.intervalMinutes = nextIntervals[Math.min(row.correctStreak - 1, nextIntervals.length - 1)];
    row.dueAt = Date.now() + row.intervalMinutes * 60_000;
    row.mastered = row.correctStreak >= 3;
    ui.exerciseFeedback.textContent = "Correct ✅";
  } else {
    user.stats.wrong += 1;
    row.wrongCount += 1;
    row.correctStreak = 0;
    row.intervalMinutes = 5;
    row.dueAt = Date.now() + 5 * 60_000;
    row.mastered = false;
    ui.exerciseFeedback.textContent = `Wrong ❌ Correct answer: ${currentExercise.answers[0]}`;
  }

  saveState();
  refresh();
}

function skipExercise() {
  const user = getActiveUserData();
  if (!user || !currentExercise) {
    return;
  }

  const row = user.exerciseProgress[currentExercise.id];
  row.dueAt = Date.now() + 2 * 60_000;
  ui.exerciseFeedback.textContent = "Skipped. It will appear again shortly.";
  saveState();
  refresh();
}

function showSolution() {
  if (!currentExercise) {
    return;
  }
  ui.exerciseFeedback.textContent = `Solution: ${currentExercise.answers[0]}`;
}

function renderReference() {
  ui.conjugationTable.innerHTML = courseData.conjugations
    .map((entry) => {
      const forms = Object.entries(entry.forms)
        .map(([pronoun, form]) => `<li><strong>${pronoun}:</strong> ${form}</li>`)
        .join("");
      return `<article><h3>${entry.verb} (${entry.level})</h3><ul>${forms}</ul></article>`;
    })
    .join("");

  ui.grammarList.innerHTML = courseData.grammar.map((item) => `<li>${item}</li>`).join("");
}

function maybeUnlockRewards(user) {
  const masteredByTier = { A1: 0, A2: 0, B1: 0 };

  for (const ex of courseData.exercises) {
    const row = user.exerciseProgress[ex.id];
    if (row.mastered && masteredByTier[ex.tier] !== undefined) {
      masteredByTier[ex.tier] += 1;
    }
  }

  for (const tier of ["A1", "A2", "B1"]) {
    const needed = courseData.milestones[tier];
    if (!needed) {
      continue;
    }

    const unlockTarget = Math.floor(masteredByTier[tier] / needed);
    const alreadyUnlocked = user.unlockedRewards[tier].length;
    if (unlockTarget <= alreadyUnlocked) {
      continue;
    }

    const available = (rewardsData[tier] || []).filter(
      (reward) => !user.unlockedRewards[tier].includes(reward.id)
    );

    while (user.unlockedRewards[tier].length < unlockTarget && available.length) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const reward = available.splice(randomIndex, 1)[0];
      user.unlockedRewards[tier].push(reward.id);
    }
  }
}

function renderRewards(user) {
  const blocks = [];

  for (const tier of ["A1", "A2", "B1"]) {
    const unlockedIds = user.unlockedRewards[tier];
    const rewards = (rewardsData[tier] || []).filter((r) => unlockedIds.includes(r.id));

    blocks.push(`<h3>${tier}</h3>`);

    if (!rewards.length) {
      blocks.push(`<p class="muted">No ${tier} rewards unlocked yet.</p>`);
      continue;
    }

    for (const reward of rewards) {
      blocks.push(`
        <div class="reward-item">
          <strong>${reward.title}</strong><br />
          <span class="muted">Type: ${reward.type}</span><br />
          <a href="${reward.path}" target="_blank" rel="noopener">Open reward file</a>
        </div>
      `);
    }
  }

  ui.rewardList.innerHTML = blocks.join("");
}
