// ============================================================
// SIKSHA AI — FINAL FRONTEND ENGINE V4
// CHAT + MEMORY + PREMIUM + HINDI + ENGLISH + HINGLISH
// VOICE INPUT + GEMINI TTS + FILE UPLOAD
// RECENT CHATS + SEARCH + DELETE
// MATH RENDERING + MARKDOWN + TYPING ANIMATION
// RENDER DEPLOYMENT READY
// CONNECTION + DOM STABILITY FIXED
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

    const HEALTH_URL =
        `${API_BASE}/api/health`;

    const CHATS_KEY =
        "siksha_ai_chats_v2";

    const CURRENT_CHAT_KEY =
        "siksha_ai_current_chat_v2";

    const MAX_CHATS = 500;
    const MAX_MESSAGES = 80;

    // Render free instances can sleep.
    // Give backend enough time to wake up.
    const REQUEST_TIMEOUT = 60000;

    // ========================================================
    // DOM HELPER
    // ========================================================

    const $ = (id) =>
        document.getElementById(id);

    // ========================================================
    // DOM ELEMENTS
    // ========================================================

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
    // BASIC DOM SAFETY
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
    // REQUEST HELPER
    // ========================================================

    async function fetchWithTimeout(
        url,
        options = {},
        timeout = REQUEST_TIMEOUT
    ) {

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
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

        } catch (error) {

            if (
                error &&
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Siksha AI is taking too long to respond. The server may be waking up. Please try again."
                );
            }

            if (
                !navigator.onLine
            ) {

                throw new Error(
                    "No internet connection. Please check your internet and try again."
                );
            }

            throw new Error(
                "Could not reach the Siksha AI server. Please try again in a few seconds."
            );

        } finally {

            clearTimeout(timer);
        }
    }

    // ========================================================
    // CHAT DATA
    // ========================================================

    function generateId() {

        return (
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

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

            chat.messages =
                [];
        }

        return chat;
    }

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
                localStorage.getItem(
                    CHATS_KEY
                );

            if (!saved) {
                return [];
            }

            const parsed =
                JSON.parse(saved);

            if (
                !Array.isArray(
                    parsed
                )
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
                chats.length > 0
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
            "%cSiksha AI frontend loaded.",
            "color:#a855f7;font-weight:bold;"
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
         * IMPORTANT:
         * Do NOT use messages.innerHTML = "".
         *
         * That detaches welcomeScreen and
         * typingIndicator from the DOM.
         */

        const oldMessages =
            messages.querySelectorAll(
                ".message"
            );

        oldMessages.forEach(
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

        const value =
            String(
                role || ""
            ).toLowerCase();

        if (
            value === "user"
        ) {

            return "user";
        }

        if (
            value === "ai" ||
            value === "assistant" ||
            value === "model"
        ) {

            return "ai";
        }

        return "ai";
    }

    // ========================================================
    // TYPING INDICATOR
    // ========================================================

    function ensureTypingIndicator() {

        if (!typingIndicator) {
            return;
        }

        /*
         * insertBefore() requires the reference node
         * to be an actual child of messages.
         */

        if (
            typingIndicator.parentNode !==
            messages
        ) {

            messages.appendChild(
                typingIndicator
            );
        }
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

        if (
            typingIndicator
        ) {

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

        recentChats.innerHTML =
            "";

        const query =
            String(
                filter || ""
            )
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
                            ) || ""
                        ).toLowerCase();

                    return (
                        title.includes(
                            query
                        ) ||
                        preview.includes(
                            query
                        )
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

                    if (
                        deleteButton
                    ) {

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

    function openChat(id) {

        if (
            !chats.some(
                chat =>
                    chat.id === id
            )
        ) {

            return;
        }

        if (
            isGenerating
        ) {

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

    function formatChatDate(
        timestamp
    ) {

        if (!timestamp) {
            return "";
        }

        const date =
            new Date(
                timestamp
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }

        const now =
            new Date();

        if (
            date.toDateString() ===
            now.toDateString()
        ) {

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

            if (
                isGenerating
            ) {

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

            if (
                isGenerating
            ) {

                return;
            }

            const chat =
                getCurrentChat();

            chat.messages =
                [];

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

    function openDeleteModal(
        id
    ) {

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

            if (
                !deleteTargetId
            ) {

                return;
            }

            if (
                isGenerating
            ) {

                showToast(
                    "Please wait for the current response"
                );

                return;
            }

            const deletingId =
                deleteTargetId;

            const wasCurrent =
                currentChatId ===
                deletingId;

            chats =
                chats.filter(
                    chat =>
                        chat.id !==
                        deletingId
                );

            if (
                chats.length === 0
            ) {

                createChat();

            } else if (
                wasCurrent
            ) {

                currentChatId =
                    chats[0].id;

                localStorage.setItem(
                    CURRENT_CHAT_KEY,
                    currentChatId
                );
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

            if (
                isGenerating
            ) {

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

            if (
                isGenerating
            ) {

                return;
            }

            setMode(
                "premium"
            );
        }
    );

    function setMode(
        mode
    ) {

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
    // SEND
    // ========================================================

    sendButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );

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

    async function sendMessage() {

        if (
            isGenerating
        ) {

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

        if (selectedFile) {

            await solveFile(
                text,
                selectedFile
            );

            return;
        }

        if (welcomeScreen) {

            welcomeScreen.style.display =
                "none";
        }

        addMessage(
            "user",
            text
        );

        if (messageInput) {

            messageInput.value =
                "";

            autoResizeTextarea();
        }

        await askAI(
            text
        );
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

        renderMessage(
            normalizedRole,
            String(
                content || ""
            ),
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
                String(
                    content || ""
                ),

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
                    content
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

    function createChatTitle(
        text
    ) {

        const cleaned =
            String(
                text || ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (!cleaned) {

            return "New conversation";
        }

        if (
            cleaned.length <= 35
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

        // ----------------------------------------------------
        // AI AVATAR
        // ----------------------------------------------------

        if (
            role === "ai"
        ) {

            const avatar =
                document.createElement(
                    "div"
                );

            avatar.className =
                "ai-avatar";

            const img =
                document.createElement(
                    "img"
                );

            img.src =
                "assets/logo.png";

            img.alt =
                "Siksha AI";

            /*
             * Prevent a broken logo from creating
             * an ugly giant broken-image area.
             */

            img.onerror =
                () => {

                    avatar.classList.add(
                        "logo-failed"
                    );

                    img.remove();
                };

            avatar.appendChild(
                img
            );

            wrapper.appendChild(
                avatar
            );
        }

        // ----------------------------------------------------
        // MESSAGE BUBBLE
        // ----------------------------------------------------

        const bubble =
            document.createElement(
                "div"
            );

        bubble.className =
            "message-bubble";

        if (
            role === "ai"
        ) {

            const response =
                document.createElement(
                    "div"
                );

            response.className =
                "ai-response";

            response.innerHTML =
                formatAIResponse(
                    content
                );

            bubble.appendChild(
                response
            );

        } else {

            bubble.textContent =
                content;
        }

        contentBox.appendChild(
            bubble
        );

        // ----------------------------------------------------
        // META
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // SAFE INSERT
        // ----------------------------------------------------

        ensureTypingIndicator();

        /*
         * Only use insertBefore if typingIndicator
         * is actually inside messages.
         */

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
    // ASK AI
    // ========================================================

    async function askAI(
        userText
    ) {

        setGenerating(
            true
        );

        showTyping();

        try {

            const chat =
                getCurrentChat();

            /*
             * The current user message has already been
             * stored locally before askAI().
             *
             * Therefore exclude the last message from
             * history to prevent sending it twice.
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

                        const normalized =
                            normalizeRole(
                                message.role
                            );

                        return {

                            role:
                                normalized ===
                                    "ai"
                                    ? "model"
                                    : "user",

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
                    }
                );

            const data =
                await parseResponse(
                    response
                );

            hideTyping();

            if (
                !response.ok
            ) {

                throw new Error(
                    getServerError(
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

            /*
             * Show a friendly error, but don't make the
             * error itself look like a normal AI answer
             * with the huge logo/avatar.
             */

            showConnectionError(
                error
            );

        } finally {

            setGenerating(
                false
            );
        }
    }

    // ========================================================
    // CONNECTION ERROR
    // ========================================================

    function showConnectionError(
        error
    ) {

        const message =
            error?.message ||
            "Please try again in a few seconds.";

        /*
         * Create a special system error element.
         * This avoids storing connection errors inside
         * conversation memory.
         */

        const errorBox =
            document.createElement(
                "div"
            );

        errorBox.className =
            "message ai system-error";

        const contentBox =
            document.createElement(
                "div"
            );

        contentBox.className =
            "message-content";

        const bubble =
            document.createElement(
                "div"
            );

        bubble.className =
            "message-bubble";

        const response =
            document.createElement(
                "div"
            );

        response.className =
            "ai-response";

        response.innerHTML = `
            <strong>⚠️ Siksha AI connection error</strong>
            <br><br>
            ${escapeHTML(message)}
            <br><br>
            Please try again in a few seconds.
        `;

        bubble.appendChild(
            response
        );

        contentBox.appendChild(
            bubble
        );

        errorBox.appendChild(
            contentBox
        );

        ensureTypingIndicator();

        if (
            typingIndicator &&
            typingIndicator.parentNode ===
                messages
        ) {

            messages.insertBefore(
                errorBox,
                typingIndicator
            );

        } else {

            messages.appendChild(
                errorBox
            );

            ensureTypingIndicator();
        }

        scrollToBottom();

        showToast(
            "Could not connect to Siksha AI"
        );
    }

    function getServerError(
        data,
        status
    ) {

        if (
            data &&
            typeof data ===
                "object"
        ) {

            if (
                data.error
            ) {

                return String(
                    data.error
                );
            }

            if (
                data.message
            ) {

                return String(
                    data.message
                );
            }
        }

        if (
            status === 429
        ) {

            return "Too many requests. Please wait a moment and try again.";
        }

        if (
            status >= 500
        ) {

            return "The Siksha AI server encountered an error. Please try again.";
        }

        return `Server returned HTTP ${status}.`;
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

        if (!text) {

            return {
                text: ""
            };
        }

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

        if (talkButton) {

            talkButton.disabled =
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

            if (
                isGenerating
            ) {

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

        if (
            filePreviewName
        ) {

            filePreviewName.textContent =
                file.name;
        }

        if (
            filePreviewSize
        ) {

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
                    }
                );

            const data =
                await parseResponse(
                    response
                );

            hideTyping();

            if (
                !response.ok
            ) {

                throw new Error(
                    getServerError(
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

            showConnectionError(
                error
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

                if (
                    messageInput
                ) {

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

            if (
                isGenerating
            ) {

                return;
            }

            if (
                isListening
            ) {

                stopListening();

                return;
            }

            if (
                !recognition
            ) {

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

        if (
            recognition
        ) {

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
                    45000
                );

            if (
                !response.ok
            ) {

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

            console.warn(
                "TTS unavailable:",
                error
            );
        }
    }

    function playAudioBlob(
        blob
    ) {

        const url =
            URL.createObjectURL(
                blob
            );

        currentAudio =
            new Audio(
                url
            );

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

    function stopCurrentAudio() {

        if (
            !currentAudio
        ) {

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
                /\s+/g,
                " "
            )
            .trim();
    }

    // ========================================================
    // AI RESPONSE FORMATTER
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
        // CODE BLOCKS
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

                    return `SIAI_CODE_${index}_END`;
                }
            );

        // ----------------------------------------------------
        // DISPLAY MATH
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

                    return `SIAI_MATH_${index}_END`;
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

                    return `SIAI_MATH_${index}_END`;
                }
            );

        // ----------------------------------------------------
        // INLINE MATH
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

                    return `SIAI_MATH_${index}_END`;
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

                    return `SIAI_MATH_${index}_END`;
                }
            );

        // ----------------------------------------------------
        // ESCAPE HTML
        // ----------------------------------------------------

        value =
            escapeHTML(
                value
            );

        // ----------------------------------------------------
        // HEADINGS
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
        // BOLD
        // ----------------------------------------------------

        value =
            value.replace(
                /\*\*(.+?)\*\*/g,
                "<strong>$1</strong>"
            );

        // ----------------------------------------------------
        // ITALIC
        // ----------------------------------------------------

        value =
            value.replace(
                /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
                "$1<em>$2</em>"
            );

        // ----------------------------------------------------
        // INLINE CODE
        // ----------------------------------------------------

        value =
            value.replace(
                /`([^`\n]+)`/g,
                "<code>$1</code>"
            );

        // ----------------------------------------------------
        // BLOCKQUOTES
        // ----------------------------------------------------

        value =
            value.replace(
                /^&gt;\s?(.*)$/gm,
                "<blockquote>$1</blockquote>"
            );

        // ----------------------------------------------------
        // NUMBERED LISTS
        // ----------------------------------------------------

        value =
            value.replace(
                /(?:^|\n)((?:\d+\.\s.+(?:\n|$))+)/g,
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
                            .filter(
                                Boolean
                            )
                            .map(
                                item =>
                                    `<li>${item}</li>`
                            )
                            .join("");

                    return `\n<ol>${items}</ol>\n`;
                }
            );

        // ----------------------------------------------------
        // BULLET LISTS
        // ----------------------------------------------------

        value =
            value.replace(
                /(?:^|\n)((?:[-•]\s.+(?:\n|$))+)/g,
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
                            .filter(
                                Boolean
                            )
                            .map(
                                item =>
                                    `<li>${item}</li>`
                            )
                            .join("");

                    return `\n<ul>${items}</ul>\n`;
                }
            );

        // ----------------------------------------------------
        // NEWLINES
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
        // RESTORE MATH
        // ----------------------------------------------------

        protectedMath.forEach(
            (html, index) => {

                value =
                    value.replace(
                        `SIAI_MATH_${index}_END`,
                        html
                    );
            }
        );

        // ----------------------------------------------------
        // RESTORE CODE
        // ----------------------------------------------------

        protectedBlocks.forEach(
            (html, index) => {

                value =
                    value.replace(
                        `SIAI_CODE_${index}_END`,
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
            replaceMathCommands(
                expression
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
            replaceMathCommands(
                expression
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

        return `
            <span class="math-text">
                ${expression}
            </span>
        `;
    }

    function replaceMathCommands(
        expression
    ) {

        const replacements = {

            "\\times":
                "×",

            "\\cdot":
                "·",

            "\\pm":
                "±",

            "\\leq":
                "≤",

            "\\geq":
                "≥",

            "\\neq":
                "≠",

            "\\rightarrow":
                "→",

            "\\leftarrow":
                "←",

            "\\approx":
                "≈",

            "\\infty":
                "∞",

            "\\pi":
                "π",

            "\\theta":
                "θ",

            "\\alpha":
                "α",

            "\\beta":
                "β",

            "\\gamma":
                "γ",

            "\\delta":
                "δ",

            "\\lambda":
                "λ",

            "\\mu":
                "μ",

            "\\sigma":
                "σ",

            "\\omega":
                "ω"
        };

        Object.entries(
            replacements
        ).forEach(
            ([command, symbol]) => {

                expression =
                    expression.replace(
                        new RegExp(
                            escapeRegExp(
                                command
                            ),
                            "g"
                        ),
                        symbol
                    );
            }
        );

        return expression;
    }

    function escapeRegExp(
        value
    ) {

        return String(
            value
        ).replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
    }

    // ========================================================
    // SAFE HTML
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

        if (
            !messageInput
        ) {

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

        if (
            toastMessage
        ) {

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
    // ESCAPE KEY
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
    // ========================================================

    document.addEventListener(
        "error",
        event => {

            const target =
                event.target;

            if (
                target instanceof
                HTMLImageElement
            ) {

                if (
                    target.src.includes(
                        "assets/logo.png"
                    )
                ) {

                    target.style.display =
                        "none";
                }
            }

        },
        true
    );

    // ========================================================
    // GLOBAL DEBUG HELPERS
    // ========================================================

    window.SikshaAI = {

        newChat: () => {

            if (
                isGenerating
            ) {

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

        stopVoice: () => {

            stopCurrentAudio();
        },

        backend: API_BASE
    };

});