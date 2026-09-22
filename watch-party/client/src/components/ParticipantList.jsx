import React from "react";
import { socket } from "../socket";

const ROLE_ICON = {
  Host: "👑",
  Moderator: "🛡️",
  Participant: "👤",
};

export default function ParticipantList({ room, selfId }) {
  const isSelfHost = room.hostId === selfId;

  return (
    <div className="participant-list">
      <h3>Participants</h3>
      <ul>
        {room.participants.map((p) => (
          <li key={p.userId} className="participant-row">
            <div className="participant-info">
              <span className="role-icon">{ROLE_ICON[p.role] || "👤"}</span>
              <span className="username">
                {p.username}
                {p.userId === selfId ? " (you)" : ""}
              </span>
              <span className="role-label">{p.role}</span>
            </div>
            {isSelfHost && p.userId !== selfId && (
              <div className="participant-actions">
                {p.role === "Participant" ? (
                  <button
                    className="link-btn"
                    onClick={() =>
                      socket.emit("assign_role", {
                        userId: p.userId,
                        role: "Moderator",
                      })
                    }
                  >
                    Make Moderator
                  </button>
                ) : (
                  <button
                    className="link-btn"
                    onClick={() =>
                      socket.emit("assign_role", {
                        userId: p.userId,
                        role: "Participant",
                      })
                    }
                  >
                    Revoke Moderator
                  </button>
                )}
                <button
                  className="link-btn danger"
                  onClick={() =>
                    socket.emit("remove_participant", { userId: p.userId })
                  }
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
