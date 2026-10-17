"use strict";

/* ==========================================
   STUDYAI — COMPLETE FRONTEND APPLICATION
   Backend endpoints:
   /api/chat
   /api/notes
   /api/quiz
   /api/youtube
   /api/analyze-pdf
========================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const state = {
    messagesSent: 0,
    videosChecked: 0,
    files: [],
    activities: [],
    currentPage: "chat",
    toastTimer: null,
    isChatLoading: false,
    isNotesLoading: false,
    isQuizLoading: false,
    isPdfAnalyzing: false,
    quiz: null,
    quizIndex: 0,
    quizAnswers: [],
    selectedPdfId: null
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_SIZE = 3 * 1024 * 1024;
const MAX_TRANSCRIPT_LENGTH = 50000;

const ALLOWED_EXTENSIONS = [
    "pdf",
    "txt",
    "docx",
    "pptx"
];

/* ---------- DOM HELPERS ---------- */

function getElement(...selectors) {
    for (const selector of selectors) {
        const element = $(selector);

        if (element) {
            return element;
        }
    }

    return null;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

function getExtension(filename) {
    const parts = String(filename).split(".");
    return parts.length > 1
        ? parts.pop().toLowerCase()
        : "";
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ---------- NOTIFICATIONS ---------- */

function showToast(message, type = "info") {
    let toast = getElement("#toast", "#toastMessage");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.setAttribute("role", "status");

        Object.assign(toast.style, {
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "99999",
            padding: "12px 18px",
            borderRadius: "12px",
            background: "#20243a",
            color: "#ffffff",
            maxWidth: "90%",
            fontSize: "14px",
            boxShadow: "0 6px 25px rgba(0,0,0,.2)"
        });

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.style.display = "block";

    if (state.toastTimer) {
        clearTimeout(state.toastTimer);
    }

    state.toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3500);
}

/* ---------- ACTIVITY TRACKING ---------- */

function addActivity(title, description = "") {
    state.activities.unshift({
        id: Date.now() + Math.random(),
        title,
        description,
        date: new Date().toLocaleString()
    });

    state.activities = state.activities.slice(0, 30);

    renderActivity();
    updateStatistics();
}

function renderActivity() {
    const container = getElement(
        "#activityList",
        "#recentActivity",
        "#activityContainer"
    );

    if (!container) {
        return;
    }

    if (state.activities.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Your recent activities will appear here.</p>';

        return;
    }

    container.innerHTML = state.activities.map((activity) => `
        <div class="activity-item">
            <div>
                <strong>${escapeHTML(activity.title)}</strong>
                <p>${escapeHTML(activity.description)}</p>
                <small>${escapeHTML(activity.date)}</small>
            </div>
        </div>
    `).join("");
}

function updateStatistics() {
    const messages = getElement("#messagesSent", "#messageCount");
    const videos = getElement("#videosChecked", "#videoCount");
    const files = getElement("#fileCount");
    const activities = getElement("#activityCount");

    if (messages) {
        messages.textContent = state.messagesSent;
    }

    if (videos) {
        videos.textContent = state.videosChecked;
    }

    if (files) {
        files.textContent = state.files.length;
    }

    if (activities) {
        activities.textContent = state.activities.length;
    }
}

/* ---------- API CONNECTION ---------- */

async function callAPI(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            "The server returned an invalid response."
        );
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

/* ---------- PAGE NAVIGATION ---------- */

function navigateTo(pageName) {
    state.currentPage = pageName;

    const pageAliases = {
        chat: ["chatPage", "chat"],
        notes: ["notesPage", "notes"],
        youtube: ["youtubePage", "youtube"],
        quiz: ["quizPage", "quiz"],
        files: ["filesPage", "files"],
        library: ["libraryPage", "library"],
        dashboard: ["dashboardPage", "dashboard"]
    };

    const allPages = [
        "#chatPage",
        "#notesPage",
        "#youtubePage",
        "#quizPage",
        "#filesPage",
        "#libraryPage",
        "#dashboardPage"
    ];

    allPages.forEach((selector) => {
        const page = $(selector);

        if (page) {
            page.hidden = true;
            page.style.display = "none";
        }
    });

    const matchingSelectors = pageAliases[pageName] || [];

    let selectedPage = null;

    for (const id of matchingSelectors) {
        const page = $(`#${id}`);

        if (page) {
            selectedPage = page;
            break;
        }
    }

    if (selectedPage) {
        selectedPage.hidden = false;
        selectedPage.style.display = "";
    }

    $$("[data-page]").forEach((button) => {
        const active = button.dataset.page === pageName;

        button.classList.toggle("active", active);

        if (active) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    $$(".nav-link, .sidebar-link").forEach((button) => {
        const target =
            button.dataset.page ||
            button.dataset.target;

        if (target) {
            button.classList.toggle(
                "active",
                target === pageName
            );
        }
    });

    const sidebar = getElement("#sidebar");

    if (sidebar) {
        sidebar.classList.remove("open");
    }
}

function initializeNavigation() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest(
            "[data-page], [data-target]"
        );

        if (!button) {
            return;
        }

        const page =
            button.dataset.page ||
            button.dataset.target;

        if (!page) {
            return;
        }

        event.preventDefault();
        navigateTo(page);
    });

    const menuButton = getElement(
        "#menuToggle",
        "#sidebarToggle",
        "#mobileMenuButton"
    );

    if (menuButton) {
        menuButton.addEventListener("click", () => {
            const sidebar = getElement("#sidebar");

            if (sidebar) {
                sidebar.classList.toggle("open");
            }
        });
    }
}

