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

    // 處理進入房間
    socket.on('joinRoom', (roomId) => {
        if (currentRoom) socket.leave(currentRoom);
        currentRoom = roomId;
        socket.join(roomId);

        if (!roomsState[roomId]) roomsState[roomId] = {};
        if (roomColorCounters[roomId] === undefined) roomColorCounters[roomId] = 0;

        // 分配顏色 (根據進入順序 0-3 循環)
        myColor = PLAYER_COLORS[roomColorCounters[roomId] % PLAYER_COLORS.length];
        roomColorCounters[roomId]++;

        socket.emit('assignColor', myColor);
        socket.emit('sync', roomsState[roomId]);
    });

    // 處理點擊標記
    socket.on('click', (data) => {
        if (!currentRoom || !data.color) return;
        const { floor, tile, color } = data;
        const targetKey = `f${floor}-${tile}`;

        // 【邏輯 1：不能覆蓋別人】
        // 如果點擊的位置已經有顏色，且不是我的顏色，則不予理會
        if (roomsState[currentRoom][targetKey] && roomsState[currentRoom][targetKey] !== color) {
            return;
        }

        // 【邏輯 2：單人單行限一格】
        // 先找出這一層 (floor) 是否已經有「我的顏色」在別的位置，有的話先刪除
        let isCancelAction = false;
        for (let key in roomsState[currentRoom]) {
            if (key.startsWith(`f${floor}-`) && roomsState[currentRoom][key] === color) {
                if (key === targetKey) isCancelAction = true; // 如果點的是自己原本那格，代表想取消
                delete roomsState[currentRoom][key];
            }
        }

        // 如果不是取消動作，則在目標位置畫上我的顏色
        if (!isCancelAction) {
            roomsState[currentRoom][targetKey] = color;
        }

        // 廣播給同房間的人
        io.to(currentRoom).emit('sync', roomsState[currentRoom]);
    });

    // 重置房間
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
    console.log(`Server is running on port ${PORT}`);
});
