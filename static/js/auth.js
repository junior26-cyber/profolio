const authI18n = {
  fr: {
    "login.title": "Bon retour 👋",
    "login.subtitle": "Connectez-vous à votre compte",
    "field.email": "Adresse email",
    "field.password": "Mot de passe",
    "login.forgot": "Mot de passe oublié ?",
    "login.submit": "Se connecter",
    "login.loading": "Connexion en cours...",
    "common.or": "ou",
    "login.switchText": "Pas encore de compte ?",
    "login.switchLink": "Créer un compte →",
    "register.title": "Créez votre compte",
    "register.subtitle": "Rejoignez ProFolio gratuitement",
    "register.firstName": "Prénom",
    "register.lastName": "Nom",
    "register.username": "Nom d'utilisateur",
    "register.password2": "Confirmer le mot de passe",
    "register.referralToggle": "Vous avez un code de parrainage ? +",
    "register.terms": "J'accepte les conditions d'utilisation et la politique de confidentialité",
    "register.submit": "Créer mon compte",
    "register.loading": "Création en cours...",
    "register.switchText": "Déjà un compte ?",
    "register.switchLink": "Se connecter →",
  },
  en: {
    "login.title": "Welcome back 👋",
    "login.subtitle": "Sign in to your account",
    "field.email": "Email address",
    "field.password": "Password",
    "login.forgot": "Forgot password?",
    "login.submit": "Sign in",
    "login.loading": "Signing in...",
    "common.or": "or",
    "login.switchText": "No account yet?",
    "login.switchLink": "Create account →",
    "register.title": "Create your account",
    "register.subtitle": "Join ProFolio for free",
    "register.firstName": "First name",
    "register.lastName": "Last name",
    "register.username": "Username",
    "register.password2": "Confirm password",
    "register.referralToggle": "Have a referral code? +",
    "register.terms": "I accept the terms of use and privacy policy",
    "register.submit": "Create my account",
    "register.loading": "Creating account...",
    "register.switchText": "Already have an account?",
    "register.switchLink": "Sign in →",
  },
};

let authLang = localStorage.getItem("profolio_lang") || "fr";

function applyAuthTranslations() {
  document.documentElement.lang = authLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = authI18n[authLang]?.[key];
    if (value) el.textContent = value;
  });

  const frBtn = document.getElementById("lang-fr");
  const enBtn = document.getElementById("lang-en");
  frBtn?.classList.toggle("active", authLang === "fr");
  enBtn?.classList.toggle("active", authLang === "en");
}

function switchLanguage(lang) {
  authLang = lang === "en" ? "en" : "fr";
  localStorage.setItem("profolio_lang", authLang);
  applyAuthTranslations();
}

function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.setAttribute("data-lucide", "eye-off");
  } else {
    input.type = "password";
    icon.setAttribute("data-lucide", "eye");
  }
  if (window.lucide) window.lucide.createIcons();
}

document.getElementById("login-form")?.addEventListener("submit", function (event) {
  let valid = true;
  const email = this.querySelector('input[name="email"]');
  const password = this.querySelector('input[name="password"]');
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");

  if (emailError) emailError.textContent = "";
  if (passwordError) passwordError.textContent = "";
  email?.classList.remove("error");
  password?.classList.remove("error");

  if (!email?.value.trim()) {
    if (emailError) emailError.textContent = authLang === "fr" ? "Ce champ est requis." : "This field is required.";
    email?.classList.add("error");
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    if (emailError) emailError.textContent = authLang === "fr" ? "Email invalide." : "Invalid email.";
    email.classList.add("error");
    valid = false;
  }

  if (!password?.value) {
    if (passwordError) passwordError.textContent = authLang === "fr" ? "Ce champ est requis." : "This field is required.";
    password?.classList.add("error");
    valid = false;
  }

  if (!valid) {
    event.preventDefault();
    return;
  }

  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const submitBtn = document.getElementById("submit-btn");
  if (btnText) btnText.style.display = "none";
  if (btnSpinner) btnSpinner.style.display = "inline-flex";
  if (submitBtn) submitBtn.disabled = true;
});

