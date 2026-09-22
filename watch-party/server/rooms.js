// In-memory room state manager.
// Restarting the server clears rooms; this is sufficient for the assignment MVP.

const rooms = new Map();

const ROLES = {
  HOST: "Host",
  MODERATOR: "Moderator",
  PARTICIPANT: "Participant",
};

const CONTROL_ROLES = [ROLES.HOST, ROLES.MODERATOR];

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));

  return code;
}

function createRoom({ hostSocketId, hostUsername, videoId }) {
  const room = {
    roomId: generateRoomCode(),
    hostId: hostSocketId,
    videoId: videoId || "",
    playState: "paused",
    currentTime: 0,
    updatedAt: Date.now(),
    participants: [
      {
        userId: hostSocketId,
        username: hostUsername,
        role: ROLES.HOST,
      },
    ],
    pendingRequests: [],
    createdAt: Date.now(),
  };

  rooms.set(room.roomId, room);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function deleteRoom(roomId) {
  rooms.delete(roomId);
}

function addParticipant(room, { userId, username }) {
  const participant = {
    userId,
    username,
    role: ROLES.PARTICIPANT,
  };

  room.participants.push(participant);
  return participant;
}

function removeParticipantById(room, userId) {
  const index = room.participants.findIndex((p) => p.userId === userId);
  if (index === -1) return null;

  return room.participants.splice(index, 1)[0];
}

function findParticipant(room, userId) {
  return room.participants.find((p) => p.userId === userId);
}

function getRole(room, userId) {
  return findParticipant(room, userId)?.role || null;
}

function canControl(room, userId) {
  return CONTROL_ROLES.includes(getRole(room, userId));
}

function isHost(room, userId) {
  return room.hostId === userId;
}

function getCurrentTime(room) {
  if (room.playState !== "playing") {
    return room.currentTime;
  }

  const elapsedSeconds = (Date.now() - room.updatedAt) / 1000;
  return Math.max(0, room.currentTime + elapsedSeconds);
}

function touchPlaybackState(room) {
  room.updatedAt = Date.now();
}

function serializeRoom(room) {
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    videoId: room.videoId,
    playState: room.playState,
    currentTime: getCurrentTime(room),
    participants: room.participants.map((p) => ({ ...p })),
  };
}

module.exports = {
  rooms,
  ROLES,
  CONTROL_ROLES,
  createRoom,
  getRoom,
  deleteRoom,
  addParticipant,
  removeParticipantById,
  findParticipant,
  getRole,
  canControl,
  isHost,
  getCurrentTime,
  touchPlaybackState,
  serializeRoom,
};
