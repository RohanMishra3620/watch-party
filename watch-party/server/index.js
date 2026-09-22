const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const {
  ROLES,
  createRoom,
  getRoom,
  deleteRoom,
  addParticipant,
  removeParticipantById,
  findParticipant,
  canControl,
  isHost,
  serializeRoom,
  getCurrentTime,
  touchPlaybackState,
} = require("./rooms");

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Must stay in sync with the emoji list in client/src/components/Controls.jsx.
const REACTION_EMOJIS = ["❤️", "👍", "😂", "🎉", "👏", "😮", "😢", "🤔", "👎"];

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "youtube-watch-party" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

function extractVideoId(input) {
  if (!input) return "";

  const trimmed = input.trim();

  // Bare YouTube ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (/^[A-Za-z0-9_-]{11}$/.test(watchId || "")) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      const index = parts.findIndex((p) =>
        ["embed", "shorts", "live"].includes(p)
      );
      const id = index >= 0 ? parts[index + 1] : "";
      return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : "";
    }
  } catch {
    // Invalid URL; handled below.
  }

  return "";
}

function denyPermission(socket, action) {
  socket.emit("permission_denied", {
    action,
    message: `You do not have permission to perform "${action}".`,
  });
}

function broadcastParticipants(room) {
  io.to(room.roomId).emit("participants_updated", {
    participants: room.participants,
  });
}

function emitSyncState(room) {
  io.to(room.roomId).emit("sync_state", serializeRoom(room));
}

function executeControl(room, action, payload = {}) {
  const current = getCurrentTime(room);

  switch (action) {
    case "play":
      room.currentTime = current;
      room.playState = "playing";
      touchPlaybackState(room);
      io.to(room.roomId).emit("sync_play", {
        currentTime: room.currentTime,
      });
      return true;

    case "pause":
      room.currentTime =
        typeof payload.currentTime === "number"
          ? Math.max(0, payload.currentTime)
          : current;
      room.playState = "paused";
      touchPlaybackState(room);
      io.to(room.roomId).emit("sync_pause", {
        currentTime: room.currentTime,
      });
      return true;

    case "seek":
      if (typeof payload.time !== "number" || !Number.isFinite(payload.time)) {
        return false;
      }
      room.currentTime = Math.max(0, payload.time);
      touchPlaybackState(room);
      io.to(room.roomId).emit("sync_seek", { time: room.currentTime });
      return true;

    case "change_video": {
      const videoId = extractVideoId(payload.videoId);
      if (!videoId) return false;

      room.videoId = videoId;
      room.currentTime = 0;
      room.playState = "paused";
      touchPlaybackState(room);
      io.to(room.roomId).emit("sync_video", { videoId });
      return true;
    }

    default:
      return false;
  }
}

