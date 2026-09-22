import React, { useState } from "react";
import { socket } from "../socket";

export default function Controls({
  room,
  canControl,
  playerHandle,
  incomingRequests = [],
}) {
  const [requestedAction, setRequestedAction] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = [
    "❤️",
    "👍",
    "😂",
    "🎉",
    "👏",
    "😮",
    "😢",
    "🤔",
    "👎",
  ];

  function currentTime() {
    return (
      playerHandle.current?.getCurrentTime?.() ??
      room.currentTime ??
      0
    );
  }

  /* =========================
     PLAY
  ========================= */

  function handlePlay() {
    const time = currentTime();

    if (canControl) {
      playerHandle.current?.playVideo?.();

      socket.emit("play", {
        currentTime: time,
      });

      return;
    }

    socket.emit("request_control", {
      action: "play",
      payload: {
        currentTime: time,
      },
    });

    setRequestedAction("play");
  }

  /* =========================
     PAUSE
  ========================= */

  function handlePause() {
    const time = currentTime();

    if (canControl) {
      playerHandle.current?.pauseVideo?.();

      socket.emit("pause", {
        currentTime: time,
      });

      return;
    }

    socket.emit("request_control", {
      action: "pause",
      payload: {
        currentTime: time,
      },
    });

    setRequestedAction("pause");
  }

  /* =========================
     EMOJI REACTION
  ========================= */

  function handleReaction(emoji) {
    // The server identifies the sender from their socket/room membership,
    // so we only need to send the emoji itself.
    socket.emit("reaction", { emoji });

    setShowEmojiPicker(false);
  }

  /* =========================
     REQUEST STATUS
  ========================= */

  function requestText() {
    if (!requestedAction) {
      return "";
    }

    const labels = {
      play: "Play requested",
      pause: "Pause requested",
      seek: "Seek requested",
      change_video: "Video change requested",
    };

    return labels[requestedAction] || "Request sent";
  }

  return (
    <div className="room-controls">
      {/* =========================
          MAIN CONTROL BAR
      ========================= */}

      <div className="room-controls-main">

        {/* PLAY */}

        <button
          type="button"
          className="room-control-btn primary"
          onClick={handlePlay}
          title={canControl ? "Play video" : "Request play"}
        >
          <span className="control-icon">▶</span>

          <span>
            {canControl ? "Play" : "Request Play"}
          </span>
        </button>

        {/* PAUSE */}

        <button
          type="button"
          className="room-control-btn primary"
          onClick={handlePause}
          title={canControl ? "Pause video" : "Request pause"}
        >
          <span className="control-icon">Ⅱ</span>

          <span>
            {canControl ? "Pause" : "Request Pause"}
          </span>
        </button>

        {/* CURRENT STATE */}

        <div className="room-play-state">
          <span
            className={
              room.playState === "playing"
                ? "state-dot playing"
                : "state-dot paused"
            }
          />

          <span>
            {room.playState === "playing"
              ? "Playing"
              : "Paused"}
          </span>
        </div>

        {/* SPACER */}

        <div className="controls-spacer" />

        {/* EMOJI */}

        <div className="emoji-control">

          <button
            type="button"
            className="emoji-button"
            onClick={() =>
              setShowEmojiPicker((previous) => !previous)
            }
            title="Send reaction"
          >
            😊
          </button>

          {showEmojiPicker && (
            <div className="emoji-picker">

              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-option"
                  onClick={() =>
                    handleReaction(emoji)
                  }
                >
                  {emoji}
                </button>
              ))}

            </div>
          )}

        </div>
      </div>

      {/* =========================
          PARTICIPANT REQUEST STATUS
      ========================= */}

      {!canControl && requestedAction && (
        <div className="request-status">
          <span>⏳</span>

          <span>
            {requestText()} — waiting for
            Host/Moderator approval.
          </span>
        </div>
      )}

      {/* =========================
          HOST REQUEST SUMMARY
          Detailed requests are shown
          inside the sidebar.
      ========================= */}

      {canControl && incomingRequests.length > 0 && (
        <div className="request-summary">
          <span className="request-summary-icon">
            🔔
          </span>

          <span>
            {incomingRequests.length} pending{" "}
            {incomingRequests.length === 1
              ? "request"
              : "requests"}
          </span>
        </div>
      )}
    </div>
  );
}