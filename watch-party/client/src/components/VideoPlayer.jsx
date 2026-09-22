import React, { useEffect, useRef } from "react";

let apiPromise = null;

function loadYouTubeApi() {
  // API already loaded
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  // API is currently loading
  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise((resolve) => {
    const previousReady =
      window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") {
        previousReady();
      }

      resolve(window.YT);
    };

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");

      script.src =
        "https://www.youtube.com/iframe_api";

      script.async = true;

      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

export default function VideoPlayer({
  videoId,
  canControl,
  onLocalPlay,
  onLocalPause,
  onLocalSeek,
  onPlayerError,
  playerRef,
}) {
  const containerRef = useRef(null);

  const playerRefInternal = useRef(null);

  const playerReadyRef = useRef(false);

  const currentVideoRef = useRef(null);

  const canControlRef = useRef(canControl);

  const callbacksRef = useRef({
    onLocalPlay,
    onLocalPause,
    onLocalSeek,
    onPlayerError,
  });

  const suppressUntilRef = useRef(0);

  const lastTimeRef = useRef(null);

  const lastCheckRef = useRef(Date.now());


  /*
   * Keep latest permission state.
   */
  useEffect(() => {
    canControlRef.current = canControl;
  }, [canControl]);


  /*
   * Keep latest callbacks.
   */
  useEffect(() => {
    callbacksRef.current = {
      onLocalPlay,
      onLocalPause,
      onLocalSeek,
      onPlayerError,
    };
  }, [
    onLocalPlay,
    onLocalPause,
    onLocalSeek,
    onPlayerError,
  ]);


  /*
   * Create YouTube player ONLY ONCE.
   */
  useEffect(() => {
    let cancelled = false;
    let seekTimer = null;
    let playerElement = null;

    loadYouTubeApi().then((YT) => {
      if (
        cancelled ||
        !containerRef.current
      ) {
        return;
      }


      /*
       * Prevent duplicate player creation.
       */
      if (playerRefInternal.current) {
        return;
      }


      /*
       * YouTube replaces the target element with
       * an iframe, so create a fresh child element.
       */
      playerElement = document.createElement("div");

      containerRef.current.appendChild(
        playerElement
      );


      /*
       * Create YouTube player.
       */
      const player = new YT.Player(
        playerElement,
        {
          /*
           * IMPORTANT:
           *
           * Host / Moderator:
           * controls = 1
           *
           * Participant:
           * controls = 0
           *
           * disablekb also prevents keyboard
           * shortcuts for participants.
           */
          playerVars: {
            autoplay: 0,

            controls:
              canControlRef.current ? 1 : 0,

            disablekb:
              canControlRef.current ? 0 : 1,

            rel: 0,

            playsinline: 1,

            enablejsapi: 1,

            origin: window.location.origin,
          },


          /*
           * YouTube events.
           */
          events: {

            /*
             * PLAYER READY
             */
            onReady: () => {
              console.log(
                "✅ YouTube player ready"
              );

              playerReadyRef.current = true;


              /*
               * Load initial video.
               */
              if (videoId) {
                console.log(
                  "Loading initial video:",
                  videoId
                );

                currentVideoRef.current =
                  videoId;

                player.cueVideoById(videoId);
              }


              lastTimeRef.current =
                player.getCurrentTime?.() || 0;

              lastCheckRef.current =
                Date.now();
            },


            /*
             * YOUTUBE ERROR
             */
            onError: (event) => {
              console.error(
                "❌ YouTube Player Error:",
                event.data
              );

              const messages = {
                2:
                  "Invalid YouTube video ID.",

                5:
                  "YouTube could not load this video in the HTML5 player. Try another public YouTube video.",

                100:
                  "This video is unavailable or has been removed.",

                101:
                  "This video does not allow embedding.",

                150:
                  "This video does not allow embedding.",

                153:
                  "YouTube could not verify the request origin.",
              };

              const message =
                messages[event.data] ||
                "YouTube could not play this video.";

              callbacksRef.current.onPlayerError?.({
                code: event.data,
                message,
              });
            },


            /*
             * PLAYER STATE CHANGE
             */
            onStateChange: (event) => {
              const now = Date.now();


              /*
               * Ignore state changes generated
               * by our own remote synchronization.
               */
              if (
                now <
                suppressUntilRef.current
              ) {
                lastTimeRef.current =
                  player.getCurrentTime?.() || 0;

                lastCheckRef.current = now;

                return;
              }


              /*
               * PARTICIPANTS CANNOT GENERATE
               * LOCAL PLAYBACK EVENTS.
               */
              if (!canControlRef.current) {
                return;
              }


              const currentTime =
                player.getCurrentTime?.() || 0;


              /*
               * PLAY
               */
              if (
                event.data ===
                YT.PlayerState.PLAYING
              ) {
                lastTimeRef.current =
                  currentTime;

                lastCheckRef.current =
                  now;

                callbacksRef.current.onLocalPlay?.(
                  currentTime
                );
              }


              /*
               * PAUSE
               */
              if (
                event.data ===
                YT.PlayerState.PAUSED
              ) {
                lastTimeRef.current =
                  currentTime;

                lastCheckRef.current =
                  now;

                callbacksRef.current.onLocalPause?.(
                  currentTime
                );
              }
            },
          },
        }
      );


      playerRefInternal.current = player;


      /*
       * Detect manual seeking.
       *
       * Only Host / Moderator are allowed
       * to generate local seek events.
       */
      seekTimer = setInterval(() => {
        const currentPlayer =
          playerRefInternal.current;

        if (!currentPlayer) {
          return;
        }

        if (!playerReadyRef.current) {
          return;
        }

        /*
         * Participants cannot generate
         * local seek events.
         */
        if (!canControlRef.current) {
          return;
        }


        const now = Date.now();

        const current =
          currentPlayer.getCurrentTime?.() || 0;


        /*
         * First measurement.
         */
        if (lastTimeRef.current == null) {
          lastTimeRef.current = current;

          lastCheckRef.current = now;

          return;
        }


        const elapsed =
          (now - lastCheckRef.current) /
          1000;


        const state =
          currentPlayer.getPlayerState?.();


        const expected =
          state === YT.PlayerState.PLAYING
            ? lastTimeRef.current +
              elapsed
            : lastTimeRef.current;


        const jump =
          Math.abs(current - expected);


        /*
         * Detect manual seek.
         */
        if (
          jump > 1 &&
          now >=
            suppressUntilRef.current
        ) {
          callbacksRef.current.onLocalSeek?.(
            current
          );
        }


        lastTimeRef.current = current;

        lastCheckRef.current = now;
      }, 350);
    });


    /*
     * Cleanup.
     */
    return () => {
      cancelled = true;


      if (seekTimer) {
        clearInterval(seekTimer);
      }


      playerReadyRef.current = false;

      currentVideoRef.current = null;


      playerRefInternal.current?.destroy?.();

      playerRefInternal.current = null;


      /*
       * Remove scratch element if necessary.
       */
      if (
        playerElement &&
        playerElement.parentNode
      ) {
        playerElement.parentNode.removeChild(
          playerElement
        );
      }


      if (playerRef) {
        playerRef.current = null;
      }
    };
  }, []);


  /*
   * Load / change video.
   */
  useEffect(() => {
    const player =
      playerRefInternal.current;

    if (
      !player ||
      !playerReadyRef.current ||
      !videoId
    ) {
      return;
    }


    /*
     * Don't reload same video.
     */
    if (
      currentVideoRef.current === videoId
    ) {
      return;
    }


    console.log(
      "Changing video to:",
      videoId
    );


    currentVideoRef.current = videoId;


    suppressUntilRef.current =
      Date.now() + 1200;


    lastTimeRef.current = 0;

    lastCheckRef.current =
      Date.now();


    /*
     * cueVideoById does NOT autoplay.
     *
     * Server controls play state.
     */
    player.cueVideoById(videoId);
  }, [videoId]);


  /*
   * Expose player methods to WatchRoom
   * and Controls.
   */
  useEffect(() => {
    if (!playerRef) {
      return;
    }


    playerRef.current = {

      /*
       * Local play.
       */
      playVideo: () => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          return false;
        }

        /*
         * Only Host / Moderator.
         */
        if (!canControlRef.current) {
          return false;
        }

        player.playVideo();

        return true;
      },


      /*
       * Local pause.
       */
      pauseVideo: () => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          return false;
        }

        /*
         * Only Host / Moderator.
         */
        if (!canControlRef.current) {
          return false;
        }

        player.pauseVideo();

        return true;
      },


      /*
       * Remote PLAY.
       *
       * This MUST work for participants
       * because it comes from the server.
       */
      applyPlay: (time) => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          return false;
        }


        suppressUntilRef.current =
          Date.now() + 1500;


        if (
          typeof time === "number"
        ) {
          player.seekTo(
            Math.max(0, time),
            true
          );

          lastTimeRef.current =
            Math.max(0, time);

          lastCheckRef.current =
            Date.now();
        }


        player.playVideo();

        return true;
      },


      /*
       * Remote PAUSE.
       *
       * This MUST work for participants.
       */
      applyPause: (time) => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          return false;
        }


        suppressUntilRef.current =
          Date.now() + 1500;


        if (
          typeof time === "number"
        ) {
          player.seekTo(
            Math.max(0, time),
            true
          );

          lastTimeRef.current =
            Math.max(0, time);

          lastCheckRef.current =
            Date.now();
        }


        player.pauseVideo();

        return true;
      },


      /*
       * Remote SEEK.
       *
       * This MUST work for participants.
       */
      applySeek: (time) => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          return false;
        }


        const target = Math.max(
          0,
          Number(time) || 0
        );


        suppressUntilRef.current =
          Date.now() + 1000;


        player.seekTo(
          target,
          true
        );


        lastTimeRef.current =
          target;

        lastCheckRef.current =
          Date.now();


        return true;
      },


      /*
       * Direct seek.
       */
      seekTo: (time) => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current
        ) {
          return false;
        }


        /*
         * Prevent participants from
         * directly controlling the player.
         */
        if (!canControlRef.current) {
          return false;
        }


        const target = Math.max(
          0,
          Number(time) || 0
        );


        suppressUntilRef.current =
          Date.now() + 1000;


        player.seekTo(
          target,
          true
        );


        lastTimeRef.current =
          target;

        lastCheckRef.current =
          Date.now();


        return true;
      },


      /*
       * Get current playback position.
       */
      getCurrentTime: () => {
        return (
          playerRefInternal.current
            ?.getCurrentTime?.() || 0
        );
      },


      /*
       * Load a video programmatically.
       */
      loadVideo: (id) => {
        const player =
          playerRefInternal.current;

        if (
          !player ||
          !playerReadyRef.current ||
          !id
        ) {
          return false;
        }


        /*
         * Only Host / Moderator.
         */
        if (!canControlRef.current) {
          return false;
        }


        currentVideoRef.current = id;


        suppressUntilRef.current =
          Date.now() + 1200;


        lastTimeRef.current = 0;

        lastCheckRef.current =
          Date.now();


        player.cueVideoById(id);

        return true;
      },
    };
  }, [playerRef]);


  /*
   * UI
   */
  return (
    <div
      className="video-wrapper"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >

      {/* YouTube Player */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />


      {/*
       * IMPORTANT:
       *
       * For participants we put an invisible
       * layer above the YouTube iframe.
       *
       * This prevents:
       *
       * - mouse click play/pause
       * - seeking
       * - YouTube UI interaction
       * - fullscreen button
       * - other iframe interactions
       *
       * Host / Moderator do NOT get this layer.
       */}
      {!canControl && videoId && (
        <div
          className="participant-video-lock"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            cursor: "default",
            background: "transparent",
          }}
        />
      )}


      {!videoId && (
        <div className="video-placeholder">
          No video loaded yet
          {canControl
            ? " - paste a YouTube link below."
            : "."}
        </div>
      )}

    </div>
  );
}