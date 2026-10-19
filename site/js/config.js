// Site settings. Edit these, not app.js.
// Site root, worked out from this script's URL so the site runs at
// goldengateparkpianos.com/ or at a subpath like user.github.io/repo/.
const SITE_BASE = document.currentScript.src.replace(/js\/config\.js.*$/, "");

window.PIANO_CONFIG = {
  base: SITE_BASE,

  // Web app URL from Google Apps Script (Deploy > Manage deployments).
  // Leave empty to run in preview mode from data/preview.json.
  apiUrl: "https://script.google.com/macros/s/AKfycby8W0yuu4nqorzl2AMfsLqjhZiBFH1GTktRKxb9bgLm-C2yuqjinVmiP2n_Muv_4RQTaQ/exec",

  whatsappUrl: "https://chat.whatsapp.com/GUEL8VlF1jaBfo65T8gTt3",

  // Photo for each piano, keyed by the "id" column in the Pianos sheet.
  photos: {
    "conservatory": SITE_BASE + "img/conservatory.jpg",
    "blue-heron": SITE_BASE + "img/blue-heron.jpg"
  },
  defaultPhoto: SITE_BASE + "img/conservatory.jpg"
};
