document.addEventListener("DOMContentLoaded", function () {
  const lucideApi = window.lucide;
  if (lucideApi) lucideApi.createIcons();
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  function withCsrf(init = {}) {
    const headers = { ...(init.headers || {}) };
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
    return { ...init, headers, credentials: "same-origin" };
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

  const page = document.querySelector(".builder-page");
  const cvId = Number(page?.dataset.cvId || 0);
  const dataEl = document.getElementById("cvEditorData");
  const templateEl = document.getElementById("cvTemplateData");

  let state = {
    personal_info: {
      name: "",
      job_title: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      linkedin: "",
      github: "",
      photo_data_url: "",
      custom_fields: [],
    },
    summary: "",
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    interests: [],
    qualities: [],
  };

  try {
    if (dataEl?.textContent) {
      const parsed = JSON.parse(dataEl.textContent);
      if (parsed && typeof parsed === "object") state = { ...state, ...parsed };
    }
  } catch (_) {
    // ignore parsing errors
  }

  let selectedTemplate = "classique";
  try {
    if (templateEl?.textContent) selectedTemplate = JSON.parse(templateEl.textContent) || "classique";
  } catch (_) {
    // ignore parsing errors
  }

  const previewFrame = document.getElementById("cv-build-preview-frame");
  const saveBtn = document.getElementById("cvBuildSaveBtn");
  const downloadBtn = document.getElementById("cvBuildDownloadBtn");
  const modelsPanel = document.getElementById("modelsPanel");
  const openModelsBtn = document.getElementById("openModelsBtn");

  const fullName = document.getElementById("edit-full-name");
  const jobTitle = document.getElementById("edit-job-title");
  const email = document.getElementById("edit-email");
  const phone = document.getElementById("edit-phone");
  const address = document.getElementById("edit-address");
  const city = document.getElementById("edit-city");
  const linkedin = document.getElementById("edit-linkedin");
  const github = document.getElementById("edit-github");
  const summary = document.getElementById("edit-summary");
  const interests = document.getElementById("edit-interests");
  const qualities = document.getElementById("edit-qualities");
  const photoInput = document.getElementById("edit-photo-input");
  const photoRemoveBtn = document.getElementById("edit-photo-remove-btn");

  const experiencesList = document.getElementById("experiencesList");
  const educationList = document.getElementById("educationList");
  const skillsList = document.getElementById("skillsList");
  const languagesList = document.getElementById("languagesList");
  const customFieldsList = document.getElementById("customFieldsList");

  function setPrimitiveInputs() {
    fullName.value = state.personal_info?.name || "";
    jobTitle.value = state.personal_info?.job_title || "";
    email.value = state.personal_info?.email || "";
    phone.value = state.personal_info?.phone || "";
    address.value = state.personal_info?.address || "";
    city.value = state.personal_info?.city || "";
    linkedin.value = state.personal_info?.linkedin || "";
    github.value = state.personal_info?.github || "";
    summary.value = state.summary || "";
    interests.value = Array.isArray(state.interests) ? state.interests.join(", ") : "";
    qualities.value = Array.isArray(state.qualities) ? state.qualities.join(", ") : "";
    photoRemoveBtn?.classList.toggle("hidden", !state.personal_info?.photo_data_url);
  }

  function rowActionsHTML(type, idx) {
    return `<button class="section-btn" type="button" data-remove="${type}" data-index="${idx}">×</button>`;
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function renderCollections() {
    experiencesList.innerHTML = (state.experiences || [])
      .map(
        (item, idx) => `
      <div class="card" style="padding:10px;">
        <div class="optional-grid">
          <input class="builder-input plain" data-path="experiences.${idx}.title" placeholder="Titre" value="${esc(item.title)}">
          <input class="builder-input plain" data-path="experiences.${idx}.company" placeholder="Entreprise" value="${esc(item.company)}">
          <input class="builder-input plain" data-path="experiences.${idx}.location" placeholder="Lieu" value="${esc(item.location)}">
          <input class="builder-input plain" data-path="experiences.${idx}.start_date" placeholder="Début" value="${esc(item.start_date)}">
          <input class="builder-input plain" data-path="experiences.${idx}.end_date" placeholder="Fin" value="${esc(item.end_date)}">
          <label class="tiny-label"><input type="checkbox" data-path="experiences.${idx}.is_current" ${item.is_current ? "checked" : ""}> En cours</label>
        </div>
        <textarea class="builder-input plain" data-path="experiences.${idx}.description" style="margin-top:8px;min-height:70px;resize:vertical;">${esc(item.description)}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">${rowActionsHTML("experiences", idx)}</div>
      </div>`
      )
      .join("");

    educationList.innerHTML = (state.education || [])
      .map(
        (item, idx) => `
      <div class="card" style="padding:10px;">
        <div class="optional-grid">
          <input class="builder-input plain" data-path="education.${idx}.degree" placeholder="Diplôme" value="${esc(item.degree)}">
          <input class="builder-input plain" data-path="education.${idx}.school" placeholder="École" value="${esc(item.school)}">
          <input class="builder-input plain" data-path="education.${idx}.year" placeholder="Année" value="${esc(item.year)}">
          <input class="builder-input plain" data-path="education.${idx}.city" placeholder="Ville" value="${esc(item.city)}">
        </div>
        <textarea class="builder-input plain" data-path="education.${idx}.description" style="margin-top:8px;min-height:64px;resize:vertical;">${esc(item.description)}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">${rowActionsHTML("education", idx)}</div>
      </div>`
      )
      .join("");

    skillsList.innerHTML = (state.skills || [])
      .map(
        (item, idx) => `
      <div class="card" style="padding:10px;display:grid;grid-template-columns:1fr 84px auto;gap:8px;align-items:center;">
        <input class="builder-input plain" data-path="skills.${idx}.name" placeholder="Compétence" value="${esc(item.name)}">
        <input class="builder-input plain" data-path="skills.${idx}.level" type="number" min="1" max="5" value="${item.level || 3}">
        ${rowActionsHTML("skills", idx)}
      </div>`
      )
      .join("");

    languagesList.innerHTML = (state.languages || [])
      .map(
        (item, idx) => `
      <div class="card" style="padding:10px;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;">
        <input class="builder-input plain" data-path="languages.${idx}.name" placeholder="Langue" value="${esc(item.name)}">
        <input class="builder-input plain" data-path="languages.${idx}.level" placeholder="Niveau" value="${esc(item.level)}">
        ${rowActionsHTML("languages", idx)}
      </div>`
      )
      .join("");

    customFieldsList.innerHTML = (state.personal_info.custom_fields || [])
      .map(
        (item, idx) => `
      <div class="card" style="padding:10px;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;">
        <input class="builder-input plain" data-path="personal_info.custom_fields.${idx}.label" placeholder="Libellé" value="${esc(item.label)}">
        <input class="builder-input plain" data-path="personal_info.custom_fields.${idx}.value" placeholder="Valeur" value="${esc(item.value)}">
        ${rowActionsHTML("personal_info.custom_fields", idx)}
      </div>`
      )
      .join("");
  }

  function deepSet(path, value) {
    const keys = path.split(".");
    let ptr = state;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const k = keys[i];
      const next = keys[i + 1];
      if (/^\d+$/.test(next)) {
        if (!Array.isArray(ptr[k])) ptr[k] = [];
      } else if (!ptr[k] || typeof ptr[k] !== "object") {
        ptr[k] = {};
      }
      ptr = ptr[k];
    }
    ptr[keys[keys.length - 1]] = value;
  }

  let previewTimer;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 250);
  }

  function collectPrimitiveInputs() {
    state.personal_info.name = fullName.value.trim();
    state.personal_info.job_title = jobTitle.value.trim();
    state.personal_info.email = email.value.trim();
    state.personal_info.phone = phone.value.trim();
    state.personal_info.address = address.value.trim();
    state.personal_info.city = city.value.trim();
    state.personal_info.linkedin = linkedin.value.trim();
    state.personal_info.github = github.value.trim();
    state.summary = summary.value.trim();
    state.interests = interests.value.split(",").map((v) => v.trim()).filter(Boolean);
    state.qualities = qualities.value.split(",").map((v) => v.trim()).filter(Boolean);
  }

  async function updatePreview() {
    collectPrimitiveInputs();
    const res = await fetch("/api/cv/render-template/", {
      ...withCsrf({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selectedTemplate, cv: state }),
      }),
    });
    const html = await res.text();
    previewFrame.srcdoc = html;
  }

  async function saveCv() {
    collectPrimitiveInputs();
    if (!state.personal_info?.photo_data_url) {
      throw new Error("La photo est obligatoire.");
    }
    const res = await fetch(`/api/cv/${cvId}/update/`, {
      ...withCsrf({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selectedTemplate, cv: state }),
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.detail || "Sauvegarde impossible.");
  }

  function bindRootEvents() {
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const input = target.closest("[data-path]");
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      const path = input.getAttribute("data-path");
      if (!path) return;
      const value = input.type === "number" ? Number(input.value || 0) : input.value;
      deepSet(path, value);
      schedulePreview();
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const path = target.getAttribute("data-path");
      if (!path) return;
      if (target.type === "checkbox") {
        deepSet(path, target.checked);
        schedulePreview();
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const removeBtn = target.closest("[data-remove]");
      if (removeBtn) {
        const key = removeBtn.getAttribute("data-remove");
        const idx = Number(removeBtn.getAttribute("data-index") || "-1");
        if (idx < 0 || !key) return;
        const keys = key.split(".");
        let ptr = state;
        for (let i = 0; i < keys.length; i += 1) ptr = ptr[keys[i]];
        if (Array.isArray(ptr)) ptr.splice(idx, 1);
        renderCollections();
        schedulePreview();
      }
    });
  }

  function bindPhotoEvents() {
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
        state.personal_info.photo_data_url = String(reader.result || "");
        photoRemoveBtn?.classList.remove("hidden");
        schedulePreview();
      };
      reader.readAsDataURL(file);
    });

    photoRemoveBtn?.addEventListener("click", function () {
      state.personal_info.photo_data_url = "";
      if (photoInput) photoInput.value = "";
      photoRemoveBtn?.classList.add("hidden");
      schedulePreview();
    });
  }

  document.getElementById("addExperienceBtn")?.addEventListener("click", () => {
    state.experiences.push({ title: "", company: "", location: "", start_date: "", end_date: "", is_current: false, description: "" });
    renderCollections();
    schedulePreview();
  });
  document.getElementById("addEducationBtn")?.addEventListener("click", () => {
    state.education.push({ degree: "", school: "", year: "", city: "", description: "" });
    renderCollections();
    schedulePreview();
  });
  document.getElementById("addSkillBtn")?.addEventListener("click", () => {
    state.skills.push({ name: "", level: 3 });
    renderCollections();
    schedulePreview();
  });
  document.getElementById("addLanguageBtn")?.addEventListener("click", () => {
    state.languages.push({ name: "", level: "" });
    renderCollections();
    schedulePreview();
  });
  document.getElementById("addCustomFieldBtn")?.addEventListener("click", () => {
    state.personal_info.custom_fields = state.personal_info.custom_fields || [];
    state.personal_info.custom_fields.push({ label: "", value: "" });
    renderCollections();
    schedulePreview();
  });

  saveBtn?.addEventListener("click", async () => {
    try {
      await saveCv();
      alert("CV sauvegardé.");
    } catch (error) {
      alert(error.message || "Sauvegarde impossible.");
    }
  });

  downloadBtn?.addEventListener("click", async () => {
    try {
      await saveCv();
      const res = await fetch(`/cv/download/${cvId}/`);
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
        let message = "Le serveur n'a pas renvoyé de PDF.";
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
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `cv-${cvId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      alert(error.message || "Téléchargement impossible.");
    }
  });

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
      selectedTemplate = card.getAttribute("data-model-id") || "classique";
      document.querySelectorAll(".model-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      modelsPanel?.classList.add("hidden");
      schedulePreview();
    });
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

  [fullName, jobTitle, email, phone, address, city, linkedin, github, summary, interests, qualities].forEach((el) => {
    el?.addEventListener("input", schedulePreview);
  });

  bindRootEvents();
  bindPhotoEvents();
  setPrimitiveInputs();
  renderCollections();
  updatePreview();
});
