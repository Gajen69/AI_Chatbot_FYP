const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active chat sessions
let activeChats = {};

// Store messages for chats that are not yet accepted
let pendingMessages = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User starts a live chat session
    socket.on('requestLiveChat', (userData) => {
        const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        activeChats[chatId] = {
            userSocketId: socket.id,
            userData: userData,
            status: 'pending', // pending, active, closed
            adminId: null,
            messages: [],
            createdAt: new Date()
        };
        
        // Initialize pending messages for this chat
        pendingMessages[chatId] = [];
        
        // Tell the user their session has started
        socket.emit('chatRequestReceived', { chatId: chatId });
        
        // Notify all admins that a new chat has started
        socket.broadcast.emit('newChatStarted', {
            chatId: chatId,
            userData: userData,
            status: 'pending',
            createdAt: activeChats[chatId].createdAt
        });
    });

    // Handle messages from user
// Handle messages from user
socket.on('userMessage', (data) => {
    const { chatId, message } = data;
    const chat = activeChats[chatId];
    
    if (chat) {
        // Add message to chat history
        const messageData = {
            sender: 'user',
            message: message,
            timestamp: new Date(),
            userData: chat.userData
        };
        
        chat.messages.push(messageData);
        
        // Always add message to chat history, regardless of status
        if (chat.status === 'pending') {
            pendingMessages[chatId].push(messageData);
        }
        
        // Broadcast the message to all admins
        socket.broadcast.emit('userMessage', {
            chatId: chatId,
            message: messageData,
            status: chat.status,
            userData: chat.userData
        });
    }
});
    // Admin accepts a chat request
    socket.on('adminAcceptChat', (data) => {
        const { chatId, adminId } = data;
        const chat = activeChats[chatId];
        
        if (chat) {
            chat.status = 'active';
            chat.adminId = adminId;
            
            // Notify the user that their chat has been accepted
            io.to(chat.userSocketId).emit('adminAcceptedChat', { 
                adminId: adminId,
                chatId: chatId
            });
            
            // Send any pending messages to the admin
            if (pendingMessages[chatId] && pendingMessages[chatId].length > 0) {
                io.to(adminId).emit('pendingMessages', {
                    chatId: chatId,
                    messages: pendingMessages[chatId]
                });
            }
            
            // Notify all admins that this chat is now active
            socket.broadcast.emit('chatStatusChanged', {
                chatId: chatId,
                status: 'active',
                adminId: adminId
            });
        }
    });

    // Handle messages from admin
    socket.on('adminMessage', (data) => {
        const { chatId, message } = data;
        const chat = activeChats[chatId];
        
        if (chat && chat.userSocketId) {
            // Add message to chat history
            const messageData = {
                sender: 'admin',
                message: message,
                timestamp: new Date(),
                adminId: socket.id
            };
            
            chat.messages.push(messageData);
            
            // Send the message to the user
            io.to(chat.userSocketId).emit('adminMessage', {
                message: message,
                chatId: chatId
            });
            
            // Notify user about new admin reply
            io.to(chat.userSocketId).emit('newAdminReply', {
                chatId: chatId,
                message: message
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find and update any chats associated with this socket
        for (const chatId in activeChats) {
            const chat = activeChats[chatId];
            
            if (chat.userSocketId === socket.id) {
                chat.status = 'disconnected';
                
                // Notify all admins that this user has left
                socket.broadcast.emit('userDisconnected', { 
                    chatId: chatId,
                    status: 'disconnected'
                });
            } else if (chat.adminId === socket.id) {
                chat.status = 'admin_disconnected';
                
                // Notify the user that the admin has left
                io.to(chat.userSocketId).emit('adminDisconnected', { 
                    chatId: chatId
                });
            }
        }
    });
});

// API endpoint to get chat history
app.get('/api/chat-history/:chatId', (req, res) => {
    const { chatId } = req.params;
    const chat = activeChats[chatId];
    
    if (chat) {
        res.json({
            success: true,
            chat: chat
        });
    } else {
        res.json({
            success: false,
            message: 'Chat not found'
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});