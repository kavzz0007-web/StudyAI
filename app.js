"use strict";

/* ==========================================
   STUDYAI — FRONTEND APPLICATION
========================================== */

const $ = (selector) => document.querySelector(selector);

const state = {
  messagesSent: 0,
  notesGenerated: 0,
  files: [],
  selectedPdf: null,
  quiz: [],
  quizAnswers: {},
  activity: []
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_SIZE = 3 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ["pdf", "txt", "docx", "pptx"];

const PAGE_INFO = {
  home: ["Welcome to StudyAI", "Make learning easier, every day."],
  chat: ["AI Study Chat", "Ask questions and understand concepts."],
  notes: ["Notes Generator", "Create your personalized study notes."],
  youtube: ["YouTube Summarizer", "Turn educational videos into notes."],
  quiz: ["Practice Quiz", "Test your knowledge and improve."],
  files: ["Study Files", "Upload files and analyze PDFs."]
};

/* ---------- HELPERS ---------- */

function getElement(id) {
  return document.getElementById(id);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

function showToast(message) {
  const toast = getElement("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function setLoading(button, loading, loadingText) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText || "Please wait...";
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;

    button.disabled = false;
  }
}

function setOutput(id, text) {
  const element = getElement(id);

  if (!element) return;

  // Plain text rendering avoids injecting AI-generated HTML.
  element.textContent = String(text ?? "");
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function getExtension(filename) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function updateStats() {
  getElement("messagesCount").textContent = state.messagesSent;
  getElement("notesCount").textContent = state.notesGenerated;
  getElement("filesCount").textContent = state.files.length;
}

/* ---------- API REQUESTS ---------- */

async function callAPI(endpoint, payload) {
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(
      "Unable to connect to the server. Check your internet connection and deployment."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      "The server returned an invalid response. Check your API deployment."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Request failed with status " + response.status
    );
  }

  return data;
}

function extractText(data, keys) {
  for (const key of keys) {
    if (typeof data[key] === "string" && data[key].trim()) {
      return data[key].trim();
    }
  }

  if (data.data && typeof data.data === "string") {
    return data.data;
  }

  return "";
}

/* ---------- PAGE NAVIGATION ---------- */

function navigateTo(pageName) {
  if (!PAGE_INFO[pageName]) {
    pageName = "home";
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const target = getElement(pageName + "Page");

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  getElement("pageTitle").textContent = PAGE_INFO[pageName][0];
  getElement("pageSubtitle").textContent = PAGE_INFO[pageName][1];

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initializeNavigation() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.go);
    });
  });
}

/* ---------- AI CHAT ---------- */

function addChatMessage(text, role) {
  const container = getElement("chatMessages");
  const message = document.createElement("div");

  message.className = "message " + role;
  message.textContent = text;

  container.appendChild(message);
  container.scrollTop = container.scrollHeight;

  return message;
}

function initializeChat() {
  const form = getElement("chatForm");
  const input = getElement("chatInput");
  const button = getElement("sendChat");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
      showToast("Please enter your question.");
      return;
    }

    addChatMessage(message, "user");

    input.value = "";
    state.messagesSent++;
    updateStats();

    const pending = addChatMessage("Thinking...", "assistant");

    setLoading(button, true, "Thinking...");

    try {
      const data = await callAPI("/api/chat", {
        message: message
      });

      const answer = extractText(data, [
        "reply",
        "response",
        "answer",
        "text",
        "result"
      ]);

      if (!answer) {
        throw new Error("The AI returned an empty answer.");
      }

      pending.textContent = answer;
    } catch (error) {
      pending.textContent = "Error: " + error.message;
    } finally {
      setLoading(button, false);
    }
  });

  getElement("clearChat").addEventListener("click", () => {
    getElement("chatMessages").replaceChildren();

    addChatMessage(
      "Chat cleared! 👋 Ask me a new study question.",
      "assistant"
    );

    showToast("Conversation cleared.");
  });
}

/* ---------- NOTES GENERATOR ---------- */

