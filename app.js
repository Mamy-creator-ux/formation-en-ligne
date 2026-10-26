import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const app = document.getElementById("app");
const logoutBtn = document.getElementById("logout");

const CONTACTS = {
  tel: ["0388517134", "0328218844"],
  mail: ["mamyherver@gmail.com", "kohlernaomy@gmail.com", "freddafishera@gmail.com"],
  fb: [
    ["Profil (MP)", "https://web.facebook.com/profile.php?id=61588757650516"],
    ["Page", "https://web.facebook.com/profile.php?id=61594269681261"],
  ],
};

let token = localStorage.getItem("token");

// ---------- Utilitaires ----------
const $ = (sel) => document.querySelector(sel);

const el = (tag, cls = "", text = "") => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

const link = (href, text, cls = "btn") => {
  const a = el("a", cls, text);
  a.href = href;
  if (href.startsWith("http")) Object.assign(a, { target: "_blank", rel: "noopener" });
  return a;
};

// "+261 38..." ou "038..." -> format local "0XXXXXXXXX"
const normPhone = (p) => {
  const s = p.replace(/[^\d+]/g, "");
  return s.startsWith("+261") ? "0" + s.slice(4) : s;
};

// Appel d'une fonction SQL Supabase (RPC)
async function rpc(fn, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Erreur serveur");
  return data;
}

// ---------- Lecteur vidéo (YouTube, fichier mp4/webm, ou lien externe) ----------
function player(url) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    const f = el("iframe");
    f.src = `https://www.youtube.com/embed/${yt[1]}`;
    f.title = "Vidéo";
    f.allowFullscreen = true;
    return f;
  }
  if (/\.(mp4|webm)(\?|$)/i.test(url)) {
    const v = el("video");
    v.src = url;
    v.controls = true;
    return v;
  }
  return link(url, "Ouvrir la vidéo ↗");
}

function videoCard(v, admin) {
  const box = el("article", "item");
  box.append(el("h3", "", v.title), player(v.url));
  if (v.description) box.append(el("p", "muted", v.description));
  if (admin) {
    const del = el("button", "danger", "Supprimer");
    del.onclick = async () => {
      if (!confirm(`Supprimer « ${v.title} » ?`)) return;
      await rpc("admin_delete_video", { p_token: token, p_id: v.id });
      showHome();
    };
    box.append(del);
  }
  return box;
}

// ---------- Écrans ----------
function showLogin() {
  logoutBtn.hidden = true;
  app.innerHTML = `
    <section class="card narrow">
      <h2>Connexion</h2>
      <p class="muted">Entrez votre numéro et le code à usage unique donné par l'administrateur.</p>
      <form id="login-form">
        <input name="phone" type="tel" placeholder="Numéro (ex : 0388517134)" required>
        <input name="code" placeholder="Code (8 caractères)" autocomplete="one-time-code" required>
        <button>Se connecter</button>
        <p id="err" class="error"></p>
      </form>
    </section>`;
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      token = await rpc("login", { p_phone: normPhone(d.phone), p_code: d.code });
    } catch (err) {
      $("#err").textContent = err.message;
      return;
    }
    localStorage.setItem("token", token);
    await showHome();
  };
}

async function showHome() {
  const admin = await rpc("is_admin", { p_token: token });
  logoutBtn.hidden = false;
  app.innerHTML = `
    <section class="card">
      <h2>Mes formations</h2>
      <div id="videos" class="grid"></div>
    </section>
    ${admin ? `
    <section class="card">
      <h2>Administration</h2>
      <h3>Ajouter une vidéo</h3>
      <form id="add-video">
        <input name="title" placeholder="Titre" required>
        <input name="url" placeholder="Lien (YouTube, Facebook, fichier .mp4)" required>
        <textarea name="description" placeholder="Description (facultatif)"></textarea>
        <button>Ajouter</button>
      </form>
      <h3>Inviter un membre</h3>
      <form id="add-member">
        <input name="name" placeholder="Nom" required>
        <input name="phone" type="tel" placeholder="Téléphone" required>
        <button>Générer le code (24 h, usage unique)</button>
      </form>
      <p id="code-out" class="code"></p>
    </section>` : ""}
    <section class="card">
      <h2>Contacts des responsables</h2>
      <div id="contacts" class="contacts"></div>
    </section>`;

  $("#contacts").append(
    ...CONTACTS.tel.map((t) => link(`tel:${t}`, `📞 ${t}`)),
    ...CONTACTS.mail.map((m) => link(`mailto:${m}`, `✉️ ${m}`)),
    ...CONTACTS.fb.map(([label, url]) => link(url, `👍 ${label}`)),
  );

  const videos = await rpc("list_videos", { p_token: token });
  $("#videos").replaceChildren(
    ...(videos.length
      ? videos.map((v) => videoCard(v, admin))
      : [el("p", "muted", "Aucune vidéo pour le moment.")]),
  );

  if (admin) bindAdmin();
}

function bindAdmin() {
  $("#add-video").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!/^https?:\/\//.test(d.url)) return alert("Le lien doit commencer par http:// ou https://");
    await rpc("admin_add_video", {
      p_token: token, p_title: d.title, p_description: d.description, p_url: d.url,
    });
    showHome();
  };
  $("#add-member").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      const code = await rpc("admin_create_code", {
        p_token: token, p_phone: normPhone(d.phone), p_name: d.name,
      });
      $("#code-out").textContent = `Code de ${d.name} : ${code} (valable 24 h, usage unique)`;
      e.target.reset();
    } catch (err) {
      alert(err.message);
    }
  };
}

// ---------- Démarrage ----------
async function endSession() {
  await rpc("logout", { p_token: token }).catch(() => {});
  localStorage.removeItem("token");
  token = null;
  showLogin();
}

// Affiché une seule fois à l'admin avant la déconnexion
function showBackupCode(code) {
  logoutBtn.hidden = true;
  app.innerHTML = `
    <section class="card narrow">
      <h2>Code de secours administrateur</h2>
      <p class="muted">Notez ce code : il ne sera plus affiché. Il vous permettra de vous reconnecter (valable 30 jours, usage unique).</p>
      <p id="backup" class="code"></p>
      <button id="confirm-logout">J'ai noté le code, me déconnecter</button>
    </section>`;
  $("#backup").textContent = code;
  $("#confirm-logout").onclick = endSession;
}

logoutBtn.onclick = async () => {
  try {
    const admin = await rpc("is_admin", { p_token: token });
    if (!admin) return endSession();
    showBackupCode(await rpc("admin_prepare_logout", { p_token: token }));
  } catch (err) {
    alert("Déconnexion impossible : " + err.message);
  }
};

(async () => {
  if (!token) return showLogin();
  try {
    await showHome();
  } catch {
    localStorage.removeItem("token");
    token = null;
    showLogin();
  }
})();
