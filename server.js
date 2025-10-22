import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"

const app = express()
app.use(cors())

const server = createServer(app)
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://moodles-seven.vercel.app"],
        methods: ["GET", "POST"],
    },
})

// Persistent in-memory room store
const rooms = {}

io.on("connection", (socket) => {
    console.log("🟢 New client connected:", socket.id)

    socket.on("joinRoom", ({ roomId, username }) => {
        socket.join(roomId)
        socket.data = { roomId, username }

        // Create room if doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: [],
                lines: [],
            }
        }

        // Remove any existing user with same name (reconnection)
        rooms[roomId].users = rooms[roomId].users.filter((u) => u.name !== username)
        // Add current user
        rooms[roomId].users.push({ id: socket.id, name: username })

        // Send all existing lines to new user
        socket.emit("initCanvas", rooms[roomId].lines)

        // Broadcast updated user list
        io.to(roomId).emit("usersUpdate", rooms[roomId].users.map((u) => u.name))

        // Send existing user IDs to new user for reconnection
        const existingUserIds = rooms[roomId].users.filter(u => u.id !== socket.id).map(u => u.id)
        socket.emit("existingUsers", existingUserIds)

        // Notify existing users that a new user joined (for WebRTC)
        socket.to(roomId).emit("user-joined", socket.id)

        console.log(`👥 ${username} joined room ${roomId}`)
    })

    // When user draws
    socket.on("draw", ({ roomId, newLine }) => {
        if (rooms[roomId]) {
            rooms[roomId].lines.push(newLine)
            socket.to(roomId).emit("draw", newLine)
        }
    })

    // When user clears canvas
    socket.on("clearCanvas", (roomId) => {
        if (rooms[roomId]) rooms[roomId].lines = []
        io.to(roomId).emit("clearCanvas")
    })

    // WebRTC signaling for voice chat
    socket.on("signal", ({ to, from, signal }) => {
        socket.to(to).emit("signal", { from, signal })
    })

    // Speaking status broadcast
    socket.on("speaking", ({ roomId, username, speaking }) => {
        socket.to(roomId).emit("speakingUpdate", { username, speaking })
    })

    // When user leaves/disconnects
    socket.on("disconnect", () => {
        const { roomId, username } = socket.data || {}
        if (!roomId || !rooms[roomId]) return

        // Notify other users that this user left (for WebRTC cleanup)
        socket.to(roomId).emit("user-left", socket.id)

        rooms[roomId].users = rooms[roomId].users.filter((u) => u.id !== socket.id)
        io.to(roomId).emit("usersUpdate", rooms[roomId].users.map((u) => u.name))
        console.log(`🔴 ${username || "User"} disconnected from ${roomId}`)

        // Optional cleanup if room empty
        if (rooms[roomId].users.length === 0) {
            delete rooms[roomId]
            console.log(`🧹 Room ${roomId} deleted (empty).`)
        }
    })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`🚀 Socket server running on port ${PORT}`))
