const navbar = document.getElementById("navbar");
const langToggle = document.getElementById("langToggle");
const themeToggle = document.getElementById("themeToggle");
const toolsToggle = document.getElementById("toolsToggle");
const toolsMenu = document.getElementById("toolsMenu");
const pricingToggle = document.getElementById("pricingToggle");
const pricingMenu = document.getElementById("pricingMenu");
const pricingNavContent = document.getElementById("pricingNavContent");
const tabButtonsNav = document.querySelectorAll(".tab-btn-nav");

const i18n = {
  fr: {
    "nav.tools": "Outils",
    "nav.cv": "CV",
    "nav.letter": "Lettre de motivation",
    "nav.portfolio": "Portfolio",
    "nav.pricing": "Tarifs",
    "nav.battle": "Pourquoi nous",
    "nav.login": "Se connecter",
    "nav.start": "Créer mon CV",
    "hero.badge": "Propulse par Gemini 1.5 Flash",
    "hero.title": "Votre CV professionnel en 2 minutes.",
    "hero.subtitle": "Choisissez un template. Remplissez 5 champs. L'IA fait le reste.",
    "hero.cta1": "Creer mon CV maintenant",
    "hero.cta2": "Voir les templates",
    "hero.proof": "2 000+ CVs crees",
    "battle.title": "Comment depasser cv.fr",
    "battle.card1.title": "Generation contextualisee",
    "battle.card1.desc": "Gemini adapte le ton selon le metier et la langue active, pas juste un texte generique.",
    "battle.card2.title": "1 flux pour 3 actifs",
    "battle.card2.desc": "Depuis les memes 5 champs: CV, lettre de motivation et base portfolio coherent.",
    "battle.card3.title": "Vitesse + premium viral",
    "battle.card3.desc": "Experience en moins de 2 minutes + gains premium via referal, excellent levier conversion.",
    "pricing.title": "Tarifs simples",
    "pricing.premium.title": "PREMIUM",
    "how.title": "Comment ça marche",
    "how.step1.pill": "Étape 1",
    "how.step1.title": "Choisis un modèle",
    "how.step1.desc": "Parcours les exemples de CV et sélectionne le design qui correspond à ton style.",
    "how.step2.pill": "Étape 2",
    "how.step2.title": "Parle ou remplis",
    "how.step2.desc": "Utilise le bouton vocal pour dicter ton profil, ou remplis les champs manuellement.",
    "how.step3.pill": "Étape 3",
    "how.step3.title": "Génère et télécharge",
    "how.step3.desc": "L' IA crée ton CV complet. Tu ajustes si besoin puis tu exportes en PDF.",
    "faq.title": "FAQ",
    "faq.q1.q": "C'est quoi ProFolio exactement ?",
    "faq.q1.a": "ProFolio est une plateforme qui te permet de créer un CV professionnel, une lettre de motivation et un portfolio en ligne en moins de 2 minutes, grâce à l'intelligence artificielle.",
    "faq.q2.q": "Est-ce vraiment gratuit ?",
    "faq.q2.a": "Oui, la création de CV avec le formulaire rapide (5 champs) est 100% gratuite. Les fonctionnalités avancées (import LinkedIn, amélioration de CV existant, templates premium) sont disponibles avec l'offre Premium.",
    "faq.q3.q": "Ai-je besoin de compétences en informatique ou en design ?",
    "faq.q3.a": "Aucune. Tu remplis 5 champs simples, tu cliques sur un bouton — l'IA génère tout le reste automatiquement.",
    "faq.q4.q": "L'IA peut-elle générer mon CV en anglais ?",
    "faq.q4.a": "Oui. ProFolio est entièrement bilingue (Français / Anglais). L'IA génère le contenu dans la langue que tu choisis.",
    "faq.q5.q": "Le CV généré est-il personnalisé ou générique ?",
    "faq.q5.a": "Il est personnalisé à partir de tes informations. L'IA adapte le ton, les formulations et la mise en valeur de tes compétences selon ton profil et le poste visé.",
    "faq.q6.q": "Puis-je changer de template après avoir créé mon CV ?",
    "faq.q6.a": "Oui, tu peux changer de template à tout moment sans perdre tes données.",
    "faq.q7.q": "Dans quel format puis-je télécharger mon CV ?",
    "faq.q7.a": "Ton CV est exporté en PDF, prêt à envoyer à un recruteur.",
    "faq.q8.q": "Y a-t-il un filigrane sur le PDF gratuit ?",
    "faq.q8.a": "Les CVs gratuits incluent une petite mention discrète \"Créé avec ProFolio\". Les CVs premium sont exportés sans aucune mention.",
    "faq.q9.q": "Puis-je gagner du Premium sans payer ?",
    "faq.q9.a": "Oui ! En invitant des amis via ton lien de parrainage, tu gagnes des jours Premium gratuitement.",
    "faq.q10.q": "Qui peut voir mon portfolio public ?",
    "faq.q10.a": "Ton portfolio a une URL publique que tu partages toi-même. Il n'est pas listé dans un annuaire — seules les personnes avec le lien peuvent y accéder.",
    "footer.brand.desc": "Crée ton CV, ta lettre et ton portfolio en quelques minutes avec une expérience simple et rapide.",
    "footer.cta": "Créer mon CV",
    "footer.tools": "Outils",
    "footer.product": "Produit",
    "footer.product.cv": "CV professionnel",
    "footer.product.letter": "Lettre",
    "footer.product.portfolio": "Portfolio",
    "footer.resources": "Ressources",
    "footer.resources.cv_models": "Modèles de CV",
    "footer.resources.letter_models": "Modèles de lettre",
    "footer.resources.how": "Comment ça marche",
    "footer.resources.faq": "FAQ",
    "footer.resources.start": "Démarrer",
    "footer.support": "Service client",
    "footer.contact_email": "Contact",
    "footer.about": "À propos",
    "footer.reviews": "Avis",
    "footer.affiliation": "Programme d'affiliation",
    "footer.lang.fr": "Français",
    "footer.lang.nl": "Nederlands",
    "footer.lang.fi": "Suomi",
    "footer.lang.sv": "Svenska",
    "footer.contact": "Contact",
    "footer.location": "Lomé, Togo",
    "footer.copyright": "© 2026 ProFolio. Tous droits réservés.",
    "footer.terms": "Conditions",
    "footer.privacy": "Confidentialité",
  },
  en: {
    "nav.tools": "Tools",
    "nav.cv": "Resume",
    "nav.letter": "Cover letter",
    "nav.portfolio": "Portfolio",
    "nav.pricing": "Pricing",
    "nav.battle": "Why us",
    "nav.login": "Log in",
    "nav.start": "Create my CV",
    "hero.badge": "Powered by Gemini 1.5 Flash",
    "hero.title": "Your pro resume in 2 minutes.",
    "hero.subtitle": "Pick a template. Fill 5 fields. AI does the rest.",
    "hero.cta1": "Create my resume now",
    "hero.cta2": "Browse templates",
    "hero.proof": "2,000+ resumes created",
    "battle.title": "How to outperform cv.fr",
    "battle.card1.title": "Context-aware generation",
    "battle.card1.desc": "Gemini adjusts tone by role and language, not generic filler text.",
    "battle.card2.title": "1 flow for 3 assets",
    "battle.card2.desc": "From the same 5 fields: resume, cover letter and portfolio foundation.",
    "battle.card3.title": "Speed + viral premium",
    "battle.card3.desc": "Sub-2 minute UX + referral-driven premium loop for stronger conversion.",
    "pricing.title": "Simple pricing",
    "pricing.premium.title": "PREMIUM",
    "how.title": "How it works",
    "how.step1.pill": "Step 1",
    "how.step1.title": "Choose a template",
    "how.step1.desc": "Browse resume examples and choose the design that fits your style.",
    "how.step2.pill": "Step 2",
    "how.step2.title": "Speak or fill",
    "how.step2.desc": "Use the voice button to dictate your profile, or fill the fields manually.",
    "how.step3.pill": "Step 3",
    "how.step3.title": "Generate and download",
    "how.step3.desc": "AI builds your complete resume. You adjust if needed, then export PDF.",
    "faq.title": "FAQ",
    "faq.q1.q": "What exactly is ProFolio?",
    "faq.q1.a": "ProFolio is a platform that helps you create a professional resume, cover letter, and online portfolio in under 2 minutes with AI.",
    "faq.q2.q": "Is it really free?",
    "faq.q2.a": "Yes, resume creation with the quick 5-field form is 100% free. Advanced features are available in Premium.",
    "faq.q3.q": "Do I need tech or design skills?",
    "faq.q3.a": "No. You fill 5 simple fields, click one button, and AI generates the rest.",
    "faq.q4.q": "Can AI generate my resume in English?",
    "faq.q4.a": "Yes. ProFolio is fully bilingual (French / English), and AI generates content in your chosen language.",
    "faq.q5.q": "Is the generated resume personalized or generic?",
    "faq.q5.a": "It is personalized from your information. AI adapts tone and wording to your profile and target role.",
    "faq.q6.q": "Can I switch template after creating my resume?",
    "faq.q6.a": "Yes, you can change template anytime without losing your data.",
    "faq.q7.q": "In which format can I download my resume?",
    "faq.q7.a": "Your resume is exported as PDF, ready to send to recruiters.",
    "faq.q8.q": "Is there a watermark on free PDF?",
    "faq.q8.a": "Free resumes include a small \"Created with ProFolio\" mention. Premium exports have no mention.",
    "faq.q9.q": "Can I get Premium without paying?",
    "faq.q9.a": "Yes. Invite friends with your referral link and earn free Premium days.",
    "faq.q10.q": "Who can view my public portfolio?",
    "faq.q10.a": "Your portfolio has a public URL that you share yourself. It is not listed in a directory.",
    "footer.brand.desc": "Build your resume, cover letter, and portfolio in minutes with a simple, fast experience.",
    "footer.cta": "Create my resume",
    "footer.tools": "Tools",
    "footer.product": "Product",
    "footer.product.cv": "Professional CV",
    "footer.product.letter": "Cover letter",
    "footer.product.portfolio": "Portfolio",
    "footer.resources": "Resources",
    "footer.resources.cv_models": "CV templates",
    "footer.resources.letter_models": "Letter templates",
    "footer.resources.how": "How it works",
    "footer.resources.faq": "FAQ",
    "footer.resources.start": "Get started",
    "footer.support": "Customer service",
    "footer.contact_email": "Contact",
    "footer.about": "About",
    "footer.reviews": "Reviews",
    "footer.affiliation": "Affiliate program",
    "footer.lang.fr": "French",
    "footer.lang.nl": "Dutch",
    "footer.lang.fi": "Finnish",
    "footer.lang.sv": "Swedish",
    "footer.contact": "Contact",
    "footer.location": "Lome, Togo",
    "footer.copyright": "© 2026 ProFolio. All rights reserved.",
    "footer.terms": "Terms",
    "footer.privacy": "Privacy",
  },
};

