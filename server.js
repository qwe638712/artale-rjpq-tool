const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// 儲存各房間盤面狀態
let roomsState = {};
// 儲存各房間顏色分配計數
let roomColorCounters = {};

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6']; // 紅, 藍, 黃, 紫

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    let currentRoom = null;
    let myColor = null;

    // 處理玩家選擇房間
    socket.on('joinRoom', (roomId) => {
        if (currentRoom) socket.leave(currentRoom);
        
        currentRoom = roomId;
        socket.join(roomId);

        // 初始化房間資料
        if (!roomsState[roomId]) roomsState[roomId] = {};
        if (roomColorCounters[roomId] === undefined) roomColorCounters[roomId] = 0;

        // 分配顏色並增加計數 (確保 4 色循環)
        const colorIdx = roomColorCounters[roomId] % PLAYER_COLORS.length;
        myColor = PLAYER_COLORS[colorIdx];
        roomColorCounters[roomId]++;

        // 發送給該玩家
        socket.emit('assignColor', myColor);
        socket.emit('sync', roomsState[roomId]);
        
        console.log(`房間 [${roomId}] 新玩家進入，分配顏色: ${myColor}`);
    });

    // 處理格子點擊
    socket.on('click', (data) => {
        if (!currentRoom || !data.color) return;
        
        const { floor, tile, color } = data;
        const key = `f${floor}-${tile}`;

        // Toggle 邏輯：同顏色點擊則取消，否則標記
        if (roomsState[currentRoom][key] === color) {
            delete roomsState[currentRoom][key];
        } else {
            roomsState[currentRoom][key] = color;
        }
        
        // 廣播給房間內所有人
        io.to(currentRoom).emit('sync', roomsState[currentRoom]);
    });

    // 處理重置
    socket.on('reset', () => {
        if (!currentRoom) return;
        roomsState[currentRoom] = {};
        io.to(currentRoom).emit('sync', roomsState[currentRoom]);
    });

    // 斷線處理
    socket.on('disconnect', () => {
        if (currentRoom) {
            const clients = io.sockets.adapter.rooms.get(currentRoom);
            // 如果房間沒人了，歸零顏色計數器
            if (!clients || clients.size === 0) {
                roomColorCounters[currentRoom] = 0;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`伺服器啟動成功！Port: ${PORT}`);
});