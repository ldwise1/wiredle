// script.js (module)
const DATA_URL = "./data/characters.json";

const categories = [
  { key: "seasons", label: "Seasons" },
  { key: "first", label: "First appearance" },
  { key: "last", label: "Last appearance" },
  { key: "episodeCount", label: "Episode count" },
  { key: "gender", label: "Gender" },
  { key: "orgs", label: "Organization" },
  { key: "deceased", label: "Deceased" },
];

const categoryTooltips = {
  seasons:
    "Green: exact seasons match\nYellow: at least one season matches\nRed: no seasons match",
  first:
    "Green: first appearance exact episode\nYellow: first appearance same season\nRed: different season",
  last: "Green: last appearance exact episode\nYellow: last appearance same season\nRed: different season",
  episodeCount:
    "Green: exact episode count\nYellow: within ±5 episodes\nRed: more than 5 difference",
  gender: "Green: gender matches\nRed: gender does not match",
  orgs: "Green: exact organizations match\nYellow: at least one organization matches\nRed: no organizations match",
  deceased: "Green: guess matches deceased status\nRed: guess does not match",
};

let characters = [];
let secret = null;
let currentSuggestions = [];
let incorrectGuesses = 0;
let letterHintEnabled = true;
let revealedIndices = new Set();
let guessedThisRound = new Set();

document
  .getElementById("letter-hint-toggle")
  .addEventListener("change", (e) => {
    letterHintEnabled = e.target.checked;
    if (letterHintEnabled) {
      updateLetterHint();
    } else {
      document.getElementById("letter-hint").textContent = "";
    }
  });

// Utility functions

function generateLetterHint() {
  if (!secret || !letterHintEnabled) return "";

  const name = secret.name;
  const letters = name.split("");
  const hint = letters.map((char, idx) => {
    if (char === " ") return " "; // preserve spaces
    return revealedIndices.has(idx) ? char : "_";
  });
  return hint.join("");
}

function normalize(str) {
  if (str === undefined || str === null) return "";
  return String(str).trim().toLowerCase();
}

function uniqueArray(arr) {
  return Array.from(new Set(arr));
}

function parseSeasonEpisode(se) {
  if (!se || typeof se !== "string") return null;
  const match = se
    .trim()
    .toLowerCase()
    .match(/^s(\d+)e(\d+)$/);
  if (!match) return null;
  return { season: Number(match[1]), episode: Number(match[2]) };
}

function colorToCss(color) {
  if (color === "green") return "var(--green)";
  if (color === "yellow") return "var(--yellow)";
  return "var(--red)";
}

// Comparison functions
function compareSeasons(guessSeasons, secretSeasons) {
  const g = (guessSeasons || []).map(Number).filter((n) => !isNaN(n));
  const s = (secretSeasons || []).map(Number).filter((n) => !isNaN(n));
  if (!g.length || !s.length) return "red";

  const setS = new Set(s);
  if (g.length === s.length && g.every((x) => setS.has(x))) return "green";
  if (g.some((x) => setS.has(x))) return "yellow";
  return "red";
}

function compareFirstOrLast(catKey, guessVal, secretVal) {
  const g = parseSeasonEpisode(guessVal);
  const s = parseSeasonEpisode(secretVal);
  if (!g || !s) return "red";
  if (g.season === s.season && g.episode === s.episode) return "green";
  if (g.season === s.season) return "yellow";
  return "red";
}

function compareEpisodeCount(guessCount, secretCount) {
  const g = Number(guessCount);
  const s = Number(secretCount);
  if (isNaN(g) || isNaN(s)) return "red";
  if (g === s) return "green";
  if (Math.abs(g - s) <= 5) return "yellow";
  return "red";
}

function compareGender(guessGender, secretGender) {
  if (!guessGender || !secretGender) return "red";
  return normalize(guessGender) === normalize(secretGender) ? "green" : "red";
}

function compareOrgs(guessOrgs, secretOrgs) {
  const g = (guessOrgs || []).map(normalize).filter(Boolean);
  const s = (secretOrgs || []).map(normalize).filter(Boolean);
  if (!g.length || !s.length) return "red";

  const setS = new Set(s);
  const equal = g.length === s.length && g.every((x) => setS.has(x));
  if (equal) return "green";
  if (g.some((x) => setS.has(x))) return "yellow";
  return "red";
}

function compareDeceased(guess, secret) {
  if (!guess || !secret) return "red";
  return normalize(guess) === normalize(secret) ? "green" : "red";
}