let lang = localStorage.getItem("profolio_lang") || "fr";
let theme = localStorage.getItem("profolio_theme") || "dark";

function applyTranslations() {
  if (langToggle) langToggle.textContent = lang === "fr" ? "EN" : "FR";
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (i18n[lang][key]) el.textContent = i18n[lang][key];
  });
}

function applyTheme() {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  if (themeToggle) themeToggle.textContent = isLight ? "🌙" : "☀️";
}

window.addEventListener("scroll", () => {
  if (!navbar) return;
  if (window.scrollY > 50) navbar.classList.add("scrolled");
  else navbar.classList.remove("scrolled");
});

if (langToggle) {
  langToggle.addEventListener("click", () => {
    lang = lang === "fr" ? "en" : "fr";
    localStorage.setItem("profolio_lang", lang);
    applyTranslations();
  });
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    theme = theme === "light" ? "dark" : "light";
    localStorage.setItem("profolio_theme", theme);
    applyTheme();
  });
}

if (toolsToggle && toolsMenu) {
  toolsToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toolsMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!toolsMenu.contains(event.target) && event.target !== toolsToggle) {
      toolsMenu.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toolsMenu.classList.add("hidden");
  });
}

let pricingPlans = {};
const pricingDataEl = document.getElementById("pricingData");
if (pricingDataEl?.textContent) {
  try {
    pricingPlans = JSON.parse(pricingDataEl.textContent);
  } catch (error) {
    pricingPlans = {};
  }
}

