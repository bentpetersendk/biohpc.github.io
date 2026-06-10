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

document.addEventListener("DOMContentLoaded", () => {
  applyConfigBindings();
  markActiveNavigation();

  const year = document.querySelector("[data-current-year]");
  if (year) year.textContent = new Date().getFullYear();
});