function compareCategory(catKey, guessObj, secretObj) {
  switch (catKey) {
    case "seasons":
      return compareSeasons(guessObj.seasons, secretObj.seasons);
    case "first":
    case "last":
      return compareFirstOrLast(catKey, guessObj[catKey], secretObj[catKey]);
    case "episodeCount":
      return compareEpisodeCount(guessObj.episodeCount, secretObj.episodeCount);
    case "gender":
      return compareGender(guessObj.gender, secretObj.gender);
    case "orgs":
      return compareOrgs(guessObj.orgs, secretObj.orgs);
    case "deceased":
      return compareDeceased(guessObj.deceased, secretObj.deceased);
    default:
      return "red";
  }
}

// Game functions
function pickRandomCharacter() {
  if (!characters.length) return null;
  return characters[Math.floor(Math.random() * characters.length)];
}

function formatValueForDisplay(key, val) {
  if (val === undefined || val === null) return "—";
  if (key === "seasons" || key === "orgs") return (val || []).join(", ") || "—";
  return String(val);
}

// Rendering
function renderFeedback(guessObj) {
  const feedbackGrid = document.getElementById("feedback-grid");
  const row = document.createElement("div");
  row.className = "feedback-row";

  const nameCard = document.createElement("div");
  nameCard.className = "feedback-card";
  nameCard.style.background = "#2c2c2c";
  nameCard.style.color = "#fff";
  nameCard.textContent = guessObj.name;
  row.appendChild(nameCard);

  categories.forEach((cat) => {
    const color = compareCategory(cat.key, guessObj, secret);
    const card = document.createElement("div");
    card.className = "feedback-card";
    card.style.background = colorToCss(color);
    card.style.color = "#fff";
    card.textContent = formatValueForDisplay(cat.key, guessObj[cat.key]);
    row.appendChild(card);
  });

  feedbackGrid.appendChild(row);
}

function renderFeedbackHeader() {
  const feedbackGrid = document.getElementById("feedback-grid");
  feedbackGrid.innerHTML = "";

  const headerRow = document.createElement("div");
  headerRow.className = "feedback-row";

  const nameHeader = document.createElement("div");
  nameHeader.className = "feedback-card feedback-header";
  nameHeader.style.background = "#2c2c2c";
  nameHeader.style.color = "#fff";
  nameHeader.textContent = "Guess";
  headerRow.appendChild(nameHeader);

  categories.forEach((cat) => {
    const catHeader = document.createElement("div");
    catHeader.className = "feedback-card feedback-header category-header";
    catHeader.style.background = "#2c2c2c";
    catHeader.style.color = "#fff";
    catHeader.textContent = cat.label;
    catHeader.setAttribute("data-tooltip", categoryTooltips[cat.key] || "");
    headerRow.appendChild(catHeader);
  });

  feedbackGrid.appendChild(headerRow);
}

// Suggestions / Typeahead
let suggestionOpen = false;

function buildIndex() {
  characters.forEach((c) => {
    const tokens = new Set();
    tokens.add(normalize(c.name));
    (c.aliases || []).forEach((a) => tokens.add(normalize(a)));
    (c.orgs || []).forEach((o) => tokens.add(normalize(o)));
    c.searchTokens = Array.from(tokens);
  });
}

function matchCharacters(query) {
  const q = normalize(query);
  if (!q) return [];

  const starts = [];
  const contains = [];

  for (const c of characters) {
    if (guessedThisRound.has(c.name)) continue;
    let bestScore = null;
    for (const t of c.searchTokens) {
      if (t.startsWith(q)) {
        bestScore = "start";
        break;
      }
      if (t.includes(q)) bestScore = "contain";
    }
    if (bestScore === "start") starts.push(c);
    else if (bestScore === "contain") contains.push(c);
  }

  return starts.concat(contains).slice(0, 8);
}

function renderSuggestions(items) {
  currentSuggestions = items;
  const container = document.getElementById("suggestions");
  container.innerHTML = "";

  if (!items.length) {
    container.classList.add("hidden");
    suggestionOpen = false;
    return;
  }

  suggestionOpen = true;
  container.classList.remove("hidden");

  items.forEach((c) => {
    const el = document.createElement("div");
    el.className = "suggestion";
    el.setAttribute("role", "option");
    el.innerHTML = `
      <div>
        <div class="meta">${c.name}</div>
        <div class="aliases">${(c.aliases || []).join(" • ")}</div>
      </div>
    `;
    el.addEventListener("click", () => {
      document.getElementById("guess").value = c.name;
      container.classList.add("hidden");
      suggestionOpen = false;
      document.getElementById("guess").focus();
    });
    container.appendChild(el);
  });
}