/* ---------- CHAT ---------- */

function getChatElements() {
    return {
        input: getElement(
            "#chatInput",
            "#messageInput",
            "#userInput"
        ),

        sendButton: getElement(
            "#sendButton",
            "#sendMessage",
            "#chatSendButton"
        ),

        messages: getElement(
            "#chatMessages",
            "#messagesContainer",
            "#chatContainer"
        )
    };
}

function appendChatMessage(role, text) {
    const { messages } = getChatElements();

    if (!messages) {
        showToast("Chat message container was not found.", "error");
        return;
    }

    const message = document.createElement("div");

    message.className =
        role === "user"
            ? "chat-message user-message"
            : "chat-message assistant-message";

    const label = document.createElement("strong");
    label.textContent =
        role === "user" ? "You" : "StudyAI";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    message.append(label, content);
    messages.appendChild(message);

    messages.scrollTop = messages.scrollHeight;

    return message;
}

async function sendChatMessage() {
    if (state.isChatLoading) {
        return;
    }

    const { input } = getChatElements();

    if (!input) {
        showToast("Chat input was not found.", "error");
        return;
    }

    const message = input.value.trim();

    if (!message) {
        showToast("Enter a question first.");
        return;
    }

    state.isChatLoading = true;

    appendChatMessage("user", message);

    input.value = "";

    const sendButton = getChatElements().sendButton;

    if (sendButton) {
        sendButton.disabled = true;
    }

    const loadingMessage = appendChatMessage(
        "assistant",
        "Thinking..."
    );

    try {
        const result = await callAPI("/api/chat", {
            message
        });

        const answer =
            result.reply ||
            result.response ||
            result.answer ||
            result.text;

        if (!answer) {
            throw new Error("The AI returned an empty response.");
        }

        const content = loadingMessage
            ? loadingMessage.querySelector(".message-content")
            : null;

        if (content) {
            content.textContent = answer;
        }

        state.messagesSent += 1;

        addActivity(
            "AI Chat",
            message.slice(0, 100)
        );
    } catch (error) {
        if (loadingMessage) {
            const content =
                loadingMessage.querySelector(".message-content");

            if (content) {
                content.textContent =
                    `Sorry, something went wrong: ${error.message}`;
            }
        }

        showToast(error.message, "error");
    } finally {
        state.isChatLoading = false;

        if (sendButton) {
            sendButton.disabled = false;
        }

        updateStatistics();
    }
}

