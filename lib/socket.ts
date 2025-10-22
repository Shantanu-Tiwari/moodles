import express from "express";
import http from "http";
import { Server } from "socket.io";
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const roomsHistory = {}; // in-memory stroke history per room

io.on("connection", socket => {
    socket.on("join-room", ({ roomId }) => {
        socket.join(roomId);
        // send existing strokes to the new user
        if (roomsHistory[roomId]) socket.emit("initial-strokes", roomsHistory[roomId]);
    });

    socket.on("stroke:start", (data) => {
        roomsHistory[data.roomId] = roomsHistory[data.roomId] || [];
        roomsHistory[data.roomId].push(data);
        socket.to(data.roomId).emit("stroke:start", data);
    });

    socket.on("stroke:point", (data) => {
        roomsHistory[data.roomId] = roomsHistory[data.roomId] || [];
        // find line and append on server copy if desired
        socket.to(data.roomId).emit("stroke:point", data);
    });

    socket.on("clear", ({ roomId }) => {
        roomsHistory[roomId] = [];
        io.to(roomId).emit("clear");
    });

    socket.on("disconnect", () => {});
});

server.listen(4000, () => console.log("Socket server on :4000"));
