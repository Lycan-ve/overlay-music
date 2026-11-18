(() => {
  const SOURCE = location.hostname === "music.youtube.com" ? "youtube_music" : "youtube";
  const MESSAGE_TYPE = "OVERLAY_MUSIC_STATE";
  const POLL_INTERVAL_MS = 1000;
  const MIN_SEND_INTERVAL_MS = 1200;

  function readText(...selectors) {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.textContent?.replace(/\\s+/g, " ").trim();
      if (value) return value;
    }
    return "";
  }

  function mediaSessionMetadata() {
    try {
      return navigator.mediaSession?.metadata ?? null;
    } catch {
      return null;
    }
  }

  function mediaArtwork(metadata) {
    const artwork = Array.from(metadata?.artwork ?? []);
    if (artwork.length === 0) return "";
    const best = artwork.sort((a, b) => {
      const size = (entry) => {
        const match = String(entry.sizes || "").match(/(\\d+)x(\\d+)/);
        return match ? Number(match[1]) * Number(match[2]) : 0;
      };
      return size(b) - size(a);
    })[0];
    return typeof best?.src === "string" ? best.src : "";
  }

  function pageArtwork() {
    return document.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector('link[rel="image_src"]')?.href ||
      "";
  }

  function readTrack() {
    const video = document.querySelector("video.html5-main-video, ytmusic-player video, video");
    if (!video) return null;

    const metadata = mediaSessionMetadata();
    const isMusic = SOURCE === "youtube_music";

    const title = String(metadata?.title || "").trim() ||
      (isMusic
        ? readText("ytmusic-player-bar .title", "ytmusic-player-bar .content-info-wrapper .title")
        : readText(
            "ytd-watch-metadata h1 yt-formatted-string",
            "h1.ytd-watch-metadata",
            "h1.title",
            "meta[name='title']"
          )) ||
      document.title.replace(/\\s+-\\s+YouTube(?: Music)?$/i, "").trim();

    if (!title || /^(YouTube|YouTube Music)$/i.test(title)) return null;

    const artist = String(metadata?.artist || "").trim() ||
      (isMusic
        ? readText("ytmusic-player-bar .byline", "ytmusic-player-bar .subtitle")
        : readText(
            "ytd-video-owner-renderer #channel-name a",
            "ytd-video-owner-renderer #channel-name yt-formatted-string"
          ));

    const artworkUrl = mediaArtwork(metadata) || pageArtwork();
    const durationSeconds = Number(video.duration);
    const currentSeconds = Number(video.currentTime);

    return {
      source: SOURCE,
      title: title.slice(0, 180),
      artist: artist.slice(0, 180),
      artworkUrl,
      trackUrl: location.href.split("&list=")[0],
      durationMs: Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.floor(durationSeconds * 1000)
        : 0,
      progressMs: Number.isFinite(currentSeconds) && currentSeconds > 0
        ? Math.floor(currentSeconds * 1000)
        : 0,
      isPlaying: !video.paused && !video.ended
    };
  }

  let previousFingerprint = "";
  let lastSentAt = 0;

  function publish() {
    const payload = readTrack();
    if (!payload) return;

    const fingerprint = [
      payload.source,
      payload.title,
      payload.artist,
      payload.artworkUrl,
      payload.isPlaying
    ].join("|");

    const now = Date.now();
    if (fingerprint === previousFingerprint && now - lastSentAt < MIN_SEND_INTERVAL_MS) return;

    previousFingerprint = fingerprint;
    lastSentAt = now;

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPE,
      payload
    }).catch(() => {
      // La extensión puede haberse recargado; no interrumpimos la reproducción.
    });
  }

  publish();
  window.setInterval(publish, POLL_INTERVAL_MS);

  document.addEventListener("yt-navigate-finish", () => {
    previousFingerprint = "";
    window.setTimeout(publish, 700);
  });
})();
