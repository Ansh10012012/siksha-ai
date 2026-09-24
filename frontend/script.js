// ============================================================
// SIKSHA AI — FINAL FRONTEND ENGINE V4
// CHAT + MEMORY + PREMIUM + HINDI + ENGLISH + HINGLISH
// VOICE INPUT + GEMINI TTS + FILE UPLOAD
// RECENT CHATS + SEARCH + DELETE
// MATH RENDERING + TYPING ANIMATION
// RENDER DEPLOYMENT READY
//
// FIXES:
// - Removed AI logo/avatar from every response
// - Fixed insertBefore / detached typing indicator crash
// - Fixed current-message history duplication
// - Stronger backend connection handling
// - Better Render cold-start handling
// - Safer response parsing
// ============================================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    // ========================================================
    // CONFIG
    // ========================================================

    const API_BASE =
        "https://siksha-ai-backend.onrender.com";

    const API_URL =
        `${API_BASE}/api/chat`;

    const FILE_API_URL =
        `${API_BASE}/api/solve-file`;

    const TTS_URL =
        `${API_BASE}/api/tts`;

    const CHATS_KEY =
        "siksha_ai_chats_v2";

    const CURRENT_CHAT_KEY =
        "siksha_ai_current_chat_v2";

    const MAX_CHATS = 500;
    const MAX_MESSAGES = 80;

    // Render free backend can take some time to wake up.
    const REQUEST_TIMEOUT = 60000;

    // ========================================================
    // DOM
    // ========================================================

    const $ = (id) =>
        document.getElementById(id);

    const messages =
        $("messages");

    const welcomeScreen =
        $("welcomeScreen");

    const typingIndicator =
        $("typingIndicator");

    const messageInput =
        $("messageInput");

    const sendButton =
        $("sendButton");

    const talkButton =
        $("talkButton");

    const newChatButton =
        $("newChatButton");

    const clearButton =
        $("clearButton");

    const recentChats =
        $("recentChats");

    const chatSearchInput =
        $("chatSearchInput");

    const chatCount =
        $("chatCount");

    const normalModeButton =
        $("normalModeButton");

    const premiumModeButton =
        $("premiumModeButton");

    const modeTitle =
        $("modeTitle");

    const modeSubtitle =
        $("modeSubtitle");

    const modePill =
        $("modePill");

    const fileInput =
        $("fileInput");

    const attachButton =
        $("attachButton");

    const filePreview =
        $("filePreview");

    const filePreviewName =
        $("filePreviewName");

    const filePreviewSize =
        $("filePreviewSize");

    const removeFileButton =
        $("removeFileButton");

    const premiumModal =
        $("premiumModal");

    const closePremiumModal =
        $("closePremiumModal");

    const premiumCta =
        $("premiumCta");

    const sidebarPremiumButton =
        $("sidebarPremiumButton");

    const voicePanel =
        $("voicePanel");

    const stopVoiceButton =
        $("stopVoiceButton");

    const deleteModal =
        $("deleteModal");

    const cancelDelete =
        $("cancelDelete");

    const confirmDelete =
        $("confirmDelete");

    const toast =
        $("toast");

    const toastMessage =
        $("toastMessage");

    const mobileMenuButton =
        $("mobileMenuButton");

    const sidebar =
        $("sidebar");

    const mobileSidebarOverlay =
        $("mobileSidebarOverlay");

    // ========================================================
    // BASIC SAFETY
    // ========================================================

    if (!messages) {

        console.error(
            "Siksha AI: #messages element not found."
        );

        return;
    }

    // ========================================================
    // STATE
    // ========================================================

    let chats =
        loadChats();

    let currentChatId =
        localStorage.getItem(
            CURRENT_CHAT_KEY
        );

    let currentMode =
        "normal";

    let selectedFile =
        null;

    let deleteTargetId =
        null;

    let recognition =
        null;

    let isListening =
        false;

    let isGenerating =
        false;

    let currentAudio =
        null;

    let toastTimer =
        null;

    // ========================================================
    // CHAT ID
    // ========================================================

    function generateId() {

        return (
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    // ========================================================
    // CREATE CHAT
    // ========================================================

    function createChat() {

        const chat = {

            id:
                generateId(),

            title:
                "New conversation",

            createdAt:
                Date.now(),

            updatedAt:
                Date.now(),

            messages:
                []
        };

        chats.unshift(chat);

        trimChats();

        currentChatId =
            chat.id;

        saveChats();

        localStorage.setItem(
            CURRENT_CHAT_KEY,
            currentChatId
        );

        return chat;
    }

    // ========================================================
    // GET CURRENT CHAT
    // ========================================================

    function getCurrentChat() {

        let chat =
            chats.find(
                item =>
                    item.id ===
                    currentChatId
            );

        if (!chat) {

            chat =
                createChat();
        }

        if (
            !Array.isArray(
                chat.messages
            )
        ) {

            chat.messages = [];
        }

        return chat;
    }

    // ========================================================
    // TRIM CHATS
    // ========================================================

    function trimChats() {

        if (
            chats.length >
            MAX_CHATS
        ) {

            chats =
                chats.slice(
                    0,
                    MAX_CHATS
                );
        }
    }

    // ========================================================
    // SAVE CHATS
    // ========================================================

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

    // ========================================================
    // LOAD CHATS
    // ========================================================

    function loadChats() {

        try {

            const saved =
                localStorage.getItem(
                    CHATS_KEY
                );

            if (!saved) {
                return [];
            }

            const parsed =
                JSON.parse(saved);

            if (
                !Array.isArray(parsed)
            ) {

                return [];
            }

            return parsed
                .filter(
                    chat =>
                        chat &&
                        typeof chat ===
                            "object" &&
                        chat.id
                )
                .map(
                    chat => ({

                        ...chat,

                        messages:
                            Array.isArray(
                                chat.messages
                            )
                                ? chat.messages
                                : []
                    })
                )
                .slice(
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

        if (
            !currentChatId ||
            !chats.some(
                chat =>
                    chat.id ===
                    currentChatId
            )
        ) {

            if (
                chats.length >
                0
            ) {

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

        setMode("normal");

        console.log(
            "%cSiksha AI frontend loaded successfully.",
            "color:#a855f7;font-weight:bold;font-size:14px"
        );

        console.log(
            "Backend:",
            API_BASE
        );
    }

    // ========================================================
    // CURRENT CHAT RENDER
    // ========================================================

    function renderCurrentChat() {

        const chat =
            getCurrentChat();

        /*
         * Remove only generated message elements.
         *
         * IMPORTANT:
         * Do NOT use messages.innerHTML = ""
         *
         * That used to detach typingIndicator
         * and cause insertBefore() crashes.
         */

        const existingMessages =
            messages.querySelectorAll(
                ".message"
            );

        existingMessages.forEach(
            element =>
                element.remove()
        );

        hideTyping();

        if (
            !chat.messages ||
            chat.messages.length === 0
        ) {

            if (welcomeScreen) {

                if (
                    welcomeScreen.parentNode !==
                    messages
                ) {

                    messages.appendChild(
                        welcomeScreen
                    );
                }

                welcomeScreen.style.display =
                    "flex";
            }

            ensureTypingIndicator();

            return;
        }

        if (welcomeScreen) {

            welcomeScreen.style.display =
                "none";
        }

        chat.messages.forEach(
            message => {

                if (
                    !message ||
                    !message.role
                ) {

                    return;
                }

                renderMessage(
                    normalizeRole(
                        message.role
                    ),
                    String(
                        message.content ||
                        ""
                    ),
                    false
                );
            }
        );

        ensureTypingIndicator();

        scrollToBottom(false);
    }

    // ========================================================
    // ROLE NORMALIZER
    // ========================================================

    function normalizeRole(role) {

        if (
            role === "assistant" ||
            role === "model" ||
            role === "ai"
        ) {

            return "ai";
        }

        return "user";
    }

    // ========================================================
    // TYPING INDICATOR
    // ========================================================

    function ensureTypingIndicator() {

        if (!typingIndicator) {
            return;
        }

        if (
            typingIndicator.parentNode !==
            messages
        ) {

            messages.appendChild(
                typingIndicator
            );
        }
    }

    function addTypingIndicator() {

        ensureTypingIndicator();
    }

    function showTyping() {

        ensureTypingIndicator();

        if (typingIndicator) {

            typingIndicator.classList.add(
                "visible"
            );
        }

        scrollToBottom();
    }

    function hideTyping() {

        if (typingIndicator) {

            typingIndicator.classList.remove(
                "visible"
            );
        }
    }

    // ========================================================
    // RECENT CHATS
    // ========================================================

    function renderRecentChats(
        filter = ""
    ) {

        if (!recentChats) {
            return;
        }

        recentChats.innerHTML = "";

        const query =
            String(filter || "")
                .trim()
                .toLowerCase();

        const filtered =
            chats.filter(
                chat => {

                    if (!query) {
                        return true;
                    }

                    const title =
                        String(
                            chat.title ||
                            ""
                        ).toLowerCase();

                    const preview =
                        String(
                            getLastUserMessage(
                                chat
                            ) ||
                            ""
                        ).toLowerCase();

                    return (
                        title.includes(query) ||
                        preview.includes(query)
                    );
                }
            );

        if (
            filtered.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "empty-chats";

            empty.innerHTML = `
                <div class="empty-chat-icon">✦</div>

                <p>
                    ${
                        query
                            ? "No chats found"
                            : "No conversations yet"
                    }
                </p>

                <span>
                    ${
                        query
                            ? "Try another search"
                            : "Start asking Siksha AI"
                    }
                </span>
            `;

            recentChats.appendChild(
                empty
            );

        } else {

            filtered.forEach(
                chat => {

                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "chat-item recent-chat-item";

                    if (
                        chat.id ===
                        currentChatId
                    ) {

                        item.classList.add(
                            "active"
                        );
                    }

                    const lastMessage =
                        getLastUserMessage(
                            chat
                        );

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
                            type="button"
                            class="chat-delete recent-chat-delete"
                            title="Delete chat"
                            data-chat-id="${escapeHTML(
                                chat.id
                            )}">
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

                            openChat(
                                chat.id
                            );
                        }
                    );

                    const deleteButton =
                        item.querySelector(
                            ".chat-delete"
                        );

                    if (deleteButton) {

                        deleteButton.addEventListener(
                            "click",
                            event => {

                                event.preventDefault();

                                event.stopPropagation();

                                openDeleteModal(
                                    chat.id
                                );
                            }
                        );
                    }

                    recentChats.appendChild(
                        item
                    );
                }
            );
        }

        if (chatCount) {

            chatCount.textContent =
                String(
                    chats.length
                );
        }
    }

    // ========================================================
    // OPEN CHAT
    // ========================================================

    function openChat(id) {

        if (
            !chats.some(
                chat =>
                    chat.id === id
            )
        ) {

            return;
        }

        if (isGenerating) {

            showToast(
                "Please wait for the current response"
            );

            return;
        }

        currentChatId =
            id;

        localStorage.setItem(
            CURRENT_CHAT_KEY,
            id
        );

        renderRecentChats(
            chatSearchInput?.value ||
            ""
        );

        renderCurrentChat();

        closeMobileSidebar();
    }

    // ========================================================
    // LAST USER MESSAGE
    // ========================================================

    function getLastUserMessage(
        chat
    ) {

        if (
            !chat ||
            !Array.isArray(
                chat.messages
            )
        ) {

            return "";
        }

        for (
            let i =
                chat.messages.length - 1;
            i >= 0;
            i--
        ) {

            const message =
                chat.messages[i];

            if (
                message &&
                normalizeRole(
                    message.role
                ) === "user"
            ) {

                return String(
                    message.content ||
                    ""
                );
            }
        }

        return "";
    }

    // ========================================================
    // CHAT DATE
    // ========================================================

    function formatChatDate(
        timestamp
    ) {

        if (!timestamp) {
            return "";
        }

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }

        const now =
            new Date();

        const sameDay =
            date.toDateString() ===
            now.toDateString();

        if (sameDay) {

            return date.toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );
        }

        return date.toLocaleDateString(
            [],
            {
                day:
                    "numeric",

                month:
                    "short"
            }
        );
    }

    // ========================================================
    // NEW CHAT
    // ========================================================

    newChatButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (isGenerating) {

                showToast(
                    "Please wait for the current response"
                );

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
        event => {

            event.preventDefault();

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

        deleteTargetId =
            id;

        if (deleteModal) {

            deleteModal.classList.add(
                "visible"
            );
        }
    }

    function closeDeleteModal() {

        deleteTargetId =
            null;

        deleteModal?.classList.remove(
            "visible"
        );
    }

    cancelDelete?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            closeDeleteModal();
        }
    );

    confirmDelete?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (!deleteTargetId) {
                return;
            }

            if (isGenerating) {
                return;
            }

            const deletingId =
                deleteTargetId;

            const wasCurrentChat =
                currentChatId ===
                deletingId;

            chats =
                chats.filter(
                    chat =>
                        chat.id !==
                        deletingId
                );

            /*
             * If deleting the current/last chat,
             * create a replacement safely.
             */

            if (wasCurrentChat) {

                if (
                    chats.length >
                    0
                ) {

                    currentChatId =
                        chats[0].id;

                } else {

                    createChat();
                }
            }

            saveChats();

            localStorage.setItem(
                CURRENT_CHAT_KEY,
                currentChatId
            );

            closeDeleteModal();

            renderRecentChats();

            renderCurrentChat();

            showToast(
                "Conversation deleted"
            );
        }
    );

    // ========================================================
    // SEARCH
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
        event => {

            event.preventDefault();

            if (isGenerating) {
                return;
            }

            setMode(
                "normal"
            );
        }
    );

    premiumModeButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (isGenerating) {
                return;
            }

            setMode(
                "premium"
            );
        }
    );

    function setMode(mode) {

        currentMode =
            mode === "premium"
                ? "premium"
                : "normal";

        if (
            currentMode ===
            "premium"
        ) {

            document.body.classList.add(
                "premium-active"
            );

            normalModeButton?.classList.remove(
                "active"
            );

            premiumModeButton?.classList.add(
                "active"
            );

            if (modeTitle) {

                modeTitle.textContent =
                    "Siksha AI Premium";
            }

            if (modeSubtitle) {

                modeSubtitle.textContent =
                    "Enhanced AI learning experience";
            }

            if (modePill) {

                modePill.textContent =
                    "PREMIUM";

                modePill.classList.add(
                    "premium"
                );
            }

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

            if (modeTitle) {

                modeTitle.textContent =
                    "Siksha AI";
            }

            if (modeSubtitle) {

                modeSubtitle.textContent =
                    "Your intelligent learning assistant";
            }

            if (modePill) {

                modePill.textContent =
                    "NORMAL";

                modePill.classList.remove(
                    "premium"
                );
            }
        }
    }

    // ========================================================
    // PREMIUM MODAL
    // ========================================================

    sidebarPremiumButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            premiumModal?.classList.add(
                "visible"
            );
        }
    );

    closePremiumModal?.addEventListener(
        "click",
        event => {

            event.preventDefault();

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
        event => {

            event.preventDefault();

            premiumModal?.classList.remove(
                "visible"
            );

            setMode(
                "premium"
            );

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

            if (messageInput) {

                messageInput.value =
                    prompt;

                autoResizeTextarea();

                messageInput.focus();
            }
        }
    );

    // ========================================================
    // SEND BUTTON
    // ========================================================

    sendButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );

    // ========================================================
    // ENTER TO SEND
    // ========================================================

    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );

    // ========================================================
    // SEND MESSAGE
    // ========================================================

    async function sendMessage() {

        if (isGenerating) {
            return;
        }

        const text =
            messageInput?.value.trim() ||
            "";

        if (
            !text &&
            !selectedFile
        ) {

            showToast(
                "Type something first"
            );

            messageInput?.focus();

            return;
        }

        if (welcomeScreen) {

            welcomeScreen.style.display =
                "none";
        }

        if (selectedFile) {

            await solveFile(
                text,
                selectedFile
            );

            return;
        }

        /*
         * Save/render the user's message first.
         */

        addMessage(
            "user",
            text
        );

        if (messageInput) {

            messageInput.value =
                "";

            autoResizeTextarea();
        }

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

        const normalizedRole =
            normalizeRole(role);

        const cleanContent =
            String(
                content || ""
            );

        renderMessage(
            normalizedRole,
            cleanContent,
            true
        );

        if (!save) {
            return;
        }

        const chat =
            getCurrentChat();

        chat.messages.push({

            role:
                normalizedRole,

            content:
                cleanContent,

            timestamp:
                Date.now()
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
            normalizedRole ===
                "user" &&
            chat.title ===
                "New conversation"
        ) {

            chat.title =
                createChatTitle(
                    cleanContent
                );
        }

        chat.updatedAt =
            Date.now();

        saveChats();

        renderRecentChats(
            chatSearchInput?.value ||
            ""
        );
    }

    // ========================================================
    // CHAT TITLE
    // ========================================================

    function createChatTitle(
        text
    ) {

        const cleaned =
            String(text || "")
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (!cleaned) {

            return "New conversation";
        }

        if (
            cleaned.length <=
            35
        ) {

            return cleaned;
        }

        return (
            cleaned
                .slice(
                    0,
                    35
                )
                .trim() +
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
            document.createElement(
                "div"
            );

        wrapper.className =
            `message ${role}`;

        if (!animate) {

            wrapper.style.animation =
                "none";
        }

        const contentBox =
            document.createElement(
                "div"
            );

        contentBox.className =
            "message-content";

        /*
         * IMPORTANT:
         *
         * NO AI LOGO HERE.
         *
         * The old version created:
         *
         * <img src="assets/logo.png">
         *
         * for every AI answer.
         *
         * That is the reason the large logo
         * was appearing in replies.
         */

        const bubble =
            document.createElement(
                "div"
            );

        bubble.className =
            "message-bubble";

        if (
            role === "ai"
        ) {

            bubble.innerHTML = `
                <div class="ai-response">
                    ${formatAIResponse(
                        content
                    )}
                </div>
            `;

        } else {

            bubble.textContent =
                content;
        }

        contentBox.appendChild(
            bubble
        );

        const meta =
            document.createElement(
                "div"
            );

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

        /*
         * SAFE INSERT
         *
         * Always ensure typingIndicator
         * is attached before using it
         * as an insertion reference.
         */

        ensureTypingIndicator();

        if (
            typingIndicator &&
            typingIndicator.parentNode ===
                messages
        ) {

            messages.insertBefore(
                wrapper,
                typingIndicator
            );

        } else {

            messages.appendChild(
                wrapper
            );

            ensureTypingIndicator();
        }

        scrollToBottom(
            animate
        );
    }

    // ========================================================
    // AI REQUEST
    // ========================================================

    async function askAI(
        userText
    ) {

        setGenerating(true);

        showTyping();

        try {

            const chat =
                getCurrentChat();

            /*
             * IMPORTANT FIX:
             *
             * The current user message has already
             * been stored in chat.messages.
             *
             * Backend also receives it separately
             * as "message".
             *
             * Therefore we EXCLUDE the latest
             * user message from history.
             */

            const previousMessages =
                chat.messages
                    .slice(
                        0,
                        -1
                    )
                    .slice(
                        -20
                    );

            const history =
                previousMessages.map(
                    message => {

                        const originalRole =
                            message.role;

                        const role =
                            (
                                originalRole ===
                                    "ai" ||
                                originalRole ===
                                    "assistant" ||
                                originalRole ===
                                    "model"
                            )
                                ? "model"
                                : "user";

                        return {

                            role:
                                role,

                            content:
                                String(
                                    message.content ||
                                    ""
                                )
                        };
                    }
                );

            const response =
                await fetchWithTimeout(
                    API_URL,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                message:
                                    userText,

                                mode:
                                    currentMode,

                                history:
                                    history
                            })
                    },
                    REQUEST_TIMEOUT
                );

            const data =
                await parseResponse(
                    response
                );

            hideTyping();

            if (!response.ok) {

                throw new Error(
                    getBackendError(
                        data,
                        response.status
                    )
                );
            }

            const answer =
                extractAnswer(
                    data
                );

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
                currentMode ===
                "premium"
            ) {

                speakAI(
                    answer
                );
            }

        } catch (error) {

            console.error(
                "AI error:",
                error
            );

            hideTyping();

            const errorMessage =
                friendlyConnectionError(
                    error
                );

            addMessage(
                "ai",
                `⚠️ **Siksha AI connection error**

${errorMessage}

Please try again in a few seconds.`
            );

            showToast(
                "Could not connect to Siksha AI"
            );

        } finally {

            setGenerating(
                false
            );
        }
    }

    // ========================================================
    // FETCH WITH TIMEOUT
    // ========================================================

    async function fetchWithTimeout(
        url,
        options = {},
        timeout =
            REQUEST_TIMEOUT
    ) {

        const controller =
            new AbortController();

        const timeoutId =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeout
            );

        try {

            return await fetch(
                url,
                {
                    ...options,
                    signal:
                        controller.signal
                }
            );

        } finally {

            clearTimeout(
                timeoutId
            );
        }
    }

    // ========================================================
    // BACKEND ERROR
    // ========================================================

    function getBackendError(
        data,
        status
    ) {

        const raw =
            extractAnswer(
                data
            ) ||
            (
                data &&
                data.error
                    ? data.error
                    : ""
            );

        if (raw) {
            return String(raw);
        }

        if (
            status === 404
        ) {

            return (
                "The requested Siksha AI endpoint was not found."
            );
        }

        if (
            status >= 500
        ) {

            return (
                "The Siksha AI server is temporarily unavailable."
            );
        }

        return (
            `The server returned an error (${status}).`
        );
    }

    // ========================================================
    // FRIENDLY CONNECTION ERROR
    // ========================================================

    function friendlyConnectionError(
        error
    ) {

        if (
            !navigator.onLine
        ) {

            return (
                "You appear to be offline. Please check your internet connection."
            );
        }

        if (
            error &&
            error.name ===
                "AbortError"
        ) {

            return (
                "The Siksha AI server is taking longer than usual to wake up. Please try again."
            );
        }

        const message =
            String(
                error?.message ||
                ""
            );

        if (
            message.toLowerCase()
                .includes(
                    "failed to fetch"
                )
        ) {

            return (
                "The frontend could not reach the Siksha AI server. The server may be waking up or temporarily unavailable."
            );
        }

        if (
            message.toLowerCase()
                .includes(
                    "networkerror"
                )
        ) {

            return (
                "A network error occurred while contacting the Siksha AI server."
            );
        }

        return (
            message ||
            "Siksha AI could not process your request right now."
        );
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

            try {

                return await response.json();

            } catch {

                return {
                    error:
                        "The server returned invalid JSON."
                };
            }
        }

        const text =
            await response.text();

        try {

            return JSON.parse(
                text
            );

        } catch {

            return {
                text:
                    text
            };
        }
    }

    // ========================================================
    // EXTRACT ANSWER
    // ========================================================

    function extractAnswer(
        data
    ) {

        if (!data) {
            return "";
        }

        if (
            typeof data ===
            "string"
        ) {

            return data;
        }

        /*
         * Keep this broad so the frontend can work
         * with different backend response formats.
         */

        const answer =
            data.answer ||
            data.response ||
            data.reply ||
            data.text ||
            data.output ||
            data.content ||
            "";

        return typeof answer ===
            "string"
            ? answer
            : String(answer || "");
    }

    // ========================================================
    // GENERATING STATE
    // ========================================================

    function setGenerating(
        value
    ) {

        isGenerating =
            Boolean(value);

        if (sendButton) {

            sendButton.disabled =
                isGenerating;

            sendButton.style.opacity =
                isGenerating
                    ? "0.55"
                    : "";
        }

        if (attachButton) {

            attachButton.disabled =
                isGenerating;
        }
    }

    // ========================================================
    // FILE UPLOAD
    // ========================================================

    attachButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (isGenerating) {
                return;
            }

            fileInput?.click();
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

    function showFilePreview(
        file
    ) {

        if (filePreviewName) {

            filePreviewName.textContent =
                file.name;
        }

        if (filePreviewSize) {

            filePreviewSize.textContent =
                formatFileSize(
                    file.size
                );
        }

        filePreview?.classList.add(
            "visible"
        );
    }

    removeFileButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            removeSelectedFile();
        }
    );

    function removeSelectedFile() {

        selectedFile =
            null;

        if (fileInput) {

            fileInput.value =
                "";
        }

        filePreview?.classList.remove(
            "visible"
        );
    }

    function formatFileSize(
        bytes
    ) {

        if (
            bytes < 1024
        ) {

            return `${bytes} B`;
        }

        if (
            bytes <
            1024 * 1024
        ) {

            return `${(
                bytes / 1024
            ).toFixed(1)} KB`;
        }

        return `${(
            bytes /
            (1024 * 1024)
        ).toFixed(1)} MB`;
    }

    // ========================================================
    // SOLVE FILE
    // ========================================================

    async function solveFile(
        question,
        file
    ) {

        setGenerating(
            true
        );

        showTyping();

        const fileName =
            file.name;

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

            removeSelectedFile();

            const response =
                await fetchWithTimeout(
                    FILE_API_URL,
                    {
                        method:
                            "POST",

                        body:
                            formData
                    },
                    REQUEST_TIMEOUT
                );

            const data =
                await parseResponse(
                    response
                );

            hideTyping();

            if (!response.ok) {

                throw new Error(
                    getBackendError(
                        data,
                        response.status
                    )
                );
            }

            const answer =
                extractAnswer(
                    data
                );

            if (!answer) {

                throw new Error(
                    "No answer was returned for the file."
                );
            }

            addMessage(
                "user",
                question
                    ? `${question}\n\n📎 ${fileName}`
                    : `📎 ${fileName}`
            );

            addMessage(
                "ai",
                answer
            );

            if (
                currentMode ===
                "premium"
            ) {

                speakAI(
                    answer
                );
            }

        } catch (error) {

            console.error(
                "File error:",
                error
            );

            hideTyping();

            addMessage(
                "ai",
                `⚠️ **File processing failed**

${friendlyConnectionError(
    error
)}`
            );

            showToast(
                "Could not process the file"
            );

        } finally {

            setGenerating(
                false
            );
        }
    }

    // ========================================================
    // VOICE INPUT
    // ========================================================

    function setupSpeechRecognition() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (
            !SpeechRecognition
        ) {

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

                isListening =
                    true;

                talkButton?.classList.add(
                    "listening"
                );

                voicePanel?.classList.add(
                    "visible"
                );
            };

        recognition.onresult =
            event => {

                let transcript =
                    "";

                for (
                    let i =
                        event.resultIndex;

                    i <
                    event.results.length;

                    i++
                ) {

                    transcript +=
                        event.results[i][0]
                            .transcript;
                }

                if (messageInput) {

                    messageInput.value =
                        transcript;

                    autoResizeTextarea();
                }
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
        event => {

            event.preventDefault();

            if (isGenerating) {
                return;
            }

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

                console.error(
                    "Could not start recognition:",
                    error
                );
            }
        }
    );

    stopVoiceButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            stopListening();
        }
    );

    function stopListening() {

        if (recognition) {

            try {

                recognition.stop();

            } catch {}
        }

        isListening =
            false;

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

    async function speakAI(
        text
    ) {

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
                await fetchWithTimeout(
                    TTS_URL,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                text:
                                    cleanText,

                                mode:
                                    currentMode
                            })
                    },
                    REQUEST_TIMEOUT
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

                playAudioBlob(
                    blob
                );

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

            playAudioBlob(
                blob
            );

        } catch (error) {

            /*
             * TTS failure should NEVER
             * break the normal AI response.
             */

            console.warn(
                "TTS unavailable:",
                error
            );
        }
    }

    // ========================================================
    // PLAY AUDIO
    // ========================================================

    function playAudioBlob(
        blob
    ) {

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

                currentAudio =
                    null;
            };

        currentAudio.onerror =
            () => {

                URL.revokeObjectURL(
                    url
                );

                currentAudio =
                    null;
            };

        currentAudio
            .play()
            .catch(
                error => {

                    console.warn(
                        "Browser blocked audio playback:",
                        error
                    );
                }
            );
    }

    // ========================================================
    // STOP AUDIO
    // ========================================================

    function stopCurrentAudio() {

        if (!currentAudio) {
            return;
        }

        try {

            currentAudio.pause();

            currentAudio.currentTime =
                0;

        } catch {}

        currentAudio =
            null;
    }

    // ========================================================
    // BASE64 TO BLOB
    // ========================================================

    function base64ToBlob(
        base64,
        mimeType
    ) {

        const byteCharacters =
            atob(base64);

        const byteArrays =
            [];

        const chunkSize =
            1024;

        for (
            let offset = 0;

            offset <
            byteCharacters.length;

            offset +=
                chunkSize
        ) {

            const slice =
                byteCharacters.slice(
                    offset,
                    offset +
                        chunkSize
                );

            const byteNumbers =
                new Array(
                    slice.length
                );

            for (
                let i = 0;

                i <
                slice.length;

                i++
            ) {

                byteNumbers[i] =
                    slice.charCodeAt(
                        i
                    );
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
                type:
                    mimeType
            }
        );
    }

    // ========================================================
    // SPEECH CLEANER
    // ========================================================

    function stripMarkdownForSpeech(
        text
    ) {

        return String(
            text || ""
        )
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
                /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
                "$1 divided by $2"
            )
            .replace(
                /\\sqrt\{([^{}]*)\}/g,
                "square root of $1"
            )
            .replace(
                /\\times/g,
                " times "
            )
            .replace(
                /\\cdot/g,
                " times "
            )
            .replace(
                /\\pm/g,
                " plus or minus "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    // ========================================================
    // MARKDOWN + MATH
    // ========================================================

    function formatAIResponse(
        text
    ) {

        if (!text) {
            return "";
        }

        let value =
            String(text)
                .replace(
                    /\r\n/g,
                    "\n"
                )
                .replace(
                    /\r/g,
                    "\n"
                );

        // ----------------------------------------------------
        // Protect code blocks
        // ----------------------------------------------------

        const protectedBlocks =
            [];

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

                    return `SIAI_CODE_${index}_SIAI`;
                }
            );

        // ----------------------------------------------------
        // Protect display math
        // ----------------------------------------------------

        const protectedMath =
            [];

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

                    return `SIAI_MATH_${index}_SIAI`;
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

                    return `SIAI_MATH_${index}_SIAI`;
                }
            );

        // ----------------------------------------------------
        // Inline math
        // ----------------------------------------------------

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

                    return `SIAI_MATH_${index}_SIAI`;
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

                    return `SIAI_MATH_${index}_SIAI`;
                }
            );

        // ----------------------------------------------------
        // Escape HTML
        // ----------------------------------------------------

        value =
            escapeHTML(
                value
            );

        // ----------------------------------------------------
        // Headings
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // Bold
        // ----------------------------------------------------

        value =
            value.replace(
                /\*\*(.+?)\*\*/g,
                "<strong>$1</strong>"
            );

        // ----------------------------------------------------
        // Italic
        // ----------------------------------------------------

        value =
            value.replace(
                /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
                "$1<em>$2</em>"
            );

        // ----------------------------------------------------
        // Inline code
        // ----------------------------------------------------

        value =
            value.replace(
                /`([^`\n]+)`/g,
                "<code>$1</code>"
            );

        // ----------------------------------------------------
        // Blockquotes
        // ----------------------------------------------------

        value =
            value.replace(
                /^&gt;\s?(.*)$/gm,
                "<blockquote>$1</blockquote>"
            );

        // ----------------------------------------------------
        // Numbered lists
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // Bullet lists
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // Line breaks
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // Restore math
        // ----------------------------------------------------

        protectedMath.forEach(
            (html, index) => {

                value =
                    value.replace(
                        `SIAI_MATH_${index}_SIAI`,
                        html
                    );
            }
        );

        // ----------------------------------------------------
        // Restore code
        // ----------------------------------------------------

        protectedBlocks.forEach(
            (html, index) => {

                value =
                    value.replace(
                        `SIAI_CODE_${index}_SIAI`,
                        html
                    );
            }
        );

        return value;
    }

    // ========================================================
    // DISPLAY MATH
    // ========================================================

    function renderMath(
        math
    ) {

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
                /\\gamma/g,
                "γ"
            );

        expression =
            expression.replace(
                /\\Delta/g,
                "Δ"
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

    // ========================================================
    // INLINE MATH
    // ========================================================

    function renderInlineMath(
        math
    ) {

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
            <span class="math-text">
                ${expression}
            </span>
        `;
    }

    // ========================================================
    // ESCAPE HTML
    // ========================================================

    function escapeHTML(
        value
    ) {

        return String(
            value
        )
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

                if (!messages) {
                    return;
                }

                try {

                    messages.scrollTo({

                        top:
                            messages.scrollHeight,

                        behavior:
                            smooth
                                ? "smooth"
                                : "auto"
                    });

                } catch {

                    messages.scrollTop =
                        messages.scrollHeight;
                }
            }
        );
    }

    // ========================================================
    // TOAST
    // ========================================================

    function showToast(
        message
    ) {

        if (!toast) {
            return;
        }

        if (toastMessage) {

            toastMessage.textContent =
                message;
        }

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
        event => {

            event.preventDefault();

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
    // ESCAPE
    // ========================================================

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
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
    // ONLINE / OFFLINE
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
    //
    // Kept for other images in the UI.
    // Since AI message avatar was removed,
    // this will no longer affect AI responses.
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

            if (isGenerating) {
                return;
            }

            createChat();

            renderRecentChats();

            renderCurrentChat();
        },

        clearChat: () => {

            clearButton?.click();
        },

        setMode: mode => {

            if (
                mode === "normal" ||
                mode === "premium"
            ) {

                setMode(
                    mode
                );
            }
        },

        getChats: () => {

            return chats;
        },

        getCurrentChat: () => {

            return getCurrentChat();
        },

        send: () => {

            return sendMessage();
        },

        getBackend: () => {

            return API_BASE;
        }
    };

});