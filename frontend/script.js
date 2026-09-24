// ============================================================
// SIKSHA AI — FINAL FRONTEND ENGINE
// CHAT + MEMORY + PREMIUM + HINDI + ENGLISH + HINGLISH
// VOICE INPUT + GEMINI TTS + FILE UPLOAD
// RECENT CHATS + SEARCH + DELETE
// MATH RENDERING + TYPING ANIMATION
// ============================================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    // ========================================================
    // CONFIG
    // ========================================================

    const API_BASE = "http://127.0.0.1:5000";

    const API_URL = `${API_BASE}/api/chat`;
    const FILE_API_URL = `${API_BASE}/api/solve-file`;
    const TTS_URL = `${API_BASE}/api/tts`;

    const CHATS_KEY = "siksha_ai_chats_v2";
    const CURRENT_CHAT_KEY = "siksha_ai_current_chat_v2";

    const MAX_CHATS = 500;
    const MAX_MESSAGES = 80;


    // ========================================================
    // DOM
    // ========================================================

    const $ = (id) => document.getElementById(id);

    const messages = $("messages");
    const welcomeScreen = $("welcomeScreen");
    const typingIndicator = $("typingIndicator");

    const messageInput = $("messageInput");
    const sendButton = $("sendButton");
    const talkButton = $("talkButton");

    const newChatButton = $("newChatButton");
    const clearButton = $("clearButton");

    const recentChats = $("recentChats");
    const emptyChats = $("emptyChats");

    const chatSearchInput = $("chatSearchInput");
    const chatCount = $("chatCount");

    const normalModeButton = $("normalModeButton");
    const premiumModeButton = $("premiumModeButton");

    const modeTitle = $("modeTitle");
    const modeSubtitle = $("modeSubtitle");
    const modePill = $("modePill");

    const fileInput = $("fileInput");
    const attachButton = $("attachButton");

    const filePreview = $("filePreview");
    const filePreviewName = $("filePreviewName");
    const filePreviewSize = $("filePreviewSize");
    const removeFileButton = $("removeFileButton");

    const premiumModal = $("premiumModal");
    const closePremiumModal = $("closePremiumModal");
    const premiumCta = $("premiumCta");
    const sidebarPremiumButton = $("sidebarPremiumButton");

    const voicePanel = $("voicePanel");
    const stopVoiceButton = $("stopVoiceButton");

    const deleteModal = $("deleteModal");
    const cancelDelete = $("cancelDelete");
    const confirmDelete = $("confirmDelete");

    const toast = $("toast");
    const toastMessage = $("toastMessage");

    const mobileMenuButton = $("mobileMenuButton");
    const sidebar = $("sidebar");
    const mobileSidebarOverlay = $("mobileSidebarOverlay");


    // ========================================================
    // STATE
    // ========================================================

    let chats = loadChats();

    let currentChatId = localStorage.getItem(CURRENT_CHAT_KEY);

    let currentMode = "normal";

    let selectedFile = null;

    let deleteTargetId = null;

    let recognition = null;

    let isListening = false;

    let isGenerating = false;

    let currentAudio = null;

    let toastTimer = null;


    // ========================================================
    // CHAT DATA
    // ========================================================

    function generateId() {

        return (
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 8)
        );

    }


    function createChat() {

        const chat = {
            id: generateId(),

            title: "New conversation",

            createdAt: Date.now(),

            updatedAt: Date.now(),

            messages: []
        };

        chats.unshift(chat);

        trimChats();

        currentChatId = chat.id;

        saveChats();

        localStorage.setItem(
            CURRENT_CHAT_KEY,
            currentChatId
        );

        return chat;
    }


    function getCurrentChat() {

        let chat = chats.find(
            item => item.id === currentChatId
        );

        if (!chat) {
            chat = createChat();
        }

        return chat;
    }


    function trimChats() {

        if (chats.length > MAX_CHATS) {

            chats = chats.slice(
                0,
                MAX_CHATS
            );

        }

    }


    function saveChats() {

        try {

            localStorage.setItem(
                CHATS_KEY,
                JSON.stringify(chats)
            );

        } catch (error) {

            console.error(
                "Could not save chats:",
                error
            );

        }

    }


    function loadChats() {

        try {

            const saved =
                localStorage.getItem(CHATS_KEY);

            if (!saved) {
                return [];
            }

            const parsed =
                JSON.parse(saved);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.slice(
                0,
                MAX_CHATS
            );

        } catch (error) {

            console.error(
                "Could not load chats:",
                error
            );

            return [];
        }

    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    initialize();


    function initialize() {

        if (!currentChatId ||
            !chats.some(
                chat => chat.id === currentChatId
            )) {

            if (chats.length > 0) {

                currentChatId =
                    chats[0].id;

            } else {

                createChat();

            }

        }

        localStorage.setItem(
            CURRENT_CHAT_KEY,
            currentChatId
        );

        renderRecentChats();

        renderCurrentChat();

        setupSpeechRecognition();

        autoResizeTextarea();

    }


    // ========================================================
    // CURRENT CHAT RENDER
    // ========================================================

    function renderCurrentChat() {

        const chat = getCurrentChat();

        messages.innerHTML = "";

        if (
            !chat.messages ||
            chat.messages.length === 0
        ) {

            messages.appendChild(
                welcomeScreen
            );

            welcomeScreen.style.display = "flex";

            addTypingIndicator();

            return;
        }


        welcomeScreen.style.display = "none";

        chat.messages.forEach(
            message => {

                renderMessage(
                    message.role,
                    message.content,
                    false
                );

            }
        );

        addTypingIndicator();

        scrollToBottom(false);

    }


    function addTypingIndicator() {

        if (
            typingIndicator &&
            !messages.contains(typingIndicator)
        ) {

            messages.appendChild(
                typingIndicator
            );

        }

    }


    // ========================================================
    // RECENT CHAT SIDEBAR
    // ========================================================

    function renderRecentChats(filter = "") {

        recentChats.innerHTML = "";

        const query =
            filter.trim().toLowerCase();


        const filtered =
            chats.filter(chat => {

                if (!query) {
                    return true;
                }

                const title =
                    String(chat.title || "")
                        .toLowerCase();

                const preview =
                    String(
                        getLastUserMessage(chat) || ""
                    ).toLowerCase();

                return (
                    title.includes(query) ||
                    preview.includes(query)
                );

            });


        if (filtered.length === 0) {

            const empty =
                document.createElement("div");

            empty.className =
                "empty-chats";

            empty.innerHTML = `
                <div class="empty-chat-icon">✦</div>
                <p>${query ? "No chats found" : "No conversations yet"}</p>
                <span>${query ? "Try another search" : "Start asking Siksha AI"}</span>
            `;

            recentChats.appendChild(empty);

        } else {

            filtered.forEach(chat => {

                const item =
                    document.createElement("div");

                item.className =
                    "chat-item recent-chat-item";

                if (
                    chat.id === currentChatId
                ) {

                    item.classList.add(
                        "active"
                    );

                }


                const lastMessage =
                    getLastUserMessage(chat);


                item.innerHTML = `
                    <div class="chat-item-main recent-chat-main">
                        <div class="chat-item-title recent-chat-title">
                            ${escapeHTML(
                                chat.title ||
                                "New conversation"
                            )}
                        </div>

                        <div class="chat-item-time recent-chat-preview">
                            ${escapeHTML(
                                lastMessage ||
                                formatChatDate(
                                    chat.updatedAt
                                )
                            )}
                        </div>
                    </div>

                    <button
                        class="chat-delete recent-chat-delete"
                        title="Delete chat"
                        data-chat-id="${chat.id}">
                        ×
                    </button>
                `;


                item.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target.closest(
                                ".chat-delete"
                            )
                        ) {

                            return;

                        }

                        openChat(chat.id);

                    }
                );


                const deleteButton =
                    item.querySelector(
                        ".chat-delete"
                    );


                deleteButton.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        openDeleteModal(
                            chat.id
                        );

                    }
                );


                recentChats.appendChild(
                    item
                );

            });

        }


        chatCount.textContent =
            String(chats.length);

    }


    function openChat(id) {

        if (
            !chats.some(
                chat => chat.id === id
            )
        ) {

            return;

        }

        currentChatId = id;

        localStorage.setItem(
            CURRENT_CHAT_KEY,
            id
        );

        renderRecentChats(
            chatSearchInput.value
        );

        renderCurrentChat();

        closeMobileSidebar();

    }


    function getLastUserMessage(chat) {

        if (!chat.messages) {
            return "";
        }

        for (
            let i = chat.messages.length - 1;
            i >= 0;
            i--
        ) {

            if (
                chat.messages[i].role === "user"
            ) {

                return chat.messages[i].content;

            }

        }

        return "";

    }


    function formatChatDate(timestamp) {

        if (!timestamp) {
            return "";
        }

        const date =
            new Date(timestamp);

        const now =
            new Date();

        const sameDay =
            date.toDateString() ===
            now.toDateString();

        if (sameDay) {

            return date.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        }

        return date.toLocaleDateString(
            [],
            {
                day: "numeric",
                month: "short"
            }
        );

    }


    // ========================================================
    // NEW CHAT
    // ========================================================

    newChatButton?.addEventListener(
        "click",
        () => {

            if (isGenerating) {
                return;
            }

            createChat();

            renderRecentChats();

            renderCurrentChat();

            showToast(
                "New conversation started"
            );

            closeMobileSidebar();

        }
    );


    // ========================================================
    // CLEAR CHAT
    // ========================================================

    clearButton?.addEventListener(
        "click",
        () => {

            if (isGenerating) {
                return;
            }

            const chat =
                getCurrentChat();

            chat.messages = [];

            chat.title =
                "New conversation";

            chat.updatedAt =
                Date.now();

            saveChats();

            renderRecentChats();

            renderCurrentChat();

            showToast(
                "Conversation cleared"
            );

        }
    );


    // ========================================================
    // DELETE CHAT
    // ========================================================

    function openDeleteModal(id) {

        deleteTargetId = id;

        deleteModal?.classList.add(
            "visible"
        );

    }


    cancelDelete?.addEventListener(
        "click",
        closeDeleteModal
    );


    function closeDeleteModal() {

        deleteTargetId = null;

        deleteModal?.classList.remove(
            "visible"
        );

    }


    confirmDelete?.addEventListener(
        "click",
        () => {

            if (!deleteTargetId) {
                return;
            }

            const deletingId =
                deleteTargetId;

            chats =
                chats.filter(
                    chat =>
                        chat.id !== deletingId
                );


            if (
                currentChatId === deletingId
            ) {

                if (chats.length > 0) {

                    currentChatId =
                        chats[0].id;

                } else {

                    createChat();

                }

                localStorage.setItem(
                    CURRENT_CHAT_KEY,
                    currentChatId
                );

            }


            saveChats();

            closeDeleteModal();

            renderRecentChats();

            renderCurrentChat();

            showToast(
                "Conversation deleted"
            );

        }
    );


    // ========================================================
    // SEARCH CHATS
    // ========================================================

    chatSearchInput?.addEventListener(
        "input",
        () => {

            renderRecentChats(
                chatSearchInput.value
            );

        }
    );


    // ========================================================
    // MODE SWITCH
    // ========================================================

    normalModeButton?.addEventListener(
        "click",
        () => {

            setMode("normal");

        }
    );


    premiumModeButton?.addEventListener(
        "click",
        () => {

            setMode("premium");

        }
    );


    function setMode(mode) {

        currentMode = mode;

        if (mode === "premium") {

            document.body.classList.add(
                "premium-active"
            );

            normalModeButton?.classList.remove(
                "active"
            );

            premiumModeButton?.classList.add(
                "active"
            );

            modeTitle.textContent =
                "Siksha AI Premium";

            modeSubtitle.textContent =
                "Enhanced AI learning experience";

            modePill.textContent =
                "PREMIUM";

            modePill.classList.add(
                "premium"
            );

        } else {

            document.body.classList.remove(
                "premium-active"
            );

            premiumModeButton?.classList.remove(
                "active"
            );

            normalModeButton?.classList.add(
                "active"
            );

            modeTitle.textContent =
                "Siksha AI";

            modeSubtitle.textContent =
                "Your intelligent learning assistant";

            modePill.textContent =
                "NORMAL";

            modePill.classList.remove(
                "premium"
            );

        }

    }


    // ========================================================
    // PREMIUM MODAL
    // ========================================================

    sidebarPremiumButton?.addEventListener(
        "click",
        () => {

            premiumModal?.classList.add(
                "visible"
            );

        }
    );


    closePremiumModal?.addEventListener(
        "click",
        () => {

            premiumModal?.classList.remove(
                "visible"
            );

        }
    );


    premiumModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                premiumModal
            ) {

                premiumModal.classList.remove(
                    "visible"
                );

            }

        }
    );


    premiumCta?.addEventListener(
        "click",
        () => {

            premiumModal?.classList.remove(
                "visible"
            );

            setMode("premium");

            showToast(
                "Premium mode enabled"
            );

        }
    );


    // ========================================================
    // QUICK PROMPTS
    // ========================================================

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".quick-prompt"
                );

            if (!button) {
                return;
            }

            const prompt =
                button.dataset.prompt;

            if (!prompt) {
                return;
            }

            messageInput.value =
                prompt;

            autoResizeTextarea();

            messageInput.focus();

        }
    );


    // ========================================================
    // SEND
    // ========================================================

    sendButton?.addEventListener(
        "click",
        sendMessage
    );


    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    async function sendMessage() {

        if (isGenerating) {
            return;
        }

        const text =
            messageInput.value.trim();


        if (!text && !selectedFile) {

            showToast(
                "Type something first"
            );

            return;

        }


        const chat =
            getCurrentChat();


        welcomeScreen.style.display =
            "none";


        if (selectedFile) {

            await solveFile(
                text,
                selectedFile
            );

            return;

        }


        addMessage(
            "user",
            text
        );


        messageInput.value = "";

        autoResizeTextarea();


        await askAI(text);

    }


    // ========================================================
    // ADD MESSAGE
    // ========================================================

    function addMessage(
        role,
        content,
        save = true
    ) {

        renderMessage(
            role,
            content,
            true
        );


        if (save) {

            const chat =
                getCurrentChat();


            chat.messages.push({
                role,
                content,
                timestamp: Date.now()
            });


            if (
                chat.messages.length >
                MAX_MESSAGES
            ) {

                chat.messages =
                    chat.messages.slice(
                        -MAX_MESSAGES
                    );

            }


            if (
                role === "user" &&
                chat.title === "New conversation"
            ) {

                chat.title =
                    createChatTitle(
                        content
                    );

            }


            chat.updatedAt =
                Date.now();


            saveChats();

            renderRecentChats();

        }

    }


    function createChatTitle(text) {

        const cleaned =
            text
                .replace(/\s+/g, " ")
                .trim();


        if (!cleaned) {
            return "New conversation";
        }


        if (cleaned.length <= 35) {
            return cleaned;
        }


        return (
            cleaned.slice(0, 35).trim() +
            "..."
        );

    }


    // ========================================================
    // RENDER MESSAGE
    // ========================================================

    function renderMessage(
        role,
        content,
        animate = true
    ) {

        const wrapper =
            document.createElement("div");

        wrapper.className =
            `message ${role}`;


        if (!animate) {
            wrapper.style.animation =
                "none";
        }


        const contentBox =
            document.createElement("div");

        contentBox.className =
            "message-content";


        if (role === "ai") {

            const avatar =
                document.createElement("div");

            avatar.className =
                "ai-avatar";

            avatar.innerHTML = `
                <img
                    src="assets/logo.png"
                    alt="Siksha AI">
            `;

            wrapper.appendChild(
                avatar
            );

        }


        const bubble =
            document.createElement("div");

        bubble.className =
            "message-bubble";


        if (role === "ai") {

            bubble.innerHTML =
                `<div class="ai-response">
                    ${formatAIResponse(content)}
                </div>`;

        } else {

            bubble.textContent =
                content;

        }


        contentBox.appendChild(
            bubble
        );


        const meta =
            document.createElement("div");

        meta.className =
            "message-meta";

        meta.textContent =
            role === "user"
                ? "You"
                : "Siksha AI";


        contentBox.appendChild(
            meta
        );


        wrapper.appendChild(
            contentBox
        );


        messages.insertBefore(
            wrapper,
            typingIndicator
        );


        scrollToBottom(
            animate
        );

    }


    // ========================================================
    // AI REQUEST
    // ========================================================

    async function askAI(userText) {

        setGenerating(true);

        showTyping();


        try {

            const chat =
                getCurrentChat();


            const history =
                chat.messages
                    .slice(-20)
                    .map(message => ({
                        role:
                            message.role === "assistant"
                                ? "model"
                                : message.role,

                        content:
                            message.content
                    }));


            const response =
                await fetch(
                    API_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            message: userText,

                            mode: currentMode,

                            history
                        })
                    }
                );


            const data =
                await parseResponse(
                    response
                );


            hideTyping();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.message ||
                    "AI request failed"
                );

            }


            const answer =
                extractAnswer(data);


            if (!answer) {

                throw new Error(
                    "Siksha AI returned an empty response."
                );

            }


            addMessage(
                "ai",
                answer
            );


            if (
                currentMode === "premium"
            ) {

                speakAI(answer);

            }

        } catch (error) {

            console.error(
                "AI error:",
                error
            );

            hideTyping();

            addMessage(
                "ai",
                `⚠️ **Siksha AI connection error**\n\n${error.message}\n\nPlease make sure the Siksha AI backend is running.` 
            );

            showToast(
                "Could not connect to Siksha AI"
            );

        } finally {

            setGenerating(false);

        }

    }


    // ========================================================
    // RESPONSE PARSER
    // ========================================================

    async function parseResponse(
        response
    ) {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            return await response.json();

        }


        const text =
            await response.text();


        try {

            return JSON.parse(text);

        } catch {

            return {
                text
            };

        }

    }


    function extractAnswer(data) {

        if (!data) {
            return "";
        }

        if (
            typeof data === "string"
        ) {
            return data;
        }


        return (
            data.answer ||
            data.response ||
            data.reply ||
            data.text ||
            data.message ||
            data.output ||
            ""
        );

    }


    // ========================================================
    // TYPING
    // ========================================================

    function showTyping() {

        addTypingIndicator();

        typingIndicator.classList.add(
            "visible"
        );

        scrollToBottom();

    }


    function hideTyping() {

        typingIndicator.classList.remove(
            "visible"
        );

    }


    // ========================================================
    // GENERATING STATE
    // ========================================================

    function setGenerating(value) {

        isGenerating = value;

        sendButton.disabled =
            value;

        attachButton.disabled =
            value;

        if (value) {

            sendButton.style.opacity =
                "0.55";

        } else {

            sendButton.style.opacity =
                "";

        }

    }


    // ========================================================
    // FILE UPLOAD
    // ========================================================

    attachButton?.addEventListener(
        "click",
        () => {

            if (isGenerating) {
                return;
            }

            fileInput.click();

        }
    );


    fileInput?.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files?.[0];

            if (!file) {
                return;
            }

            selectedFile =
                file;

            showFilePreview(
                file
            );

        }
    );


    function showFilePreview(file) {

        filePreviewName.textContent =
            file.name;

        filePreviewSize.textContent =
            formatFileSize(
                file.size
            );

        filePreview.classList.add(
            "visible"
        );

    }


    removeFileButton?.addEventListener(
        "click",
        removeSelectedFile
    );


    function removeSelectedFile() {

        selectedFile = null;

        fileInput.value = "";

        filePreview.classList.remove(
            "visible"
        );

    }


    function formatFileSize(bytes) {

        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {

            return `${(
                bytes / 1024
            ).toFixed(1)} KB`;

        }

        return `${(
            bytes / (1024 * 1024)
        ).toFixed(1)} MB`;

    }


    async function solveFile(
        question,
        file
    ) {

        setGenerating(true);

        showTyping();

        removeSelectedFile();


        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            formData.append(
                "message",
                question ||
                "Analyze this file and explain the important content clearly."
            );

            formData.append(
                "mode",
                currentMode
            );


            const response =
                await fetch(
                    FILE_API_URL,
                    {
                        method: "POST",

                        body: formData
                    }
                );


            const data =
                await parseResponse(
                    response
                );


            hideTyping();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.message ||
                    "File processing failed"
                );

            }


            const answer =
                extractAnswer(data);


            if (!answer) {

                throw new Error(
                    "No answer was returned for the file."
                );

            }


            addMessage(
                "user",
                question
                    ? `${question}\n\n📎 ${file.name}`
                    : `📎 ${file.name}`
            );


            addMessage(
                "ai",
                answer
            );


            if (
                currentMode === "premium"
            ) {

                speakAI(answer);

            }

        } catch (error) {

            console.error(
                "File error:",
                error
            );

            hideTyping();

            addMessage(
                "ai",
                `⚠️ **File processing failed**\n\n${error.message}`
            );

            showToast(
                "Could not process the file"
            );

        } finally {

            setGenerating(false);

        }

    }


    // ========================================================
    // VOICE INPUT
    // ========================================================

    function setupSpeechRecognition() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            console.warn(
                "Speech Recognition is not supported."
            );

            return;

        }


        recognition =
            new SpeechRecognition();


        recognition.continuous =
            false;

        recognition.interimResults =
            true;

        recognition.lang =
            "en-IN";


        recognition.onstart =
            () => {

                isListening = true;

                talkButton.classList.add(
                    "listening"
                );

                voicePanel?.classList.add(
                    "visible"
                );

            };


        recognition.onresult =
            event => {

                let transcript = "";

                for (
                    let i = event.resultIndex;
                    i < event.results.length;
                    i++
                ) {

                    transcript +=
                        event.results[i][0].transcript;

                }

                messageInput.value =
                    transcript;

                autoResizeTextarea();

            };


        recognition.onerror =
            event => {

                console.error(
                    "Speech recognition:",
                    event.error
                );

                stopListening();

                if (
                    event.error ===
                    "not-allowed"
                ) {

                    showToast(
                        "Microphone permission is required"
                    );

                }

            };


        recognition.onend =
            () => {

                stopListening();

            };

    }


    talkButton?.addEventListener(
        "click",
        () => {

            if (isListening) {

                stopListening();

                return;

            }


            if (!recognition) {

                showToast(
                    "Voice input is not supported in this browser"
                );

                return;

            }


            try {

                recognition.start();

            } catch (error) {

                console.error(error);

            }

        }
    );


    stopVoiceButton?.addEventListener(
        "click",
        stopListening
    );


    function stopListening() {

        if (recognition) {

            try {
                recognition.stop();
            } catch {}

        }

        isListening = false;

        talkButton?.classList.remove(
            "listening"
        );

        voicePanel?.classList.remove(
            "visible"
        );

    }


    // ========================================================
    // GEMINI TTS
    // ========================================================

    async function speakAI(text) {

        try {

            stopCurrentAudio();


            const cleanText =
                stripMarkdownForSpeech(
                    text
                );


            if (!cleanText) {
                return;
            }


            const response =
                await fetch(
                    TTS_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            text: cleanText,

                            mode: currentMode
                        })
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "TTS request failed"
                );

            }


            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";


            if (
                contentType.includes(
                    "audio/"
                )
            ) {

                const blob =
                    await response.blob();

                const url =
                    URL.createObjectURL(
                        blob
                    );

                currentAudio =
                    new Audio(url);

                currentAudio.onended =
                    () => {

                        URL.revokeObjectURL(
                            url
                        );

                    };

                await currentAudio.play();

                return;

            }


            const data =
                await response.json();


            const audioData =
                data.audio ||
                data.audioContent ||
                data.data;


            if (!audioData) {
                return;
            }


            const blob =
                base64ToBlob(
                    audioData,
                    "audio/wav"
                );


            const url =
                URL.createObjectURL(
                    blob
                );


            currentAudio =
                new Audio(url);


            currentAudio.onended =
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                };


            await currentAudio.play();

        } catch (error) {

            console.warn(
                "TTS unavailable:",
                error
            );

        }

    }


    function stopCurrentAudio() {

        if (!currentAudio) {
            return;
        }

        try {

            currentAudio.pause();

            currentAudio.currentTime =
                0;

        } catch {}

        currentAudio = null;

    }


    function base64ToBlob(
        base64,
        mimeType
    ) {

        const byteCharacters =
            atob(base64);

        const byteArrays = [];

        const chunkSize =
            1024;


        for (
            let offset = 0;
            offset < byteCharacters.length;
            offset += chunkSize
        ) {

            const slice =
                byteCharacters.slice(
                    offset,
                    offset + chunkSize
                );


            const byteNumbers =
                new Array(
                    slice.length
                );


            for (
                let i = 0;
                i < slice.length;
                i++
            ) {

                byteNumbers[i] =
                    slice.charCodeAt(i);

            }


            byteArrays.push(
                new Uint8Array(
                    byteNumbers
                )
            );

        }


        return new Blob(
            byteArrays,
            {
                type: mimeType
            }
        );

    }


    function stripMarkdownForSpeech(text) {

        return text
            .replace(
                /```[\s\S]*?```/g,
                ""
            )
            .replace(
                /[#*_>`]/g,
                ""
            )
            .replace(
                /\$[^$]*\$/g,
                " mathematical expression "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    }


    // ========================================================
    // MATH + MARKDOWN RENDERER
    // ========================================================

    function formatAIResponse(text) {

        if (!text) {
            return "";
        }


        let value =
            String(text)
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n");


        // Protect code blocks

        const protectedBlocks = [];


        value =
            value.replace(
                /```([\s\S]*?)```/g,
                (_, code) => {

                    const index =
                        protectedBlocks.length;

                    protectedBlocks.push(
                        `<pre><code>${escapeHTML(
                            code.trim()
                        )}</code></pre>`
                    );

                    return `@@CODE${index}@@`;

                }
            );


        // Protect math

        const protectedMath = [];


        value =
            value.replace(
                /\$\$([\s\S]*?)\$\$/g,
                (_, math) => {

                    const index =
                        protectedMath.length;

                    protectedMath.push(
                        renderMath(
                            math.trim()
                        )
                    );

                    return `@@MATH${index}@@`;

                }
            );


        value =
            value.replace(
                /\\\[([\s\S]*?)\\\]/g,
                (_, math) => {

                    const index =
                        protectedMath.length;

                    protectedMath.push(
                        renderMath(
                            math.trim()
                        )
                    );

                    return `@@MATH${index}@@`;

                }
            );


        value =
            value.replace(
                /\\\(([\s\S]*?)\\\)/g,
                (_, math) => {

                    const index =
                        protectedMath.length;

                    protectedMath.push(
                        renderInlineMath(
                            math.trim()
                        )
                    );

                    return `@@MATH${index}@@`;

                }
            );


        value =
            value.replace(
                /\$([^$\n]+)\$/g,
                (_, math) => {

                    const index =
                        protectedMath.length;

                    protectedMath.push(
                        renderInlineMath(
                            math.trim()
                        )
                    );

                    return `@@MATH${index}@@`;

                }
            );


        // Escape remaining HTML

        value =
            escapeHTML(value);


        // Headings

        value =
            value.replace(
                /^### (.+)$/gm,
                "<h3>$1</h3>"
            );

        value =
            value.replace(
                /^## (.+)$/gm,
                "<h2>$1</h2>"
            );

        value =
            value.replace(
                /^# (.+)$/gm,
                "<h1>$1</h1>"
            );


        // Bold

        value =
            value.replace(
                /\*\*(.+?)\*\*/g,
                "<strong>$1</strong>"
            );


        // Italic

        value =
            value.replace(
                /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
                "<em>$1</em>"
            );


        // Inline code

        value =
            value.replace(
                /`([^`\n]+)`/g,
                "<code>$1</code>"
            );


        // Blockquotes

        value =
            value.replace(
                /^&gt;\s?(.*)$/gm,
                "<blockquote>$1</blockquote>"
            );


        // Numbered list

        value =
            value.replace(
                /(?:^|\n)((?:\d+\.\s.+\n?)+)/g,
                (_, block) => {

                    const items =
                        block
                            .trim()
                            .split("\n")
                            .map(
                                line =>
                                    line.replace(
                                        /^\d+\.\s+/,
                                        ""
                                    )
                            )
                            .filter(Boolean)
                            .map(
                                item =>
                                    `<li>${item}</li>`
                            )
                            .join("");

                    return `\n<ol>${items}</ol>\n`;

                }
            );


        // Bullet list

        value =
            value.replace(
                /(?:^|\n)((?:[-•]\s.+\n?)+)/g,
                (_, block) => {

                    const items =
                        block
                            .trim()
                            .split("\n")
                            .map(
                                line =>
                                    line.replace(
                                        /^[-•]\s+/,
                                        ""
                                    )
                            )
                            .filter(Boolean)
                            .map(
                                item =>
                                    `<li>${item}</li>`
                            )
                            .join("");

                    return `\n<ul>${items}</ul>\n`;

                }
            );


        // Line breaks

        value =
            value.replace(
                /\n{2,}/g,
                "<br><br>"
            );

        value =
            value.replace(
                /\n/g,
                "<br>"
            );


        // Restore math

        protectedMath.forEach(
            (html, index) => {

                value =
                    value.replace(
                        `@@MATH${index}@@`,
                        html
                    );

            }
        );


        // Restore code

        protectedBlocks.forEach(
            (html, index) => {

                value =
                    value.replace(
                        `@@CODE${index}@@`,
                        html
                    );

            }
        );


        return value;

    }


    function renderMath(math) {

        let expression =
            escapeHTML(
                math
            );


        expression =
            expression.replace(
                /\\boxed\{([\s\S]*?)\}/g,
                '<span class="math-box">$1</span>'
            );


        expression =
            expression.replace(
                /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
                '<span class="math-fraction"><span class="numerator">$1</span><span class="denominator">$2</span></span>'
            );


        expression =
            expression.replace(
                /\\sqrt\{([^{}]*)\}/g,
                '<span class="sqrt"><span class="sqrt-symbol">√</span><span class="sqrt-content">$1</span></span>'
            );


        expression =
            expression.replace(
                /\\text\{([^{}]*)\}/g,
                '<span class="math-text">$1</span>'
            );


        expression =
            expression.replace(
                /\\times/g,
                "×"
            );


        expression =
            expression.replace(
                /\\cdot/g,
                "·"
            );


        expression =
            expression.replace(
                /\\pm/g,
                "±"
            );


        expression =
            expression.replace(
                /\\leq/g,
                "≤"
            );


        expression =
            expression.replace(
                /\\geq/g,
                "≥"
            );


        expression =
            expression.replace(
                /\\neq/g,
                "≠"
            );


        expression =
            expression.replace(
                /\\rightarrow/g,
                "→"
            );


        expression =
            expression.replace(
                /\\pi/g,
                "π"
            );


        expression =
            expression.replace(
                /\\theta/g,
                "θ"
            );


        expression =
            expression.replace(
                /\\alpha/g,
                "α"
            );


        expression =
            expression.replace(
                /\\beta/g,
                "β"
            );


        expression =
            expression.replace(
                /\^(\d+)/g,
                "<sup>$1</sup>"
            );


        expression =
            expression.replace(
                /\^([a-zA-Z])/g,
                "<sup>$1</sup>"
            );


        expression =
            expression.replace(
                /_(\d+)/g,
                "<sub>$1</sub>"
            );


        expression =
            expression.replace(
                /_([a-zA-Z])/g,
                "<sub>$1</sub>"
            );


        expression =
            expression.replace(
                /\\left/g,
                ""
            );


        expression =
            expression.replace(
                /\\right/g,
                ""
            );


        expression =
            expression.replace(
                /\\,/g,
                " "
            );


        return `
            <div class="math-display">
                ${expression}
            </div>
        `;

    }


    function renderInlineMath(math) {

        let expression =
            escapeHTML(
                math
            );


        expression =
            expression.replace(
                /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
                '<span class="math-fraction"><span class="numerator">$1</span><span class="denominator">$2</span></span>'
            );


        expression =
            expression.replace(
                /\\sqrt\{([^{}]*)\}/g,
                '<span class="sqrt"><span class="sqrt-symbol">√</span><span class="sqrt-content">$1</span></span>'
            );


        expression =
            expression.replace(
                /\\times/g,
                "×"
            );


        expression =
            expression.replace(
                /\\cdot/g,
                "·"
            );


        expression =
            expression.replace(
                /\\pi/g,
                "π"
            );


        expression =
            expression.replace(
                /\^(\d+)/g,
                "<sup>$1</sup>"
            );


        expression =
            expression.replace(
                /_(\d+)/g,
                "<sub>$1</sub>"
            );


        return `
            <span class="math-text">
                ${expression}
            </span>
        `;

    }


    // ========================================================
    // SAFE HTML
    // ========================================================

    function escapeHTML(value) {

        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    // ========================================================
    // TEXTAREA
    // ========================================================

    messageInput?.addEventListener(
        "input",
        autoResizeTextarea
    );


    function autoResizeTextarea() {

        if (!messageInput) {
            return;
        }

        messageInput.style.height =
            "auto";

        messageInput.style.height =
            Math.min(
                messageInput.scrollHeight,
                150
            ) + "px";

    }


    // ========================================================
    // SCROLL
    // ========================================================

    function scrollToBottom(
        smooth = true
    ) {

        requestAnimationFrame(
            () => {

                messages.scrollTo({
                    top:
                        messages.scrollHeight,

                    behavior:
                        smooth
                            ? "smooth"
                            : "auto"
                });

            }
        );

    }


    // ========================================================
    // TOAST
    // ========================================================

    function showToast(message) {

        if (!toast) {
            return;
        }

        toastMessage.textContent =
            message;

        toast.classList.add(
            "visible"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "visible"
                    );

                },
                2500
            );

    }


    // ========================================================
    // MOBILE SIDEBAR
    // ========================================================

    mobileMenuButton?.addEventListener(
        "click",
        () => {

            sidebar?.classList.add(
                "open"
            );

            mobileSidebarOverlay?.classList.add(
                "visible"
            );

        }
    );


    mobileSidebarOverlay?.addEventListener(
        "click",
        closeMobileSidebar
    );


    function closeMobileSidebar() {

        sidebar?.classList.remove(
            "open"
        );

        mobileSidebarOverlay?.classList.remove(
            "visible"
        );

    }


    // ========================================================
    // ESCAPE KEY
    // ========================================================

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {

                return;

            }


            premiumModal?.classList.remove(
                "visible"
            );

            deleteModal?.classList.remove(
                "visible"
            );

            voicePanel?.classList.remove(
                "visible"
            );

            closeMobileSidebar();

        }
    );


    // ========================================================
    // CLICK OUTSIDE DELETE MODAL
    // ========================================================

    deleteModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                deleteModal
            ) {

                closeDeleteModal();

            }

        }
    );


    // ========================================================
    // ONLINE / OFFLINE NOTICE
    // ========================================================

    window.addEventListener(
        "offline",
        () => {

            showToast(
                "Internet connection lost"
            );

        }
    );


    window.addEventListener(
        "online",
        () => {

            showToast(
                "Back online"
            );

        }
    );


    // ========================================================
    // IMAGE FALLBACK
    // ========================================================

    document.addEventListener(
        "error",
        event => {

            const target =
                event.target;

            if (
                target instanceof
                HTMLImageElement &&
                target.src.includes(
                    "assets/logo.png"
                )
            ) {

                target.style.display =
                    "none";

            }

        },
        true
    );


    // ========================================================
    // GLOBAL DEBUG HELPERS
    // ========================================================

    window.SikshaAI = {

        newChat: () => {

            createChat();

            renderRecentChats();

            renderCurrentChat();

        },

        clearChat: () => {

            clearButton?.click();

        },

        setMode: (
            mode
        ) => {

            if (
                mode === "normal" ||
                mode === "premium"
            ) {

                setMode(mode);

            }

        },

        getChats: () => {

            return chats;

        }

    };

});