function initializeChat() {
    const { input, sendButton } = getChatElements();

    if (sendButton) {
        sendButton.addEventListener("click", sendChatMessage);
    }

    if (input) {
        input.addEventListener("keydown", (event) => {
            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {
                event.preventDefault();
                sendChatMessage();
            }
        });
    }
}

/* ---------- STUDY NOTES ---------- */

async function generateNotes() {
    if (state.isNotesLoading) {
        return;
    }

    const topicInput = getElement(
        "#notesTopic",
        "#topicInput",
        "#notesInput"
    );

    const output = getElement(
        "#notesOutput",
        "#generatedNotes",
        "#notesResult"
    );

    const topic = topicInput
        ? topicInput.value.trim()
        : "";

    if (!topic) {
        showToast("Enter a topic for your study notes.");
        return;
    }

    const languageInput = getElement(
        "#notesLanguage",
        "#languageSelect"
    );

    const detailInput = getElement(
        "#notesDetail",
        "#notesLength"
    );

    state.isNotesLoading = true;

    const button = getElement(
        "#generateNotesButton",
        "#generateNotes",
        "#notesButton"
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Generating...";
    }

    if (output) {
        output.textContent = "Preparing your study notes...";
    }

    try {
        const result = await callAPI("/api/notes", {
            topic,
            language: languageInput
                ? languageInput.value
                : "Simple English",
            detail: detailInput
                ? detailInput.value
                : "medium"
        });

        const text =
            result.notes ||
            result.result ||
            result.text ||
            result.response;

        if (!text) {
            throw new Error("No notes were returned.");
        }

        if (output) {
            output.textContent = text;
        }

        addActivity("Study Notes", topic);

        showToast("Study notes generated successfully!");
    } catch (error) {
        if (output) {
            output.textContent = error.message;
        }

        showToast(error.message, "error");
    } finally {
        state.isNotesLoading = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Generate Notes";
        }
    }
}

function initializeNotes() {
    const button = getElement(
        "#generateNotesButton",
        "#generateNotes",
        "#notesButton"
    );

    if (button) {
        button.addEventListener("click", generateNotes);
    }
}

/* ---------- YOUTUBE SEMINAR ANALYZER ---------- */

function extractYouTubeVideoId(url) {
    try {
        const parsed = new URL(url);

        if (
            parsed.hostname === "youtu.be" ||
            parsed.hostname.endsWith(".youtu.be")
        ) {
            return parsed.pathname.slice(1).split("/")[0];
        }

        if (
            parsed.hostname.includes("youtube.com") ||
            parsed.hostname.includes("youtube-nocookie.com")
        ) {
            if (parsed.pathname === "/watch") {
                return parsed.searchParams.get("v");
            }

            const parts = parsed.pathname.split("/").filter(Boolean);

            if (
                ["embed", "shorts", "live"].includes(parts[0])
            ) {
                return parts[1] || null;
            }
        }
    } catch {
        return null;
    }

    return null;
}

async function analyzeYouTube() {
    const urlInput = getElement(
        "#youtubeUrl",
        "#videoUrl",
        "#youtubeInput"
    );

    const output = getElement(
        "#youtubeOutput",
        "#videoSummary",
        "#youtubeResult"
    );

    const url = urlInput
        ? urlInput.value.trim()
        : "";

    if (!url) {
        showToast("Paste a YouTube video link.");
        return;
    }

    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
        showToast("Enter a valid YouTube video URL.", "error");
        return;
    }

    const button = getElement(
        "#analyzeYoutubeButton",
        "#analyzeVideo",
        "#youtubeButton"
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Analyzing...";
    }

    if (output) {
        output.textContent = "Analyzing video...";
    }

    try {
        const result = await callAPI("/api/youtube", {
            url,
            videoId,
            maxLength: MAX_TRANSCRIPT_LENGTH
        });

        const text =
            result.summary ||
            result.result ||
            result.transcript ||
            result.text ||
            result.response;

        if (!text) {
            throw new Error(
                "No summary was returned. Check your YouTube backend."
            );
        }

        if (output) {
            output.textContent = text;
        }

        state.videosChecked += 1;

        addActivity(
            "YouTube Analysis",
            url
        );

        updateStatistics();

        showToast("YouTube analysis completed!");
    } catch (error) {
        if (output) {
            output.textContent = error.message;
        }

        showToast(error.message, "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Analyze Video";
        }
    }
}