io.on("connection", (socket) => {
  // -------------------- CREATE ROOM --------------------
  socket.on("create_room", ({ username, videoId } = {}) => {
    const name = String(username || "").trim();

    if (!name) {
      socket.emit("create_error", { message: "Username is required." });
      return;
    }

    const parsedVideoId = extractVideoId(videoId);
    if (videoId && !parsedVideoId) {
      socket.emit("create_error", {
        message: "Please enter a valid YouTube URL or 11-character video ID.",
      });
      return;
    }

    const room = createRoom({
      hostSocketId: socket.id,
      hostUsername: name,
      videoId: parsedVideoId,
    });

    socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    socket.data.username = name;

    socket.emit("room_created", {
      room: serializeRoom(room),
      selfId: socket.id,
    });
  });

  // -------------------- JOIN ROOM --------------------
  socket.on("join_room", ({ roomId, username } = {}) => {
    const code = String(roomId || "").trim().toUpperCase();
    const name = String(username || "").trim();
    const room = getRoom(code);

    if (!room) {
      socket.emit("join_error", {
        message: `Room "${code}" was not found.`,
      });
      return;
    }

    if (!name) {
      socket.emit("join_error", { message: "Username is required." });
      return;
    }

    const participant = addParticipant(room, {
      userId: socket.id,
      username: name,
    });

    socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    socket.data.username = name;

    socket.emit("room_joined", {
      room: serializeRoom(room),
      self: participant,
      selfId: socket.id,
    });

    socket.to(room.roomId).emit("user_joined", { participant });
    broadcastParticipants(room);
  });

  // -------------------- STATE SYNC --------------------
  socket.on("request_sync_state", () => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    socket.emit("sync_state", serializeRoom(room));
  });

  // -------------------- PLAYBACK --------------------
  socket.on("play", ({ currentTime } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    if (!canControl(room, socket.id)) return denyPermission(socket, "play");

    executeControl(room, "play", {
      currentTime:
        typeof currentTime === "number" ? currentTime : getCurrentTime(room),
    });
  });

  socket.on("pause", ({ currentTime } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    if (!canControl(room, socket.id)) return denyPermission(socket, "pause");

    executeControl(room, "pause", { currentTime });
  });

  socket.on("seek", ({ time } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    if (!canControl(room, socket.id)) return denyPermission(socket, "seek");

    if (!executeControl(room, "seek", { time })) {
      socket.emit("invalid_action", { message: "Invalid seek position." });
    }
  });

  socket.on("change_video", ({ videoId } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    if (!canControl(room, socket.id)) {
      return denyPermission(socket, "change_video");
    }

    if (!executeControl(room, "change_video", { videoId })) {
      socket.emit("invalid_action", {
        message: "Please enter a valid YouTube URL or video ID.",
      });
    }
  });

  // -------------------- REACTIONS --------------------
  socket.on("reaction", ({ emoji } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;

    const participant = findParticipant(room, socket.id);
    if (!participant) return;

    if (!REACTION_EMOJIS.includes(emoji)) return;

    io.to(room.roomId).emit("reaction_received", {
      reactionId: `${socket.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: socket.id,
      username: participant.username,
      emoji,
    });
  });

  // -------------------- HOST-ONLY MANAGEMENT --------------------
  socket.on("assign_role", ({ userId, role } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;

    if (!isHost(room, socket.id)) {
      return denyPermission(socket, "assign_role");
    }

    if (![ROLES.MODERATOR, ROLES.PARTICIPANT].includes(role)) return;
    if (userId === room.hostId) return;

    const participant = findParticipant(room, userId);
    if (!participant) return;

    participant.role = role;

    io.to(room.roomId).emit("role_assigned", {
      userId,
      username: participant.username,
      role,
      participants: room.participants,
    });

    broadcastParticipants(room);
  });

  socket.on("remove_participant", ({ userId } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;

    if (!isHost(room, socket.id)) {
      return denyPermission(socket, "remove_participant");
    }

    if (userId === room.hostId) return;

    const removed = removeParticipantById(room, userId);
    if (!removed) return;

    room.pendingRequests = room.pendingRequests.filter(
      (request) => request.userId !== userId
    );

    io.to(room.roomId).emit("participant_removed", {
      userId,
      username: removed.username,
    });

    broadcastParticipants(room);

    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.emit("you_were_removed");
      targetSocket.leave(room.roomId);
      targetSocket.data.roomId = null;
    }
  });

  // -------------------- PARTICIPANT REQUESTS --------------------
  socket.on("request_control", ({ action, payload } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;

    const requester = findParticipant(room, socket.id);
    if (!requester) return;

    if (canControl(room, socket.id)) {
      return denyPermission(socket, "request_control");
    }

    const allowedActions = ["play", "pause", "seek", "change_video"];
    if (!allowedActions.includes(action)) {
      socket.emit("invalid_action", { message: "Unsupported control request." });
      return;
    }

    const requestId = `${socket.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const request = {
      requestId,
      userId: socket.id,
      username: requester.username,
      action,
      payload: payload || {},
    };

    room.pendingRequests.push(request);

    room.participants
      .filter((p) => canControl(room, p.userId))
      .forEach((p) => {
        io.to(p.userId).emit("control_request", request);
      });

    socket.emit("request_sent", {
      requestId,
      message: "Request sent - waiting for approval.",
    });
  });

  socket.on("approve_request", ({ requestId } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;

    if (!canControl(room, socket.id)) {
      return denyPermission(socket, "approve_request");
    }

    const idx = room.pendingRequests.findIndex(
      (request) => request.requestId === requestId
    );

    if (idx === -1) {
      // The request is already gone (already resolved by another
      // moderator, or pruned because the requester disconnected /
      // was removed). Tell clients to clear it from their UI instead
      // of leaving a stale entry that can never be approved.
      io.to(room.roomId).emit("request_resolved", {
        requestId,
        status: "rejected",
      });
      return;
    }

    const [request] = room.pendingRequests.splice(idx, 1);

    // Re-check that the requester is still in the room. This can only
    // trigger for requests removed by means other than the disconnect/
    // remove_participant cleanup above (which already prunes by userId),
    // but is kept as a defensive guard.
    if (!findParticipant(room, request.userId)) {
      io.to(room.roomId).emit("request_resolved", {
        requestId,
        status: "rejected",
      });
      return;
    }

    const executed = executeControl(room, request.action, request.payload);

    io.to(room.roomId).emit("request_resolved", {
      requestId,
      status: executed ? "approved" : "rejected",
    });
  });

  socket.on("reject_request", ({ requestId } = {}) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;

    if (!canControl(room, socket.id)) {
      return denyPermission(socket, "reject_request");
    }

    room.pendingRequests = room.pendingRequests.filter(
      (request) => request.requestId !== requestId
    );

    io.to(room.roomId).emit("request_resolved", {
      requestId,
      status: "rejected",
    });
  });

  // -------------------- LEAVE / DISCONNECT --------------------
  function handleLeave() {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;

    const wasHost = isHost(room, socket.id);
    removeParticipantById(room, socket.id);

    room.pendingRequests = room.pendingRequests.filter(
      (request) => request.userId !== socket.id
    );

    if (room.participants.length === 0) {
      deleteRoom(roomId);
      socket.data.roomId = null;
      return;
    }

    if (wasHost) {
      // Host transfer is optional in the assignment, but keeps a room alive.
      const successor = room.participants[0];
      room.hostId = successor.userId;
      successor.role = ROLES.HOST;

      io.to(roomId).emit("host_transferred", {
        newHostId: successor.userId,
        newHostUsername: successor.username,
      });
    }

    io.to(roomId).emit("user_left", {
      userId: socket.id,
      username: socket.data.username,
    });

    broadcastParticipants(room);
    socket.data.roomId = null;
  }

  socket.on("leave_room", () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.leave(roomId);
    handleLeave();
  });

  socket.on("disconnect", handleLeave);
});

server.listen(PORT, () => {
  console.log(`Watch Party server listening on http://localhost:${PORT}`);
});