function initializeNotes() {
  const form = getElement("notesForm");
  const button = getElement("generateNotes");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const topic = getElement("notesTopic").value.trim();
    const language = getElement("notesLanguage").value;
    const detail = getElement("notesDetail").value;

    if (!topic) {
      showToast("Enter a topic first.");
      return;
    }

    setOutput("notesOutput", "Generating notes...");

    setLoading(button, true, "Generating...");

    try {
      const data = await callAPI("/api/notes", {
        topic: topic,
        language: language,
        detail: detail
      });

      const notes = extractText(data, [
        "notes",
        "result",
        "text",
        "response",
        "answer"
      ]);

      if (!notes) {
        throw new Error("No notes returned by the server.");
      }

      setOutput("notesOutput", notes);

      state.notesGenerated++;
      updateStats();

      showToast("Notes generated successfully!");
    } catch (error) {
      setOutput("notesOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------- YOUTUBE SUMMARIZER ---------- */

function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "youtu.be" ||
      hostname.endsWith(".youtu.be")
    ) {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }

      const parts = parsed.pathname.split("/").filter(Boolean);

      if (
        ["embed", "shorts", "live"].includes(parts[0])
      ) {
        return parts[1] || "";
      }
    }
  } catch (error) {
    return "";
  }

  return "";
}

function initializeYouTube() {
  const form = getElement("youtubeForm");
  const button = getElement("summarizeVideo");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = getElement("youtubeUrl").value.trim();
    const maxLength = getElement("youtubeLength").value;
    const videoId = getYouTubeVideoId(url);

    if (!videoId) {
      showToast("Enter a valid YouTube video URL.");
      return;
    }

    setOutput("youtubeOutput", "Preparing video summary...");
    setLoading(button, true, "Summarizing...");

    try {
      const data = await callAPI("/api/youtube", {
        url: url,
        videoId: videoId,
        maxLength: maxLength
      });

      const summary = extractText(data, [
        "summary",
        "result",
        "transcript",
        "text",
        "response",
        "answer"
      ]);

      if (!summary) {
        throw new Error(
          "No summary returned. The backend may need access to the video's transcript."
        );
      }

      setOutput("youtubeOutput", summary);
      showToast("Video summary received!");
    } catch (error) {
      setOutput("youtubeOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------- QUIZ ---------- */

function parseQuizResponse(data) {
  let quizData = data;

  if (typeof quizData === "string") {
    quizData = JSON.parse(quizData);
  }

  if (quizData && typeof quizData.result === "string") {
    try {
      quizData = JSON.parse(quizData.result);
    } catch (error) {
      // Continue checking other response fields.
    }
  }

  if (quizData && typeof quizData.text === "string") {
    try {
      quizData = JSON.parse(quizData.text);
    } catch (error) {
      // Continue checking other response fields.
    }
  }

  if (quizData && Array.isArray(quizData.questions)) {
    return quizData.questions;
  }

  if (Array.isArray(quizData)) {
    return quizData;
  }

  throw new Error(
    "Quiz response must contain a JSON array of questions."
  );
}

function normalizeQuestion(question) {
  const options = question.options || question.choices;

  if (!Array.isArray(options) || options.length < 2) {
    throw new Error("A quiz question has invalid answer choices.");
  }

  let answer = question.answer ?? question.correctAnswer ?? question.correct;

  if (typeof answer === "string") {
    const letter = answer.trim().toUpperCase();

    if (/^[A-D]$/.test(letter)) {
      answer = letter.charCodeAt(0) - 65;
    } else {
      const matchingIndex = options.findIndex((option) => {
        const optionText =
          typeof option === "string" ? option : option.text;

        return String(optionText).trim() === answer.trim();
      });

      if (matchingIndex !== -1) {
        answer = matchingIndex;
      }
    }
  }

  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    throw new Error(
      "A quiz question is missing a valid correct answer."
    );
  }

  return {
    question: String(question.question || question.text || "Question"),
    options: options.map((option) => {
      if (typeof option === "string") return option;
      return String(option.text || option.label || "");
    }),
    answer: answer,
    explanation: String(question.explanation || "")
  };
}

function renderQuiz() {
  const output = getElement("quizOutput");
  output.replaceChildren();

  if (!state.quiz.length) return;

  let score = 0;

  state.quiz.forEach((question, questionIndex) => {
    if (state.quizAnswers[questionIndex] === question.answer) {
      score++;
    }

    const block = document.createElement("div");
    block.style.marginBottom = "24px";

    const heading = document.createElement("h3");
    heading.textContent =
      (questionIndex + 1) + ". " + question.question;

    block.appendChild(heading);

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent =
        String.fromCharCode(65 + optionIndex) + ". " + option;

      const selected = state.quizAnswers[questionIndex];

      if (selected === optionIndex) {
        button.classList.add("selected");
      }

      if (selected !== undefined && optionIndex === question.answer) {
        button.classList.add("correct");
      } else if (selected === optionIndex && selected !== question.answer) {
        button.classList.add("wrong");
      }

      button.addEventListener("click", () => {
        if (state.quizAnswers[questionIndex] !== undefined) {
          return;
        }

        state.quizAnswers[questionIndex] = optionIndex;
        renderQuiz();
      });

      block.appendChild(button);
    });

    if (state.quizAnswers[questionIndex] !== undefined) {
      const explanation = document.createElement("p");
      explanation.className = "muted";

      explanation.textContent =
        "Correct answer: " +
        String.fromCharCode(65 + question.answer) +
        ". " +
        question.options[question.answer] +
        (question.explanation ? "\n" + question.explanation : "");

      block.appendChild(explanation);
    }

    output.appendChild(block);
  });

  const answered = Object.keys(state.quizAnswers).length;
  const scoreLabel = document.createElement("p");

  scoreLabel.className = "muted";
  scoreLabel.textContent =
    "Answered: " + answered + "/" + state.quiz.length +
    " · Current score: " + score;

  output.prepend(scoreLabel);
}

