"use strict";

/* =====================================================
   STUDYAI - COMPLETE FRONTEND JAVASCRIPT
   Features:
   Navigation, AI Chat, Notes, YouTube, Quiz,
   File Upload, PDF Analyzer, Copy, Error Handling
===================================================== */

/* ---------------- CONFIGURATION ---------------- */

const CONFIG = {
  endpoints: {
    chat: "/api/chat",
    notes: "/api/notes",
    youtube: "/api/youtube",
    quiz: "/api/quiz",
    pdf: "/api/analyze-pdf"
  },

  maxFileSize: 10 * 1024 * 1024,
  maxPdfSize: 3 * 1024 * 1024,

  allowedExtensions: ["pdf", "txt", "docx", "pptx"]
};

/* ---------------- APPLICATION STATE ---------------- */

const state = {
  messagesSent: 0,
  notesGenerated: 0,
  files: [],
  selectedPdf: null,
  quiz: [],
  quizAnswers: {},
  busy: new Set()
};

const PAGE_INFO = {
  home: {
    title: "Welcome to StudyAI",
    subtitle: "Make learning easier, every day."
  },

  chat: {
    title: "AI Study Chat",
    subtitle: "Ask questions and understand concepts."
  },

  notes: {
    title: "Notes Generator",
    subtitle: "Create personalized study notes."
  },

  youtube: {
    title: "YouTube Summarizer",
    subtitle: "Turn educational videos into summaries."
  },

  quiz: {
    title: "Practice Quiz",
    subtitle: "Test your knowledge."
  },

  files: {
    title: "Study Files",
    subtitle: "Upload files and analyze PDFs."
  }
};

/* ---------------- DOM HELPERS ---------------- */

function $(selector) {
  return document.querySelector(selector);
}

function getElement(id) {
  return document.getElementById(id);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function getExtension(filename) {
  const parts = String(filename).toLowerCase().split(".");

  return parts.length > 1 ? parts.pop() : "";
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + " B";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function showToast(message) {
  let toast = getElement("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";

    Object.assign(toast.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#24243a",
      color: "#fff",
      padding: "12px 18px",
      borderRadius: "12px",
      zIndex: "99999",
      maxWidth: "90%",
      fontSize: "14px"
    });

    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.display = "block";

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.style.display = "none";
  }, 3200);
}

function setOutput(id, message) {
  const element = getElement(id);

  if (element) {
    element.textContent = String(message ?? "");
  }
}

function setLoading(button, loading, text) {
  if (!button) return;

  if (loading) {
    if (button.dataset.loading === "true") return;

    button.dataset.originalText = button.textContent;
    button.dataset.loading = "true";

    button.disabled = true;
    button.textContent = text || "Please wait...";
  } else {
    button.disabled = false;

    if (button.dataset.originalText !== undefined) {
      button.textContent = button.dataset.originalText;
    }

    delete button.dataset.originalText;
    delete button.dataset.loading;
  }
}

function updateStats() {
  const messages = getElement("messagesCount");
  const notes = getElement("notesCount");
  const files = getElement("filesCount");

  if (messages) {
    messages.textContent = state.messagesSent;
  }

  if (notes) {
    notes.textContent = state.notesGenerated;
  }

  if (files) {
    files.textContent = state.files.length;
  }
}

/* ---------------- API REQUEST HANDLER ---------------- */

/*
  This function reads the response as text first.
  It reports HTTP errors and invalid JSON clearly.
*/

async function callAPI(endpoint, payload) {
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },

      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("Network request failed:", endpoint, error);

    throw new Error(
      "Cannot connect to the server. Check your internet and deployed website."
    );
  }

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    console.error("Invalid API response:", {
      endpoint: endpoint,
      status: response.status,
      body: responseText.slice(0, 1500)
    });

    if (response.status === 404) {
      throw new Error(
        "API route not found (404). Check the api folder and Vercel deployment."
      );
    }

    if (response.status >= 500) {
      throw new Error(
        "Server error (" + response.status +
        "). Check Vercel Function Logs and the API code."
      );
    }

    throw new Error(
      "Server returned invalid JSON (HTTP " +
      response.status +
      "). The endpoint may be returning an HTML error page."
    );
  }

  if (!response.ok) {
    console.error("API request error:", endpoint, data);

    throw new Error(
      data.error ||
      data.message ||
      "Request failed with HTTP " + response.status
    );
  }

  return data;
}

