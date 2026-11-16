"use strict";

// En producción, cambia API_BASE por la URL pública del backend.
const API_BASE = "http://127.0.0.1:8000";
const $ = (id) => document.getElementById(id);
let mode = "login", token = localStorage.getItem("cm5_token"), me = null;
let activeConversation = null, socket = null, conversations = [];

function notice(message, error = true) {
  $("authNotice").textContent = message;
  $("authNotice").style.color = error ? "#ffb3b3" : "#8fe0b0";
}
function headers() { return { "Content-Type": "application/json", ...(token ? {Authorization:`Bearer ${token}`} : {}) }; }
async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {...options, headers:{...headers(), ...(options.headers||{})}});
  const data = await response.json().catch(()=>({detail:"Respuesta no válida del servidor."}));
  if (!response.ok) throw new Error(data.detail || "No se pudo completar la operación.");
  return data;
}
function setMode(next) {
  mode = next;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("authSubmit").textContent = mode === "login" ? "Entrar" : "Crear cuenta";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  notice("");
  $("forgotLink").classList.toggle("hidden", mode !== "login");
}
$("loginTab").onclick = () => setMode("login");
$("registerTab").onclick = () => setMode("register");

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = $("username").value.trim(), password = $("password").value;
  try {
    const result = await api(`/api/${mode}`, {method:"POST", body:JSON.stringify({username,password})});
    token = result.token; localStorage.setItem("cm5_token", token);
    await startApp();
  } catch (error) { notice(error.message); }
});
$("logoutBtn").onclick = () => {
  if (socket) socket.close();
  localStorage.removeItem("cm5_token"); token = null; me = null;
  $("appView").classList.add("hidden"); $("authView").classList.remove("hidden");
};
async function startApp() {
  me = await api("/api/me");
  $("authView").classList.add("hidden"); $("appView").classList.remove("hidden");
  applyProfile();
  await loadConversations();
}
async function loadConversations() {
  conversations = await api("/api/conversations");
  $("conversationList").innerHTML = "";
  conversations.forEach(c => {
    const button = document.createElement("button"); button.className = "person-row";
    button.innerHTML = `<div class="avatar">${(c.other_user||"?")[0].toUpperCase()}</div><div class="person-info"><strong></strong><small></small></div>`;
    button.querySelector("strong").textContent = c.other_user || "Conversación";
    button.querySelector("small").textContent = c.last_message || "Todavía no hay mensajes";
    button.onclick = () => openConversation(c.id, c.other_user);
    $("conversationList").append(button);
  });
}
$("searchBtn").onclick = searchUsers;
$("userSearch").addEventListener("keydown", e => { if(e.key === "Enter") searchUsers(); });
async function searchUsers() {
  try {
    const users = await api("/api/users?q=" + encodeURIComponent($("userSearch").value.trim()));
    $("userResults").innerHTML = "";
    users.forEach(u => {
      const button = document.createElement("button"); button.className = "person-row";
      button.innerHTML = `<div class="avatar">${u.username[0].toUpperCase()}</div><div class="person-info"><strong></strong><small>Empezar conversación</small></div>`;
      button.querySelector("strong").textContent = u.username;
      button.onclick = async () => {
        try {
          const result = await api(`/api/conversations/${u.id}`, {method:"POST"});
          await loadConversations(); await openConversation(result.id, u.username);
        } catch(error) { alert(error.message); }
      };
      $("userResults").append(button);
    });
    if (!users.length) $("userResults").textContent = "No se encontraron usuarios.";
  } catch(error) { alert(error.message); }
}
async function openConversation(id, username) {
  activeConversation = id;
  if (socket) socket.close();
  $("chatTitle").textContent = username; $("chatSubtitle").textContent = "Conexión en tiempo real";
  $("chatAvatar").textContent = username[0].toUpperCase();
  $("emptyState").classList.add("hidden"); $("messages").classList.remove("hidden"); $("messageForm").classList.remove("hidden");
  const messages = await api(`/api/conversations/${id}/messages`);
  $("messages").innerHTML = ""; messages.forEach(renderMessage); scrollMessages();
  const wsBase = API_BASE.replace(/^http/, "ws");
  socket = new WebSocket(`${wsBase}/ws/${id}?token=${encodeURIComponent(token)}`);
  socket.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.type === "message" && msg.conversation_id === activeConversation) { renderMessage(msg); scrollMessages(); }
  };
  socket.onclose = () => { if (activeConversation === id) $("chatSubtitle").textContent = "Conexión cerrada; vuelve a abrir el chat."; };
}
function renderMessage(msg) {
  const article = document.createElement("article");
  article.className = "message" + (msg.sender_id === me.id ? " mine" : "");
  const name = document.createElement("strong"); name.textContent = msg.username;
  const body = document.createElement("p"); body.textContent = msg.content;
  const time = document.createElement("time"); time.textContent = msg.created_at || "";
  article.append(name, body, time); $("messages").append(article);
}
function scrollMessages() { $("messages").scrollTop = $("messages").scrollHeight; }
$("messageForm").addEventListener("submit", event => {
  event.preventDefault();
  const content = $("messageInput").value.trim();
  if (!content || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({content})); $("messageInput").value = "";
});