function initializeYouTube() {
    const button = getElement(
        "#analyzeYoutubeButton",
        "#analyzeVideo",
        "#youtubeButton"
    );

    if (button) {
        button.addEventListener("click", analyzeYouTube);
    }
}

/* ---------- FILE MANAGEMENT ---------- */

function addFiles(fileList) {
    if (!fileList || !fileList.length) {
        return;
    }

    let added = 0;

    Array.from(fileList).forEach((file) => {
        const extension = getExtension(file.name);

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            showToast(
                `${file.name}: unsupported file type.`
            );

            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showToast(
                `${file.name}: maximum file size is 10 MB.`
            );

            return;
        }

        const duplicate = state.files.some((item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified
        );

        if (duplicate) {
            return;
        }

        state.files.push({
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            extension,
            file
        });

        added += 1;
    });

    renderFiles();
    updateStatistics();

    if (added > 0) {
        addActivity(
            "Files Uploaded",
            `${added} file(s) added`
        );

        showToast(`${added} file(s) added.`);
    }
}

function removeFile(fileId) {
    state.files = state.files.filter(
        (file) => file.id !== fileId
    );

    if (state.selectedPdfId === fileId) {
        state.selectedPdfId = null;
    }

    renderFiles();
    updateStatistics();
    updateSelectedPdf();
}

function renderFiles() {
    const fileListElement = getElement(
        "#fileList",
        "#uploadedFiles"
    );

    if (!fileListElement) {
        return;
    }

    if (state.files.length === 0) {
        fileListElement.innerHTML =
            '<p class="empty-state">No files uploaded yet.</p>';

        return;
    }

    fileListElement.innerHTML = state.files.map((file) => `
        <div class="file-item ${
            file.id === state.selectedPdfId ? "selected" : ""
        }"
        data-file-id="${escapeHTML(file.id)}">

            <div class="file-info">
                <strong>${escapeHTML(file.name)}</strong>
                <small>${formatFileSize(file.size)}</small>
            </div>

            ${
                file.extension === "pdf"
                    ? `<button type="button"
                        data-select-pdf="${escapeHTML(file.id)}">
                        Select PDF
                    </button>`
                    : ""
            }

            <button type="button"
                data-remove-file="${escapeHTML(file.id)}"
                aria-label="Remove ${escapeHTML(file.name)}">
                Remove
            </button>
        </div>
    `).join("");
}

function initializeFileUpload() {
    const fileInput = getElement("#fileInput");
    const chooseButton = getElement("#chooseFiles");
    const uploadZone = getElement("#uploadZone");

    if (chooseButton && fileInput) {
        chooseButton.addEventListener("click", () => {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            addFiles(fileInput.files);
            fileInput.value = "";
        });
    }

    if (uploadZone) {
        uploadZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            uploadZone.classList.add("drag-over");
        });

        uploadZone.addEventListener("dragleave", () => {
            uploadZone.classList.remove("drag-over");
        });

        uploadZone.addEventListener("drop", (event) => {
            event.preventDefault();

            uploadZone.classList.remove("drag-over");

            addFiles(event.dataTransfer.files);
        });

        uploadZone.addEventListener("click", (event) => {
            if (
                fileInput &&
                !event.target.closest("button")
            ) {
                fileInput.click();
            }
        });
    }

    const fileListElement = getElement(
        "#fileList",
        "#uploadedFiles"
    );

    if (fileListElement) {
        fileListElement.addEventListener("click", (event) => {
            const removeButton = event.target.closest(
                "[data-remove-file]"
            );

            if (removeButton) {
                removeFile(removeButton.dataset.removeFile);
                return;
            }

            const selectButton = event.target.closest(
                "[data-select-pdf]"
            );

            if (selectButton) {
                selectPdf(selectButton.dataset.selectPdf);
            }
        });
    }
}