function extractText(data, possibleKeys) {
  if (typeof data === "string") {
    return data.trim();
  }

  for (const key of possibleKeys) {
    if (
      data &&
      typeof data[key] === "string" &&
      data[key].trim()
    ) {
      return data[key].trim();
    }
  }

  if (data && data.data && typeof data.data === "string") {
    return data.data.trim();
  }

  return "";
}

/* ---------------- NAVIGATION ---------------- */

function navigateTo(pageName) {
  if (!PAGE_INFO[pageName]) {
    pageName = "home";
  }

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const target = getElement(pageName + "Page");

  if (target) {
    target.classList.add("active");
  } else {
    console.warn("Missing page element:", pageName + "Page");
  }

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  const title = getElement("pageTitle");
  const subtitle = getElement("pageSubtitle");

  if (title) {
    title.textContent = PAGE_INFO[pageName].title;
  }

  if (subtitle) {
    subtitle.textContent = PAGE_INFO[pageName].subtitle;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function initializeNavigation() {
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.go);
    });
  });
}

/* ---------------- AI CHAT ---------------- */

function addChatMessage(message, role) {
  const container = getElement("chatMessages");

  if (!container) return null;

  const bubble = document.createElement("div");

  bubble.className = "message " + role;
  bubble.textContent = message;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  return bubble;
}

function initializeChat() {
  const form = getElement("chatForm");
  const input = getElement("chatInput");
  const button = getElement("sendChat");

  if (!form || !input) {
    console.warn("Chat elements were not found.");
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
      showToast("Enter a question first.");
      return;
    }

    addChatMessage(message, "user");

    input.value = "";

    state.messagesSent++;
    updateStats();

    const pending = addChatMessage("Thinking...", "assistant");

    setLoading(button, true, "Thinking...");

    try {
      const data = await callAPI(
        CONFIG.endpoints.chat,
        {
          message: message
        }
      );

      const answer = extractText(data, [
        "reply",
        "response",
        "answer",
        "text",
        "result"
      ]);

      if (!answer) {
        throw new Error(
          "The API returned no answer. Check api/chat.js."
        );
      }

      if (pending) {
        pending.textContent = answer;
      }
    } catch (error) {
      console.error("Chat error:", error);

      if (pending) {
        pending.textContent = "Sorry, " + error.message;
      }
    } finally {
      setLoading(button, false);
      input.focus();
    }
  });

  const clearButton = getElement("clearChat");

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      const container = getElement("chatMessages");

      if (container) {
        container.replaceChildren();
      }

      addChatMessage(
        "Chat cleared! Ask me a new study question.",
        "assistant"
      );

      showToast("Conversation cleared.");
    });
  }
}

/* ---------------- NOTES GENERATOR ---------------- */

