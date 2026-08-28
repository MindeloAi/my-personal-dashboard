(function () {
    const CHAT_URL = '/api/chat';

    // ---- FLOATING CHAT ELEMENTS ----
    const toggle        = document.getElementById('chat-toggle');
    const chatWindow    = document.getElementById('chat-window');
    const floatMessages = document.getElementById('chat-messages');
    const floatInput    = document.getElementById('chat-input');
    const floatSendBtn  = document.getElementById('chat-send');

    if (!toggle || !chatWindow || !floatMessages || !floatInput || !floatSendBtn) return;

    let floatIsOpen  = false;
    let floatIsBusy  = false;
    let floatHistory = [];

    // Expose state so the demo panel can read it
    window._sophieWidget = { isOpen: function () { return floatIsOpen; } };

    // ---- HELPERS ----
    function renderText(text) {
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, function (_, label, url) {
                var clean = url.trim();
                if (!clean.startsWith('/') && !clean.startsWith('http')) clean = '/' + clean;
                return '<a href="' + clean + '" style="color:#00e5b0;text-decoration:underline;" target="_self">' + label + '</a>';
            })
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }
    function appendMsg(container, text, role) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg ' + role;
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.innerHTML = role === 'bot' ? renderText(text) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        wrap.appendChild(bubble);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }
    function showTyping(container, id) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg bot';
        wrap.id = id;
        wrap.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }
    function hideTyping(id) {
        const t = document.getElementById(id);
        if (t) t.remove();
    }

    // ---- FLOATING OPEN / CLOSE ----
    function openFloat() {
        if (floatIsOpen) return;
        floatIsOpen = true;
        chatWindow.classList.add('open');
        toggle.classList.add('open');
        if (typeof window._sophieWidgetOnOpen === 'function') window._sophieWidgetOnOpen();
        setTimeout(function () { floatInput.focus(); }, 300);
    }
    function closeFloat() {
        floatIsOpen = false;
        chatWindow.classList.remove('open');
        toggle.classList.remove('open');
        if (typeof window._sophieWidgetOnClose === 'function') window._sophieWidgetOnClose();
    }
    toggle.addEventListener('click', function () { floatIsOpen ? closeFloat() : openFloat(); });

    // ---- FLOATING SEND ----
    async function floatSend() {
        const text = floatInput.value.trim();
        if (!text || floatIsBusy) return;
        floatInput.value = '';
        floatIsBusy = true;
        floatInput.disabled = true;
        floatSendBtn.disabled = true;
        appendMsg(floatMessages, text, 'user');
        showTyping(floatMessages, 'float-typing');
        try {
            const res = await fetch(CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history: floatHistory.slice(-8) })
            });
            let reply = "Sorry, I didn't catch that. Try again!";
            try { const data = await res.json(); if (data && data.reply) reply = data.reply; } catch (e) {}
            hideTyping('float-typing');
            appendMsg(floatMessages, reply, 'bot');
            floatHistory.push({ role: 'user', content: text });
            floatHistory.push({ role: 'assistant', content: reply });
        } catch (err) {
            hideTyping('float-typing');
            appendMsg(floatMessages, 'Something went wrong. Please try again in a moment.', 'bot');
        } finally {
            floatIsBusy = false;
            floatInput.disabled = false;
            floatSendBtn.disabled = false;
            floatInput.focus();
        }
    }
    floatSendBtn.addEventListener('click', floatSend);
    floatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); floatSend(); } });
})();