document.getElementById("password-input")?.addEventListener("input", function () {
  const val = this.value;
  let strength = 0;
  if (val.length >= 8) strength++;
  if (/[A-Z]/.test(val)) strength++;
  if (/[0-9]/.test(val)) strength++;
  if (/[^A-Za-z0-9]/.test(val)) strength++;

  const labelsFr = ["", "Très faible", "Faible", "Moyen", "Fort"];
  const labelsEn = ["", "Very weak", "Weak", "Medium", "Strong"];
  const labels = authLang === "fr" ? labelsFr : labelsEn;
  const colors = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E"];
  const segments = document.querySelectorAll(".strength-segment");
  const label = document.getElementById("strength-label");

  segments.forEach((seg, idx) => {
    seg.style.background = idx < strength ? colors[strength] : "rgba(255,255,255,0.08)";
  });

  if (label) {
    label.textContent = labels[strength];
    label.style.color = colors[strength] || "#64748B";
  }
});

let usernameTimer;
document.getElementById("username-input")?.addEventListener("input", function () {
  clearTimeout(usernameTimer);
  const val = this.value.trim();
  const feedback = document.getElementById("username-feedback");
  if (!feedback) return;
  feedback.textContent = "";
  if (val.length < 3) return;

  usernameTimer = setTimeout(() => {
    fetch(`/api/accounts/check-username/?username=${encodeURIComponent(val)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.taken) {
          feedback.textContent = authLang === "fr" ? "✗ Déjà pris" : "✗ Already taken";
          feedback.style.color = "#EF4444";
        } else {
          feedback.textContent = authLang === "fr" ? "✓ Disponible" : "✓ Available";
          feedback.style.color = "#22C55E";
        }
      })
      .catch(() => {
        feedback.textContent = "";
      });
  }, 450);
});

let referralTimer;
document.getElementById("referral-input")?.addEventListener("input", function () {
  clearTimeout(referralTimer);
  const val = this.value.trim().toUpperCase();
  const feedback = document.getElementById("referral-feedback");
  if (!feedback) return;
  this.value = val;
  feedback.textContent = "";
  if (val.length !== 8) return;

  referralTimer = setTimeout(() => {
    fetch(`/api/accounts/check-referral/?code=${encodeURIComponent(val)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          feedback.textContent = authLang === "fr"
            ? "✓ Code valide — vous recevrez 3 jours Premium !"
            : "✓ Valid code — you will receive 3 premium days!";
          feedback.style.color = "#22C55E";
        } else {
          feedback.textContent = authLang === "fr" ? "✗ Code invalide" : "✗ Invalid code";
          feedback.style.color = "#EF4444";
        }
      })
      .catch(() => {
        feedback.textContent = "";
      });
  }, 450);
});

document.getElementById("password2-input")?.addEventListener("input", function () {
  const p1 = document.getElementById("password-input");
  const feedback = document.getElementById("password2-feedback");
  if (!p1 || !feedback) return;

  if (this.value && this.value === p1.value) {
    feedback.textContent = authLang === "fr"
      ? "✓ Les mots de passe correspondent"
      : "✓ Passwords match";
    feedback.style.color = "#22C55E";
  } else if (this.value) {
    feedback.textContent = authLang === "fr"
      ? "✗ Les mots de passe ne correspondent pas"
      : "✗ Passwords do not match";
    feedback.style.color = "#EF4444";
  } else {
    feedback.textContent = "";
  }
});

document.getElementById("referral-toggle")?.addEventListener("click", function () {
  const section = document.getElementById("referral-section");
  if (!section) return;

  const isOpen = section.style.display === "block";
  section.style.display = isOpen ? "none" : "block";
  const span = this.querySelector("span");
  if (!span) return;
  span.textContent = isOpen
    ? (authLang === "fr" ? "Vous avez un code de parrainage ? +" : "Have a referral code? +")
    : (authLang === "fr" ? "Masquer ×" : "Hide ×");
});

document.getElementById("register-form")?.addEventListener("submit", function () {
  const btnText = document.getElementById("register-btn-text");
  const btnSpinner = document.getElementById("register-btn-spinner");
  const submitBtn = document.getElementById("register-submit-btn");
  if (btnText) btnText.style.display = "none";
  if (btnSpinner) btnSpinner.style.display = "inline-flex";
  if (submitBtn) submitBtn.disabled = true;
});

if (window.lucide) window.lucide.createIcons();
applyAuthTranslations();
