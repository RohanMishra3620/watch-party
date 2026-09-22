import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { RoomProvider, useRoom } from "./context/RoomContext.jsx";
import Home from "./pages/Home.jsx";
import WatchRoom from "./pages/WatchRoom.jsx";

function Toast() {
  const { toast, clearToast } = useRoom();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 3500);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}

// Redirects to /room/:roomId as soon as a room is created or joined, and
// back to / if the room disappears (removed, closed, etc).
function RoomRouter({ children }) {
  const { room } = useRoom();
  const navigate = useNavigate();

  useEffect(() => {
    if (room && room.roomId) {
      navigate(`/room/${room.roomId}`, { replace: true });
    }
  }, [room, navigate]);

  return children;
}

export default function App() {
  return (
    <RoomProvider>
      <BrowserRouter>
        <RoomRouter>
          <Toast />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomId" element={<WatchRoom />} />
          </Routes>
        </RoomRouter>
      </BrowserRouter>
    </RoomProvider>
  );
}