/* ---------- PDF ANALYZER ---------- */

function selectPdf(fileId) {
    const file = state.files.find(
        (item) => item.id === fileId
    );

    if (!file || file.extension !== "pdf") {
        showToast("Select a PDF file.", "error");
        return;
    }

    if (file.size > MAX_PDF_SIZE) {
        showToast(
            "For PDF analysis, choose a PDF of 3 MB or less.",
            "error"
        );

        return;
    }

    state.selectedPdfId = fileId;

    updateSelectedPdf();
    renderFiles();

    showToast("PDF selected.");
}

function updateSelectedPdf() {
    const nameElement = getElement("#selectedPdfName");
    const analyzeButton = getElement("#analyzePdfButton");

    const selected = state.files.find(
        (file) => file.id === state.selectedPdfId
    );

    if (nameElement) {
        nameElement.textContent = selected
            ? `${selected.name} (${formatFileSize(selected.size)})`
            : "No PDF selected";
    }

    if (analyzeButton) {
        analyzeButton.disabled =
            !selected || state.isPdfAnalyzing;
    }
}

function pdfToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || "");
            const commaIndex = result.indexOf(",");

            if (commaIndex === -1) {
                reject(new Error("Could not read the PDF."));
                return;
            }

            resolve(result.slice(commaIndex + 1));
        };

        reader.onerror = () => {
            reject(new Error("Failed to read the selected PDF."));
        };

        reader.readAsDataURL(file);
    });
}

function showPdfMessage(message) {
    const output = getElement("#pdfOutput");

    if (output) {
        output.textContent = message;
    }
}

function getPdfTaskTitle(task) {
    const titles = {
        summary: "PDF Summary",
        "study-notes": "PDF Study Notes",
        questions: "Practice Questions",
        flashcards: "Flashcards"
    };

    return titles[task] || "PDF Analysis";
}

async function analyzePdf() {
    if (state.isPdfAnalyzing) {
        return;
    }

    const selected = state.files.find(
        (file) => file.id === state.selectedPdfId
    );

    if (!selected) {
        showToast("Upload and select a PDF first.");
        return;
    }

    if (selected.extension !== "pdf") {
        showToast("Only PDF files can be analyzed.");
        return;
    }

    if (selected.size > MAX_PDF_SIZE) {
        showToast("PDF must be 3 MB or smaller.");
        return;
    }

    const taskSelect = getElement("#pdfTask");
    const languageSelect = getElement("#pdfLanguage");
    const analyzeButton = getElement("#analyzePdfButton");

    const task = taskSelect
        ? taskSelect.value
        : "summary";

    const language = languageSelect
        ? languageSelect.value
        : "Simple English";

    const allowedTasks = [
        "summary",
        "study-notes",
        "questions",
        "flashcards"
    ];

    if (!allowedTasks.includes(task)) {
        showToast("Choose a valid PDF analysis task.");
        return;
    }

    state.isPdfAnalyzing = true;

    if (analyzeButton) {
        analyzeButton.disabled = true;
        analyzeButton.textContent = "Analyzing PDF...";
    }

    showPdfMessage(
        "Reading PDF and generating your study material..."
    );

    try {
        const fileData = await pdfToBase64(selected.file);

        const result = await callAPI("/api/analyze-pdf", {
            fileName: selected.name,
            fileData,
            task,
            language
        });

        const text =
            result.result ||
            result.text ||
            result.response;

        if (!text) {
            throw new Error(
                "The PDF analyzer returned no study material."
            );
        }

        showPdfMessage(text);

        addActivity(
            getPdfTaskTitle(task),
            selected.name
        );

        showToast("PDF analysis completed!");
    } catch (error) {
        showPdfMessage(
            `Unable to analyze PDF.\n\n${error.message}`
        );

        showToast(error.message, "error");
    } finally {
        state.isPdfAnalyzing = false;

        if (analyzeButton) {
            analyzeButton.textContent = "Analyze PDF";
        }

        updateSelectedPdf();
    }
}

