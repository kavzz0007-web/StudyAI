"use strict";

/* ========================================
   STUDYAI - FRONTEND APPLICATION
   Acode-friendly JavaScript
   Gemini API + Vercel Serverless Backend
======================================== */

/* ---------- DOM HELPERS ---------- */

/** @param {string} selector */
const $$ = (selector) => document.querySelectorAll(selector);

/** @param {string} id */
function getElement(id) {
    return document.getElementById(id);
}

/* ---------- APPLICATION STATE ---------- */

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
    quiz: null
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TRANSCRIPT_LENGTH = 50000;

const ALLOWED_EXTENSIONS = [
    "pdf",
    "txt",
    "docx",
    "pptx"
];

const PAGE_NAMES = {
    chat: "AI Chat",
    files: "My Documents",
    notes: "Study Notes",
    youtube: "YouTube Extractor",
    quiz: "Quiz & Flashcards",
    library: "My Library"
};

/* ---------- TOAST NOTIFICATIONS ---------- */

/** @param {string} message */
function showToast(message) {
    const toast = getElement("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    if (state.toastTimer !== null) {
        clearTimeout(state.toastTimer);
    }

    state.toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        state.toastTimer = null;
    }, 2800);
}

/* ---------- HTML ESCAPING ---------- */

/** @param {unknown} value */
function escapeHTML(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value).replace(/[&<>"']/g, (character) => {
        return entities[character];
    });
}

/* ---------- FILE SIZE FORMATTING ---------- */

/** @param {number} bytes */
function formatBytes(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* ---------- API HELPER ---------- */

/**
 * Calls a same-origin Vercel serverless endpoint.
 *
 * @param {string} endpoint
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
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
    } catch (error) {
        throw new Error(
            "The server returned an invalid response. Please try again."
        );
    }

    if (!response.ok || !data || data.success !== true) {
        throw new Error(
            data && data.error
                ? String(data.error)
                : "The request failed. Please try again."
        );
    }

    return data;
}

/* ---------- ACTIVITY TRACKING ---------- */

/** @param {string} description */
function addActivity(description) {
    state.activities.unshift({
        description: description,
        time: new Date()
    });

    state.activities = state.activities.slice(0, 30);

    renderActivity();
    updateStatistics();
}

function renderActivity() {
    const activityList = getElement("activityList");

    if (!activityList) {
        return;
    }

    if (state.activities.length === 0) {
        activityList.innerHTML =
            '<p class="empty-state">Your activity will appear here.</p>';

        return;
    }

    activityList.innerHTML = state.activities.map((activity) => {
        const time = activity.time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        return `
            <div class="activity-item">
                ${escapeHTML(activity.description)}
                <span>${escapeHTML(time)}</span>
            </div>
        `;
    }).join("");
}

/* ---------- STATISTICS ---------- */

function updateStatistics() {
    const fileCount = getElement("libraryFileCount");
    const chatCount = getElement("libraryChatCount");
    const videoCount = getElement("libraryVideoCount");
    const visibleFileCount = getElement("fileCount");

    if (fileCount) {
        fileCount.textContent = String(state.files.length);
    }

    if (chatCount) {
        chatCount.textContent = String(state.messagesSent);
    }

    if (videoCount) {
        videoCount.textContent = String(state.videosChecked);
    }

    if (visibleFileCount) {
        visibleFileCount.textContent =
            state.files.length +
            (state.files.length === 1 ? " file" : " files");
    }
}

/* ---------- NAVIGATION ---------- */

/** @param {string} pageName */
function navigateTo(pageName) {
    if (!Object.prototype.hasOwnProperty.call(PAGE_NAMES, pageName)) {
        return;
    }

    state.currentPage = pageName;

    $$(".page").forEach((page) => {
        page.classList.remove("active");
    });

    const targetPage = getElement(pageName + "Page");

    if (targetPage) {
        targetPage.classList.add("active");
    }

    $$(".nav-item").forEach((button) => {
        const isActive = button.dataset.page === pageName;

        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    const sectionTitle = getElement("currentSection");

    if (sectionTitle) {
        sectionTitle.textContent = PAGE_NAMES[pageName];
    }

    closeSidebar();
}

/* ---------- NAVIGATION BUTTONS ---------- */

$$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
        const pageName = button.dataset.page;

        if (pageName) {
            navigateTo(pageName);
        }
    });
});

