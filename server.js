const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

let roomsState = {};
let roomColorCounters = {};
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6']; // 紅, 藍, 黃, 紫

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    let currentRoom = null;
    let myColor = null;

    socket.on('joinRoom', (roomId) => {
        if (currentRoom) socket.leave(currentRoom);
        currentRoom = roomId;
        socket.join(roomId);

        if (!roomsState[roomId]) roomsState[roomId] = {};
        if (roomColorCounters[roomId] === undefined) roomColorCounters[roomId] = 0;

        // 分配顏色
        myColor = PLAYER_COLORS[roomColorCounters[roomId] % PLAYER_COLORS.length];
        roomColorCounters[roomId]++;

        socket.emit('assignColor', myColor);
        socket.emit('sync', roomsState[roomId]);
    });

    socket.on('click', (data) => {
        if (!currentRoom || !data.color) return;
        const { floor, tile, color } = data;
        const targetKey = `f${floor}-${tile}`;

        // 檢查這一層是否已經有「我的顏色」，有的話先移除（實現單人單行單色）
        let alreadyExists = false;
        for (let key in roomsState[currentRoom]) {
            if (key.startsWith(`f${floor}-`) && roomsState[currentRoom][key] === color) {
                // 如果點擊的是同一個格子，記錄起來準備刪除後不補
                if (key === targetKey) alreadyExists = true; 
                delete roomsState[currentRoom][key];
            }
        }

        // 如果點擊的是新格子，則加上標記；如果是舊格子，上面已刪除達成取消效果
        if (!alreadyExists) {
            roomsState[currentRoom][targetKey] = color;
        }

        io.to(currentRoom).emit('sync', roomsState[currentRoom]);
    });

    socket.on('reset', () => {
        if (!currentRoom) return;
        roomsState[currentRoom] = {};
        io.to(currentRoom).emit('sync', roomsState[currentRoom]);
    });

    socket.on('disconnect', () => {
        if (currentRoom) {
            const clients = io.sockets.adapter.rooms.get(currentRoom);
            if (!clients || clients.size === 0) {
                roomColorCounters[currentRoom] = 0;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
});