function initializeNotes() {
  const form = getElement("notesForm");
  const button = getElement("generateNotes");

  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const topic = getElement("notesTopic")?.value.trim();

    const language =
      getElement("notesLanguage")?.value || "Simple English";

    const detail =
      getElement("notesDetail")?.value || "exam-ready";

    if (!topic) {
      showToast("Enter a topic first.");
      return;
    }

    setOutput("notesOutput", "Generating notes...");

    setLoading(button, true, "Generating...");

    try {
      const data = await callAPI(
        CONFIG.endpoints.notes,
        {
          topic: topic,
          language: language,
          detail: detail
        }
      );

      const notes = extractText(data, [
        "notes",
        "result",
        "text",
        "response",
        "answer"
      ]);

      if (!notes) {
        throw new Error(
          "No notes received. Check the response from api/notes.js."
        );
      }

      setOutput("notesOutput", notes);

      state.notesGenerated++;
      updateStats();

      showToast("Notes generated successfully!");
    } catch (error) {
      console.error("Notes error:", error);

      setOutput("notesOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------------- YOUTUBE SUMMARY ---------------- */

function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "youtu.be") {
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

      if (["embed", "shorts", "live"].includes(parts[0])) {
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

  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const url = getElement("youtubeUrl")?.value.trim() || "";

    const maxLength =
      getElement("youtubeLength")?.value || "medium";

    const videoId = getYouTubeVideoId(url);

    if (!videoId) {
      showToast("Enter a valid YouTube URL.");
      return;
    }

    setOutput("youtubeOutput", "Generating video summary...");

    setLoading(button, true, "Summarizing...");

    try {
      const data = await callAPI(
        CONFIG.endpoints.youtube,
        {
          url: url,
          videoId: videoId,
          maxLength: maxLength
        }
      );

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
          "No summary returned. Check api/youtube.js and transcript access."
        );
      }

      setOutput("youtubeOutput", summary);

      showToast("Video summary received!");
    } catch (error) {
      console.error("YouTube error:", error);

      setOutput("youtubeOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------------- QUIZ GENERATOR ---------------- */

function parseQuizResponse(data) {
  let parsed = data;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (typeof parsed !== "string") break;

    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      throw new Error(
        "The quiz API returned invalid JSON. Check api/quiz.js."
      );
    }
  }

  if (parsed && typeof parsed.result === "string") {
    try {
      parsed = JSON.parse(parsed.result);
    } catch (error) {
      // Handle below.
    }
  }

  if (parsed && Array.isArray(parsed.questions)) {
    return parsed.questions;
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  throw new Error(
    "Quiz response must contain a questions array."
  );
}

function normalizeQuestion(question) {
  const options = question.options || question.choices;

  if (!Array.isArray(options) || options.length < 2) {
    throw new Error("A quiz question has invalid answer options.");
  }

  const cleanOptions = options.map(option => {
    if (typeof option === "string") return option;

    return String(option.text || option.label || "");
  });

  let answer =
    question.answer ??
    question.correctAnswer ??
    question.correct;

  if (typeof answer === "string") {
    const letter = answer.trim().toUpperCase();

    if (/^[A-Z]$/.test(letter)) {
      answer = letter.charCodeAt(0) - 65;
    } else {
      const index = cleanOptions.findIndex(option =>
        option.trim() === answer.trim()
      );

      if (index >= 0) {
        answer = index;
      }
    }
  }

  if (
    !Number.isInteger(answer) ||
    answer < 0 ||
    answer >= cleanOptions.length
  ) {
    throw new Error(
      "A quiz question has no valid correct answer."
    );
  }

  return {
    question: String(question.question || question.text || "Question"),
    options: cleanOptions,
    answer: answer,
    explanation: String(question.explanation || "")
  };
}

function renderQuiz() {
  const output = getElement("quizOutput");

  if (!output) return;

  output.replaceChildren();

  if (!state.quiz.length) return;

  let score = 0;

  state.quiz.forEach((question, index) => {
    if (state.quizAnswers[index] === question.answer) {
      score++;
    }

    const block = document.createElement("div");
    block.style.marginBottom = "25px";

    const heading = document.createElement("h3");

    heading.textContent =
      (index + 1) + ". " + question.question;

    block.appendChild(heading);

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "choice";

      button.textContent =
        String.fromCharCode(65 + optionIndex) + ". " + option;

      const selected = state.quizAnswers[index];

      if (selected === optionIndex) {
        button.classList.add("selected");
      }

      if (
        selected !== undefined &&
        optionIndex === question.answer
      ) {
        button.classList.add("correct");
      }

      if (
        selected === optionIndex &&
        selected !== question.answer
      ) {
        button.classList.add("wrong");
      }

      button.addEventListener("click", () => {
        if (state.quizAnswers[index] !== undefined) return;

        state.quizAnswers[index] = optionIndex;
        renderQuiz();
      });

      block.appendChild(button);
    });

    if (state.quizAnswers[index] !== undefined) {
      const explanation = document.createElement("p");

      explanation.className = "muted";

      explanation.textContent =
        "Correct answer: " +
        String.fromCharCode(65 + question.answer) +
        ". " +
        question.options[question.answer] +
        (
          question.explanation
            ? "\n" + question.explanation
            : ""
        );

      block.appendChild(explanation);
    }

    output.appendChild(block);
  });

  const result = document.createElement("p");

  result.className = "muted";

  result.textContent =
    "Answered: " +
    Object.keys(state.quizAnswers).length +
    "/" +
    state.quiz.length +
    " · Score: " +
    score;

  output.prepend(result);
}

function initializeQuiz() {
  const form = getElement("quizForm");
  const button = getElement("generateQuiz");

  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const topic = getElement("quizTopic")?.value.trim();

    const count = Number(
      getElement("quizCount")?.value || 5
    );

    const difficulty =
      getElement("quizDifficulty")?.value || "medium";

    if (!topic) {
      showToast("Enter a quiz topic.");
      return;
    }

    setOutput("quizOutput", "Generating quiz questions...");

    setLoading(button, true, "Generating...");

    try {
      const data = await callAPI(
        CONFIG.endpoints.quiz,
        {
          topic: topic,
          count: count,
          difficulty: difficulty
        }
      );

      state.quiz = parseQuizResponse(data).map(normalizeQuestion);
      state.quizAnswers = {};

      if (!state.quiz.length) {
        throw new Error("The server returned no quiz questions.");
      }

      renderQuiz();

      showToast("Quiz is ready!");
    } catch (error) {
      console.error("Quiz error:", error);

      state.quiz = [];
      state.quizAnswers = {};

      setOutput("quizOutput", "Error: " + error.message);
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------------- FILE UPLOAD ---------------- */

function updateSelectedPdf() {
  const label = getElement("selectedPdfName");

  if (!label) return;

  if (state.selectedPdf) {
    label.textContent =
      "Selected PDF: " + state.selectedPdf.name;
  } else {
    label.textContent = "No PDF selected yet.";
  }
}

function renderFiles() {
  const list = getElement("fileList");

  if (list) {
    list.replaceChildren();

    state.files.forEach(file => {
      const row = document.createElement("div");
      row.className = "file-item";

      const details = document.createElement("span");

      details.textContent =
        "📄 " +
        file.name +
        " · " +
        formatFileSize(file.size);

      const actions = document.createElement("div");

      actions.style.display = "flex";
      actions.style.gap = "6px";

      if (getExtension(file.name) === "pdf") {
        const selectButton = document.createElement("button");

        selectButton.type = "button";
        selectButton.className = "btn btn-secondary";
        selectButton.textContent =
          state.selectedPdf === file ? "Selected" : "Use PDF";

        selectButton.style.marginTop = "0";

        selectButton.addEventListener("click", () => {
          state.selectedPdf = file;

          updateSelectedPdf();
          renderFiles();

          showToast("PDF selected.");
        });

        actions.appendChild(selectButton);
      }

      const removeButton = document.createElement("button");

      removeButton.type = "button";
      removeButton.className = "btn btn-danger";
      removeButton.textContent = "Remove";
      removeButton.style.marginTop = "0";

      removeButton.addEventListener("click", () => {
        if (state.selectedPdf === file) {
          state.selectedPdf = null;
        }

        state.files = state.files.filter(item => item !== file);

        if (!state.selectedPdf) {
          state.selectedPdf =
            state.files.find(item =>
              getExtension(item.name) === "pdf"
            ) || null;
        }

        renderFiles();
        updateSelectedPdf();
        updateStats();

        showToast("File removed.");
      });

      actions.appendChild(removeButton);

      row.append(details, actions);
      list.appendChild(row);
    });
  }

  const count = getElement("fileCount");

  if (count) {
    count.textContent =
      state.files.length + " file(s) selected";
  }

  updateStats();
}

function initializeFiles() {
  const input = getElement("fileInput");

  if (!input) return;

  input.addEventListener("change", () => {
    const incoming = Array.from(input.files || []);

    incoming.forEach(file => {
      const extension = getExtension(file.name);

      if (!CONFIG.allowedExtensions.includes(extension)) {
        showToast("Unsupported file: " + file.name);
        return;
      }

      if (file.size > CONFIG.maxFileSize) {
        showToast(file.name + " exceeds the 10 MB limit.");
        return;
      }

      const duplicate = state.files.some(existing =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
      );

      if (duplicate) return;

      state.files.push(file);
    });

    if (!state.selectedPdf) {
      state.selectedPdf =
        state.files.find(file =>
          getExtension(file.name) === "pdf"
        ) || null;
    }

    renderFiles();
    updateSelectedPdf();

    // Allows selecting the same file again.
    input.value = "";
  });

  const clearButton = getElement("clearFiles");

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      state.files = [];
      state.selectedPdf = null;

      renderFiles();
      updateSelectedPdf();

      setOutput("pdfOutput", "");

      showToast("Files cleared.");
    });
  }
}

