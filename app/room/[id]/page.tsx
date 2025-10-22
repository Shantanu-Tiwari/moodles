"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import io, { Socket } from "socket.io-client"
import { Stage, Layer, Line } from "react-konva"
import { Button } from "@/components/ui/button"
import Peer from "simple-peer"

let socket: Socket

export default function RoomPage() {
    type LineData = { points: number[]; color: string; strokeWidth: number };
    const { id } = useParams()
    const searchParams = useSearchParams()
    const username = searchParams.get("username")

    const [lines, setLines] = useState<LineData[]>([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [users, setUsers] = useState<string[]>([])
    const [isMuted, setIsMuted] = useState(false)
    const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({})

    const stageRef = useRef<any>(null)
    const peersRef = useRef<Record<string, Peer.Instance>>({})
    const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
    const userStream = useRef<MediaStream | null>(null)

    // --- SOCKET SETUP + DRAWING ---
    useEffect(() => {
        socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", { transports: ["websocket"] })
        socket.emit("joinRoom", { roomId: id, username })

        socket.on("initCanvas", (serverLines) => setLines(serverLines))
        socket.on("draw", (newLine) => setLines((prev) => [...prev, newLine]))
        socket.on("clearCanvas", () => setLines([]))
        socket.on("usersUpdate", (userList) => setUsers(userList))

        // --- VOICE CHAT EVENTS ---
        socket.on("user-joined", (userId) => {
            if (userStream.current && socket.id) {
                const peer = createPeer(userId, socket.id, userStream.current)
                peersRef.current[userId] = peer
            }
        })

        socket.on("signal", ({ from, signal }) => {
            if (!peersRef.current[from]) {
                const peer = addPeer(signal, from, userStream.current!)
                peersRef.current[from] = peer
            } else {
                peersRef.current[from].signal(signal)
            }
        })

        socket.on("user-left", (userId) => {
            if (peersRef.current[userId]) {
                peersRef.current[userId].destroy()
                delete peersRef.current[userId]
            }
            if (audioRefs.current[userId]) {
                audioRefs.current[userId].remove()
                delete audioRefs.current[userId]
            }
        })

        // --- MIC ACCESS ---
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            userStream.current = stream
            detectSpeaking(stream, username || "You")
        })

        const cleanup = () => socket.disconnect()
        window.addEventListener("beforeunload", cleanup)
        return () => {
            cleanup()
            window.removeEventListener("beforeunload", cleanup)
        }
    }, [id, username])

    // --- PEER HELPERS ---
    function createPeer(userToSignal: string, callerId: string, stream: MediaStream) {
        const peer = new Peer({ initiator: true, trickle: false, stream })
        peer.on("signal", (signal) => {
            if (socket.id) {
                socket.emit("signal", { to: userToSignal, from: callerId, signal })
            }
        })
        peer.on("stream", (remoteStream) => addAudio(remoteStream, userToSignal))
        return peer
    }

    function addPeer(incomingSignal: Peer.SignalData, fromId: string, stream: MediaStream) {
        const peer = new Peer({ initiator: false, trickle: false, stream })
        peer.on("signal", (signal) => {
            if (socket.id) {
                socket.emit("signal", { to: fromId, from: socket.id, signal })
            }
        })
        peer.on("stream", (remoteStream) => addAudio(remoteStream, fromId))
        peer.signal(incomingSignal)
        return peer
    }

    function addAudio(stream: MediaStream, id: string) {
        if (audioRefs.current[id]) return
        const audio = document.createElement("audio")
        audio.srcObject = stream
        audio.autoplay = true
        audioRefs.current[id] = audio
        document.body.appendChild(audio)
    }

    // --- MIC & SPEAK DETECTION ---
    function toggleMute() {
        if (userStream.current) {
            const track = userStream.current.getAudioTracks()[0]
            track.enabled = !track.enabled
            setIsMuted(!track.enabled)
        }
    }

    function detectSpeaking(stream: MediaStream, name: string) {
        const audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        const source = audioCtx.createMediaStreamSource(stream)
        const data = new Uint8Array(analyser.frequencyBinCount)
        source.connect(analyser)

        const loop = () => {
            analyser.getByteFrequencyData(data)
            const volume = data.reduce((a, b) => a + b, 0) / data.length
            setSpeakingUsers((prev) => ({ ...prev, [name]: volume > 20 }))
            requestAnimationFrame(loop)
        }
        loop()
    }

    // --- DRAWING ---
    const handleMouseDown = (e: any) => {
        setIsDrawing(true)
        const pos = e.target.getStage().getPointerPosition()
        const newLine = { points: [pos.x, pos.y], color: "black", strokeWidth: 3 }
        setLines((prev) => [...prev, newLine])
    }

    const handleMouseMove = (e: any) => {
        if (!isDrawing) return
        const stage = e.target.getStage()
        const point = stage.getPointerPosition()
        const lastLine = lines[lines.length - 1]
        lastLine.points = lastLine.points.concat([point.x, point.y])
        const newLines = lines.slice(0, lines.length - 1).concat(lastLine)
        setLines(newLines)
        socket.emit("draw", { roomId: id, newLine: lastLine })
    }

    const handleMouseUp = () => setIsDrawing(false)

    const clearCanvas = () => socket.emit("clearCanvas", id)

    return (
        <main className="flex flex-col min-h-screen bg-gradient-to-br from-yellow-200 via-orange-200 to-pink-200">
            <header className="flex justify-between items-center px-6 py-4 bg-white/70 backdrop-blur-md shadow">
                <h1 className="text-2xl font-bold">🎨 Moodles Room: {id}</h1>
                <div className="flex items-center gap-4 text-gray-600">
                    👥 {users.length} players
                    <Button onClick={toggleMute} className="bg-blue-500 hover:bg-blue-600">
                        {isMuted ? "Unmute" : "Mute"}
                    </Button>
                </div>
            </header>

            <div className="flex flex-col md:flex-row flex-1">
                <div className="flex-1 flex flex-col justify-center items-center">
                    <div className="bg-white rounded-2xl shadow-xl">
                        <Stage
                            width={800}
                            height={600}
                            ref={stageRef}
                            onMouseDown={handleMouseDown}
                            onMousemove={handleMouseMove}
                            onMouseup={handleMouseUp}
                        >
                            <Layer>
                                {lines.map((line, i) => (
                                    <Line
                                        key={i}
                                        points={line.points}
                                        stroke={line.color}
                                        strokeWidth={line.strokeWidth}
                                        tension={0.5}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                ))}
                            </Layer>
                        </Stage>
                    </div>

                    <div className="flex gap-4 mt-4">
                        <Button onClick={clearCanvas} className="bg-yellow-500 hover:bg-yellow-600">
                            Clear Canvas
                        </Button>
                        <Button
                            onClick={() => {
                                socket.disconnect()
                                window.location.href = "/"
                            }}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Leave Room
                        </Button>
                    </div>
                </div>

                <aside className="bg-white/80 p-4 md:w-64 border-l border-gray-200">
                    <h2 className="text-lg font-semibold mb-2">Players</h2>
                    <ul className="mb-4 space-y-2">
                        {users.map((u, i) => (
                            <li
                                key={i}
                                className={`flex items-center gap-2 ${
                                    speakingUsers[u] ? "text-green-600 font-bold" : "text-gray-700"
                                }`}
                            >
                                {speakingUsers[u] && <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>}
                                🎧 {u}
                            </li>
                        ))}
                    </ul>

                    <div className="border-t border-gray-300 pt-3">
                        <h2 className="text-lg font-semibold mb-2">Voice Chat</h2>
                        <p className="text-sm text-gray-600">🎙 Live now! Speak to other players.</p>
                    </div>
                </aside>
            </div>
        </main>
    )
}