document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const detailsForm = document.getElementById('details-form');
    const formSection = document.getElementById('user-details-form');
    const chatInterface = document.getElementById('chat-interface');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-btn');
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    const messagesContainer = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const notificationBanner = document.getElementById('notification-banner');
    const notificationText = document.getElementById('notification-text');
    const closeNotification = document.getElementById('close-notification');
    const replyNotification = document.getElementById('reply-notification');

    // State
    const socket = io();
    let currentChatId = null;
    let userData = null;
    let chatStatus = 'disconnected'; // disconnected, pending, active
    let hasUnreadMessages = false;
    let hasUnreadAdminReply = false;

    // Check if there's an existing chat session
    const existingChatId = sessionStorage.getItem('liveChatId');
    if (existingChatId) {
        // Try to reconnect to existing chat
        fetch(`/api/chat-history/${existingChatId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.chat.status !== 'closed') {
                    currentChatId = existingChatId;
                    userData = data.chat.userData;
                    showChatInterface();
                    restoreChatHistory(data.chat.messages);
                    
                    if (data.chat.status === 'pending') {
                        updateStatus('Waiting for admin to accept...', 'pending');
                        enableChatInput(); // Enable input immediately
                    } else if (data.chat.status === 'active') {
                        updateStatus('Connected to admin', 'active');
                        enableChatInput();
                    }
                }
            })
            .catch(error => {
                console.error('Error restoring chat:', error);
            });
    }

    // Form submission
    detailsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        userData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            studentId: document.getElementById('student-id').value
        };

        // Request a live chat from the server
        socket.emit('requestLiveChat', userData);
        
        // Show chat interface immediately
        showChatInterface();
        updateStatus('Waiting for admin to accept...', 'pending');
        enableChatInput(); // Enable input immediately
        
        // Store chat ID when received
        socket.on('chatRequestReceived', (data) => {
            currentChatId = data.chatId;
            sessionStorage.setItem('liveChatId', currentChatId);
        });
    });

    // Admin accepts a chat request
    socket.on('adminAcceptedChat', (data) => {
        updateStatus('Connected to admin', 'active');
        enableChatInput();
        showNotification('An admin has joined the chat. You can now send messages.', 'success');
    });

    // Admin disconnects
    socket.on('adminDisconnected', () => {
        updateStatus('Admin has left the chat', 'disconnected');
        disableChatInput();
        showNotification('The admin has left the chat. You can still send messages and they will see them when they return.', 'warning');
    });

    // Handle messages from admin
    socket.on('adminMessage', (data) => {
        const { chatId, message } = data;
        
        if (chatId === currentChatId) {
            addMessage('agent', message);
            showAdminReplyNotification(message); // Show notification for admin reply
            
            // Remove unread indicator if page is visible
            if (!document.hidden) {
                hasUnreadAdminReply = false;
            }
        }
    });

    // Handle typing indicator from admin
    socket.on('adminTyping', () => {
        typingIndicator.style.display = 'block';
    });

    socket.on('adminStopTyping', () => {
        typingIndicator.style.display = 'none';
    });

    // Send message
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Instant reply buttons
    const replyButtons = document.querySelectorAll('.reply-btn');
    replyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const message = button.getAttribute('data-message');
            messageInput.value = message;
            sendMessage();
        });
    });

    // Close notification
    closeNotification.addEventListener('click', () => {
        notificationBanner.style.display = 'none';
    });

    // Close reply notification
    if (closeReplyNotification) {
        closeReplyNotification.addEventListener('click', () => {
            replyNotification.style.display = 'none';
            hasUnreadAdminReply = false;
        });
    }

    // Page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.title = hasUnreadAdminReply ? '(New Admin Reply) AskSDCKL Live Support' : 'AskSDCKL Live Support';
        } else {
            document.title = 'AskSDCKL Live Support';
            hasUnreadAdminReply = false;
        }
    });

    // Functions
    function showChatInterface() {
        formSection.style.display = 'none';
        chatInterface.style.display = 'flex';
    }

    function updateStatus(text, status) {
        statusText.textContent = text;
        chatStatus = status;
        
        statusDot.classList.remove('online', 'pending', 'offline');
        
        if (status === 'active') {
            statusDot.classList.add('online');
        } else if (status === 'pending') {
            statusDot.classList.add('pending');
        } else {
            statusDot.classList.add('offline');
        }
    }

    function enableChatInput() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    function disableChatInput() {
        messageInput.disabled = true;
        sendButton.disabled = true;
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !currentChatId) return;

        addMessage('user', text);
        socket.emit('userMessage', { chatId: currentChatId, message: text });
        messageInput.value = '';
    }

    function addMessage(sender, text) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender);
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function restoreChatHistory(messages) {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            addMessage(msg.sender === 'user' ? 'user' : 'agent', msg.message);
        });
    }

    function showNotification(message, type) {
        notificationText.textContent = message;
        notificationBanner.className = `notification-${type}`;
        notificationBanner.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notificationBanner.style.display = 'none';
        }, 5000);
    }

    function showAdminReplyNotification(message) {
        // Create reply notification if it doesn't exist
        if (!replyNotification) {
            const notification = document.createElement('div');
            notification.id = 'reply-notification';
            notification.className = 'admin-reply-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-icon">📢</span>
                        <span class="notification-title">Admin Reply</span>
                        <button id="close-reply-notification" class="notification-close">✕</button>
                    </div>
                    <div class="notification-message">${message}</div>
                    <button id="view-reply-btn" class="notification-view-btn">View Reply</button>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Add event listeners
            document.getElementById('close-reply-notification').addEventListener('click', () => {
                notification.style.display = 'none';
                hasUnreadAdminReply = false;
            });
            
            document.getElementById('view-reply-btn').addEventListener('click', () => {
                notification.style.display = 'none';
                hasUnreadAdminReply = false;
                // Scroll to bottom of messages
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
            
            // Set unread indicator
            hasUnreadAdminReply = true;
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                notification.style.display = 'none';
            }, 10000);
        } else {
            // Update existing notification
            const notificationMessage = replyNotification.querySelector('.notification-message');
            const viewBtn = replyNotification.querySelector('#view-reply-btn');
            
            notificationMessage.textContent = message;
            replyNotification.style.display = 'flex';
            
            // Set unread indicator
            hasUnreadAdminReply = true;
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                replyNotification.style.display = 'none';
            }, 10000);
        }
    }
});