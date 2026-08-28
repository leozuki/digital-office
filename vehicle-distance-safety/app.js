/**
 * Vehicle Following-Distance Safety App
 *
 * Detects vehicles ahead using the device camera (TensorFlow.js + COCO-SSD),
 * estimates the distance to the nearest vehicle with the classic monocular
 * "triangle similarity" method, and compares it against the minimum safe
 * following distance for the current speed (Vietnam Thong tu 31/2019/TT-BGTVT,
 * with a 2-second-rule fallback under 60 km/h).
 */

const VEHICLE_CLASSES = new Set(["car", "truck", "bus"]);
const STORAGE_KEY = "vds.focalLengthPx";

const state = {
  focalLengthPx: Number(localStorage.getItem(STORAGE_KEY)) || null,
  refCarWidthM: 1.8,
  speedKmh: 0,
  speedSource: "gps",
  model: null,
  lastWarnAt: 0,
  showAllLabels: true,
  lastLat: null,
  lastLon: null,
};

const els = {
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  statusBanner: document.getElementById("statusBanner"),
  statusText: document.getElementById("statusText"),
  speedValue: document.getElementById("speedValue"),
  primaryBadge: document.getElementById("primaryBadge"),
  primaryDistValue: document.getElementById("primaryDistValue"),
  primarySafeValue: document.getElementById("primarySafeValue"),
  watermark: document.getElementById("watermark"),
  snapshotBtn: document.getElementById("snapshotBtn"),
  recordBtn: document.getElementById("recordBtn"),
  detailToggleBtn: document.getElementById("detailToggleBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
  closeSettings: document.getElementById("closeSettings"),
  manualSpeedRow: document.getElementById("manualSpeedRow"),
  manualSpeedSlider: document.getElementById("manualSpeedSlider"),
  manualSpeedLabel: document.getElementById("manualSpeedLabel"),
  calibDistance: document.getElementById("calibDistance"),
  calibrateBtn: document.getElementById("calibrateBtn"),
  carWidthInput: document.getElementById("carWidthInput"),
  calibStatus: document.getElementById("calibStatus"),
};

const ctx = els.overlay.getContext("2d");
let lastDetections = [];
let audioCtx = null;

/* ---------- Snapshot + trip recording (compositing video + boxes) ---------- */

let compositeCanvas = null;
let compositeCtx = null;
let mediaRecorder = null;
let recordChunks = [];
let isRecording = false;

function ensureCompositeCanvas() {
  if (!compositeCanvas) {
    compositeCanvas = document.createElement("canvas");
    compositeCtx = compositeCanvas.getContext("2d");
  }
  compositeCanvas.width = els.overlay.width;
  compositeCanvas.height = els.overlay.height;
}

function drawComposite() {
  compositeCtx.drawImage(els.video, 0, 0, compositeCanvas.width, compositeCanvas.height);
  compositeCtx.drawImage(els.overlay, 0, 0, compositeCanvas.width, compositeCanvas.height);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function takeSnapshot() {
  if (!els.video.videoWidth) return;
  ensureCompositeCanvas();
  drawComposite();
  compositeCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `khoang-cach-${Date.now()}.png`);
  }, "image/png");
}

function toggleRecording() {
  if (isRecording) {
    mediaRecorder.stop();
    return;
  }
  if (!els.video.videoWidth) return;
  ensureCompositeCanvas();
  drawComposite();
  const stream = compositeCanvas.captureStream(30);
  recordChunks = [];
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  } catch (e) {
    mediaRecorder = new MediaRecorder(stream);
  }
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recordChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    isRecording = false;
    els.recordBtn.classList.remove("recording");
    if (recordChunks.length) {
      downloadBlob(new Blob(recordChunks, { type: "video/webm" }), `hanh-trinh-${Date.now()}.webm`);
    }
  };
  mediaRecorder.start();
  isRecording = true;
  els.recordBtn.classList.add("recording");
}

function initControls() {
  els.snapshotBtn.addEventListener("click", takeSnapshot);
  els.recordBtn.addEventListener("click", toggleRecording);
  els.detailToggleBtn.addEventListener("click", () => {
    state.showAllLabels = !state.showAllLabels;
    els.detailToggleBtn.classList.toggle("active", state.showAllLabels);
  });
}

/* ---------- Safe following distance rule ---------- */

function safeDistanceMeters(speedKmh) {
  if (speedKmh <= 60) {
    // 2-second rule, minimum 10 m regardless of speed.
    const metersPerSecond = speedKmh / 3.6;
    return Math.max(metersPerSecond * 2, 10);
  }
  if (speedKmh <= 80) return 55;
  if (speedKmh <= 100) return 70;
  if (speedKmh <= 120) return 100;
  // Extrapolate beyond the regulated table.
  return 100 + (speedKmh - 120) * 1.5;
}

