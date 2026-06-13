function getConfigValue(path) {
  return path.split(".").reduce((value, key) => value && value[key], siteConfig);
}

function applyConfigBindings() {
  document.querySelectorAll("[data-href]").forEach((element) => {
    const value = getConfigValue(element.dataset.href);
    if (value) element.setAttribute("href", value);
  });

  document.querySelectorAll("[data-text]").forEach((element) => {
    const value = getConfigValue(element.dataset.text);
    if (value) element.textContent = value;
  });
}

function markActiveNavigation() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach((link) => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) link.setAttribute("aria-current", "page");
  });
}

function animateCounter(element, targetValue, duration = 1000, formatter = formatCounterValue) {
  const target = Number(targetValue);
  if (!element || !Number.isFinite(target)) {
    if (element && targetValue !== null && targetValue !== undefined) element.textContent = String(targetValue);
    return;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = formatter(target);
    return;
  }

  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const value = start + (target - start) * easedProgress;

    element.textContent = formatter(value, progress === 1);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = formatter(target, true);
    }
  }

  requestAnimationFrame(update);
}

function formatCounterValue(value) {
  return Math.round(value).toLocaleString();
}

if (typeof window !== "undefined") {
  window.animateCounter = animateCounter;
}

function updateTextById(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  if (Number.isFinite(value)) {
    animateCounter(element, value);
  } else if (value !== null && value !== undefined) {
    element.textContent = String(value);
  }
}

function getNestedValue(value, path) {
  return path.split(".").reduce((current, key) => current && current[key], value);
}

function loadWebsiteStats() {
  const statElements = [
    "registered-pis-stat",
    "project-spaces-stat",
    "users-stat",
  ];
  if (!statElements.some((id) => document.getElementById(id))) return;

  fetch(getConfigValue("urls.biohpcStats"), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Stats unavailable");
      return response.json();
    })
    .then((stats) => {
      updateTextById("registered-pis-stat", getNestedValue(stats, "pis.registered"));
      updateTextById("project-spaces-stat", getNestedValue(stats, "projects.total"));
      updateTextById("users-stat", getNestedValue(stats, "users.registered"));
    })
    .catch(() => {
      statElements.forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = "--";
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  applyConfigBindings();
  markActiveNavigation();
  loadWebsiteStats();

  const year = document.querySelector("[data-current-year]");
  if (year) year.textContent = new Date().getFullYear();
});
