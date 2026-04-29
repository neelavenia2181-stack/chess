const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the current directory
app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', () => {
        // Generate a simple 6-character alphanumeric room code
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomId] = { players: [socket.id] };
        socket.join(roomId);
        // The creator will play White
        socket.emit('roomCreated', { roomId, color: 'w' });
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on('joinRoom', (roomId) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && rooms[roomId].players.length === 1) {
            rooms[roomId].players.push(socket.id);
            socket.join(roomId);
            // The joiner plays Black
            socket.emit('roomJoined', { roomId, color: 'b' });
            // Notify the creator that the opponent has joined
            socket.to(roomId).emit('gameStarted', 'Opponent joined! Your move.');
            console.log(`User ${socket.id} joined room: ${roomId}`);
        } else if (rooms[roomId] && rooms[roomId].players.length >= 2) {
            socket.emit('errorMsg', 'Room is full.');
        } else {
            socket.emit('errorMsg', 'Room not found.');
        }
    });

    socket.on('move', (data) => {
        // Broadcast the move to the other player in the room
        socket.to(data.roomId).emit('opponentMove', data.move);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find which room the user was in and notify the other player
        for (const roomId in rooms) {
            if (rooms[roomId].players.includes(socket.id)) {
                socket.to(roomId).emit('opponentDisconnected', 'Opponent disconnected.');
                delete rooms[roomId]; // Clear the room
            }
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