/* ---------- Camera + model setup ---------- */

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  els.video.srcObject = stream;
  await new Promise((resolve) => (els.video.onloadedmetadata = resolve));
  els.overlay.width = els.video.videoWidth;
  els.overlay.height = els.video.videoHeight;
}

async function initModel() {
  setStatus("unknown", "Đang tải mô hình nhận diện...");
  if (typeof cocoSsd === "undefined") {
    throw new Error("coco-ssd script not loaded");
  }
  state.model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
}

/* ---------- Speed tracking ---------- */

function initSpeed() {
  document.querySelectorAll('input[name="speedSource"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.speedSource = e.target.value;
      els.manualSpeedRow.classList.toggle("hidden", state.speedSource !== "manual");
      if (state.speedSource === "manual") {
        state.speedKmh = Number(els.manualSpeedSlider.value);
      }
    });
  });

  els.manualSpeedSlider.addEventListener("input", () => {
    const v = Number(els.manualSpeedSlider.value);
    els.manualSpeedLabel.textContent = `${v} km/h`;
    if (state.speedSource === "manual") state.speedKmh = v;
  });

  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      (pos) => {
        // Captured regardless of speedSource: used for the dashcam-style
        // watermark even when speed itself comes from manual entry.
        state.lastLat = pos.coords.latitude;
        state.lastLon = pos.coords.longitude;
        if (state.speedSource !== "gps") return;
        const mps = pos.coords.speed; // meters/second, may be null
        if (mps != null && !Number.isNaN(mps)) {
          state.speedKmh = Math.max(0, mps * 3.6);
        }
      },
      () => {
        /* GPS unavailable/denied: user can switch to manual entry. */
      },
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
  }
}

/* ---------- Calibration ---------- */

function initCalibration() {
  els.carWidthInput.addEventListener("change", () => {
    state.refCarWidthM = Number(els.carWidthInput.value) || 1.8;
  });

  els.calibrateBtn.addEventListener("click", () => {
    const knownDistance = Number(els.calibDistance.value);
    if (!knownDistance || knownDistance <= 0) {
      els.calibStatus.textContent = "Nhập khoảng cách thực tế hợp lệ trước khi hiệu chuẩn.";
      return;
    }
    const target = lastDetections
      .filter((d) => VEHICLE_CLASSES.has(d.class))
      .sort((a, b) => b.bbox[2] - a.bbox[2])[0];
    if (!target) {
      els.calibStatus.textContent = "Không thấy xe nào trong khung hình để hiệu chuẩn.";
      return;
    }
    const bboxWidthPx = target.bbox[2];
    state.focalLengthPx = (bboxWidthPx * knownDistance) / state.refCarWidthM;
    localStorage.setItem(STORAGE_KEY, String(state.focalLengthPx));
    els.calibStatus.textContent = `Đã hiệu chuẩn (focal length ≈ ${state.focalLengthPx.toFixed(0)}px).`;
  });
}

/* ---------- Detection + distance loop ---------- */

function estimateDistanceMeters(bboxWidthPx) {
  if (!state.focalLengthPx || bboxWidthPx <= 0) return null;
  return (state.refCarWidthM * state.focalLengthPx) / bboxWidthPx;
}

function statusOf(distance, safeDist) {
  if (distance == null) return "unknown";
  if (distance < safeDist * 0.7) return "danger";
  if (distance < safeDist) return "warn";
  return "safe";
}

const STATUS_COLOR = {
  unknown: "#4da3ff",
  safe: "#22d3ee",
  warn: "#f1c40f",
  danger: "#e74c3c",
};

function drawDetections(detections, nearest, safeDist) {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  detections.forEach((d) => {
    if (!VEHICLE_CLASSES.has(d.class)) return;
    const isPrimary = d === nearest;
    // Decluttered mode: only draw the tracked vehicle ahead.
    if (!state.showAllLabels && !isPrimary) return;

    const [x, y, w, h] = d.bbox;
    const dist = estimateDistanceMeters(w);
    const color = STATUS_COLOR[statusOf(dist, safeDist)];

    ctx.strokeStyle = color;
    ctx.lineWidth = isPrimary ? 4 : 2;
    ctx.strokeRect(x, y, w, h);

    if (dist == null) return;
    const label = `${dist.toFixed(1)}m`;
    const fontSize = isPrimary ? 20 : 14;
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const padX = 8;
    const boxH = fontSize + 10;
    const boxW = textWidth + padX * 2;
    const labelX = x + w / 2 - boxW / 2;
    const labelY = Math.max(0, y - boxH - 4);

    ctx.fillStyle = color;
    ctx.fillRect(labelX, labelY, boxW, boxH);
    ctx.fillStyle = "#04141a";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX + padX, labelY + boxH / 2);
  });
}

function unlockAudio() {
  // iOS Safari only allows creating/resuming an AudioContext inside a
  // direct user-gesture handler (the "Bắt đầu" tap), so this must run
  // there rather than lazily on the first warning beep.
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    /* Web Audio unavailable; visual warning still applies. */
  }
}

