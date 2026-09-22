import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { useRoom } from "../context/RoomContext.jsx";

export default function Home() {
  const navigate = useNavigate();
  const { error, clearError } = useRoom();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("watch-party-theme") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("watch-party-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) =>
      current === "dark" ? "light" : "dark"
    );
  }
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [createUsername, setCreateUsername] = useState("");
  const [createVideo, setCreateVideo] = useState("");

  const [joinUsername, setJoinUsername] = useState("");
  const [joinInput, setJoinInput] = useState("");

  function openCreate() {
    clearError();
    setShowJoin(false);
    setShowCreate(true);
  }

  function openJoin() {
    clearError();
    setShowCreate(false);
    setShowJoin(true);
  }

  function closeModals() {
    setShowCreate(false);
    setShowJoin(false);
    clearError();
  }

  function handleCreate(e) {
    e.preventDefault();

    clearError();

    const username = createUsername.trim();

    if (!username) {
      return;
    }

    socket.emit("create_room", {
      username,
      videoId: createVideo.trim(),
    });

    setShowCreate(false);
  }

  function extractRoomId(value) {
    const input = value.trim();

    if (!input) {
      return "";
    }

    /*
     * Direct room code:
     * ABC123
     */
    if (
      /^[A-Za-z0-9]{4,12}$/.test(input)
    ) {
      return input.toUpperCase();
    }

    /*
     * Full application room link:
     * http://localhost:5173/room/ABC123
     */
    try {
      const url = new URL(input);

      const parts = url.pathname
        .split("/")
        .filter(Boolean);

      const roomIndex =
        parts.findIndex(
          (part) =>
            part.toLowerCase() === "room"
        );

      if (
        roomIndex !== -1 &&
        parts[roomIndex + 1]
      ) {
        return parts[
          roomIndex + 1
        ].toUpperCase();
      }
    } catch {
      // Not a URL. Continue below.
    }

    /*
     * Sometimes user may paste only:
     * /room/ABC123
     */
    const match = input.match(
      /\/room\/([A-Za-z0-9_-]+)/i
    );

    if (match) {
      return match[1].toUpperCase();
    }

    return "";
  }

  function handleJoin(e) {
    e.preventDefault();

    clearError();

    const username =
      joinUsername.trim();

    const roomId =
      extractRoomId(joinInput);

    if (!username || !roomId) {
      return;
    }

    /*
     * Keep the existing Socket.IO workflow.
     */
    socket.emit("join_room", {
      username,
      roomId,
    });

    /*
     * Also navigate directly to the room.
     * RoomContext will receive the server response.
     */
    navigate(`/room/${roomId}`);

    setShowJoin(false);
  }

  function handleQuickJoin(e) {
    e.preventDefault();

    const roomId =
      extractRoomId(joinInput);

    if (!roomId) {
      return;
    }

    setShowJoin(true);
  }

  return (
    <div className={`meet-home ${theme}-theme`}>

      {/* =====================================
          TOP NAVIGATION
      ====================================== */}

      <header className="meet-header">

        {/* Brand */}

        <div className="meet-brand">
          <div className="brand-icon">
            🎬
          </div>

          <span className="brand-name">
            Watch Party
          </span>
        </div>


        {/* Join bar */}

        <div className="meet-join-bar">

          <span className="join-icon">
            ⌨
          </span>

          <input
            type="text"
            value={joinInput}
            onChange={(e) =>
              setJoinInput(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleQuickJoin(e);
              }
            }}
            placeholder="Enter a code or link"
          />

          <button
            className={`top-join-btn ${joinInput.trim()
                ? "active"
                : ""
              }`}
            type="button"
            onClick={openJoin}
            disabled={!joinInput.trim()}
          >
            Join
          </button>

        </div>


        {/* New button */}

        <button
          className="new-room-btn"
          type="button"
          onClick={openCreate}
        >
          <span>＋</span>
          New
        </button>


      <button
  className="theme-toggle"
  type="button"
  onClick={toggleTheme}
  aria-label={`Switch to ${
    theme === "dark" ? "light" : "dark"
  } theme`}