/* ---------- MOBILE SIDEBAR ---------- */

function openSidebar() {
    const sidebar = getElement("sidebar");

    if (sidebar) {
        sidebar.classList.add("open");
    }
}

function closeSidebar() {
    const sidebar = getElement("sidebar");

    if (sidebar) {
        sidebar.classList.remove("open");
    }
}

const menuButton = getElement("menuButton");
const closeSidebarButton = getElement("closeSidebar");

if (menuButton) {
    menuButton.addEventListener("click", openSidebar);
}

if (closeSidebarButton) {
    closeSidebarButton.addEventListener("click", closeSidebar);
}

/* ---------- CHAT MESSAGES ---------- */

/**
 * @param {string} role
 * @param {string} text
 */
function appendMessage(role, text) {
    const messages = getElement("chatMessages");

    if (!messages) {
        return;
    }

    const message = document.createElement("div");

    if (role === "user") {
        message.className = "user-message";

        const content = document.createElement("div");
        content.className = "message-content";

        const paragraph = document.createElement("p");
        paragraph.textContent = text;

        content.appendChild(paragraph);
        message.appendChild(content);
    } else {
        message.className = "assistant-message";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "✦";

        const content = document.createElement("div");
        content.className = "message-content";

        const heading = document.createElement("strong");
        heading.textContent = "StudyAI";

        const paragraph = document.createElement("p");
        paragraph.textContent = text;

        content.appendChild(heading);
        content.appendChild(paragraph);

        message.appendChild(avatar);
        message.appendChild(content);
    }

    messages.appendChild(message);

    message.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

/* ---------- CHAT LOADING INDICATOR ---------- */

function createChatLoadingMessage() {
    const messages = getElement("chatMessages");

    if (!messages) {
        return null;
    }

    const message = document.createElement("div");
    message.className = "assistant-message";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "✦";

    const content = document.createElement("div");
    content.className = "message-content";

    const heading = document.createElement("strong");
    heading.textContent = "StudyAI";

    const paragraph = document.createElement("p");
    paragraph.textContent = "Thinking... ✨";

    content.appendChild(heading);
    content.appendChild(paragraph);

    message.appendChild(avatar);
    message.appendChild(content);

    messages.appendChild(message);

    message.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    return message;
}

/* ---------- SEND CHAT MESSAGE ---------- */

/** @param {string} text */
async function sendMessage(text) {
    const cleanText = String(text || "").trim();

    if (!cleanText) {
        showToast("Please enter a message first.");
        return;
    }

    if (state.isChatLoading) {
        showToast("Please wait for the current response.");
        return;
    }

    const messages = getElement("chatMessages");

    if (!messages) {
        showToast("Chat interface could not be found.");
        return;
    }

    state.isChatLoading = true;

    appendMessage("user", cleanText);

    state.messagesSent += 1;

    updateStatistics();
    addActivity("Sent a message in AI Chat");

    const input = getElement("chatInput");

    if (input) {
        input.disabled = true;
    }

    const sendButton = chatForm
        ? chatForm.querySelector('button[type="submit"]')
        : null;

    if (sendButton) {
        sendButton.disabled = true;
    }

    const loadingMessage = createChatLoadingMessage();

    try {
        const data = await callAPI("/api/chat", {
            message: cleanText
        });

        if (loadingMessage) {
            loadingMessage.remove();
        }

        const reply = typeof data.reply === "string"
            ? data.reply
            : "The AI returned an empty response.";

        appendMessage("assistant", reply);

        addActivity("Received an AI response");
    } catch (error) {
        if (loadingMessage) {
            loadingMessage.remove();
        }

        appendMessage(
            "assistant",
            "Sorry, I couldn't get a response from the AI service. " +
            "Please check your deployment and API configuration."
        );

        console.error("StudyAI chat error:", error);

        showToast(
            error instanceof Error
                ? error.message
                : "AI connection failed."
        );
    } finally {
        state.isChatLoading = false;

        if (input) {
            input.disabled = false;
            input.focus();
        }

        if (sendButton) {
            sendButton.disabled = false;
        }
    }
}

/* ---------- CHAT FORM ---------- */

const chatForm = getElement("chatForm");

if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const input = getElement("chatInput");

        if (
            !(input instanceof HTMLInputElement) &&
            !(input instanceof HTMLTextAreaElement)
        ) {
            return;
        }

        const message = input.value.trim();

        if (!message) {
            showToast("Please enter a message first.");
            return;
        }

        if (state.isChatLoading) {
            return;
        }

        input.value = "";

        await sendMessage(message);
    });
}

