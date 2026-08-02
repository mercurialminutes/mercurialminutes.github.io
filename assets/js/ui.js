(function () {
  "use strict";

  const data = window.SITE_DATA;
  if (!data) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initBio() {
    const bio = document.getElementById("bio");
    if (bio) bio.textContent = data.bio;

    const portrait = document.getElementById("portrait");
    if (portrait && data.photo) portrait.src = data.photo;
  }

  function initYears() {
    const scroll = document.querySelector(".year-scroll");
    if (!scroll) return;

    // Keep the All chip already in HTML; append years newest-first
    const years = (data.years || []).slice().sort((a, b) => b - a);
    years.forEach((y) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "year-chip";
      btn.dataset.year = String(y);
      btn.textContent = String(y);
      scroll.appendChild(btn);
    });

    scroll.addEventListener("click", (e) => {
      const btn = e.target.closest(".year-chip");
      if (!btn) return;
      scroll.querySelectorAll(".year-chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      const year = btn.dataset.year;
      if (window.Boxes) window.Boxes.setYear(year);
    });
  }

  function initHighlights() {
    const ul = document.getElementById("list-highlights");
    if (!ul) return;
    ul.innerHTML = (data.highlights || [])
      .map(
        (h) =>
          `<li><span class="meta">${h.year}</span><a href="${escapeHtml(h.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(h.title)}</a></li>`
      )
      .join("");
  }

  function initUpcoming() {
    const ul = document.getElementById("list-upcoming");
    if (!ul) return;
    ul.innerHTML = (data.upcoming || [])
      .map((u) => {
        const title = u.url
          ? `<a href="${escapeHtml(u.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.title)}</a>`
          : `<span>${escapeHtml(u.title)}</span>`;
        const place = u.place ? `<span class="place">${escapeHtml(u.place)}</span>` : "";
        return `<li><span class="meta">${escapeHtml(u.date)}</span>${title}${place}</li>`;
      })
      .join("");
  }

  function initSocials() {
    const ul = document.getElementById("list-socials");
    if (!ul) return;
    ul.innerHTML = (data.socials || [])
      .map((s) => {
        const cls = s.primary ? "is-primary" : "";
        return `<li><a class="${cls}" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label)}</a></li>`;
      })
      .join("");
  }

  function initTabs() {
    const tabs = document.querySelectorAll(".tab");
    const panels = {
      highlights: document.getElementById("tab-highlights"),
      upcoming: document.getElementById("tab-upcoming"),
      socials: document.getElementById("tab-socials"),
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.tab;
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        Object.keys(panels).forEach((key) => {
          const panel = panels[key];
          if (!panel) return;
          const on = key === id;
          panel.classList.toggle("is-active", on);
          if (on) panel.removeAttribute("hidden");
          else panel.setAttribute("hidden", "");
        });
      });
    });
  }

  function init() {
    initBio();
    initYears();
    initHighlights();
    initUpcoming();
    initSocials();
    initTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
