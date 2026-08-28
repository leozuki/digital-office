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
};

const els = {
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  statusBanner: document.getElementById("statusBanner"),
  statusText: document.getElementById("statusText"),
  speedValue: document.getElementById("speedValue"),
  distValue: document.getElementById("distValue"),
  safeDistValue: document.getElementById("safeDistValue"),
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

function drawDetections(detections, nearest) {
  ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  detections.forEach((d) => {
    if (!VEHICLE_CLASSES.has(d.class)) return;
    const [x, y, w, h] = d.bbox;
    const isNearest = d === nearest;
    ctx.strokeStyle = isNearest ? "#e74c3c" : "#2ecc71";
    ctx.lineWidth = isNearest ? 4 : 2;
    ctx.strokeRect(x, y, w, h);

    const dist = estimateDistanceMeters(w);
    const label = dist ? `${d.class} ~${dist.toFixed(1)}m` : d.class;
    ctx.font = "16px sans-serif";
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = isNearest ? "#e74c3c" : "#2ecc71";
    ctx.fillRect(x, Math.max(0, y - 22), textWidth + 10, 22);
    ctx.fillStyle = "#0b0f14";
    ctx.fillText(label, x + 5, Math.max(14, y - 6));
  });
}

function beepWarning() {
  const now = Date.now();
  if (now - state.lastWarnAt < 1500) return;
  state.lastWarnAt = now;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
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

function updateHud(distance, safeDist) {
  els.speedValue.textContent = state.speedKmh.toFixed(0);
  els.distValue.textContent = distance != null ? distance.toFixed(1) : "--";
  els.safeDistValue.textContent = safeDist.toFixed(0);
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

    drawDetections(detections, nearest);
    updateHud(distance, safeDist);

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

async function main() {
  initSpeed();
  initCalibration();
  initSettingsPanel();
  try {
    await initCamera();
  } catch (err) {
    setStatus("danger", "Không thể truy cập camera. Hãy cấp quyền camera cho trình duyệt.");
    return;
  }
  await initModel();
  setStatus("unknown", "Sẵn sàng. Hiệu chuẩn để có kết quả chính xác.");
  requestAnimationFrame(detectLoop);
}

main();
