# YouTube Watch Party

A real-time YouTube Watch Party built with React + Vite, Node.js + Express, Socket.IO, and the YouTube IFrame Player API.

## Features implemented

### Rooms
- Create a room with a unique 6-character room code.
- Creator automatically becomes **Host**.
- Join using a room code.
- Share a full `/room/:roomId` invite link.
- A user opening an invite link can enter a username and join directly.
- New users receive the current video, play state, and current playback position.

### Real-time synchronization
- WebSocket communication through Socket.IO.
- Play synchronization.
- Pause synchronization.
- Seek synchronization.
- YouTube video-change synchronization.
- Late-join state synchronization.
- Server tracks playback time while a room is playing.

### Role-based access control
- **Host:** full control, assign/revoke Moderator, remove participants.
- **Moderator:** play, pause, seek, and change video.
- **Participant:** watch only.
- Backend validates every protected playback and management action.
- UI exposes participant actions as approval requests instead of directly changing room state.

### Participant approval workflow
A Participant can request:
- Play
- Pause
- Seek
- Change video

A Host or Moderator receives the request and can:
- Approve
- Reject

The backend executes an approved action and broadcasts the resulting state to the room.

### Participant management
- Live participant list.
- Role display.
- Promote Participant to Moderator.
- Revoke Moderator.
- Remove participant.
- Optional host transfer is implemented when the current Host leaves.

## Project structure

```text
watch-party/
├── server/
│   ├── index.js
│   ├── rooms.js
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Controls.jsx
│   │   │   ├── ParticipantList.jsx
│   │   │   └── VideoPlayer.jsx
│   │   ├── context/
│   │   │   └── RoomContext.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── WatchRoom.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── socket.js
│   │   └── styles.css
│   └── package.json
│
└── README.md
```

## Run locally

### Backend

```bash
cd server
npm install
npm start
```

Backend:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/health
```

### Frontend

Create `client/.env`:

```env
VITE_SERVER_URL=http://localhost:4000
```

Then:

```bash
cd client
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Testing workflow

Use two browser windows/incognito windows.

1. User A creates a room.
2. Copy the generated invite link.
3. User B opens the link and joins.
4. Confirm both users appear in the participant list.
5. Host plays and pauses the video.
6. Confirm the second user follows.
7. Host seeks to another position.
8. Confirm the second user follows.
9. Host changes the YouTube video.
10. Confirm both clients load the new video.
11. Host promotes User B to Moderator.
12. Confirm User B can control playback.
13. Host demotes User B back to Participant.
14. Confirm User B's playback actions become approval requests.
15. Host approves/rejects a request.
16. Host removes a participant.
17. Open the room invite link in another browser and confirm direct joining works.
18. Test the `/health` endpoint before deployment.

## Environment variables

### Server

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

### Client

```env
VITE_SERVER_URL=http://localhost:4000
```

## Deployment

The assignment requires a publicly accessible production URL.

Recommended deployment model:

```text
React/Vite client
       |
       | HTTPS / Socket.IO
       v
Node/Express + Socket.IO server
```

Set the production values:

```env
# server
CLIENT_ORIGIN=https://YOUR-FRONTEND-DOMAIN

# client
VITE_SERVER_URL=https://YOUR-BACKEND-DOMAIN
```

After deployment, put the live frontend URL here:

```text
Live URL: https://YOUR-FRONTEND-DOMAIN
```

## Architecture

```text
Browser
  |
  | Socket.IO / WebSocket
  v
Node.js + Express
  |
  +-- Room manager
  |
  +-- RBAC validation
  |
  +-- Playback state
  |
  +-- Participant requests
  |
  v
Socket.IO broadcasts
  |
  +---- Host
  +---- Moderator
  +---- Participant
```

The backend is the source of truth for room state and permissions. The frontend controls the YouTube IFrame Player, while Socket.IO distributes approved state changes to every connected client.

## Current storage model

Room state is stored in memory. Restarting the server clears all rooms. A persistent database is not required for the MVP, but PostgreSQL/SQLite could be added later for persistent rooms.

## Known production consideration

Modern browsers can restrict autoplay initiated by a remote WebSocket event until the user has interacted with the page/player. For a production-grade watch party, this should be handled with an explicit "Enable synchronized playback" user gesture and/or a controlled autoplay strategy.
