"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function HomePage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [roomCode, setRoomCode] = useState("")

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert("Enter your name first!")
      return
    }
    // Generate a random room ID
    const roomId = Math.random().toString(36).substring(2, 8)
    router.push(`/room/${roomId}?username=${encodeURIComponent(username)}`)
  }

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) {
      alert("Enter both your name and room code!")
      return
    }
    router.push(`/room/${roomCode}?username=${encodeURIComponent(username)}`)
  }

  return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200">
        <div className="bg-white/70 backdrop-blur-md p-8 rounded-2xl shadow-xl text-center w-[90%] max-w-md">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">🎨 Moodles</h1>
          <p className="text-gray-600 mb-6">Draw. Talk. Guess. Laugh with friends!</p>

          <div className="space-y-4">
            <Input
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
            />

            <div className="flex gap-2">
              <Input
                  placeholder="Room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="flex-1"
              />
              <Button onClick={handleJoinRoom} className="bg-purple-500 hover:bg-purple-600">
                Join
              </Button>
            </div>

            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500">or</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <Button
                onClick={handleCreateRoom}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium"
            >
              Create New Room
            </Button>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Built with ❤️ using Next.js + Socket.io + WebRTC
          </p>
        </div>
      </main>
  )
}
