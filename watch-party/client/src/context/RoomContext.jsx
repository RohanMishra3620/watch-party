import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { socket } from "../socket";

const RoomContext = createContext(null);

// How long a floating reaction stays mounted before we drop it from state.
// Must be >= the CSS animation duration for .floating-reaction, or the emoji
// will pop out abruptly instead of finishing its fade.
const REACTION_LIFETIME_MS = 2600;

export function RoomProvider({ children }) {
  const [room, setRoom] = useState(null); // { roomId, hostId, videoId, playState, currentTime, participants }
  const [selfId, setSelfId] = useState(socket.id || null);
  const [error, setError] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]); // control_request queue (host/mod only)
  const [toast, setToast] = useState(null); // ephemeral notice, e.g. permission_denied
  const [reactions, setReactions] = useState([]); // transient floating emoji reactions
  const reactionTimeoutsRef = useRef(new Map());

  useEffect(() => {
    function onConnect() {
      setSelfId(socket.id);
    }
    function onRoomCreated({ room: r, selfId: id }) {
      setSelfId(id || socket.id);
      setRoom(r);
      setIncomingRequests([]);
      setError(null);
    }
    function onRoomJoined({ room: r, selfId: id }) {
      setSelfId(id || socket.id);
      setRoom(r);
      setIncomingRequests([]);
      setError(null);
    }
    function onCreateError({ message }) {
      setError(message);
    }
    function onJoinError({ message }) {
      setError(message);
    }
    function onParticipantsUpdated({ participants }) {
      setRoom((prev) => (prev ? { ...prev, participants } : prev));
    }
    function onUserJoined() {
      // participants_updated follows right behind; nothing else to do here.
    }
    function onUserLeft() {
      // handled via participants_updated
    }
    function onSyncPlay({ currentTime }) {
      setRoom((prev) =>
        prev ? { ...prev, playState: "playing", currentTime } : prev
      );
    }
    function onSyncPause({ currentTime }) {
      setRoom((prev) =>
        prev ? { ...prev, playState: "paused", currentTime } : prev
      );
    }
    function onSyncSeek({ time }) {
      setRoom((prev) => (prev ? { ...prev, currentTime: time } : prev));
    }
    function onSyncVideo({ videoId }) {
      setRoom((prev) =>
        prev
          ? { ...prev, videoId, currentTime: 0, playState: "paused" }
          : prev
      );
    }
    function onSyncState(state) {
      setRoom(state);
    }
    function onRoleAssigned({ userId, role }) {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.userId === userId ? { ...p, role } : p
          ),
        };
      });
    }
    function onHostTransferred({ newHostId }) {
      setRoom((prev) => (prev ? { ...prev, hostId: newHostId } : prev));
    }
    function onParticipantRemoved({ userId }) {
      if (userId === socket.id) {
        setToast("You were removed from the room by the host.");
        setRoom(null);
      }
    }
    function onYouWereRemoved() {
      setToast("You were removed from the room by the host.");
      setRoom(null);
    }
    function onPermissionDenied({ message }) {
      setToast(message || "Permission denied.");
    }
    function onControlRequest(request) {
      setIncomingRequests((prev) => [...prev, request]);
    }
    function onRequestResolved({ requestId }) {
      setIncomingRequests((prev) =>
        prev.filter((r) => r.requestId !== requestId)
      );
    }
    function onRequestSent({ message } = {}) {
      setToast(message || "Request sent - waiting for approval.");
    }
    function onInvalidAction({ message }) {
      setToast(message || "Invalid action.");
    }
    function onReactionReceived(reaction) {
      const reactionId =
        reaction?.reactionId ||
        `${reaction?.userId || "unknown"}-${Date.now()}`;

      // Spread reactions horizontally so a burst of them doesn't stack
      // directly on top of each other.
      const left = 20 + Math.random() * 60;

      setReactions((prev) => [
        ...prev,
        { ...reaction, reactionId, left },
      ]);

      const timeoutId = setTimeout(() => {
        setReactions((prev) =>
          prev.filter((r) => r.reactionId !== reactionId)
        );
        reactionTimeoutsRef.current.delete(reactionId);
      }, REACTION_LIFETIME_MS);

      reactionTimeoutsRef.current.set(reactionId, timeoutId);
    }

    socket.on("connect", onConnect);
    socket.on("room_created", onRoomCreated);
    socket.on("room_joined", onRoomJoined);
    socket.on("create_error", onCreateError);
    socket.on("join_error", onJoinError);
    socket.on("participants_updated", onParticipantsUpdated);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("sync_play", onSyncPlay);
    socket.on("sync_pause", onSyncPause);
    socket.on("sync_seek", onSyncSeek);
    socket.on("sync_video", onSyncVideo);
    socket.on("sync_state", onSyncState);
    socket.on("role_assigned", onRoleAssigned);
    socket.on("host_transferred", onHostTransferred);
    socket.on("participant_removed", onParticipantRemoved);
    socket.on("you_were_removed", onYouWereRemoved);
    socket.on("permission_denied", onPermissionDenied);
    socket.on("control_request", onControlRequest);
    socket.on("request_resolved", onRequestResolved);
    socket.on("request_sent", onRequestSent);
    socket.on("invalid_action", onInvalidAction);
    socket.on("reaction_received", onReactionReceived);

    return () => {
      socket.off("connect", onConnect);
      socket.off("room_created", onRoomCreated);
      socket.off("room_joined", onRoomJoined);
      socket.off("create_error", onCreateError);
      socket.off("join_error", onJoinError);
      socket.off("participants_updated", onParticipantsUpdated);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("sync_play", onSyncPlay);
      socket.off("sync_pause", onSyncPause);
      socket.off("sync_seek", onSyncSeek);
      socket.off("sync_video", onSyncVideo);
      socket.off("sync_state", onSyncState);
      socket.off("role_assigned", onRoleAssigned);
      socket.off("host_transferred", onHostTransferred);
      socket.off("participant_removed", onParticipantRemoved);
      socket.off("you_were_removed", onYouWereRemoved);
      socket.off("permission_denied", onPermissionDenied);
      socket.off("control_request", onControlRequest);
      socket.off("request_resolved", onRequestResolved);
      socket.off("request_sent", onRequestSent);
      socket.off("invalid_action", onInvalidAction);
      socket.off("reaction_received", onReactionReceived);

      reactionTimeoutsRef.current.forEach((timeoutId) =>
        clearTimeout(timeoutId)
      );
      reactionTimeoutsRef.current.clear();
    };
  }, []);

  const clearToast = useCallback(() => setToast(null), []);
  const clearError = useCallback(() => setError(null), []);

  const value = {
    room,
    setRoom,
    selfId,
    error,
    clearError,
    toast,
    clearToast,
    incomingRequests,
    setIncomingRequests,
    reactions,
  };

  return (
    <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}