/* ---------- QUICK PROMPTS ---------- */

$$(".quick-card").forEach((card) => {
    card.addEventListener("click", () => {
        const prompt = card.dataset.prompt;

        navigateTo("chat");

        const input = getElement("chatInput");

        if (
            input &&
            (
                input instanceof HTMLInputElement ||
                input instanceof HTMLTextAreaElement
            ) &&
            prompt
        ) {
            input.value = prompt;
            input.focus();
        }
    });
});

/* ---------- NEW CHAT ---------- */

const newChatButton = getElement("newChat");

if (newChatButton) {
    newChatButton.addEventListener("click", () => {
        if (state.isChatLoading) {
            showToast("Please wait for the current response.");
            return;
        }

        const messages = getElement("chatMessages");

        if (messages) {
            messages.innerHTML = `
                <div class="assistant-message">
                    <div class="message-avatar">✦</div>
                    <div class="message-content">
                        <strong>StudyAI</strong>
                        <p>New conversation started!</p>
                        <p>Ask a question or choose a study tool.</p>
                    </div>
                </div>
            `;
        }

        navigateTo("chat");

        showToast("New conversation started.");
    });
}

/* ---------- FILE UPLOAD HELPERS ---------- */

/** @param {string} filename */
function getExtension(filename) {
    const lastDot = filename.lastIndexOf(".");

    return lastDot < 0
        ? ""
        : filename.slice(lastDot + 1).toLowerCase();
}

function createFileId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

/** @param {FileList|File[]|null} fileList */
function addFiles(fileList) {
    const selectedFiles = Array.from(fileList || []);

    if (selectedFiles.length === 0) {
        return;
    }

    let addedCount = 0;

    selectedFiles.forEach((file) => {
        const extension = getExtension(file.name);

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            showToast("Unsupported file type: " + file.name);
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showToast(file.name + " exceeds the 10 MB limit.");
            return;
        }

        const duplicate = state.files.some((item) => {
            return (
                item.name === file.name &&
                item.size === file.size &&
                item.lastModified === file.lastModified
            );
        });

        if (duplicate) {
            showToast(file.name + " is already in your list.");
            return;
        }

        state.files.push({
            id: createFileId(),
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            extension: extension,
            file: file
        });

        addedCount += 1;

        addActivity("Selected file: " + file.name);
    });

    renderFiles();
    updateStatistics();

    if (addedCount > 0) {
        showToast(
            addedCount +
            (addedCount === 1
                ? " file added to the list."
                : " files added to the list.")
        );
    }
}

/* ---------- DISPLAY FILES ---------- */

function renderFiles() {
    const fileList = getElement("fileList");

    if (!fileList) {
        return;
    }

    if (state.files.length === 0) {
        fileList.innerHTML = `
            <div class="empty-state">
                <span>▤</span>
                <p>Your uploaded files will appear here.</p>
            </div>
        `;

        return;
    }

    fileList.innerHTML = state.files.map((file) => {
        return `
            <div class="file-item">
                <div class="file-icon">▤</div>

                <div class="file-details">
                    <strong>${escapeHTML(file.name)}</strong>

                    <span>
                        ${escapeHTML(file.extension.toUpperCase())}
                        · ${formatBytes(file.size)}
                        · Selected locally
                    </span>
                </div>

                <button
                    type="button"
                    class="file-remove"
                    data-remove-file="${escapeHTML(file.id)}"
                    aria-label="Remove ${escapeHTML(file.name)}"
                >✕</button>
            </div>
        `;
    }).join("");
}

/* ---------- FILE BUTTONS ---------- */

const chooseFilesButton = getElement("chooseFiles");

if (chooseFilesButton) {
    chooseFilesButton.addEventListener("click", () => {
        const input = getElement("fileInput");

        if (input) {
            input.click();
        }
    });
}