function initializeQuiz() {
  const form = getElement("quizForm");
  const button = getElement("generateQuiz");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const topic = getElement("quizTopic").value.trim();
    const count = Number(getElement("quizCount").value);
    const difficulty = getElement("quizDifficulty").value;

    if (!topic) {
      showToast("Enter a quiz topic.");
      return;
    }

    setOutput("quizOutput", "Generating quiz questions...");
    setLoading(button, true, "Generating...");

    try {
      const data = await callAPI("/api/quiz", {
        topic: topic,
        count: count,
        difficulty: difficulty
      });

      state.quiz = parseQuizResponse(data).map(normalizeQuestion);
      state.quizAnswers = {};

      if (!state.quiz.length) {
        throw new Error("No questions were generated.");
      }

      renderQuiz();
      showToast("Quiz is ready!");
    } catch (error) {
      state.quiz = [];
      state.quizAnswers = {};
      setOutput("quizOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------- FILE UPLOAD ---------- */

function renderFiles() {
  const list = getElement("fileList");
  list.replaceChildren();

  state.files.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "file-item";

    const info = document.createElement("span");
    info.textContent = "📄 " + file.name + " · " + formatSize(file.size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-danger";
    remove.textContent = "Remove";
    remove.style.marginTop = "0";

    remove.addEventListener("click", () => {
      if (state.selectedPdf === file) {
        state.selectedPdf = null;
      }

      state.files.splice(index, 1);

      renderFiles();
      updateStats();
      updateSelectedPdf();

      showToast("File removed.");
    });

    row.append(info, remove);
    list.appendChild(row);
  });

  getElement("fileCount").textContent =
    state.files.length + " file(s) selected";
}

function updateSelectedPdf() {
  const label = getElement("selectedPdfName");

  if (state.selectedPdf) {
    label.textContent = "Selected PDF: " + state.selectedPdf.name;
  } else {
    label.textContent = "No PDF selected yet.";
  }
}

function initializeFiles() {
  const input = getElement("fileInput");

  input.addEventListener("change", () => {
    const incoming = Array.from(input.files || []);

    for (const file of incoming) {
      const extension = getExtension(file.name);

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        showToast("Unsupported file: " + file.name);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        showToast(file.name + " exceeds the 10 MB limit.");
        continue;
      }

      if (state.files.some((existing) =>
        existing.name === file.name &&
        existing.size === file.size
      )) {
        continue;
      }

      state.files.push(file);
    }

    renderFiles();
    updateStats();

    if (!state.selectedPdf) {
      state.selectedPdf =
        state.files.find((file) =>
          getExtension(file.name) === "pdf"
        ) || null;
    }

    updateSelectedPdf();

    // Reset so the same file can be selected again after removal.
    input.value = "";
  });

  getElement("clearFiles").addEventListener("click", () => {
    state.files = [];
    state.selectedPdf = null;

    renderFiles();
    updateStats();
    updateSelectedPdf();

    setOutput("pdfOutput", "");
    showToast("Selected files cleared.");
  });

  getElement("fileList").addEventListener("click", (event) => {
    const row = event.target.closest(".file-item");
    if (!row) return;
  });
}

/* ---------- PDF ANALYZER ---------- */

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");

      if (commaIndex === -1) {
        reject(new Error("Could not read PDF data."));
        return;
      }

      resolve(result.slice(commaIndex + 1));
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the PDF file."));
    };

    reader.readAsDataURL(file);
  });
}

