"use client";
import { Stage, Layer, Line } from "react-konva";
import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";

let socket: any;
if (!socket) socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001");

export default function Canvas({ roomId }: { roomId: string }) {
    const [lines, setLines] = useState<any[]>([]);
    const isDrawing = useRef(false);
    const currentLine = useRef<any>(null);

    useEffect(() => {
        socket.emit("join-room", { roomId });

        socket.on("stroke:start", (line) => setLines(prev => [...prev, line]));
        socket.on("stroke:point", ({ id, point }) => {
            setLines(prev => prev.map(l => l.id === id ? {...l, points: l.points.concat(point)} : l));
        });
        socket.on("stroke:end", ({ id }) => {/* optionally finalize */});

        return () => {
            socket.off("stroke:start");
            socket.off("stroke:point");
            socket.off("stroke:end");
        };
    }, [roomId]);

    function handleMouseDown(e: any) {
        isDrawing.current = true;
        const pos = e.target.getStage().getPointerPosition();
        const id = Date.now().toString();
        currentLine.current = { id, points: [pos.x, pos.y], color: "black", width: 3 };
        setLines(prev => [...prev, currentLine.current]);
        socket.emit("stroke:start", { roomId, ...currentLine.current });
    }

    function handleMouseMove(e: any) {
        if (!isDrawing.current) return;
        const pos = e.target.getStage().getPointerPosition();
        currentLine.current.points.push(pos.x, pos.y);
        setLines(prev => prev.map(l => l.id === currentLine.current.id ? currentLine.current : l));
        socket.emit("stroke:point", { roomId, id: currentLine.current.id, point: [pos.x, pos.y] });
    }

    function handleMouseUp() {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        socket.emit("stroke:end", { roomId, id: currentLine.current.id });
        currentLine.current = null;
    }

    return (
        <Stage width={800} height={600}
               onMouseDown={handleMouseDown}
               onMouseMove={handleMouseMove}
               onMouseUp={handleMouseUp}>
            <Layer>
                {lines.map(l => <Line key={l.id} points={l.points} stroke={l.color} strokeWidth={l.width} lineCap="round" />)}
            </Layer>
        </Stage>
    );
}
