let recognition = null;
let isListening = false;
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let activeMode = "browser";
const VOICE_DEBUG_PREFIX = "[VoiceDebug]";

function voiceDebug(message, extra = null) {
  if (extra !== null) console.log(`${VOICE_DEBUG_PREFIX} ${message}`, extra);
  else console.log(`${VOICE_DEBUG_PREFIX} ${message}`);
}

function getBridge() {
  return window.profolioVoiceBridge || {};
}

function showToast(message, type = "error") {
  const bridge = getBridge();
  if (typeof bridge.showToast === "function") {
    bridge.showToast(message, type);
    return;
  }
  alert(message);
}

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute("content") || "";
}

function setVoiceState(state) {
  const btn = document.getElementById("voice-btn");
  const icon = document.getElementById("voice-icon");
  const label = document.getElementById("voice-label");
  if (!btn || !icon || !label) return;

  btn.classList.remove("listening", "processing");
  icon.setAttribute("data-lucide", "mic");
  icon.classList.remove("spinning");
  icon.style.color = "#3B82F6";
  label.style.color = "#94A3B8";

  if (state === "listening") {
    btn.classList.add("listening");
    icon.style.color = "#EF4444";
    label.textContent = "Écoute...";
    label.style.color = "#EF4444";
  } else if (state === "processing") {
    btn.classList.add("processing");
    icon.setAttribute("data-lucide", "loader-2");
    icon.style.color = "#F59E0B";
    icon.classList.add("spinning");
    label.textContent = "Analyse...";
    label.style.color = "#F59E0B";
  } else {
    label.textContent = "Parler";
  }

  if (window.lucide) window.lucide.createIcons();
}

function showVoiceFeedback() {
  const feedback = document.getElementById("voice-feedback");
  if (!feedback) return;
  feedback.style.display = "block";
  feedback.style.animation = "fadeInUp 0.3s ease";
}

function hideVoiceFeedback() {
  const feedback = document.getElementById("voice-feedback");
  if (feedback) feedback.style.display = "none";
}

function isSecureVoiceContext() {
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function stopMediaTracks() {
  if (!mediaStream) return;
  mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    voiceDebug("getUserMedia failed", { name: err?.name, message: err?.message });
    const errors = {
      NotAllowedError: "Microphone refusé. Autorisez l'accès micro dans le navigateur.",
      NotFoundError: "Aucun microphone détecté.",
      NotReadableError: "Le microphone est déjà utilisé par une autre application.",
      SecurityError: "Contexte non sécurisé. Utilisez HTTPS ou localhost.",
    };
    showToast(errors[err?.name] || "Impossible d'accéder au microphone.", "error");
    return false;
  }
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  el.style.borderColor = "#22C55E";
  el.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.1)";
  setTimeout(() => {
    el.style.borderColor = "";
    el.style.boxShadow = "";
  }, 2000);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillFields(fields, mode) {
  const bridge = getBridge();
  if (mode === "cv") {
    if (fields.full_name) setField("full-name", fields.full_name);
    if (fields.job_title) setField("job-title", fields.job_title);
    if (fields.experience) setField("cv-prompt", fields.experience);
    if (fields.city) setField("city", fields.city);
    if (Array.isArray(fields.skills) && typeof bridge.addTag === "function") {
      fields.skills.forEach((skill) => bridge.addTag(skill));
    }
  } else {
    if (fields.company) setField("company", fields.company);
    if (fields.position) setField("position", fields.position);
    if (fields.tone) {
      const tone = String(fields.tone).toLowerCase();
      if (typeof bridge.setTone === "function") bridge.setTone(tone);
    }
  }
  if (typeof bridge.schedulePreviewUpdate === "function") bridge.schedulePreviewUpdate();
}

async function extractFromTranscript(transcript) {
  setVoiceState("processing");
  const mode = document.body.dataset.page || "cv";
  const lang = document.documentElement.lang || "fr";

  try {
    const res = await fetch("/api/voice/extract/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrfToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ transcript, mode, lang }),
    });
    const data = await res.json();
    setVoiceState("idle");
    if (!res.ok || !data.success) throw new Error(data.error || "Extraction vocale impossible.");
    fillFields(data.fields || {}, mode);
    hideVoiceFeedback();
    showToast("Champs remplis depuis votre voix.", "success");
  } catch (err) {
    setVoiceState("idle");
    showToast(`Erreur : ${err.message}`, "error");
  }
}

function shouldUseServerTranscription() {
  const ua = navigator.userAgent || "";
  const isLinux = /Linux/i.test(ua);
  const isChromiumFamily = /Edg|Chrome|Chromium/i.test(ua);
  return !recognition || (isLinux && isChromiumFamily);
}

function getPreferredMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const type of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

async function transcribeServerAudio(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "voice.webm");
  formData.append("lang", document.documentElement.lang === "en" ? "en" : "fr");

  const res = await fetch("/api/voice/transcribe/", {
    method: "POST",
    headers: { "X-CSRFToken": getCsrfToken() },
    credentials: "same-origin",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Transcription serveur impossible.");
  return String(data.transcript || "").trim();
}

async function startVoice() {
  window._finalTranscript = "";
  if (!isSecureVoiceContext()) {
    showToast("Reconnaissance vocale bloquée: utilisez HTTPS ou http://localhost.", "error");
    return;
  }

  const hasMicAccess = await ensureMicrophoneAccess();
  if (!hasMicAccess) return;

  activeMode = shouldUseServerTranscription() ? "server" : "browser";
  isListening = true;
  setVoiceState("listening");
  showVoiceFeedback();

  const box = document.getElementById("transcript-box");
  if (box) {
    box.textContent = "Parlez maintenant...";
    box.style.color = "#94A3B8";
    box.style.fontStyle = "italic";
  }

  if (activeMode === "server") {
    try {
      const mimeType = getPreferredMimeType();
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
      recordedChunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordedChunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        try {
          setVoiceState("processing");
          const blobType = mediaRecorder?.mimeType || mimeType || "audio/webm";
          const audioBlob = new Blob(recordedChunks, { type: blobType });
          const transcript = await transcribeServerAudio(audioBlob);
          if (!transcript) throw new Error("Aucune transcription détectée.");
          if (box) {
            box.textContent = transcript;
            box.style.color = "#E2E8F0";
            box.style.fontStyle = "normal";
          }
          await extractFromTranscript(transcript);
        } catch (err) {
          setVoiceState("idle");
          hideVoiceFeedback();
          showToast(`Erreur : ${err.message}`, "error");
        } finally {
          stopMediaTracks();
        }
      };
      mediaRecorder.start();
      if (box) box.textContent = "Enregistrement en cours... Cliquez à nouveau pour arrêter.";
      voiceDebug("MediaRecorder.start", { mimeType: mediaRecorder.mimeType || mimeType });
      return;
    } catch (err) {
      isListening = false;
      setVoiceState("idle");
      hideVoiceFeedback();
      stopMediaTracks();
      showToast("Impossible de démarrer l'enregistrement audio.", "error");
      return;
    }
  }

  try {
    recognition.start();
  } catch (_) {
    isListening = false;
    setVoiceState("idle");
    hideVoiceFeedback();
    showToast("Impossible de démarrer la reconnaissance vocale.", "error");
  }
}

function stopVoice() {
  isListening = false;
  if (activeMode === "server" && mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    return;
  }
  recognition?.stop();
}

function toggleVoice() {
  if (isListening) stopVoice();
  else startVoice();
}

function initVoice() {
  const voiceBtn = document.getElementById("voice-btn");
  if (!voiceBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang === "en" ? "en-US" : "fr-FR";

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      const box = document.getElementById("transcript-box");
      if (box) {
        box.textContent = finalText || interim || "Parlez maintenant...";
        box.style.color = finalText ? "#E2E8F0" : "#94A3B8";
        box.style.fontStyle = finalText ? "normal" : "italic";
      }
      if (finalText) window._finalTranscript = finalText.trim();
    };

    recognition.onend = () => {
      isListening = false;
      const finalText = String(window._finalTranscript || "").trim();
      if (finalText) {
        extractFromTranscript(finalText);
        window._finalTranscript = "";
        return;
      }
      setVoiceState("idle");
      hideVoiceFeedback();
      showToast("Aucune voix détectée. Réessayez.", "error");
    };

    recognition.onerror = () => {
      isListening = false;
      setVoiceState("idle");
      hideVoiceFeedback();
      showToast("Service vocal navigateur indisponible. Utilisation du mode serveur recommandée.", "error");
    };
  }

  if (!SpeechRecognition && !window.MediaRecorder) {
    voiceBtn.style.display = "none";
    return;
  }

  voiceBtn.addEventListener("click", toggleVoice);
  voiceDebug("init", {
    speechRecognition: Boolean(SpeechRecognition),
    mediaRecorder: Boolean(window.MediaRecorder),
    serverFallback: shouldUseServerTranscription(),
    secure: isSecureVoiceContext(),
    ua: navigator.userAgent,
  });
}

document.addEventListener("DOMContentLoaded", initVoice);