function beepWarning() {
  const now = Date.now();
  if (now - state.lastWarnAt < 1500) return;
  state.lastWarnAt = now;
  try {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    /* Audio not available; visual warning still applies. */
  }
}

function setStatus(kind, text) {
  els.statusBanner.className = `status-banner status-${kind}`;
  els.statusText.textContent = text;
}

function updateReadouts(distance, safeDist) {
  els.speedValue.textContent = state.speedKmh.toFixed(0);
  els.primaryDistValue.textContent = distance != null ? distance.toFixed(1) : "--";
  els.primarySafeValue.textContent = safeDist.toFixed(0);
  els.primaryBadge.className = `primary-badge status-${statusOf(distance, safeDist)}`;
}

function updateWatermark() {
  const ts = new Date().toISOString().replace("T", " ").substring(0, 19);
  const lat = state.lastLat != null ? state.lastLat.toFixed(6) : "--";
  const lon = state.lastLon != null ? state.lastLon.toFixed(6) : "--";
  els.watermark.textContent = `${ts}  N${lat} E${lon}  ${state.speedKmh.toFixed(0)}KM/H`;
}

async function detectLoop() {
  if (state.model && els.video.readyState >= 2) {
    const detections = await state.model.detect(els.video);
    lastDetections = detections;

    const vehicles = detections.filter((d) => VEHICLE_CLASSES.has(d.class));
    // Nearest = largest bounding-box width, roughly centered horizontally
    // (a simple proxy for "the vehicle directly ahead").
    const nearest = vehicles.sort((a, b) => b.bbox[2] - a.bbox[2])[0] || null;
    const distance = nearest ? estimateDistanceMeters(nearest.bbox[2]) : null;
    const safeDist = safeDistanceMeters(state.speedKmh);

    drawDetections(detections, nearest, safeDist);
    updateReadouts(distance, safeDist);
    updateWatermark();

    if (isRecording) {
      // Canvas is already sized by toggleRecording(); resizing it here on
      // every frame would reset its bitmap and disrupt captureStream().
      drawComposite();
    }

    if (!state.focalLengthPx) {
      setStatus("unknown", "Chưa hiệu chuẩn — mở Cài đặt để hiệu chuẩn khoảng cách.");
    } else if (!nearest || distance == null) {
      setStatus("unknown", "Không phát hiện xe phía trước.");
    } else if (distance < safeDist * 0.7) {
      setStatus("danger", "NGUY HIỂM: Quá gần! Giảm tốc độ ngay.");
      beepWarning();
    } else if (distance < safeDist) {
      setStatus("warn", "Cảnh báo: Dưới khoảng cách an toàn.");
    } else {
      setStatus("safe", "An toàn.");
    }
  }
  requestAnimationFrame(detectLoop);
}

/* ---------- Settings panel wiring ---------- */

function initSettingsPanel() {
  els.settingsBtn.addEventListener("click", () => els.settingsPanel.classList.remove("hidden"));
  els.closeSettings.addEventListener("click", () => els.settingsPanel.classList.add("hidden"));
  if (state.focalLengthPx) {
    els.calibStatus.textContent = `Đã hiệu chuẩn trước đó (focal length ≈ ${state.focalLengthPx.toFixed(0)}px).`;
  }
}

/* ---------- Boot ---------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Relative path: keeps it working when the app is served from a
  // sub-path rather than the domain root.
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* Offline app-shell caching is a nice-to-have, not required to run. */
  });
}

async function startApp() {
  const startOverlay = document.getElementById("startOverlay");
  const startBtn = document.getElementById("startBtn");
  startBtn.disabled = true;
  startBtn.textContent = "Đang khởi động...";

  // Must run inside this click handler: iOS Safari only grants a reliable
  // camera prompt and allows creating/resuming an AudioContext when both
  // happen synchronously-ish inside a direct user gesture.
  unlockAudio();

  try {
    await initCamera();
  } catch (err) {
    startBtn.disabled = false;
    startBtn.textContent = "Thử lại";
    setStatus("danger", "Không thể truy cập camera. Hãy cấp quyền camera cho trình duyệt.");
    return;
  }

  startOverlay.classList.add("hidden");

  try {
    await initModel();
  } catch (err) {
    setStatus("danger", "Không tải được mô hình nhận diện. Kiểm tra kết nối mạng và tải lại trang.");
    return;
  }
  setStatus("unknown", "Sẵn sàng. Hiệu chuẩn để có kết quả chính xác.");
  requestAnimationFrame(detectLoop);
}

function main() {
  initSpeed();
  initCalibration();
  initSettingsPanel();
  initControls();
  registerServiceWorker();
  // Not { once: true }: a failed camera permission prompt re-enables the
  // button so the user can retry the gesture.
  document.getElementById("startBtn").addEventListener("click", startApp);
}

main();