/* ---------------- PDF ANALYZER ---------------- */

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");

      if (comma < 0) {
        reject(new Error("Invalid file data."));
        return;
      }

      resolve(result.slice(comma + 1));
    };

    reader.onerror = () => {
      reject(new Error("Unable to read the PDF file."));
    };

    reader.readAsDataURL(file);
  });
}

function initializePdfAnalyzer() {
  const form = getElement("pdfForm");
  const button = getElement("analyzePdfButton");

  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const file = state.selectedPdf;

    if (!file) {
      showToast("Upload a PDF and select it first.");
      return;
    }

    if (getExtension(file.name) !== "pdf") {
      showToast("Please select a PDF.");
      return;
    }

    if (file.size > CONFIG.maxPdfSize) {
      showToast("PDF Analyzer supports files up to 3 MB.");
      return;
    }

    const task =
      getElement("pdfTask")?.value || "summary";

    const language =
      getElement("pdfLanguage")?.value || "Simple English";

    setOutput(
      "pdfOutput",
      "Reading PDF and generating study material..."
    );

    setLoading(button, true, "Analyzing...");

    try {
      const fileData = await readFileAsBase64(file);

      const data = await callAPI(
        CONFIG.endpoints.pdf,
        {
          fileName: file.name,
          fileData: fileData,
          task: task,
          language: language
        }
      );

      const result = extractText(data, [
        "result",
        "text",
        "response",
        "answer"
      ]);

      if (!result) {
        throw new Error(
          "No analysis returned. Check api/analyze-pdf.js."
        );
      }

      setOutput(
        "pdfOutput",
        result +
          (
            data.textTruncated
              ? "\n\nNote: Part of the PDF text was omitted."
              : ""
          )
      );

      showToast("PDF analysis completed!");
    } catch (error) {
      console.error("PDF analysis error:", error);

      setOutput(
        "pdfOutput",
        "PDF analysis failed: " + error.message
      );
    } finally {
      setLoading(button, false);
    }
  });
}