const attachButton = getElement("attachButton");

if (attachButton) {
    attachButton.addEventListener("click", () => {
        navigateTo("files");

        const input = getElement("fileInput");

        if (input) {
            input.click();
        }
    });
}

const fileInput = getElement("fileInput");

if (fileInput) {
    fileInput.addEventListener("change", (event) => {
        const input = event.currentTarget;

        if (!(input instanceof HTMLInputElement)) {
            return;
        }

        addFiles(input.files);

        input.value = "";
    });
}

/* ---------- REMOVE FILES ---------- */

const fileListElement = getElement("fileList");

if (fileListElement) {
    fileListElement.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const button = target.closest("[data-remove-file]");

        if (!(button instanceof HTMLElement)) {
            return;
        }

        const fileId = button.getAttribute("data-remove-file");

        state.files = state.files.filter((file) => {
            return file.id !== fileId;
        });

        renderFiles();
        updateStatistics();

        showToast("File removed from the list.");
    });
}

/* ---------- DRAG AND DROP ---------- */

const uploadZone = getElement("uploadZone");

if (uploadZone) {
    uploadZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        uploadZone.classList.add("drag-over");
    });

    uploadZone.addEventListener("dragleave", (event) => {
        if (
            !(event.relatedTarget instanceof Node) ||
            !uploadZone.contains(event.relatedTarget)
        ) {
            uploadZone.classList.remove("drag-over");
        }
    });

    uploadZone.addEventListener("drop", (event) => {
        event.preventDefault();

        uploadZone.classList.remove("drag-over");

        if (event.dataTransfer) {
            addFiles(event.dataTransfer.files);
        }
    });
}

/* ---------- STUDY NOTES SHORTCUT ---------- */

const notesShortcut = getElement("notesShortcut");

if (notesShortcut) {
    notesShortcut.addEventListener("click", () => {
        navigateTo("notes");

        const topicInput = getElement("notesTopic");

        if (topicInput instanceof HTMLInputElement) {
            topicInput.focus();
        }
    });
}

/* ---------- STUDY NOTES GENERATION ---------- */

const generateNotesButton = getElement("generateNotes");

if (generateNotesButton) {
    generateNotesButton.addEventListener("click", async () => {
        if (state.isNotesLoading) {
            showToast("Please wait for notes to finish generating.");
            return;
        }

        const topicInput = getElement("notesTopic");
        const formatInput = getElement("notesFormat");
        const languageInput = getElement("notesLanguage");
        const output = getElement("notesOutput");

        const topic =
            topicInput instanceof HTMLInputElement
                ? topicInput.value.trim()
                : "";

        const format =
            formatInput instanceof HTMLSelectElement
                ? formatInput.value
                : "detailed";

        const language =
            languageInput instanceof HTMLSelectElement
                ? languageInput.value
                : "English";

        if (!topic) {
            showToast("Enter a study topic first.");

            if (topicInput instanceof HTMLInputElement) {
                topicInput.focus();
            }

            return;
        }

        if (!output) {
            showToast("Study notes output area not found.");
            return;
        }

        state.isNotesLoading = true;
        generateNotesButton.disabled = true;

        output.innerHTML = `
            <h3>Generating study notes...</h3>
            <p>Please wait while StudyAI prepares your notes. ✨</p>
        `;

        try {
            const data = await callAPI("/api/notes", {
                topic: topic,
                detailLevel: format,
                format: format,
                language: language
            });

            const notes = typeof data.notes === "string"
                ? data.notes
                : "No notes were returned.";

            const heading = document.createElement("h3");
            heading.textContent = "Study Notes: " + topic;

            const notesContainer = document.createElement("div");
            notesContainer.className = "generated-notes";
            notesContainer.textContent = notes;

            output.replaceChildren(heading, notesContainer);

            addActivity("Generated study notes: " + topic);
            showToast("Study notes generated successfully.");

        } catch (error) {
            console.error("StudyAI notes error:", error);

            output.innerHTML = `
                <h3>Unable to generate notes</h3>
                <p id="notesErrorMessage"></p>
            `;

            const errorMessage = getElement("notesErrorMessage");

            if (errorMessage) {
                errorMessage.textContent =
                    error instanceof Error
                        ? error.message
                        : "Study notes generation failed.";
            }

            showToast("Study notes generation failed.");

        } finally {
            state.isNotesLoading = false;
            generateNotesButton.disabled = false;
        }
    });
}