function renderPricing(planKey, targetEl) {
  if (!targetEl || !pricingPlans[planKey] || !pricingPlans[planKey][lang]) return;
  const data = pricingPlans[planKey][lang];
  const list = data.features.map((item) => `<li>${item}</li>`).join("");
  targetEl.innerHTML = `<p class="price-big">${data.price}</p><ul>${list}</ul>`;
}

if (pricingToggle && pricingMenu && pricingNavContent) {
  let activePlan = "monthly";
  renderPricing(activePlan, pricingNavContent);

  pricingToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    pricingMenu.classList.toggle("hidden");
    renderPricing(activePlan, pricingNavContent);
  });

  tabButtonsNav.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtonsNav.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activePlan = btn.dataset.plan || "monthly";
      renderPricing(activePlan, pricingNavContent);
    });
  });

  document.addEventListener("click", (event) => {
    if (!pricingMenu.contains(event.target) && event.target !== pricingToggle) {
      pricingMenu.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") pricingMenu.classList.add("hidden");
  });
}

const carousel = document.querySelector("[data-cv-carousel]");
if (carousel) {
  const track = carousel.querySelector("[data-cv-track]");
  const slides = Array.from(carousel.querySelectorAll("[data-cv-card]"));
  const prevBtn = carousel.querySelector("[data-cv-prev]");
  const nextBtn = carousel.querySelector("[data-cv-next]");
  const dotsWrap = document.querySelector("[data-cv-dots]");
  let currentIndex = 0;

  function visibleSlides() {
    if (window.innerWidth <= 980) return 1;
    if (window.innerWidth <= 1400) return 3;
    return 4;
  }

  function maxIndex() {
    return Math.max(0, slides.length - visibleSlides());
  }

  function updateTrack() {
    if (!track || slides.length === 0) return;
    currentIndex = Math.min(currentIndex, maxIndex());
    const slideWidth = slides[0].getBoundingClientRect().width;
    const offset = currentIndex * (slideWidth + 18);
    track.style.transform = `translateX(-${offset}px)`;

    const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll("button")) : [];
    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === currentIndex);
    });
  }

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    const count = maxIndex() + 1;
    for (let idx = 0; idx < count; idx += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      if (idx === currentIndex) dot.classList.add("active");
      dot.addEventListener("click", () => {
        currentIndex = idx;
        updateTrack();
      });
      dotsWrap.appendChild(dot);
    }
  }

  prevBtn?.addEventListener("click", () => {
    currentIndex = currentIndex > 0 ? currentIndex - 1 : maxIndex();
    updateTrack();
  });

  nextBtn?.addEventListener("click", () => {
    currentIndex = currentIndex < maxIndex() ? currentIndex + 1 : 0;
    updateTrack();
  });

  slides.forEach((card) => {
    card.addEventListener("click", (event) => {
      const actionLink = event.target.closest(".home-cv-action a");
      if (actionLink) return;
      const isOpen = card.classList.contains("touch-open");
      slides.forEach((item) => item.classList.remove("touch-open"));
      if (!isOpen) card.classList.add("touch-open");
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-cv-card]")) {
      slides.forEach((card) => card.classList.remove("touch-open"));
    }
  });

  window.addEventListener("resize", () => {
    buildDots();
    updateTrack();
  });

  buildDots();
  updateTrack();
}

applyTranslations();
applyTheme();