>
  <span className="theme-icon">
    {theme === "dark" ? "☀️" : "🌙"}
  </span>

  <span className="toggle-track">
    <span className="toggle-thumb" />
  </span>
</button>
      </header>


      {/* =====================================
          MAIN CONTENT
      ====================================== */}

      <main className="meet-content">

        {/* Sidebar */}

        <aside className="meet-sidebar">

          <button
            className="sidebar-item active"
            type="button"
          >
            <span className="sidebar-icon">
              🏠
            </span>

            <span>
              Home
            </span>
          </button>

          <button
            className="sidebar-item"
            type="button"
            onClick={openCreate}
          >
            <span className="sidebar-icon">
              🎬
            </span>

            <span>
              New Party
            </span>
          </button>

        </aside>


        {/* Main hero */}

        <section className="meet-main">

          <div className="hero-content">

            <div className="hero-illustration">

              <div className="screen-shape">
                ▶
              </div>

              <div className="floating-circle circle-one" />
              <div className="floating-circle circle-two" />

              <div className="film-strip">
                🎞️
              </div>

            </div>


            <h1>
              Watch together.
              <br />
              Stay in sync.
            </h1>

            <p>
              Create a Watch Party and enjoy
              YouTube videos together with your
              friends in real time.
            </p>


            <button
              className="hero-new-btn"
              type="button"
              onClick={openCreate}
            >
              <span>＋</span>
              New Watch Party
            </button>

          </div>

        </section>

      </main>


      {/* =====================================
          ERROR
      ====================================== */}

      {error && (
        <div className="home-error">
          <span>⚠️</span>

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={clearError}
          >
            Dismiss
          </button>
        </div>
      )}


      {/* =====================================
          CREATE PARTY MODAL
      ====================================== */}

      {showCreate && (
        <div
          className="modal-overlay"
          onMouseDown={closeModals}
        >

          <div
            className="party-modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="modal-close"
              type="button"
              onClick={closeModals}
            >
              ×
            </button>


            <div className="modal-icon">
              🎬
            </div>

            <h2>
              Create a Watch Party
            </h2>

            <p className="modal-subtitle">
              Start watching together in
              real time.
            </p>


            <form onSubmit={handleCreate}>

              <label>
                Your name

                <input
                  value={createUsername}
                  onChange={(e) =>
                    setCreateUsername(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Rohan"
                  autoFocus
                  required
                />
              </label>


              <label>
                YouTube video

                <span className="field-hint">
                  Optional — you can add one
                  later.
                </span>

                <input
                  value={createVideo}
                  onChange={(e) =>
                    setCreateVideo(
                      e.target.value
                    )
                  }
                  placeholder="Paste a YouTube link"
                />
              </label>


              <button
                className="modal-primary-btn"
                type="submit"
              >
                Create Party
              </button>

            </form>

          </div>

        </div>
      )}


      {/* =====================================
          JOIN PARTY MODAL
      ====================================== */}

      {showJoin && (
        <div
          className="modal-overlay"
          onMouseDown={closeModals}
        >

          <div
            className="party-modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="modal-close"
              type="button"
              onClick={closeModals}
            >
              ×
            </button>


            <div className="modal-icon">
              🔗
            </div>

            <h2>
              Join a Watch Party
            </h2>

            <p className="modal-subtitle">
              Enter the room code or invitation
              link you received.
            </p>


            <form onSubmit={handleJoin}>

              <label>
                Your name

                <input
                  value={joinUsername}
                  onChange={(e) =>
                    setJoinUsername(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Aman"
                  autoFocus
                  required
                />
              </label>


              <label>
                Room code or link

                <input
                  value={joinInput}
                  onChange={(e) =>
                    setJoinInput(
                      e.target.value
                    )
                  }
                  placeholder="ABC123 or room link"
                  required
                />
              </label>


              <button
                className="modal-primary-btn"
                type="submit"
              >
                Join Party
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}