/* ---------- YOUTUBE URL VALIDATION ---------- */

/**
 * @param {string} input
 * @returns {string|null}
 */
function getYouTubeVideoId(input) {
    try {
        const url = new URL(input.trim());

        const host = url.hostname
            .toLowerCase()
            .replace(/^www\./, "");

        const allowedHosts = [
            "youtu.be",
            "m.youtube.com",
            "youtube.com",
            "music.youtube.com"
        ];

        if (!allowedHosts.includes(host)) {
            return null;
        }

        if (host === "youtu.be") {
            const id = url.pathname
                .split("/")
                .filter(Boolean)[0];

            return id && /^[\w-]{11}$/.test(id)
                ? id
                : null;
        }

        if (url.pathname === "/watch") {
            const id = url.searchParams.get("v");

            return id && /^[\w-]{11}$/.test(id)
                ? id
                : null;
        }

        const match = url.pathname.match(
            /^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/
        );

        return match ? match[1] : null;

    } catch (error) {
        return null;
    }
}

/* ---------- YOUTUBE SEMINAR NOTES ---------- */

let isYouTubeLoading = false;

const youtubeForm = getElement("youtubeForm");

if (youtubeForm) {
    youtubeForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isYouTubeLoading) {
            showToast("Please wait while your seminar notes are generated.");
            return;
        }

        const urlInput = getElement("youtubeUrl");
        const transcriptInput = getElement("youtubeTranscript");
        const languageInput = getElement("youtubeLanguage");
        const output = getElement("youtubeOutput");
        const submitButton = getElement("generateYoutubeNotes");

        if (
            !(urlInput instanceof HTMLInputElement) ||
            !(transcriptInput instanceof HTMLTextAreaElement) ||
            !output
        ) {
            showToast(
                "YouTube form elements are missing. Check your index.html."
            );
            return;
        }

        const videoUrl = urlInput.value.trim();
        const transcript = transcriptInput.value.trim();

        const language =
            languageInput instanceof HTMLSelectElement
                ? languageInput.value
                : "Simple English";

        const videoId = getYouTubeVideoId(videoUrl);

        if (!videoId) {
            showToast("Please enter a valid YouTube video URL.");
            urlInput.focus();
            return;
        }

        if (!transcript) {
            showToast("Please paste the video transcript first.");
            transcriptInput.focus();
            return;
        }

        if (transcript.length < 50) {
            showToast("Please paste a longer video transcript.");
            transcriptInput.focus();
            return;
        }

        if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
            showToast("The transcript exceeds the 50,000-character limit.");
            transcriptInput.focus();
            return;
        }

        isYouTubeLoading = true;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Generating notes...";
        }

        output.innerHTML = `
            <h3>✦ Preparing your seminar notes...</h3>
            <p>StudyAI is organizing the transcript into useful study material.</p>
            <p>Please wait. ✨</p>
        `;

        try {
            const data = await callAPI("/api/youtube", {
                url: videoUrl,
                videoId: videoId,
                transcript: transcript,
                language: language
            });

            const notes = typeof data.notes === "string"
                ? data.notes
                : "";

            if (!notes.trim()) {
                throw new Error(
                    "The AI returned empty seminar notes. Please try again."
                );
            }

            state.videosChecked += 1;

            updateStatistics();

            addActivity("Generated YouTube seminar notes");

            const heading = document.createElement("h3");
            heading.textContent = "Your Seminar Notes";

            const videoLink = document.createElement("a");
            videoLink.href =
                "https://www.youtube.com/watch?v=" + videoId;
            videoLink.target = "_blank";
            videoLink.rel = "noopener noreferrer";
            videoLink.textContent = "▶ Open original YouTube video";

            const languageLabel = document.createElement("p");
            languageLabel.textContent = "Notes language: " + language;

            const notesContainer = document.createElement("div");
            notesContainer.className = "generated-notes";
            notesContainer.textContent = notes;

            const copyButton = document.createElement("button");
            copyButton.type = "button";
            copyButton.className = "primary-button";
            copyButton.textContent = "Copy Seminar Notes";

            copyButton.addEventListener("click", async () => {
                try {
                    if (
                        navigator.clipboard &&
                        typeof navigator.clipboard.writeText === "function"
                    ) {
                        await navigator.clipboard.writeText(notes);
                    } else {
                        const temporary = document.createElement("textarea");

                        temporary.value = notes;
                        temporary.style.position = "fixed";
                        temporary.style.opacity = "0";

                        document.body.appendChild(temporary);
                        temporary.select();

                        const copied = document.execCommand("copy");

                        temporary.remove();

                        if (!copied) {
                            throw new Error("Copy failed.");
                        }
                    }

                    showToast("Seminar notes copied successfully!");

                } catch (error) {
                    showToast(
                        "Copy unavailable. Select the notes and copy them manually."
                    );
                }
            });

            output.replaceChildren(
                heading,
                videoLink,
                languageLabel,
                notesContainer,
                copyButton
            );

            showToast("Seminar notes generated successfully!");

        } catch (error) {
            console.error("StudyAI YouTube error:", error);

            output.innerHTML = `
                <h3>Unable to generate seminar notes</h3>
                <p id="youtubeErrorMessage"></p>
            `;

            const errorMessage = getElement("youtubeErrorMessage");

            if (errorMessage) {
                errorMessage.textContent =
                    error instanceof Error
                        ? error.message
                        : "Please check your connection and try again.";
            }

            showToast("Seminar generation failed.");

        } finally {
            isYouTubeLoading = false;

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "✦ Generate Seminar Notes";
            }
        }
    });
}