/* ---------------- COPY BUTTONS ---------------- */

async function copyText(text) {
  if (!text.trim()) {
    showToast("There is no content to copy.");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);

      showToast("Copied successfully!");
      return;
    }
  } catch (error) {
    console.warn("Clipboard API unavailable:", error);
  }

  const temporary = document.createElement("textarea");

  temporary.value = text;
  temporary.style.position = "absolute";
  temporary.style.left = "-9999px";

  document.body.appendChild(temporary);

  temporary.select();

  let success = false;

  try {
    success = document.execCommand("copy");
  } catch (error) {
    success = false;
  }

  temporary.remove();

  showToast(
    success
      ? "Copied successfully!"
      : "Copy failed. Select and copy the text manually."
  );
}

function initializeCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", () => {
      const target = getElement(button.dataset.copy);

      if (!target) {
        showToast("Copy target not found.");
        return;
      }

      copyText(target.textContent);
    });
  });
}

/* ---------------- APP INITIALIZATION ---------------- */

function initializeStudyAI() {
  console.log("StudyAI: initializing...");

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

    showToast("StudyAI is ready!");
  } catch (error) {
    console.error("StudyAI initialization error:", error);

    showToast(
      "App initialization failed. Check the browser console."
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeStudyAI,
    { once: true }
  );
} else {
  initializeStudyAI();
}
