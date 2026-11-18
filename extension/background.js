const MESSAGE_TYPE = "OVERLAY_MUSIC_STATE";
const BRIDGE_URL = "http://127.0.0.1:4317/api/now-playing";
const ALLOWED_SENDERS = new Set([
  "https://www.youtube.com",
  "https://music.youtube.com"
]);

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== MESSAGE_TYPE || !message.payload) return;

  let senderOrigin = "";
  try {
    senderOrigin = new URL(sender.url || "").origin;
  } catch {
    return;
  }
  if (!ALLOWED_SENDERS.has(senderOrigin)) return;

  const payload = message.payload;
  if (
    !["youtube", "youtube_music"].includes(payload.source) ||
    typeof payload.title !== "string" ||
    !payload.title.trim()
  ) return;

  void chrome.storage.local.get(["musicBridgeToken"]).then(({ musicBridgeToken }) => {
    if (!musicBridgeToken) return;

    return fetch(BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + musicBridgeToken
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  }).catch(() => {
    // El puente local puede estar apagado; no interrumpimos YouTube.
  });
});
