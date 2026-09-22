import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { socket } from "../socket";
import { useRoom } from "../context/RoomContext.jsx";

import VideoPlayer from "../components/VideoPlayer.jsx";
import ParticipantList from "../components/ParticipantList.jsx";
import Controls from "../components/Controls.jsx";

export default function WatchRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const {
    room,
    setRoom,
    selfId,
    incomingRequests,
    error,
    clearError,
    reactions,
  } = useRoom();

  const playerHandleRef = useRef(null);

  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");
  const [videoError, setVideoError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("watch-party-theme") || "dark";
  });

  const [videoInput, setVideoInput] = useState("");
  const [seekInput, setSeekInput] = useState("");

  /* =========================================================
     THEME
     ========================================================= */

  useEffect(() => {
    localStorage.setItem("watch-party-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) =>
      current === "dark" ? "light" : "dark"
    );
  }

  /* =========================================================
     SERVER → PLAYER SYNC
     ========================================================= */

  useEffect(() => {
    if (!room || !playerHandleRef.current) {
      return;
    }

    if (room.playState === "playing") {
      playerHandleRef.current.applyPlay?.(
        room.currentTime
      );
    } else {
      playerHandleRef.current.applyPause?.(
        room.currentTime
      );
    }
  }, [
    room?.playState,
    room?.currentTime,
  ]);

  /* =========================================================
     CLEAR VIDEO ERROR WHEN VIDEO CHANGES
     ========================================================= */

  useEffect(() => {
    setVideoError("");
  }, [room?.videoId]);

  /* =========================================================
     JOIN ROOM FROM LINK
     ========================================================= */

  function handleJoinFromLink(e) {
    e.preventDefault();

    const name = username.trim();

    if (!name) {
      return;
    }

    socket.emit("join_room", {
      roomId: roomId.toUpperCase(),
      username: name,
    });
  }

  /* =========================================================
     JOIN SCREEN
     ========================================================= */

  if (!room) {
    return (
      <div className="join-page">

        {/* =========================
            NAVBAR
        ========================== */}

        <header className="join-navbar">

          <div className="join-brand">
            <div className="join-brand-icon">
              🎬
            </div>

            <span>Watch Party</span>
          </div>

          <div className="join-nav-center">

            <div className="join-nav-search">
              <span>⌨</span>
              <span>Enter a code or link</span>
            </div>

            <button
              type="button"
              className="join-nav-join"
              disabled
            >
              Join
            </button>

            <button
              type="button"
              className="join-nav-new"
              onClick={() => navigate("/")}
            >
              <span>＋</span>
              New
            </button>

            <button
              type="button"
              className="join-theme-button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <span>
                {theme === "dark" ? "☀️" : "🌙"}
              </span>

              <span className="join-theme-toggle">
                <span
                  className={
                    theme === "light"
                      ? "theme-thumb-light"
                      : ""
                  }
                />
              </span>
            </button>

          </div>
        </header>


        {/* =========================
            MAIN JOIN CONTENT
        ========================== */}

        <main
          className={`join-content ${
            theme === "light"
              ? "join-light"
              : "join-dark"
          }`}
        >

          <div className="join-hero">

            {/* Decorative visual */}

            <div className="join-visual">

              <div className="join-video-card">
                <span>▶</span>
              </div>

              <div className="join-circle join-circle-yellow" />

              <div className="join-circle join-circle-pink" />

              <span className="join-film">
                🎞️
              </span>

            </div>


            <h1>
              Join Watch Party
            </h1>

            <p className="join-description">
              You've been invited to watch together
              in real time.
            </p>


            {/* ROOM */}

            <div className="join-room-badge">
              <span>Room</span>

              <strong>
                {roomId.toUpperCase()}
              </strong>
            </div>


            {/* =========================
                JOIN CARD
            ========================== */}

            <form
              className="join-card"
              onSubmit={handleJoinFromLink}
            >

              <div className="join-card-header">

                <div className="join-card-icon">
                  👋
                </div>

                <div>
                  <h2>
                    Enter your name
                  </h2>

                  <p>
                    Your name will be visible
                    to everyone in the room.
                  </p>
                </div>

              </div>


              {/* ERROR */}

              {error && (
                <div className="join-error">

                  <span>⚠️</span>

                  <span>
                    {error}
                  </span>

                  <button
                    type="button"
                    onClick={clearError}
                    aria-label="Dismiss error"
                  >
                    ×
                  </button>

                </div>
              )}


              {/* NAME */}

              <label className="join-input-label">
                Your name

                <div className="join-input-wrapper">

                  <span>👤</span>

                  <input
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value)
                    }
                    placeholder="e.g. Rohan"
                    autoFocus
                    required
                    maxLength={30}
                  />

                </div>
              </label>


              {/* JOIN */}

              <button
                type="submit"
                className="join-submit"
              >
                <span>
                  Join Watch Party
                </span>

                <span>
                  →
                </span>
              </button>


              {/* BACK */}

              <button
                type="button"
                className="join-back"
                onClick={() => navigate("/")}
              >
                ← Back to Home
              </button>

            </form>


            <p className="join-footer-text">
              🎬 Watch together. Stay in sync.
            </p>

          </div>

        </main>

      </div>
    );
  }

  /* =========================================================
     CURRENT USER ROLE
     ========================================================= */

  const selfParticipant =
    room.participants?.find(
      (participant) =>
        participant.userId === selfId
    );

  const selfRole =
    selfParticipant?.role || "Participant";

  const canControl =
    selfRole === "Host" ||
    selfRole === "Moderator";


  /* =========================================================
     LEAVE ROOM
     ========================================================= */

  function handleLeave() {
    socket.emit("leave_room");

    // Clear local room state immediately. Without this, revisiting this
    // room's URL later (back button, bookmark, a link left open in
    // another tab) would render the stale room UI instead of the join
    // screen, even though the server has already dropped this socket
    // from the room - every control button on that stale page would
    // then silently no-op.
    setRoom(null);

    navigate("/");
  }


  /* =========================================================
     COPY ROOM LINK
     ========================================================= */

  async function handleCopyLink() {
    const link =
      `${window.location.origin}/room/${room.roomId}`;

    try {
      await navigator.clipboard.writeText(link);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);

    } catch (copyError) {
      console.error(
        "Could not copy room link:",
        copyError
      );

      setCopied(false);
    }
  }


  /* =========================================================
     YOUTUBE PLAYER ERROR
     ========================================================= */

  function handlePlayerError(playerError) {
    console.error(
      "YouTube player error:",
      playerError
    );

    setVideoError(
      playerError?.message ||
        "This YouTube video cannot be played here."
    );
  }


  /* =========================================================
     CHANGE VIDEO
     ========================================================= */

  function handleChangeVideo(e) {
    e.preventDefault();

    const value = videoInput.trim();

    if (!value) {
      return;
    }

    if (canControl) {

      socket.emit("change_video", {
        videoId: value,
      });

    } else {

      socket.emit("request_control", {
        action: "change_video",

        payload: {
          videoId: value,
        },
      });

    }

    setVideoInput("");
  }


  /* =========================================================
     SEEK
     ========================================================= */

  function handleSeek(e) {
    e.preventDefault();

    const time = Number(seekInput);

    if (
      !Number.isFinite(time) ||
      time < 0
    ) {
      return;
    }

    if (canControl) {

      playerHandleRef.current?.seekTo?.(
        time
      );

      socket.emit("seek", {
        time,
      });

    } else {

      socket.emit("request_control", {
        action: "seek",

        payload: {
          time,
        },
      });

    }

    setSeekInput("");
  }


  /* =========================================================
     APPROVE REQUEST
     ========================================================= */

  function handleApproveRequest(requestId) {
    socket.emit("approve_request", {
      requestId,
    });
  }


  /* =========================================================
     REJECT REQUEST
     ========================================================= */

  function handleRejectRequest(requestId) {
    socket.emit("reject_request", {
      requestId,
    });
  }


  /* =========================================================
     RENDER WATCH ROOM
     ========================================================= */

  return (
    <div
      className={`watch-room-page ${
        theme === "light"
          ? "watch-light"
          : "watch-dark"
      }`}
    >
{/* =====================================================
    TOP NAVBAR
====================================================== */}

<header className="room-navbar">

  {/* BRAND */}
  <div className="room-brand">
    <div className="room-brand-icon">
      🎬
    </div>

    <span>Watch Party</span>
  </div>


  {/* CENTER VIDEO CONTROLS */}
  <div className="room-video-tools">

    {/* CHANGE VIDEO */}
    <form
      className="room-video-form"
      onSubmit={handleChangeVideo}
    >
      <input
        className="room-video-input"
        type="text"
        value={videoInput}
        onChange={(e) => setVideoInput(e.target.value)}
        placeholder="YouTube URL or video ID"
        aria-label="YouTube URL or video ID"
      />

      <button
        className="room-change-video-btn"
        type="submit"
      >
        {canControl ? "Change" : "Request"}
      </button>
    </form>


    {/* SEEK */}
    <form
      className="navbar-seek"
      onSubmit={handleSeek}
    >
      <input
        type="number"
        min="0"
        step="0.1"
        value={seekInput}
        onChange={(e) => setSeekInput(e.target.value)}
        placeholder="sec"
        aria-label="Seek seconds"
      />

      <button type="submit">
        Seek
      </button>
    </form>

  </div>


  {/* RIGHT SIDE ACTIONS */}
  <div className="room-navbar-actions">

    {/* ROOM CODE */}
    <div className="room-code">
      <span>Room:</span>
      <strong>{room.roomId}</strong>
    </div>


    {/* COPY */}
    <button
      className="navbar-copy-btn"
      type="button"
      onClick={handleCopyLink}
    >
      {copied ? "Copied!" : "Copy"}
    </button>


    {/* LEAVE */}
    <button
      className="navbar-leave-btn"
      type="button"
      onClick={handleLeave}
    >
      Leave
    </button>


    {/* THEME */}
    <button
      className="room-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <span className="theme-icon">
        {theme === "dark" ? "☀️" : "🌙"}
      </span>

      <span className="room-toggle-track">
        <span
          className={`room-toggle-thumb ${
            theme === "light"
              ? "toggle-thumb-light"
              : ""
          }`}
        />
      </span>
    </button>

  </div>

</header>
     


      {/* =====================================================
          MAIN LAYOUT
      ====================================================== */}

      <div
        className={`room-layout ${
          sidebarOpen
            ? "sidebar-visible"
            : "sidebar-hidden"
        }`}
      >

        {/* ===================================================
            LEFT SIDEBAR
        ==================================================== */}

        <aside className="room-sidebar">

          {/* SIDEBAR HEADER */}

          <div className="sidebar-top">

            <button
              className="sidebar-close-btn"
              type="button"
              onClick={() =>
                setSidebarOpen(false)
              }
              aria-label="Close sidebar"
            >
              ☰
            </button>

            <div className="sidebar-title">
              Watch Party
            </div>

          </div>


          {/* PARTICIPANTS */}

          <section className="sidebar-section">

            <div className="sidebar-section-title">

              <span>
                👥 Participants
              </span>

              <span className="sidebar-count">
                {room.participants?.length || 0}
              </span>

            </div>


            <ParticipantList
              room={room}
              selfId={selfId}
            />

          </section>


          {/* REQUESTS */}

          {canControl && (
            <section className="sidebar-section">

              <div className="sidebar-section-title">

                <span>
                  🔔 Requests
                </span>

                {incomingRequests?.length > 0 && (
                  <span className="request-badge">
                    {incomingRequests.length}
                  </span>
                )}

              </div>


              {incomingRequests?.length === 0 ? (

                <div className="empty-sidebar">
                  No pending requests
                </div>

              ) : (

                <div className="sidebar-request-list">

                  {incomingRequests.map(
                    (request, index) => (

                      <div
                        className="sidebar-request"
                        key={
                          request.requestId ||
                          index
                        }
                      >

                        <div className="sidebar-request-info">

                          <strong>
                            {request.username ||
                              "Participant"}
                          </strong>

                          <span>
                            wants to{" "}
                            {request.action?.replace(
                              "_",
                              " "
                            )}

                            {request.action ===
                              "seek" &&
                              ` to ${
                                request.payload?.time ??
                                0
                              }s`}
                          </span>

                        </div>


                        <div className="sidebar-request-actions">

                          <button
                            type="button"
                            className="request-approve"
                            onClick={() =>
                              handleApproveRequest(
                                request.requestId
                              )
                            }
                          >
                            ✓
                          </button>

                          <button
                            type="button"
                            className="request-reject"
                            onClick={() =>
                              handleRejectRequest(
                                request.requestId
                              )
                            }
                          >
                            ×
                          </button>

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </section>
          )}


          {/* ROOM INFO */}

          <section className="sidebar-section room-info-section">

            <div className="sidebar-section-title">
              📋 Room
            </div>


            <div className="room-info-item">

              <span>
                Status
              </span>

              <strong>
                {room.playState === "playing"
                  ? "Playing"
                  : "Paused"}
              </strong>

            </div>


            <div className="room-info-item">

              <span>
                Your role
              </span>

              <strong>
                {selfRole}
              </strong>

            </div>

          </section>

        </aside>


        {/* ===================================================
            SIDEBAR OPEN BUTTON
        ==================================================== */}

        {!sidebarOpen && (
          <button
            className="sidebar-open-btn"
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open sidebar"
          >
            ☰
          </button>
        )}


        {/* ===================================================
            MAIN CONTENT
        ==================================================== */}

        <main className="room-main">

          {/* VIDEO */}

          <div className="room-video-container">

            <VideoPlayer
              videoId={room.videoId}
              canControl={canControl}
              playerRef={playerHandleRef}
              onPlayerError={handlePlayerError}

              onLocalPlay={(time) => {
                socket.emit("play", {
                  currentTime: time,
                });
              }}

              onLocalPause={(time) => {
                socket.emit("pause", {
                  currentTime: time,
                });
              }}

              onLocalSeek={(time) => {
                socket.emit("seek", {
                  time,
                });
              }}
            />

            {reactions.length > 0 && (
              <div className="reaction-overlay" aria-hidden="true">
                {reactions.map((r) => (
                  <span
                    key={r.reactionId}
                    className="floating-reaction"
                    style={{ left: `${r.left}%` }}
                  >
                    {r.emoji}
                  </span>
                ))}
              </div>
            )}

          </div>


          {/* VIDEO ERROR */}

          {videoError && (
            <div className="room-video-error">

              <strong>
                ⚠️ YouTube playback error
              </strong>

              <span>
                {videoError}
              </span>

              <button
                type="button"
                onClick={() =>
                  setVideoError("")
                }
              >
                Dismiss
              </button>

            </div>
          )}


          {/* =================================================
              BOTTOM CONTROLS
          ================================================== */}

          <div className="room-bottom-bar">

            <Controls
              room={room}
              canControl={canControl}
              playerHandle={playerHandleRef}
              incomingRequests={
                canControl
                  ? incomingRequests
                  : []
              }
            />

          </div>

        </main>

      </div>

    </div>
  );
}