function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Game logic
function newRound() {
  updateLetterHint();
  secret = pickRandomCharacter();
  incorrectGuesses = 0;
  revealedIndices = new Set();
  guessedThisRound.clear();
  updateLetterHint(); // clear hints
  document.getElementById("result-area").textContent = secret
    ? "New round started. Make a guess!"
    : "No characters loaded.";
  document.getElementById("guess").value = "";
  renderFeedbackHeader();
  document.getElementById("submit").style.display = "inline-block";
  document.getElementById("reveal").style.display = "inline-block";
}

function findCharacterByNameOrAlias(name) {
  const n = normalize(name);
  if (!n) return null;
  return (
    characters.find((c) => {
      if (normalize(c.name) === n) return true;
      for (const a of c.aliases || []) {
        if (normalize(a) === n) return true;
      }
      return false;
    }) || null
  );
}

function onGuess() {
  const input = document.getElementById("guess");
  let name = input.value.trim();
  if (!name) return;

  const exactMatch = findCharacterByNameOrAlias(name);
  if (!exactMatch) {
    if (currentSuggestions.length > 0) {
      name = currentSuggestions[0].name;
    } else {
      document.getElementById("result-area").textContent =
        "No matching character — please choose from the suggestions.";
      return;
    }
  }

  const guessObj = findCharacterByNameOrAlias(name);
  if (!guessObj) return;

  const correct = normalize(guessObj.name) === normalize(secret.name);

  // render feedback card entries
  renderFeedback(guessObj);
  guessedThisRound.add(guessObj.name);

  if (correct) {
    document.getElementById(
      "result-area"
    ).textContent = `Correct — it's ${secret.name}!`;
    document.getElementById("submit").style.display = "none";
    document.getElementById("reveal").style.display = "none";
    // reveal full letters
    revealedIndices = new Set(secret.name.split("").map((_, i) => i));
    updateLetterHint();
  } else {
    document.getElementById("result-area").textContent = `Incorrect.`;
    incorrectGuesses++;

    if (incorrectGuesses >= 5 && letterHintEnabled) {
      const nameChars = secret.name.split("");
      const unrevealedIndices = [];
      for (let i = 0; i < nameChars.length; i++) {
        if (nameChars[i] !== " " && !revealedIndices.has(i))
          unrevealedIndices.push(i);
      }

      if (unrevealedIndices.length) {
        const randIdx =
          unrevealedIndices[
            Math.floor(Math.random() * unrevealedIndices.length)
          ];
        revealedIndices.add(randIdx);
      }
      updateLetterHint();
    }
  }

  currentSuggestions = [];
  input.value = "";
}

function updateLetterHint() {
  const el = document.getElementById("letter-hint");
  if (!letterHintEnabled || incorrectGuesses < 5) {
    el.textContent = "";
    return;
  }
  el.textContent = generateLetterHint();
}

function revealSecret() {
  if (!secret) return;
  renderFeedback(secret);
  document.getElementById(
    "result-area"
  ).textContent = `Revealed — it's ${secret.name}!`;
  document.getElementById("submit").style.display = "none";
  document.getElementById("reveal").style.display = "none";
}

// Initialize
async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    characters = await response.json();
  } catch (err) {
    console.error("Failed to fetch characters.json, using empty list", err);
    characters = [];
  }
  buildIndex();
  secret = pickRandomCharacter();
  document.getElementById("result-area").textContent = secret
    ? "New round started. Make a guess!"
    : "No characters loaded.";
  renderFeedbackHeader();
  updateLetterHint();
}

// Event listeners
document.getElementById("submit").addEventListener("click", onGuess);
document.getElementById("new-round").addEventListener("click", newRound);
document.getElementById("reveal").addEventListener("click", revealSecret);

document.getElementById("guess").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    onGuess();
  }
  if (e.key === "ArrowDown" && suggestionOpen) {
    const first = document.querySelector("#suggestions .suggestion");
    if (first) first.focus();
  }
});

const onInputChange = debounce((e) => {
  const query = e.target.value;
  renderSuggestions(query ? matchCharacters(query) : []);
}, 140);

document.getElementById("guess").addEventListener("input", onInputChange);

document.addEventListener("click", (e) => {
  if (!e.target.closest(".typeahead-wrap")) {
    const container = document.getElementById("suggestions");
    container.classList.add("hidden");
    suggestionOpen = false;
  }
});

// Kick off
loadData();