function initializePdfAnalyzer() {
    const button = getElement("#analyzePdfButton");

    if (button) {
        button.addEventListener("click", analyzePdf);
    }

    updateSelectedPdf();
}

/* ---------- QUIZ GENERATOR ---------- */

async function generateQuiz() {
    if (state.isQuizLoading) {
        return;
    }

    const topicInput = getElement(
        "#quizTopic",
        "#quizTopicInput"
    );

    const countInput = getElement(
        "#quizCount",
        "#questionCount"
    );

    const difficultyInput = getElement(
        "#quizDifficulty",
        "#difficultySelect"
    );

    const output = getElement(
        "#quizOutput",
        "#quizContainer",
        "#quizResult"
    );

    const topic = topicInput
        ? topicInput.value.trim()
        : "";

    if (!topic) {
        showToast("Enter a quiz topic.");
        return;
    }

    const count = Math.min(
        20,
        Math.max(
            1,
            Number(countInput ? countInput.value : 5) || 5
        )
    );

    const difficulty = difficultyInput
        ? difficultyInput.value
        : "medium";

    const button = getElement(
        "#generateQuizButton",
        "#generateQuiz",
        "#quizButton"
    );

    state.isQuizLoading = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Generating...";
    }

    if (output) {
        output.textContent = "Creating your quiz...";
    }

    try {
        const result = await callAPI("/api/quiz", {
            topic,
            count,
            difficulty
        });

        let questions =
            result.questions ||
            result.quiz ||
            result.result;

        if (typeof questions === "string") {
            try {
                const cleaned = questions
                    .replace(/^```(?:json)?\s*/i, "")
                    .replace(/\s*```$/, "");

                questions = JSON.parse(cleaned);
            } catch {
                throw new Error(
                    "The quiz response was not valid JSON."
                );
            }
        }

        if (questions && !Array.isArray(questions)) {
            questions = questions.questions;
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error(
                "No quiz questions were generated."
            );
        }

        state.quiz = questions;
        state.quizIndex = 0;
        state.quizAnswers = [];

        renderQuiz();

        addActivity("Quiz Generated", topic);

        showToast("Quiz generated!");
    } catch (error) {
        if (output) {
            output.textContent = error.message;
        }

        showToast(error.message, "error");
    } finally {
        state.isQuizLoading = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Generate Quiz";
        }
    }
}

function renderQuiz() {
    const output = getElement(
        "#quizOutput",
        "#quizContainer",
        "#quizResult"
    );

    if (!output || !state.quiz) {
        return;
    }

    if (state.quizIndex >= state.quiz.length) {
        renderQuizResults(output);
        return;
    }

    const question = state.quiz[state.quizIndex];

    const questionText =
        question.question ||
        question.text ||
        question.prompt ||
        "Question";

    const options =
        question.options ||
        question.choices ||
        [];

    output.innerHTML = `
        <div class="quiz-question">
            <p>Question ${state.quizIndex + 1}
                of ${state.quiz.length}</p>

            <h3>${escapeHTML(questionText)}</h3>

            <div class="quiz-options">
                ${
                    options.length
                        ? options.map((option, index) => `
                            <button type="button"
                                class="quiz-option"
                                data-quiz-answer="${index}">
                                ${escapeHTML(option)}
                            </button>
                        `).join("")
                        : `
                            <input
                                id="quizTextAnswer"
                                type="text"
                                placeholder="Type your answer"
                            >
                        `
                }
            </div>

            <button type="button" id="nextQuizButton">
                ${state.quizIndex === state.quiz.length - 1
                    ? "Finish Quiz"
                    : "Next Question"}
            </button>
        </div>
    `;

    output.querySelectorAll("[data-quiz-answer]").forEach(
        (button) => {
            button.addEventListener("click", () => {
                output.querySelectorAll(
                    "[data-quiz-answer]"
                ).forEach((item) => {
                    item.classList.remove("selected");
                });

                button.classList.add("selected");

                state.quizAnswers[state.quizIndex] =
                    Number(button.dataset.quizAnswer);
            });
        }
    );

    const nextButton = $("#nextQuizButton");

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            const textAnswer = $("#quizTextAnswer");

            if (textAnswer) {
                state.quizAnswers[state.quizIndex] =
                    textAnswer.value.trim();
            }

            state.quizIndex += 1;
            renderQuiz();
        });
    }
}

