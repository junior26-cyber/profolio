document.addEventListener("DOMContentLoaded", function () {
  if (window.lucide) window.lucide.createIcons();
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  function withCsrf(init = {}) {
    const headers = { ...(init.headers || {}) };
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
    return { ...init, headers, credentials: "same-origin" };
  }
  function showToast(message) {
    alert(message);
  }

  // Letter flow is French-first for now.
  const appLang = "fr";

  const selectedTemplateInput = document.getElementById("selectedTemplate");
  const currentLetterIdInput = document.getElementById("currentLetterId");
  const initialToneInput = document.getElementById("initialTone");
  const pageMode = document.body?.dataset?.letterMode || "create";

  let currentTone = initialToneInput?.value || "formel";
  document.querySelectorAll(".tone-card").forEach((card) => {
    const isActive = card.getAttribute("data-tone") === currentTone;
    card.classList.toggle("active", isActive);
    card.addEventListener("click", function () {
      document.querySelectorAll(".tone-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      currentTone = card.getAttribute("data-tone") || "formel";
      schedulePreviewUpdate();
    });
  });

  const cvToggle = document.getElementById("cvToggle");
  const cvSection = document.getElementById("cvSection");
  const selectedCvId = document.getElementById("selectedCvId");
  const cvSelectedBadge = document.getElementById("cvSelectedBadge");

  if (selectedCvId?.value) cvSelectedBadge?.classList.remove("hidden");

  cvToggle?.addEventListener("click", function () {
    cvSection?.classList.toggle("hidden");
  });

  document.querySelectorAll(".cv-card").forEach((card) => {
    card.addEventListener("click", function () {
      document.querySelectorAll(".cv-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      if (selectedCvId) selectedCvId.value = card.getAttribute("data-cv-id") || "";
      cvSelectedBadge?.classList.remove("hidden");
    });
  });

  const previewFrame = document.getElementById("letter-preview-frame");
  const previewEmpty = document.getElementById("preview-empty");
  const uploadCvBtn = document.getElementById("uploadCvBtn");
  const uploadCvInput = document.getElementById("uploadCvInput");
  const importLinkedinBtn = document.getElementById("importLinkedinBtn");
  const linkedinUrlInput = document.getElementById("linkedinUrlInput");
  const linkedinCardBtn = document.getElementById("linkedinCardBtn");
  let previewTimer;

  function collectData() {
    return {
      letter_id: currentLetterIdInput?.value ? Number(currentLetterIdInput.value) : null,
      company: document.getElementById("company")?.value.trim() || "",
      position: document.getElementById("position")?.value.trim() || "",
      template: selectedTemplateInput?.value || "elite",
      tone: currentTone,
      cv_id: selectedCvId?.value ? Number(selectedCvId.value) : null,
      recruiter: document.getElementById("recruiter")?.value.trim() || "",
      content: document.getElementById("letter-textarea")?.value || "",
      lang: appLang,
    };
  }

  function schedulePreviewUpdate() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 400);
  }

  ["company", "position", "recruiter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", schedulePreviewUpdate);
  });

  function updatePreview() {
    const data = collectData();
    if (!data.content && !data.company && !data.position) {
      if (previewEmpty) previewEmpty.classList.remove("hidden");
      return;
    }

    fetch("/api/letters/preview/", {
      ...withCsrf({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: data.content,
          template: data.template,
          company: data.company,
          position: data.position,
          recruiter: data.recruiter,
        }),
      }),
    })
      .then((res) => res.text())
      .then((html) => {
        if (!previewFrame) return;
        previewFrame.style.opacity = "0";
        previewFrame.srcdoc = html;
        previewFrame.onload = function () {
          previewFrame.style.transition = "opacity .3s";
          previewFrame.style.opacity = "1";
        };
        previewEmpty?.classList.add("hidden");
      });
  }

  const generateBtn = document.getElementById("generate-btn");
  const saveBtn = document.getElementById("letterSaveBtn");
  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const loadingText = document.getElementById("loading-text");
  const progressWrap = document.getElementById("generate-progress");
  const progressBar = document.getElementById("progress-bar");
  const editZone = document.getElementById("edit-zone");
  const textarea = document.getElementById("letter-textarea");
  const wordCount = document.getElementById("word-count");
  const downloadLink = document.getElementById("downloadLink");
  const topDownloadBtn = document.getElementById("topDownloadBtn");

  function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  textarea?.addEventListener("input", function () {
    if (wordCount) wordCount.textContent = `${countWords(textarea.value)} mots`;
    schedulePreviewUpdate();
  });

  function setLoading(loading) {
    if (!generateBtn) return;
    generateBtn.disabled = loading;
    btnText?.classList.toggle("hidden", loading);
    btnSpinner?.classList.toggle("hidden", !loading);
    progressWrap?.classList.toggle("hidden", !loading);
    if (!loading && progressBar) progressBar.style.width = "0%";
  }

  function updateProgress(value) {
    if (progressBar) progressBar.style.width = `${value}%`;
  }

  function showSkeletonPreview() {
    if (!previewFrame) return;
    previewFrame.srcdoc = `
      <html><body style="margin:0;padding:48px;background:#fff;font-family:Arial,sans-serif">
        <div style="height:14px;background:#e2e8f0;border-radius:4px;width:34%;margin-bottom:8px;animation:s 1.5s infinite"></div>
        <div style="height:14px;background:#e2e8f0;border-radius:4px;width:56%;margin-bottom:24px;animation:s 1.5s infinite"></div>
        <div style="height:14px;background:#f1f5f9;border-radius:4px;width:70%;margin-bottom:18px;animation:s 1.5s infinite"></div>
        <div style="height:12px;background:#f1f5f9;border-radius:4px;margin-bottom:8px;animation:s 1.5s infinite"></div>
        <div style="height:12px;background:#f1f5f9;border-radius:4px;width:90%;margin-bottom:8px;animation:s 1.5s infinite"></div>
        <div style="height:12px;background:#f1f5f9;border-radius:4px;width:83%;margin-bottom:8px;animation:s 1.5s infinite"></div>
        <div style="height:12px;background:#f1f5f9;border-radius:4px;width:94%;margin-bottom:8px;animation:s 1.5s infinite"></div>
        <style>@keyframes s{0%{opacity:1}50%{opacity:.35}100%{opacity:1}}</style>
      </body></html>`;
    previewEmpty?.classList.add("hidden");
  }

  async function saveDraft(showMessage = true) {
    const data = collectData();
    try {
      const res = await fetch("/api/letters/save/", {
        ...withCsrf({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.detail || result.error || "Sauvegarde impossible");
      if (currentLetterIdInput) currentLetterIdInput.value = String(result.letter_id || "");
      if (downloadLink && result.letter_id) downloadLink.href = `/letters/download/${result.letter_id}/`;
      if (textarea && !textarea.value.trim() && result.content) textarea.value = result.content;
      if (wordCount) wordCount.textContent = `${countWords(textarea?.value || "")} mots`;
      if (showMessage) alert("Lettre sauvegardée.");
      return result;
    } catch (error) {
      if (showMessage) alert(`Erreur : ${error.message}`);
      throw error;
    }
  }

  saveBtn?.addEventListener("click", function () {
    saveDraft(true);
  });

  generateBtn?.addEventListener("click", async function () {
    const data = collectData();
    if (!data.company || !data.position) {
      alert("Remplissez tous les champs requis.");
      return;
    }

    setLoading(true);
    showSkeletonPreview();

    const messages = [
      "Analyse de votre profil...",
      "Rédaction de l'introduction...",
      "Développement des arguments...",
      "Formulation de la conclusion...",
      "Finalisation...",
    ];

    let i = 0;
    const interval = setInterval(function () {
      if (loadingText) loadingText.textContent = messages[Math.min(i, messages.length - 1)];
      updateProgress(Math.min((i + 1) * 20, 95));
      i += 1;
    }, 1300);

    try {
      const res = await fetch("/api/letters/generate/", {
        ...withCsrf({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || result.error || "Erreur de génération");
      }

      clearInterval(interval);
      updateProgress(100);
      if (textarea) textarea.value = result.content || "";
      if (wordCount) wordCount.textContent = `${countWords(textarea?.value || "")} mots`;
      editZone?.classList.remove("hidden");
      if (downloadLink) downloadLink.href = `/letters/download/${result.letter_id}/`;
      if (currentLetterIdInput) currentLetterIdInput.value = String(result.letter_id || "");
      if (pageMode === "create" && result.letter_id) {
        window.location.href = `/letters/build/${result.letter_id}/`;
        return;
      }
      setLoading(false);
      schedulePreviewUpdate();
    } catch (error) {
      clearInterval(interval);
      setLoading(false);
      alert(`Erreur : ${error.message}`);
    }
  });

  async function enhance(mode) {
    const content = textarea?.value.trim() || "";
    if (!content) return;
    try {
      const res = await fetch("/api/letters/enhance/", {
        ...withCsrf({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            mode,
            tone: currentTone,
            lang: appLang,
          }),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.detail || result.error || "Amélioration impossible");
      if (textarea) textarea.value = result.content || content;
      if (wordCount) wordCount.textContent = `${countWords(textarea?.value || "")} mots`;
      schedulePreviewUpdate();
    } catch (error) {
      alert(`Erreur : ${error.message}`);
    }
  }

  document.getElementById("regenBtn")?.addEventListener("click", function () {
    generateBtn?.click();
  });
  document.getElementById("improveToneBtn")?.addEventListener("click", function () {
    enhance("tone");
  });
  document.getElementById("fixGrammarBtn")?.addEventListener("click", function () {
    enhance("grammar");
  });

  topDownloadBtn?.addEventListener("click", function () {
    const href = downloadLink?.getAttribute("href") || "#";
    if (href === "#") {
      alert("Générez ou sauvegardez d'abord une lettre.");
      return;
    }
    window.location.href = href;
  });

  let scale = 0.72;
  const a4 = document.getElementById("letterA4");
  document.getElementById("zoom-in")?.addEventListener("click", function () {
    scale = Math.min(scale + 0.08, 1.2);
    if (a4) a4.style.transform = `scale(${scale})`;
  });
  document.getElementById("zoom-out")?.addEventListener("click", function () {
    scale = Math.max(scale - 0.08, 0.3);
    if (a4) a4.style.transform = `scale(${scale})`;
  });

  if (textarea && textarea.value.trim()) {
    editZone?.classList.remove("hidden");
    if (wordCount) wordCount.textContent = `${countWords(textarea.value)} mots`;
  }

  async function extractFromFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "cv");
    const res = await fetch("/api/ai/extract-cv-basics/", {
      ...withCsrf({
        method: "POST",
        body: formData,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.detail || data.error || "Extraction impossible");
    return data.data || {};
  }

  async function extractFromLinkedinUrl(linkedinUrl) {
    const res = await fetch("/api/ai/extract-linkedin/", {
      ...withCsrf({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: linkedinUrl, lang: appLang }),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.detail || data.error || "Import LinkedIn impossible");
    return data.data || {};
  }

  function populateFromExtract(data) {
    if (data.position) {
      const positionInput = document.getElementById("position");
      if (positionInput) positionInput.value = data.position;
    } else if (data.job_title) {
      const positionInput = document.getElementById("position");
      if (positionInput) positionInput.value = data.job_title;
    }
    const companyInput = document.getElementById("company");
    if (companyInput && data.company) companyInput.value = data.company;
    schedulePreviewUpdate();
  }

  uploadCvBtn?.addEventListener("click", () => uploadCvInput?.click());
  uploadCvInput?.addEventListener("change", async () => {
    const file = uploadCvInput.files?.[0];
    if (!file) return;
    try {
      const data = await extractFromFile(file);
      populateFromExtract(data);
      showToast("Informations importées.");
    } catch (error) {
      showToast(`Import impossible: ${error.message}`);
    } finally {
      uploadCvInput.value = "";
    }
  });
  importLinkedinBtn?.addEventListener("click", async () => {
    const url = (linkedinUrlInput?.value || "").trim();
    if (!url) {
      showToast("Ajoutez l'URL de votre profil LinkedIn.");
      return;
    }
    try {
      const data = await extractFromLinkedinUrl(url);
      populateFromExtract(data);
      showToast("Profil LinkedIn importé.");
    } catch (error) {
      showToast(`Import impossible: ${error.message}`);
    }
  });
  linkedinCardBtn?.addEventListener("click", () => {
    if ((linkedinUrlInput?.value || "").trim()) {
      importLinkedinBtn?.click();
      return;
    }
    linkedinUrlInput?.focus();
  });
  linkedinUrlInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      importLinkedinBtn?.click();
    }
  });

  window.profolioVoiceBridge = {
    setTone(tone) {
      currentTone = tone;
      document.querySelectorAll(".tone-card").forEach((card) => {
        card.classList.toggle("active", card.getAttribute("data-tone") === tone);
      });
      schedulePreviewUpdate();
    },
    schedulePreviewUpdate,
    showToast,
  };

  schedulePreviewUpdate();
});
