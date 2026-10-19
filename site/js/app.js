(function () {
  "use strict";

  const CONFIG = window.PIANO_CONFIG;
  const BASE = CONFIG.base;
  const PREVIEW = !CONFIG.apiUrl;
  const STORAGE_KEY = "ggpp-code";

  // ---------- Helpers ----------

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const child of [].concat(children || [])) {
      if (child) node.append(child);
    }
    return node;
  }

  function photoFor(piano) {
    return CONFIG.photos[piano.id] || CONFIG.defaultPhoto;
  }

  function fetchWithTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 15000);
    return fetch(url, Object.assign({}, options, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  }

  async function loadPianos() {
    const url = PREVIEW ? BASE + "data/preview.json" : CONFIG.apiUrl;
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data.pianos.map((p) => ({
      id: String(p.id),
      name: p.name,
      open: p.open === true || String(p.open).toUpperCase() === "TRUE",
      status: p.status || ""
    }));
  }

  async function submitForm(payload) {
    if (PREVIEW) {
      const res = await fetch(BASE + "data/preview.json", { cache: "no-store" });
      const data = await res.json();
      const piano = data.pianos.find((p) => p.id === payload.piano) || data.pianos.find((p) => p.open);
      await new Promise((r) => setTimeout(r, 500));
      return { ok: true, piano: piano.name, combination: piano.combination };
    }
    // text/plain avoids a CORS preflight, which Apps Script can't answer.
    const res = await fetchWithTimeout(CONFIG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }, 20000);
    return res.json();
  }

  function wireWhatsApp() {
    document.querySelectorAll("[data-whatsapp]").forEach((a) => {
      a.href = CONFIG.whatsappUrl;
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  // ---------- Home page ----------

  function pianoCard(piano) {
    const cta = piano.open
      ? el("a", { class: "btn btn-primary btn-block", href: BASE + "access/?piano=" + encodeURIComponent(piano.id), text: "Get the code" })
      : el("span", { class: "btn btn-block", "aria-disabled": "true", text: "Closed" });

    return el("article", { class: "piano" + (piano.open ? "" : " is-closed") }, [
      el("div", { class: "piano-photo" }, el("img", { src: photoFor(piano), alt: "The " + piano.name + " piano", loading: "lazy" })),
      el("div", { class: "piano-body" }, [
        el("span", { class: "pill " + (piano.open ? "pill-open" : "pill-closed"), text: piano.open ? "Open" : "Closed" }),
        el("h3", { text: piano.name }),
        piano.status && el("p", { class: "piano-status", text: piano.status }),
        cta
      ])
    ]);
  }

  async function initHome() {
    const list = document.getElementById("piano-list");
    try {
      const pianos = await loadPianos();
      list.replaceChildren(...pianos.map(pianoCard));
    } catch (err) {
      list.replaceChildren(el("div", { class: "card" }, [
        el("p", { text: "Couldn't load the pianos. Refresh to try again." })
      ]));
    }
  }

  // ---------- Access form ----------

  function wireConfirm(input, word) {
    const check = () => {
      const v = input.value.trim().toUpperCase();
      input.classList.toggle("is-valid", v === word);
      input.classList.toggle("is-invalid", v.length >= word.length && v !== word);
    };
    input.addEventListener("input", check);
  }

  function initAccess() {
    const form = document.getElementById("access-form");
    const error = document.getElementById("form-error");
    const button = form.querySelector("button[type=submit]");
    // Set by the piano card's button; recorded with the submission.
    const piano = new URLSearchParams(location.search).get("piano") || "";

    wireConfirm(form.dry, "DRY");
    wireConfirm(form.locked, "LOCKED");
    form.querySelectorAll(".field .input").forEach((input) => {
      input.addEventListener("input", () => input.classList.remove("is-invalid"));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";

      for (const name of ["firstName", "lastName", "email", "phone"]) {
        const input = form[name];
        const bad = !input.value.trim() || !input.checkValidity();
        input.classList.toggle("is-invalid", bad);
        if (bad) {
          const label = form.querySelector('label[for="' + name + '"]').textContent;
          error.textContent = "Please enter a valid " + label.toLowerCase() + ".";
          input.focus();
          return;
        }
      }
      if (form.dry.value.trim().toUpperCase() !== "DRY") {
        error.textContent = 'Type "DRY" to agree.';
        form.dry.focus();
        return;
      }
      if (form.locked.value.trim().toUpperCase() !== "LOCKED") {
        error.textContent = 'Type "LOCKED" to agree.';
        form.locked.focus();
        return;
      }

      const payload = {
        piano: piano,
        firstName: form.firstName.value.trim(),
        lastName: form.lastName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        dry: form.dry.value.trim().toUpperCase(),
        locked: form.locked.value.trim().toUpperCase(),
        website: form.website.value
      };

      button.disabled = true;
      button.textContent = "Getting your code…";
      try {
        const result = await submitForm(payload);
        if (!result.ok) throw new Error(result.error || "Something went wrong.");
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          piano: result.piano,
          combination: result.combination,
          at: Date.now()
        }));
        location.href = BASE + "code/";
      } catch (err) {
        error.textContent = (err.name === "AbortError" ? "That took too long." : err.message) +
          " Please try again.";
        button.disabled = false;
        button.textContent = "Get the code";
      }
    });
  }

  // ---------- Code page ----------

  function initCode() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }
    if (!saved || !saved.combination) {
      location.replace(BASE + "access/");
      return;
    }
    const dials = document.getElementById("dials");
    const combo = String(saved.combination).toUpperCase();
    dials.replaceChildren(...[...combo].map((ch) => el("span", { class: "dial", text: ch })));
    dials.setAttribute("aria-label", "Combination: " + combo.split("").join(" "));
  }

  // ---------- Boot ----------

  wireWhatsApp();
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "access") initAccess();
  if (page === "code") initCode();
})();