/* ---------- QUIZ AND FLASHCARDS ---------- */

/** @param {string} toolName */
function showStudyToolPreview(toolName) {
    navigateTo("quiz");

    const output = getElement("quizOutput");

    if (output) {
        output.innerHTML = `
            <h3>${escapeHTML(toolName)}</h3>
            <p>Enter a topic below to generate a quiz using StudyAI.</p>
        `;
    }

    addActivity("Opened " + toolName);
}

const quizAction = getElement("quizAction");

if (quizAction) {
    quizAction.addEventListener("click", () => {
        showStudyToolPreview("Practice Quiz");
    });
}

const flashcardAction = getElement("flashcardAction");

if (flashcardAction) {
    flashcardAction.addEventListener("click", () => {
        showStudyToolPreview("Flashcards");
    });
}

/* ---------- QUIZ FORM ---------- */

const quizForm = getElement("quizForm");

if (quizForm) {
    quizForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (state.isQuizLoading) {
            showToast("Please wait for the quiz to finish generating.");
            return;
        }

        const topicInput = getElement("quizTopic");
        const countInput = getElement("quizCount");
        const difficultyInput = getElement("quizDifficulty");
        const output = getElement("quizOutput");

        const topic =
            topicInput instanceof HTMLInputElement
                ? topicInput.value.trim()
                : "";

        const rawCount =
            countInput instanceof HTMLInputElement
                ? Number(countInput.value)
                : 5;

        const count = Number.isFinite(rawCount)
            ? Math.max(1, Math.min(20, Math.floor(rawCount)))
            : 5;

        const difficulty =
            difficultyInput instanceof HTMLSelectElement
                ? difficultyInput.value
                : "medium";

        if (!topic) {
            showToast("Enter a quiz topic first.");

            if (topicInput instanceof HTMLInputElement) {
                topicInput.focus();
            }

            return;
        }

        if (!output) {
            showToast("Quiz output area not found.");
            return;
        }

        state.isQuizLoading = true;

        const submitButton = quizForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
        }

        output.innerHTML = `
            <h3>Generating your quiz...</h3>
            <p>Please wait. ✨</p>
        `;

        try {
            const data = await callAPI("/api/quiz", {
                topic: topic,
                count: count,
                difficulty: difficulty
            });

            const quiz = data.quiz;

            if (
                !quiz ||
                !Array.isArray(quiz.questions) ||
                quiz.questions.length === 0
            ) {
                throw new Error("The AI returned no quiz questions.");
            }

            state.quiz = quiz;

            renderQuiz(quiz);

            addActivity("Generated a quiz: " + topic);
            showToast("Quiz generated successfully.");

        } catch (error) {
            console.error("StudyAI quiz error:", error);

            output.innerHTML = `
                <h3>Unable to generate quiz</h3>
                <p id="quizErrorMessage"></p>
            `;

            const errorMessage = getElement("quizErrorMessage");

            if (errorMessage) {
                errorMessage.textContent =
                    error instanceof Error
                        ? error.message
                        : "Please check your API configuration.";
            }

            showToast("Quiz generation failed.");

        } finally {
            state.isQuizLoading = false;

            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}

