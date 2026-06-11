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

function updateTextById(id, value) {
  const element = document.getElementById(id);
  if (element && Number.isFinite(value)) {
    element.textContent = value.toLocaleString();
  }
}

function loadWebsiteStats() {
  const statElements = [
    "registered-pis-stat",
    "project-spaces-stat",
    "users-stat",
  ];
  if (!statElements.some((id) => document.getElementById(id))) return;

  fetch("./stats.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Stats unavailable");
      return response.json();
    })
    .then((stats) => {
      updateTextById("registered-pis-stat", stats.registered_pis);
      updateTextById("project-spaces-stat", stats.project_spaces);
      updateTextById("users-stat", stats.users);
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