function setAuthNotice(message, error = true) {
  $("authNotice").textContent = message;
  $("authNotice").style.color = error ? "#ffb3b3" : "#8fe0b0";
}
function applyTheme(theme) {
  document.body.classList.remove("theme-light", "theme-midnight");
  if (theme === "light") document.body.classList.add("theme-light");
  if (theme === "midnight") document.body.classList.add("theme-midnight");
  document.querySelectorAll(".theme-choice").forEach(btn => btn.classList.toggle("active", btn.dataset.theme === theme));
}
function applyProfile() {
  const display = me.display_name || me.username;
  $("myName").textContent = display;
  $("myAvatar").textContent = display[0]?.toUpperCase() || "?";
  if (me.avatar_url) {
    $("myAvatar").style.backgroundImage = `url("${me.avatar_url.replace(/["\\]/g, "")}")`;
    $("myAvatar").style.backgroundSize = "cover";
    $("myAvatar").textContent = "";
  } else {
    $("myAvatar").style.backgroundImage = "";
  }
  applyTheme(me.theme || "dark");
}
function openSettings() {
  $("settingsOverlay").classList.remove("hidden");
  $("displayName").value = me.display_name || "";
  $("profileEmail").value = me.email || "";
  $("profilePhone").value = me.phone || "";
  $("profileBio").value = me.bio || "";
  $("profileAvatar").value = me.avatar_url || "";
  showSettingsPanel("profilePanel");
}
function showSettingsPanel(panelId) {
  document.querySelectorAll(".settings-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== panelId));
  document.querySelectorAll(".settings-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.panel === panelId));
}
$("settingsBtn").onclick = openSettings;
$("closeSettings").onclick = () => $("settingsOverlay").classList.add("hidden");
$("settingsOverlay").addEventListener("click", event => { if (event.target === $("settingsOverlay")) $("settingsOverlay").classList.add("hidden"); });
document.querySelectorAll(".settings-tab").forEach(tab => tab.onclick = () => showSettingsPanel(tab.dataset.panel));
document.querySelectorAll(".theme-choice").forEach(btn => btn.onclick = async () => {
  const theme = btn.dataset.theme;
  try {
    const payload = {display_name: me.display_name || "", email: me.email || "", phone: me.phone || "", bio: me.bio || "", avatar_url: me.avatar_url || "", theme};
    const result = await api("/api/profile", {method:"PUT", body:JSON.stringify(payload)});
    me = result.profile; applyProfile();
    $("settingsNotice").textContent = "Apariencia actualizada.";
    $("settingsNotice").style.color = "#8fe0b0";
  } catch (error) { $("settingsNotice").textContent = error.message; }
});
$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const result = await api("/api/profile", {method:"PUT", body:JSON.stringify({
      display_name: $("displayName").value, email: $("profileEmail").value,
      phone: $("profilePhone").value, bio: $("profileBio").value,
      avatar_url: $("profileAvatar").value, theme: me.theme || "dark"
    })});
    me = result.profile; applyProfile();
    $("settingsNotice").textContent = "Perfil guardado correctamente.";
    $("settingsNotice").style.color = "#8fe0b0";
  } catch (error) {
    $("settingsNotice").textContent = error.message;
    $("settingsNotice").style.color = "#ffb3b3";
  }
});

$("forgotLink").onclick = () => {
  $("authForm").classList.add("hidden"); $("loginTab").classList.add("hidden"); $("registerTab").classList.add("hidden");
  $("forgotLink").classList.add("hidden"); $("recoveryPanel").classList.remove("hidden");
  $("recoveryRequestForm").classList.remove("hidden"); $("recoveryResetForm").classList.add("hidden");
  setAuthNotice("");
};
$("backToLogin").onclick = () => {
  $("recoveryPanel").classList.add("hidden"); $("authForm").classList.remove("hidden");
  $("loginTab").classList.remove("hidden"); $("registerTab").classList.remove("hidden");
  setMode("login");
};
let recoveryIdentifier = "";
$("recoveryRequestForm").addEventListener("submit", async event => {
  event.preventDefault(); recoveryIdentifier = $("recoveryIdentifier").value.trim();
  try {
    const result = await api("/api/recovery/request", {method:"POST", body:JSON.stringify({identifier:recoveryIdentifier})});
    setAuthNotice(result.message, false);
    $("recoveryRequestForm").classList.add("hidden"); $("recoveryResetForm").classList.remove("hidden");
  } catch (error) { setAuthNotice(error.message); }
});
$("recoveryResetForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const result = await api("/api/recovery/reset", {method:"POST", body:JSON.stringify({identifier:recoveryIdentifier, code:$("recoveryCode").value.trim(), new_password:$("newPassword").value})});
    setAuthNotice(result.message, false);
    $("recoveryPanel").classList.add("hidden"); $("authForm").classList.remove("hidden");
    $("loginTab").classList.remove("hidden"); $("registerTab").classList.remove("hidden");
    $("username").value = ""; $("password").value = ""; setMode("login");
  } catch (error) { setAuthNotice(error.message); }
});

if (token) startApp().catch(() => { localStorage.removeItem("cm5_token"); token = null; });