/* ---------- RENDER GENERATED QUIZ ---------- */

/**
 * @param {Object} quiz
 */
function renderQuiz(quiz) {
    const output = getElement("quizOutput");

    if (!output) {
        return;
    }

    const title = typeof quiz.title === "string"
        ? quiz.title
        : "Practice Quiz";

    const questions = Array.isArray(quiz.questions)
        ? quiz.questions
        : [];

    if (questions.length === 0) {
        output.innerHTML = "<p>No questions were generated.</p>";
        return;
    }

    output.innerHTML = `
        <h3>${escapeHTML(title)}</h3>

        <p class="quiz-score" id="quizScore">
            Answer the questions and check your score.
        </p>

        <div id="quizQuestions"></div>

        <button type="button" id="checkQuizAnswers">
            Check Answers
        </button>
    `;

    const questionContainer = getElement("quizQuestions");

    if (!questionContainer) {
        return;
    }

    questionContainer.innerHTML = questions.map((question, index) => {
        const options = Array.isArray(question.options)
            ? question.options
            : [];

        return `
            <div class="quiz-question">
                <h4>
                    ${index + 1}. ${escapeHTML(question.question || "")}
                </h4>

                <div class="quiz-options">
                    ${options.map((option, optionIndex) => `
                        <label class="quiz-option">
                            <input
                                type="radio"
                                name="quiz-question-${index}"
                                value="${optionIndex}"
                            >
                            <span>${escapeHTML(option)}</span>
                        </label>
                    `).join("")}
                </div>

                <div
                    class="quiz-explanation"
                    id="quiz-explanation-${index}"
                    hidden
                ></div>
            </div>
        `;
    }).join("");

    const checkButton = getElement("checkQuizAnswers");

    if (checkButton) {
        checkButton.addEventListener("click", () => {
            let score = 0;

            questions.forEach((question, index) => {
                const selected = questionContainer.querySelector(
                    'input[name="quiz-question-' + index + '"]:checked'
                );

                const options = Array.isArray(question.options)
                    ? question.options
                    : [];

                const selectedIndex = selected
                    ? Number(selected.value)
                    : -1;

                const correctAnswer = question.correctAnswer;
                let correctIndex = -1;

                if (typeof correctAnswer === "number") {
                    correctIndex = correctAnswer;
                } else if (typeof correctAnswer === "string") {
                    correctIndex = options.findIndex((option) => {
                        return option === correctAnswer;
                    });

                    if (
                        correctIndex < 0 &&
                        /^\d+$/.test(correctAnswer)
                    ) {
                        correctIndex = Number(correctAnswer);
                    }
                }

                if (
                    selectedIndex >= 0 &&
                    selectedIndex === correctIndex
                ) {
                    score += 1;
                }

                const explanation = getElement(
                    "quiz-explanation-" + index
                );

                if (explanation) {
                    const answerText =
                        options[correctIndex] ||
                        String(correctAnswer || "Not provided");

                    explanation.hidden = false;

                    explanation.textContent =
                        "Correct answer: " + answerText +
                        (
                            question.explanation
                                ? ". " + question.explanation
                                : ""
                        );
                }
            });

            const scoreElement = getElement("quizScore");

            if (scoreElement) {
                scoreElement.textContent =
                    "Your score: " + score + " / " + questions.length;
            }

            addActivity("Completed a quiz");
        });
    }
}

/* ---------- INITIALIZATION ---------- */

function initializeApp() {
    renderFiles();
    renderActivity();
    updateStatistics();

    navigateTo("chat");

    console.log("StudyAI frontend initialized successfully.");
}

initializeApp();
