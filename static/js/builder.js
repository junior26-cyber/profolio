document.addEventListener("DOMContentLoaded", function () {
  const lucideApi = window.lucide;
  if (lucideApi) lucideApi.createIcons();
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  function withCsrf(init = {}) {
    const headers = { ...(init.headers || {}) };
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
    return { ...init, headers, credentials: "same-origin" };
  }
  function showToast(message) {
    alert(message);
  }

  async function readJsonResponse(res) {
    const raw = await res.text();
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      const htmlResponse = raw.trim().startsWith("<");
      if (res.status === 401 || res.status === 403) {
        throw new Error("Session expirée ou accès refusé. Reconnectez-vous puis réessayez.");
      }
      if (htmlResponse) {
        throw new Error("Le serveur a renvoyé une page HTML au lieu de JSON. Vérifiez les logs serveur.");
      }
      throw new Error("Réponse JSON invalide renvoyée par le serveur.");
    }
  }

  const formLang = document.getElementById("formLang");
  const browserLang = navigator.language.startsWith("fr") ? "fr" : "en";
  if (formLang) formLang.value = localStorage.getItem("profolio_lang") || browserLang;

  const selectedTemplateInput = document.getElementById("selectedTemplate");
  const modelsPanel = document.getElementById("modelsPanel");
  const openModelsBtn = document.getElementById("openModelsBtn");
  if (selectedTemplateInput && !selectedTemplateInput.value) {
    const firstModelCard = document.querySelector(".model-card");
    if (firstModelCard) selectedTemplateInput.value = firstModelCard.getAttribute("data-model-id") || "classique";
  }

  openModelsBtn?.addEventListener("click", function (event) {
    event.stopPropagation();
    modelsPanel?.classList.toggle("hidden");
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest("#modelsPanel") && !event.target.closest("#openModelsBtn")) {
      modelsPanel?.classList.add("hidden");
    }
  });

  document.querySelectorAll(".model-card").forEach((card) => {
    card.addEventListener("click", function () {
      const modelId = card.getAttribute("data-model-id") || "classique";
      if (selectedTemplateInput) selectedTemplateInput.value = modelId;
      document.querySelectorAll(".model-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      modelsPanel?.classList.add("hidden");
      schedulePreviewUpdate();
    });
  });

  const moreInfoToggle = document.getElementById("moreInfoToggle");
  const moreInfoSection = document.getElementById("moreInfoSection");
  moreInfoToggle?.addEventListener("click", function () {
    moreInfoSection?.classList.toggle("hidden");
  });

  const uploadCvBtn = document.getElementById("uploadCvBtn");
  const uploadCvInput = document.getElementById("uploadCvInput");
  const importLinkedinBtn = document.getElementById("importLinkedinBtn");
  const linkedinUrlInput = document.getElementById("linkedinUrlInput");
  const linkedinCardBtn = document.getElementById("linkedinCardBtn");

  const skillsZone = document.getElementById("skills-zone");
  const skillsInput = document.getElementById("skills-input");
  const interestsZone = document.getElementById("interests-zone");
  const interestsInput = document.getElementById("interests-input");
  let skillsTags = [];
  let interestsTags = [];

  function createTagManager(zone, input, getTags, setTags) {
    function add(val) {
      const current = getTags();
      if (!val || current.includes(val)) return;
      setTags([...current, val]);
      const tag = document.createElement("span");
      tag.className = "tag-item";
      tag.innerHTML = `${val}<span class="tag-remove">×</span>`;
      tag.querySelector(".tag-remove")?.addEventListener("click", () => {
        setTags(getTags().filter((t) => t !== val));
        tag.remove();
        schedulePreviewUpdate();
      });
      if (zone && input) zone.insertBefore(tag, input);
      schedulePreviewUpdate();
    }

    input?.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        const val = input.value.trim();
        if (val) {
          add(val);
          input.value = "";
        }
      }
    });

    return { add };
  }

  const skillsManager = createTagManager(
    skillsZone,
    skillsInput,
    () => skillsTags,
    (value) => { skillsTags = value; }
  );
  const interestsManager = createTagManager(
    interestsZone,
    interestsInput,
    () => interestsTags,
    (value) => { interestsTags = value; }
  );

  document.querySelectorAll(".suggestion-pill").forEach((pill) => {
    pill.addEventListener("click", function () {
      skillsManager.add(pill.textContent.trim());
    });
  });
  document.querySelectorAll(".interest-pill").forEach((pill) => {
    pill.addEventListener("click", function () {
      interestsManager.add(pill.textContent.trim());
    });
  });

  const previewFrame = document.getElementById("cv-preview-frame");
  const previewEmpty = document.getElementById("previewEmpty");
  const photoInput = document.getElementById("photo-input");
  const photoRemoveBtn = document.getElementById("photo-remove-btn");
  let photoDataUrl = "";
  let previewTimer;

  function collectData() {
    const cvPrompt = document.getElementById("cv-prompt")?.value || "";
    return {
      full_name: document.getElementById("full-name")?.value || "",
      job_title: document.getElementById("job-title")?.value || "",
      experience: cvPrompt,
      cv_prompt: cvPrompt,
      skills: skillsTags,
      interests: interestsTags,
      photo_data_url: photoDataUrl,
      email: document.getElementById("email")?.value || "",
      phone: document.getElementById("phone")?.value || "",
      linkedin: document.getElementById("linkedin")?.value || "",
      github: document.getElementById("github")?.value || "",
      lang: formLang?.value || "fr",
      template: selectedTemplateInput?.value || "classique",
    };
  }

  photoInput?.addEventListener("change", function () {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner une image valide.");
      photoInput.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("La photo dépasse 5MB.");
      photoInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      photoDataUrl = String(reader.result || "");
      photoRemoveBtn?.classList.remove("hidden");
      schedulePreviewUpdate();
    };
    reader.readAsDataURL(file);
  });

  photoRemoveBtn?.addEventListener("click", function () {
    photoDataUrl = "";
    if (photoInput) photoInput.value = "";
    photoRemoveBtn?.classList.add("hidden");
    schedulePreviewUpdate();
  });

  function schedulePreviewUpdate() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 400);
  }

  document.querySelectorAll(".builder-input, .builder-select").forEach((el) => {
    el.addEventListener("input", schedulePreviewUpdate);
    el.addEventListener("change", schedulePreviewUpdate);
  });

  function updatePreview() {
    const data = collectData();
    if (!data.full_name && !data.job_title && skillsTags.length === 0) {
      if (previewEmpty) previewEmpty.style.display = "flex";
      return;
    }
    fetch("/api/cv/preview/", {
      ...withCsrf({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, template: data.template }),
      }),
    })
      .then((res) => res.text())
      .then((html) => {
        if (!previewFrame) return;
        previewFrame.style.opacity = "0";
        previewFrame.srcdoc = html;
        previewFrame.onload = () => {
          previewFrame.style.transition = "opacity 0.3s";
          previewFrame.style.opacity = "1";
        };
        if (previewEmpty) previewEmpty.style.display = "none";
      });
  }

  const generateBtn = document.getElementById("generate-btn");
  const saveBtn = document.getElementById("cvCreateSaveBtn");
  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const loadingText = document.getElementById("loading-text");
  const progressWrap = document.getElementById("generate-progress");
  const progressBar = document.getElementById("progress-bar");
  const generatedSections = document.getElementById("generated-sections");
  let currentCvId = null;

  const messages = [
    "Génération du résumé...",
    "Création des expériences...",
    "Ajout des compétences...",
    "Finalisation...",
  ];

  function setLoadingState(loading) {
    if (!generateBtn) return;
    generateBtn.disabled = loading;
    btnText?.classList.toggle("hidden", loading);
    btnSpinner?.classList.toggle("hidden", !loading);
    if (progressWrap) progressWrap.style.display = loading ? "block" : "none";
    if (!loading && progressBar) progressBar.style.width = "0%";
  }

  function showSkeletonPreview() {
    if (!previewFrame) return;
    previewFrame.srcdoc = `
      <html><body style="padding:40px;background:#fff;font-family:Arial,sans-serif">
        <div style="height:30px;background:#e2e8f0;border-radius:4px;margin-bottom:12px;animation:pulse 1.2s infinite"></div>
        <div style="height:14px;background:#eef2f7;border-radius:4px;width:70%;margin-bottom:28px;animation:pulse 1.2s infinite"></div>
        <div style="height:12px;background:#e2e8f0;border-radius:4px;margin-bottom:8px;animation:pulse 1.2s infinite"></div>
        <div style="height:12px;background:#e2e8f0;border-radius:4px;width:80%;margin-bottom:8px;animation:pulse 1.2s infinite"></div>
        <div style="height:12px;background:#e2e8f0;border-radius:4px;width:88%;margin-bottom:30px;animation:pulse 1.2s infinite"></div>
        <style>@keyframes pulse{0%{opacity:1}50%{opacity:.45}100%{opacity:1}}</style>
      </body></html>`;
    if (previewEmpty) previewEmpty.style.display = "none";
  }

  generateBtn?.addEventListener("click", async function () {
    const data = collectData();
    if (!data.full_name || !data.job_title || !data.cv_prompt || interestsTags.length === 0) {
      alert("Veuillez remplir les 5 champs obligatoires.");
      return;
    }
    if (!data.photo_data_url) {
      alert("La photo est obligatoire pour générer le CV.");
      return;
    }
    if (skillsTags.length === 0) {
      alert("Ajoutez au moins une compétence.");
      return;
    }

    setLoadingState(true);
    showSkeletonPreview();
    let idx = 0;
    const interval = setInterval(() => {
      if (loadingText) loadingText.textContent = messages[idx] || messages[messages.length - 1];
      if (progressBar) progressBar.style.width = `${Math.min((idx + 1) * 25, 92)}%`;
      idx += 1;
    }, 1200);

    try {
      const res = await fetch("/api/ai/generate-cv/", {
        ...withCsrf({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      });
      const result = await readJsonResponse(res);
      if (!res.ok || !result.success) {
        let message = result?.error || "Erreur de génération";
        if (typeof result?.detail === "string") {
          message = result.detail;
        } else if (Array.isArray(result?.detail) && result.detail.length > 0) {
          const first = result.detail[0];
          message = first?.msg || JSON.stringify(first);
        } else if (result?.detail && typeof result.detail === "object") {
          message = JSON.stringify(result.detail);
        }
        throw new Error(message);
      }
      clearInterval(interval);
      if (progressBar) progressBar.style.width = "100%";
      generatedSections?.classList.remove("hidden");
      currentCvId = result.cv_id || currentCvId;
      setTimeout(() => {
        window.location.href = `/cv/build/${result.cv_id}/`;
      }, 500);
    } catch (error) {
      clearInterval(interval);
      setLoadingState(false);
      alert(`Erreur : ${error.message}`);
      schedulePreviewUpdate();
    }
  });

  const a4Container = document.getElementById("a4Container");
  const previewBody = document.querySelector(".preview-body");
  const A4_WIDTH = 595;
  const A4_HEIGHT = 842;
  let zoomDelta = 0;
  let currentScale = 0.75;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fitScale() {
    if (!previewBody) return 0.75;
    const bodyRect = previewBody.getBoundingClientRect();
    const usableW = Math.max(bodyRect.width - 36, 120);
    const usableH = Math.max(bodyRect.height - 36, 120);
    const byW = usableW / A4_WIDTH;
    const byH = usableH / A4_HEIGHT;
    return clamp(Math.min(byW, byH), 0.3, 1.0);
  }

  function applyScale() {
    if (!a4Container) return;
    const auto = fitScale();
    currentScale = clamp(auto + zoomDelta, 0.3, 1.2);
    a4Container.style.width = `${Math.round(A4_WIDTH * currentScale)}px`;
    a4Container.style.height = `${Math.round(A4_HEIGHT * currentScale)}px`;
  }

  document.getElementById("zoom-in")?.addEventListener("click", () => {
    zoomDelta = clamp(zoomDelta + 0.08, -0.5, 0.5);
    applyScale();
  });
  document.getElementById("zoom-out")?.addEventListener("click", () => {
    zoomDelta = clamp(zoomDelta - 0.08, -0.5, 0.5);
    applyScale();
  });
  window.addEventListener("resize", applyScale);
  applyScale();

  async function downloadPdfFrom(url, fallbackName) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const raw = await res.text();
        let message = `Téléchargement impossible (HTTP ${res.status}).`;
        try {
          const body = raw ? JSON.parse(raw) : {};
          message = body.detail || body.error || message;
        } catch (_) {
          const snippet = raw.trim().slice(0, 140);
          if (snippet && !snippet.startsWith("<")) message = `${message} ${snippet}`;
        }
        throw new Error(message);
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/pdf")) {
        const raw = await res.text();
        let message = "Aucun PDF disponible. Générez d'abord votre CV.";
        try {
          const body = raw ? JSON.parse(raw) : {};
          message = body.detail || body.error || message;
        } catch (_) {
          const snippet = raw.trim().slice(0, 140);
          if (snippet && !snippet.startsWith("<")) message = `${message} ${snippet}`;
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      alert(error.message || "Téléchargement impossible.");
    }
  }

  document.getElementById("cvCreateDownloadBtn")?.addEventListener("click", function () {
    (async () => {
      try {
        const data = collectData();
        if (!data.full_name || !data.job_title) {
          alert("Renseignez au moins votre nom et le poste visé avant de télécharger.");
          return;
        }
        try {
          await saveDraft(false);
        } catch (_) {
          // continue: draft save may fail for non-auth users
        }
        if (currentCvId) {
          downloadPdfFrom(`/cv/download/${currentCvId}/`, `cv-${currentCvId}.pdf`);
          return;
        }
        downloadPdfFrom("/cv/download/latest/", "cv.pdf");
      } catch (error) {
        alert(error.message || "Téléchargement impossible.");
      }
    })();
  });

  async function saveDraft(showMessage = true) {
    const payload = { cv_id: currentCvId, ...collectData() };
    try {
      const res = await fetch("/api/cv/save-draft/", {
        ...withCsrf({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      });
      const result = await readJsonResponse(res);
      if (!res.ok || !result.success) throw new Error(result.detail || result.error || "Sauvegarde impossible");
      currentCvId = result.cv_id || currentCvId;
      if (showMessage) alert("CV sauvegardé.");
      return result;
    } catch (error) {
      if (showMessage) alert(`Erreur : ${error.message}`);
      throw error;
    }
  }

  saveBtn?.addEventListener("click", function () {
    saveDraft(true);
  });

  async function extractFromFile(file, mode) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    const res = await fetch("/api/ai/extract-cv-basics/", {
      ...withCsrf({
        method: "POST",
        body: formData,
      }),
    });
    const result = await readJsonResponse(res);
    if (!res.ok || !result.success) throw new Error(result.detail || result.error || "Extraction impossible");
    return result.data || {};
  }

  async function extractFromLinkedinUrl(linkedinUrl, lang) {
    const res = await fetch("/api/ai/extract-linkedin/", {
      ...withCsrf({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: linkedinUrl, lang }),
      }),
    });
    const result = await readJsonResponse(res);
    if (!res.ok || !result.success) throw new Error(result.detail || result.error || "Import LinkedIn impossible");
    return result.data || {};
  }

  function populateFromExtract(data) {
    const fullNameInput = document.getElementById("full-name");
    const jobTitleInput = document.getElementById("job-title");
    const promptInput = document.getElementById("cv-prompt");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const linkedinField = document.getElementById("linkedin");
    const githubField = document.getElementById("github");

    if (fullNameInput && data.full_name) fullNameInput.value = data.full_name;
    if (jobTitleInput && data.job_title) jobTitleInput.value = data.job_title;
    if (promptInput) {
      const extractedPrompt = (data.cv_prompt || "").trim();
      if (extractedPrompt) {
        promptInput.value = extractedPrompt;
      } else if (data.experience) {
        promptInput.value = `Profil: ${data.experience}. Poste cible: ${data.job_title || "non précisé"}. Mettre en avant les compétences clés et les réalisations mesurables.`;
      }
    }
    if (emailInput && data.email) emailInput.value = data.email;
    if (phoneInput && data.phone) phoneInput.value = data.phone;
    if (linkedinField && data.linkedin) linkedinField.value = data.linkedin;
    if (githubField && data.github) githubField.value = data.github;

    // reset and repopulate skills
    skillsTags = [];
    skillsZone?.querySelectorAll(".tag-item").forEach((el) => el.remove());
    (Array.isArray(data.skills) ? data.skills : []).slice(0, 16).forEach((s) => skillsManager.add(String(s).trim()));

    // reset and repopulate interests
    interestsTags = [];
    interestsZone?.querySelectorAll(".tag-item").forEach((el) => el.remove());
    (Array.isArray(data.interests) ? data.interests : []).slice(0, 16).forEach((s) => interestsManager.add(String(s).trim()));

    schedulePreviewUpdate();
  }

  async function handleImport(file, mode) {
    if (!file) return;
    setLoadingState(true);
    if (loadingText) loadingText.textContent = mode === "linkedin" ? "Analyse du profil LinkedIn..." : "Analyse du CV...";
    if (progressWrap) progressWrap.style.display = "block";
    if (progressBar) progressBar.style.width = "35%";
    try {
      const data = await extractFromFile(file, mode);
      if (progressBar) progressBar.style.width = "80%";
      populateFromExtract(data);
      if (progressBar) progressBar.style.width = "100%";
      setTimeout(() => setLoadingState(false), 250);
    } catch (error) {
      setLoadingState(false);
      alert(`Import impossible: ${error.message}`);
    }
  }

  async function handleLinkedinImport() {
    const url = (linkedinUrlInput?.value || "").trim();
    if (!url) {
      alert("Ajoutez l'URL de votre profil LinkedIn.");
      return;
    }
    const lang = (formLang?.value || "fr").toLowerCase();
    setLoadingState(true);
    if (loadingText) loadingText.textContent = "Analyse du profil LinkedIn...";
    if (progressWrap) progressWrap.style.display = "block";
    if (progressBar) progressBar.style.width = "35%";
    try {
      const data = await extractFromLinkedinUrl(url, lang);
      if (progressBar) progressBar.style.width = "80%";
      populateFromExtract(data);
      if (progressBar) progressBar.style.width = "100%";
      setTimeout(() => setLoadingState(false), 250);
    } catch (error) {
      setLoadingState(false);
      alert(`Import impossible: ${error.message}`);
    }
  }

  uploadCvBtn?.addEventListener("click", () => uploadCvInput?.click());
  uploadCvInput?.addEventListener("change", () => {
    const file = uploadCvInput.files?.[0];
    handleImport(file, "cv");
    if (uploadCvInput) uploadCvInput.value = "";
  });
  importLinkedinBtn?.addEventListener("click", handleLinkedinImport);
  linkedinCardBtn?.addEventListener("click", () => {
    if ((linkedinUrlInput?.value || "").trim()) {
      handleLinkedinImport();
      return;
    }
    linkedinUrlInput?.focus();
  });
  linkedinUrlInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLinkedinImport();
    }
  });

  schedulePreviewUpdate();

  window.profolioVoiceBridge = {
    addTag(value) {
      const text = String(value || "").trim();
      if (text) skillsManager.add(text);
    },
    schedulePreviewUpdate,
    showToast,
  };
});
