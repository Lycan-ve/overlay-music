import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const token = "overlay-music-smoke-test-token";
const portProbe = createServer();

portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const address = portProbe.address();
const port = typeof address === "object" && address ? address.port : 0;
await new Promise((resolveClose, rejectClose) => {
  portProbe.close((error) => error ? rejectClose(error) : resolveClose());
});

assert.ok(port > 0, "Debe asignarse un puerto local para la prueba");

const child = spawn(process.execPath, ["server.mjs"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    MUSIC_BRIDGE_TOKEN: token,
    MUSIC_BRIDGE_PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("El puente terminó antes de responder:\n" + output);
    }
    try {
      const response = await fetch(baseUrl + "/api/now-playing");
      if (response.ok) return;
    } catch {
      // El servidor aún está arrancando.
    }
    await delay(100);
  }
  throw new Error("El puente no respondió a tiempo:\n" + output);
}

try {
  await waitForServer();

  const overlayResponse = await fetch(baseUrl + "/overlay");
  assert.equal(overlayResponse.status, 200, "La ruta de la overlay debe responder 200");
  assert.match(await overlayResponse.text(), /id="music-overlay"/);

  const cssResponse = await fetch(baseUrl + "/overlay.css");
  assert.equal(cssResponse.status, 200, "El CSS debe servirse correctamente");

  const jsResponse = await fetch(baseUrl + "/overlay.js");
  assert.equal(jsResponse.status, 200, "El JavaScript de la overlay debe servirse correctamente");

  const unauthorized = await fetch(baseUrl + "/api/now-playing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "youtube", title: "No autorizado" })
  });
  assert.equal(unauthorized.status, 401, "El puente debe rechazar actualizaciones sin token");

  const payload = {
    source: "youtube_music",
    title: "Prueba de reproducción",
    artist: "Overlay Music",
    artworkUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg",
    trackUrl: "https://music.youtube.com/watch?v=example",
    durationMs: 210000,
    progressMs: 45000,
    isPlaying: true
  };

  const update = await fetch(baseUrl + "/api/now-playing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(payload)
  });
  assert.equal(update.status, 200, "El puente debe aceptar la actualización autorizada");

  const stateResponse = await fetch(baseUrl + "/api/now-playing");
  const state = await stateResponse.json();
  assert.equal(state.track?.title, payload.title);
  assert.equal(state.track?.artist, payload.artist);
  assert.equal(state.track?.source, payload.source);
  assert.equal(state.track?.isPlaying, true);
  assert.equal(state.track?.progressMs, payload.progressMs);

  const invalidSource = await fetch(baseUrl + "/api/now-playing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ source: "unknown", title: "Fuente no soportada" })
  });
  assert.equal(invalidSource.status, 400, "El puente debe rechazar fuentes desconocidas");

  const preflight = await fetch(baseUrl + "/api/now-playing", {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  });
  assert.equal(preflight.status, 204, "El puente debe responder el preflight CORS");

  console.log("OK: overlay HTML/CSS/JS, token, actualización y consulta de estado.");
} finally {
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(1500)]);
}