function renderQuizResults(output) {
    let score = 0;

    state.quiz.forEach((question, index) => {
        const correct =
            question.answerIndex ??
            question.correctIndex ??
            question.correctAnswer;

        const userAnswer = state.quizAnswers[index];

        if (typeof correct === "number") {
            if (userAnswer === correct) {
                score += 1;
            }
        } else if (typeof correct === "string") {
            const options =
                question.options ||
                question.choices ||
                [];

            const correctOption = options[correct];

            if (
                String(userAnswer).trim().toLowerCase() ===
                    String(correct).trim().toLowerCase() ||
                (
                    correctOption !== undefined &&
                    String(userAnswer).trim().toLowerCase() ===
                    String(correctOption).trim().toLowerCase()
                )
            ) {
                score += 1;
            }
        }
    });

    output.innerHTML = `
        <div class="quiz-results">
            <h2>Quiz Completed!</h2>
            <p>Your score:</p>
            <h3>${score} / ${state.quiz.length}</h3>
            <p>${Math.round(
                score / state.quiz.length * 100
            )}%</p>

            <button type="button" id="restartQuizButton">
                Try Again
            </button>
        </div>
    `;

    const restartButton = $("#restartQuizButton");

    if (restartButton) {
        restartButton.addEventListener("click", () => {
            state.quizIndex = 0;
            state.quizAnswers = [];
            renderQuiz();
        });
    }

    addActivity(
        "Quiz Completed",
        `Score: ${score}/${state.quiz.length}`
    );
}

function initializeQuiz() {
    const button = getElement(
        "#generateQuizButton",
        "#generateQuiz",
        "#quizButton"
    );

    if (button) {
        button.addEventListener("click", generateQuiz);
    }
}

/* ---------- COPY OUTPUT ---------- */

async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement("textarea");

            textarea.value = text;

            Object.assign(textarea.style, {
                position: "absolute",
                left: "-9999px"
            });

            document.body.appendChild(textarea);

            textarea.select();

            const successful = document.execCommand("copy");

            textarea.remove();

            if (!successful) {
                throw new Error("Copy failed.");
            }
        }

        showToast("Copied to clipboard!");
    } catch {
        showToast(
            "Copy unavailable. Select the text and copy it manually."
        );
    }
}

function initializeCopyButtons() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest(
            "[data-copy-target]"
        );

        if (!button) {
            return;
        }

        const target = $(
            `#${CSS.escape(button.dataset.copyTarget)}`
        );

        if (!target) {
            return;
        }

        const text =
            target.value !== undefined
                ? target.value
                : target.innerText;

        copyText(text);
    });
}

/* ---------- CLEAR CHAT ---------- */

function initializeClearChat() {
    const button = getElement(
        "#clearChat",
        "#clearChatButton"
    );

    if (!button) {
        return;
    }

    button.addEventListener("click", () => {
        const { messages } = getChatElements();

        if (!messages) {
            return;
        }

        messages.replaceChildren();

        state.messagesSent = 0;

        updateStatistics();

        showToast("Chat cleared.");
    });
}

/* ---------- INITIALIZATION ---------- */

function initializeApp() {
    initializeNavigation();
    initializeChat();
    initializeNotes();
    initializeYouTube();
    initializeFileUpload();
    initializePdfAnalyzer();
    initializeQuiz();
    initializeCopyButtons();
    initializeClearChat();

    renderFiles();
    renderActivity();
    updateStatistics();

    navigateTo("chat");

    console.log("StudyAI initialized successfully.");
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeApp,
        { once: true }
    );
} else {
    initializeApp();
}