function initializePdfAnalyzer() {
  const form = getElement("pdfForm");
  const button = getElement("analyzePdfButton");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = state.selectedPdf;

    if (!file) {
      showToast("Upload and select a PDF first.");
      return;
    }

    if (getExtension(file.name) !== "pdf") {
      showToast("Please select a PDF file.");
      return;
    }

    if (file.size > MAX_PDF_SIZE) {
      showToast("PDF Analyzer supports PDFs up to 3 MB.");
      return;
    }

    const task = getElement("pdfTask").value;
    const language = getElement("pdfLanguage").value;

    setOutput("pdfOutput", "Reading PDF and generating your study material...");
    setLoading(button, true, "Analyzing...");

    try {
      const fileData = await readFileAsBase64(file);

      const data = await callAPI("/api/analyze-pdf", {
        fileName: file.name,
        fileData: fileData,
        task: task,
        language: language
      });

      const result = extractText(data, [
        "result",
        "text",
        "response",
        "answer"
      ]);

      if (!result) {
        throw new Error("The server did not return a PDF analysis.");
      }

      setOutput(
        "pdfOutput",
        result + (data.textTruncated
          ? "\n\nNote: Only part of the PDF text was analyzed."
          : "")
      );

      showToast("PDF analysis complete!");
    } catch (error) {
      setOutput("pdfOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------- COPY BUTTONS ---------- */

function initializeCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = getElement(button.dataset.copy);

      if (!target || !target.textContent.trim()) {
        showToast("There is no content to copy yet.");
        return;
      }

      try {
        await navigator.clipboard.writeText(target.textContent);
        showToast("Copied to clipboard!");
      } catch (error) {
        // Fallback for browsers that do not support Clipboard API.
        const temporary = document.createElement("textarea");
        temporary.value = target.textContent;
        temporary.style.position = "absolute";
        temporary.style.left = "-9999px";

        document.body.appendChild(temporary);
        temporary.select();

        const copied = document.execCommand("copy");
        temporary.remove();

        showToast(
          copied ? "Copied to clipboard!" : "Copy failed. Please select the text."
        );
      }
    });
  });
}

/* ---------- INITIALIZATION ---------- */

function initializeStudyAI() {
  try {
    initializeNavigation();
    initializeChat();
    initializeNotes();
    initializeYouTube();
    initializeQuiz();
    initializeFiles();
    initializePdfAnalyzer();
    initializeCopyButtons();

    renderFiles();
    updateSelectedPdf();
    updateStats();
    navigateTo("home");

    console.log("StudyAI initialized successfully.");
  } catch (error) {
    console.error("StudyAI initialization failed:", error);
    showToast("StudyAI could not initialize. Check app.js for errors.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeStudyAI, {
    once: true
  });
} else {
  initializeStudyAI();
                         }
