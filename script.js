"use strict";

/* =========================================================
   CHATMESSAGGIN 3.0
   Mensajería, comunidades y administración local.
   ========================================================= */

const STORAGE = {
    friends: "cm_friends",
    communities: "cm_communities",
    profile: "chatmessaggin_profile",
    conversations: "cm_conversations",
    notifications: "cm_notifications",
    settings: "cm_settings"
};

const DEFAULT_PROFILE = {
    name: "Usuario",
    username: "usuario",
    avatar: "",
    banner: "",
    bio: "",
    status: "online"
};

const DEFAULT_SETTINGS = {
    theme: "dark",
    accent: "#287bff",
    fontScale: 100,
    showOnlineStatus: true,
    allowFriendRequests: true,
    notifications: true,
    sound: false,
    compactMode: false,
    reducedMotion: false,
    language: "es"
};

let profile = loadData(STORAGE.profile, DEFAULT_PROFILE);
let friends = loadData(STORAGE.friends, []);
let communities = loadData(STORAGE.communities, []);
let conversations = loadData(STORAGE.conversations, []);
let notifications = loadData(STORAGE.notifications, []);
let settings = loadData(STORAGE.settings, DEFAULT_SETTINGS);

let activeCommunityId = null;
let activeConversationId = null;
let activeAdminCommunityId = null;
let currentSettingsPanel = "account";

/* =========================================================
   UTILIDADES
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function loadData(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return structuredCloneSafe(fallback);

        const parsed = JSON.parse(stored);
        return parsed ?? structuredCloneSafe(fallback);
    } catch (error) {
        console.warn("No se pudieron cargar los datos:", key, error);
        return structuredCloneSafe(fallback);
    }
}

function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("No se pudieron guardar los datos:", error);
        toast("No se pudieron guardar los cambios.", "error");
        return false;
    }
}

function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
}

function makeId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function cleanText(value, maxLength = 500) {
    return String(value ?? "").trim().slice(0, maxLength);
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha desconocida";

    return date.toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function toast(message, type = "info") {
    const container = $("toastContainer");

    if (!container) {
        console.log(`[${type}] ${message}`);
        return;
    }

    const element = document.createElement("div");
    element.className = `toast toast-${type}`;
    element.textContent = message;

    container.appendChild(element);

    setTimeout(() => {
        element.classList.add("toast-hide");
        setTimeout(() => element.remove(), 300);
    }, 3000);
}

function persistAll() {
    saveData(STORAGE.profile, profile);
    saveData(STORAGE.friends, friends);
    saveData(STORAGE.communities, communities);
    saveData(STORAGE.conversations, conversations);
    saveData(STORAGE.notifications, notifications);
    saveData(STORAGE.settings, settings);
}

function getCurrentCommunity() {
    return communities.find(c => c.id === activeCommunityId) || null;
}

function getAdminCommunity() {
    return communities.find(c => c.id === activeAdminCommunityId) || null;
}

function isCommunityOwner(community) {
    return community && community.owner === profile.username;
}

function createNotification(title, message) {
    notifications.unshift({
        id: makeId("notification"),
        title: cleanText(title, 100),
        message: cleanText(message, 300),
        date: new Date().toISOString(),
        read: false
    });

    notifications = notifications.slice(0, 100);
    saveData(STORAGE.notifications, notifications);
    renderNotifications();
    renderNotificationCount();
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function navigate(view) {
    const sections = [
        "home",
        "messages",
        "friends",
        "communities",
        "communityView",
        "createCommunity",
        "notifications",
        "profile",
        "settings"
    ];

    sections.forEach(name => {
        const section = $(`${name}Section`);
        if (section) section.hidden = name !== view;
    });

    document.querySelectorAll("[data-view]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === view
        );
    });

    if (view === "home") renderDashboard();
    if (view === "friends") renderFriends();
    if (view === "communities") renderCommunities();
    if (view === "notifications") renderNotifications();
    if (view === "profile") renderProfile();

    window.scrollTo?.({ top: 0, behavior: "smooth" });
}

/* =========================================================
   PERFIL
   ========================================================= */

function renderProfile() {
    const name = $("profileName");
    const username = $("profileUsername");
    const bio = $("profileBio");
    const avatar = $("profileAvatar");

    if (name) name.textContent = profile.name;
    if (username) username.textContent = `@${profile.username}`;
    if (bio) bio.textContent = profile.bio || "Sin descripción.";

    if (avatar && profile.avatar) {
        avatar.src = profile.avatar;
    }

    const nameInput = $("profileNameInput");
    const usernameInput = $("profileUsernameInput");
    const bioInput = $("profileBioInput");

    if (nameInput && document.activeElement !== nameInput) {
        nameInput.value = profile.name;
    }

    if (usernameInput && document.activeElement !== usernameInput) {
        usernameInput.value = profile.username;
    }

    if (bioInput && document.activeElement !== bioInput) {
        bioInput.value = profile.bio;
    }
}

function handleProfileSubmit(event) {
    event.preventDefault();

    const name = cleanText($("profileNameInput")?.value, 40);
    const username = cleanText($("profileUsernameInput")?.value, 24)
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, "");
    const bio = cleanText($("profileBioInput")?.value, 190);

    if (!name || !username) {
        toast("El nombre y el usuario son obligatorios.", "error");
        return;
    }

    profile.name = name;
    profile.username = username;
    profile.bio = bio;

    saveData(STORAGE.profile, profile);
    renderProfile();
    renderDashboard();
    toast("Perfil actualizado.", "success");
}

/* =========================================================
   AMIGOS
   ========================================================= */

function renderFriends() {
    const container = $("friendsList");
    if (!container) return;

    if (!friends.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Tu lista de amigos está vacía</h3>
                <p>Añade contactos para tenerlos a mano.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = friends.map(friend => `
        <div class="friend-card" data-friend-id="${escapeHTML(friend.id)}">
            <div class="friend-avatar">
                ${escapeHTML((friend.name || "?").charAt(0).toUpperCase())}
            </div>
            <div class="friend-info">
                <strong>${escapeHTML(friend.name)}</strong>
                <span>@${escapeHTML(friend.username)}</span>
            </div>
            <div class="friend-actions">
                <button type="button" data-action="message-friend"
                    data-id="${escapeHTML(friend.id)}">Mensaje</button>
                <button type="button" data-action="remove-friend"
                    data-id="${escapeHTML(friend.id)}">Eliminar</button>
            </div>
        </div>
    `).join("");
}

function handleFriendSubmit(event) {
    event.preventDefault();

    const input = $("friendUsername");
    const username = cleanText(input?.value, 24)
        .replace(/^@/, "")
        .toLowerCase();

    if (!/^[a-z0-9_.]{2,24}$/.test(username)) {
        toast("Introduce un nombre de usuario válido.", "error");
        return;
    }

    if (username === profile.username.toLowerCase()) {
        toast("No puedes añadirte a ti mismo.", "error");
        return;
    }

    if (friends.some(friend => friend.username.toLowerCase() === username)) {
        toast("Ese usuario ya está en tus amigos.", "warning");
        return;
    }

    friends.push({
        id: makeId("friend"),
        name: username,
        username,
        addedAt: new Date().toISOString()
    });

    saveData(STORAGE.friends, friends);
    renderFriends();

    if (input) input.value = "";

    toast("Contacto añadido localmente.", "success");
}

function removeFriend(id) {
    const friend = friends.find(item => item.id === id);
    if (!friend) return;

    if (!confirm(`¿Eliminar a ${friend.name} de tus amigos?`)) return;

    friends = friends.filter(item => item.id !== id);
    saveData(STORAGE.friends, friends);
    renderFriends();
    toast("Contacto eliminado.");
}

/* =========================================================
   CONVERSACIONES PRIVADAS Y GRUPOS
   ========================================================= */

function renderConversations() {
    const container = $("conversationList");
    if (!container) return;

    if (!conversations.length) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Todavía no tienes conversaciones.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conversation => {
        const lastMessage = conversation.messages?.at(-1);

        return `
            <button type="button"
                class="conversation-item ${activeConversationId === conversation.id ? "active" : ""}"
                data-action="open-conversation"
                data-id="${escapeHTML(conversation.id)}">
                <div class="conversation-avatar">
                    ${escapeHTML((conversation.name || "?").charAt(0).toUpperCase())}
                </div>
                <div class="conversation-info">
                    <strong>${escapeHTML(conversation.name)}</strong>
                    <span>${escapeHTML(lastMessage?.text || "Nueva conversación")}</span>
                </div>
            </button>
        `;
    }).join("");
}

function openPrivateConversation(friendId) {
    const friend = friends.find(item => item.id === friendId);
    if (!friend) return;

    let conversation = conversations.find(item =>
        item.type === "private" && item.friendId === friendId
    );

    if (!conversation) {
        conversation = {
            id: makeId("conversation"),
            type: "private",
            name: friend.name,
            friendId,
            messages: [],
            createdAt: new Date().toISOString()
        };

        conversations.push(conversation);
        saveData(STORAGE.conversations, conversations);
    }

    openConversation(conversation.id);
    navigate("messages");
}

function createGroupConversation() {
    const name = cleanText(prompt("Nombre del grupo:"), 50);
    if (!name) return;

    const conversation = {
        id: makeId("group"),
        type: "group",
        name,
        messages: [],
        members: [profile.username],
        createdAt: new Date().toISOString()
    };

    conversations.push(conversation);
    saveData(STORAGE.conversations, conversations);
    renderConversations();
    openConversation(conversation.id);
    navigate("messages");

    toast("Grupo creado.", "success");
}

function openConversation(id) {
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) return;

    activeConversationId = id;

    const activeChat = $("activeChat");
    const placeholder = $("chatPlaceholder");
    const title = $("chatTitle");

    if (activeChat) activeChat.hidden = false;
    if (placeholder) placeholder.hidden = true;
    if (title) title.textContent = conversation.name;

    renderConversations();
    renderConversationMessages();
}

function renderConversationMessages() {
    const container = $("chatMessages");
    const conversation = conversations.find(item => item.id === activeConversationId);

    if (!container || !conversation) return;

    container.innerHTML = (conversation.messages || []).map(message => `
        <div class="message ${message.author === profile.username ? "own-message" : ""}">
            <div class="message-meta">
                <strong>${escapeHTML(message.author)}</strong>
                <span>${formatDate(message.date)}</span>
            </div>
            <p>${escapeHTML(message.text)}</p>
        </div>
    `).join("");

    container.scrollTop = container.scrollHeight;
}

function handleMessageSubmit(event) {
    event.preventDefault();

    const input = $("messageInput");
    const text = cleanText(input?.value, 2000);

    if (!text || !activeConversationId) return;

    const conversation = conversations.find(item =>
        item.id === activeConversationId
    );

    if (!conversation) return;

    conversation.messages ||= [];
    conversation.messages.push({
        id: makeId("message"),
        author: profile.username,
        text,
        date: new Date().toISOString()
    });

    saveData(STORAGE.conversations, conversations);

    if (input) input.value = "";

    renderConversationMessages();
    renderConversations();
}

/* =========================================================
   COMUNIDADES
   ========================================================= */

function normalizeCommunity(community) {
    community.channels ||= [];
    community.members ||= [];
    community.messages ||= [];
    community.roles ||= [];
    community.invites ||= [];
    community.audit ||= [];
    community.emojis ||= [];
    community.rules ||= "";
    community.description ||= "";
    community.visibility ||= community.privacy === "private" ? "private" : "public";

    community.channels.forEach(channel => {
        channel.messages ||= [];
        channel.type ||= "text";
    });

    return community;
}

function renderCommunities() {
    const container = $("communitiesList");
    if (!container) return;

    if (!communities.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Aún no perteneces a ninguna comunidad</h3>
                <p>Crea una comunidad o únete a una invitación.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = communities.map(community => `
        <button type="button" class="community-card"
            data-action="open-community"
            data-id="${escapeHTML(community.id)}">
            <div class="community-icon">
                ${escapeHTML(community.icon || "◈")}
            </div>
            <div>
                <strong>${escapeHTML(community.name)}</strong>
                <p>${escapeHTML(community.description || "Sin descripción")}</p>
                <small>${community.members.length} miembros</small>
            </div>
        </button>
    `).join("");
}

function createCommunity(event) {
    event.preventDefault();

    const name = cleanText($("communityName")?.value, 50);
    const description = cleanText($("communityDescription")?.value, 250);

    if (name.length < 2) {
        toast("El nombre debe tener al menos 2 caracteres.", "error");
        return;
    }

    const community = {
        id: makeId("community"),
        name,
        description,
        icon: "◈",
        banner: "",
        owner: profile.username,
        visibility: "public",
        rules: "",
        members: [{
            username: profile.username,
            role: "owner",
            joinedAt: new Date().toISOString()
        }],
        channels: [
            {
                id: makeId("channel"),
                name: "general",
                type: "text",
                topic: "Canal general",
                messages: []
            },
            {
                id: makeId("channel"),
                name: "bienvenida",
                type: "text",
                topic: "Da la bienvenida a los nuevos miembros",
                messages: []
            }
        ],
        messages: [],
        roles: [
            {
                id: "admin",
                name: "Administrador",
                color: "#8955f5",
                permissions: ["manage_channels", "manage_members", "manage_roles"]
            },
            {
                id: "member",
                name: "Miembro",
                color: "#287bff",
                permissions: ["send_messages"]
            }
        ],
        invites: [],
        audit: [],
        emojis: [],
        createdAt: new Date().toISOString()
    };

    communities.push(community);
    saveData(STORAGE.communities, communities);

    const form = $("communityForm");
    if (form) form.reset();

    renderCommunities();
    openCommunity(community.id);
    toast("Comunidad creada.", "success");
}

function openCommunity(id) {
    const community = communities.find(item => item.id === id);
    if (!community) return;

    normalizeCommunity(community);
    activeCommunityId = id;

    const title = $("communityViewName");
    const description = $("communityViewDescription");

    if (title) title.textContent = community.name;
    if (description) description.textContent = community.description;

    renderChannels();
    renderMembers();
    renderCommunityMessages();

    const messageForm = $("communityMessageForm");
    if (messageForm) messageForm.hidden = false;

    navigate("communityView");
}

function renderChannels() {
    const community = getCurrentCommunity();
    const container = $("communityChannels");

    if (!community || !container) return;

    container.innerHTML = community.channels.map(channel => `
        <button type="button"
            class="channel-item"
            data-action="select-channel"
            data-id="${escapeHTML(channel.id)}">
            <span>${channel.type === "voice" ? "🔊" : "#"}</span>
            ${escapeHTML(channel.name)}
        </button>
    `).join("");
}

function renderMembers() {
    const community = getCurrentCommunity();
    const container = $("communityMembers");

    if (!community || !container) return;

    container.innerHTML = community.members.map(member => `
        <div class="member-item">
            <span>${escapeHTML(member.username)}</span>
            <small>${escapeHTML(member.role || "member")}</small>
        </div>
    `).join("");
}

function renderCommunityMessages(channelId) {
    const community = getCurrentCommunity();
    const container = $("communityMessages");

    if (!community || !container) return;

    const channel = community.channels.find(item => item.id === channelId)
        || community.channels.find(item => item.type === "text");

    if (!channel) {
        container.innerHTML = `<p class="empty-state">No hay canales de texto.</p>`;
        return;
    }

    container.innerHTML = (channel.messages || []).map(message => `
        <div class="message">
            <div class="message-meta">
                <strong>${escapeHTML(message.author)}</strong>
                <span>${formatDate(message.date)}</span>
            </div>
            <p>${escapeHTML(message.text)}</p>
        </div>
    `).join("");

    container.scrollTop = container.scrollHeight;
}

function handleCommunityMessage(event) {
    event.preventDefault();

    const community = getCurrentCommunity();
    const input = $("communityMessageInput");
    const text = cleanText(input?.value, 2000);

    if (!community || !text) return;

    let channel = community.channels.find(item => item.type === "text");

    if (!channel) {
        toast("Esta comunidad no tiene canales de texto.", "warning");
        return;
    }

    channel.messages ||= [];
    channel.messages.push({
        id: makeId("message"),
        author: profile.username,
        text,
        date: new Date().toISOString()
    });

    saveData(STORAGE.communities, communities);

    if (input) input.value = "";

    renderCommunityMessages(channel.id);
}

function addCommunityChannel() {
    const community = getCurrentCommunity();
    if (!community) return;

    const name = cleanText(prompt("Nombre del nuevo canal:"), 40)
        .toLowerCase()
        .replace(/\s+/g, "-");

    if (!name) return;

    if (community.channels.some(channel => channel.name === name)) {
        toast("Ya existe un canal con ese nombre.", "warning");
        return;
    }

    community.channels.push({
        id: makeId("channel"),
        name,
        type: "text",
        topic: "",
        messages: []
    });

    saveData(STORAGE.communities, communities);
    renderChannels();
    addAuditEntry(community, `Canal #${name} creado`);
    toast("Canal creado.", "success");
}

function joinCommunityByInvite(event) {
    event.preventDefault();

    const input = $("inviteLinkInput");
    const invite = cleanText(input?.value, 300);

    const match = invite.match(/chatmessaggin:\/\/invite\/([a-zA-Z0-9_-]+)/);

    if (!match) {
        toast("El enlace de invitación no es válido.", "error");
        return;
    }

    const community = communities.find(item => item.id === match[1]);

    if (!community) {
        toast("No se ha encontrado esa comunidad en este dispositivo.", "error");
        return;
    }

    if (community.members.some(member => member.username === profile.username)) {
        toast("Ya formas parte de esta comunidad.", "warning");
        return;
    }

    community.members.push({
        username: profile.username,
        role: "member",
        joinedAt: new Date().toISOString()
    });

    saveData(STORAGE.communities, communities);
    renderCommunities();

    if (input) input.value = "";

    toast("Te has unido a la comunidad local.", "success");
}

/* =========================================================
   CENTRO DE ADMINISTRACIÓN
   ========================================================= */

function openCommunityAdmin() {
    const community = getCurrentCommunity();

    if (!community) {
        toast("Abre primero una comunidad.", "warning");
        return;
    }

    if (!isCommunityOwner(community)) {
        toast("Solo el propietario puede administrar esta comunidad.", "error");
        return;
    }

    activeAdminCommunityId = community.id;

    const overlay = $("communityAdminOverlay");
    if (overlay) overlay.hidden = false;

    renderAdmin();
    openAdminTab("overview");
}

function closeCommunityAdmin() {
    const overlay = $("communityAdminOverlay");
    if (overlay) overlay.hidden = true;

    activeAdminCommunityId = null;
}

function openAdminTab(tab) {
    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.adminTab === tab);
    });

    document.querySelectorAll("[data-admin-panel]").forEach(panel => {
        panel.hidden = panel.dataset.adminPanel !== tab;
    });

    if (tab === "overview") renderAdminOverview();
    if (tab === "channels") renderAdminChannels();
    if (tab === "members") renderAdminMembers();
    if (tab === "roles") renderAdminRoles();
    if (tab === "invitations") renderAdminInvites();
    if (tab === "audit") renderAdminAudit();
    if (tab === "emojis") renderAdminEmojis();
    if (tab === "community") fillAdminCommunityForm();
}

function renderAdmin() {
    const community = getAdminCommunity();
    if (!community) return;

    const name = $("adminCommunityName");
    if (name) name.textContent = community.name;

    renderAdminOverview();
    renderAdminChannels();
    renderAdminMembers();
    renderAdminRoles();
    renderAdminInvites();
    renderAdminAudit();
    renderAdminEmojis();
    fillAdminCommunityForm();
}

function renderAdminOverview() {
    const community = getAdminCommunity();
    if (!community) return;

    const stats = {
        members: community.members.length,
        channels: community.channels.length,
        roles: community.roles.length,
        invites: community.invites.filter(invite => !invite.revoked).length
    };

    const mappings = {
        adminMemberCount: stats.members,
        adminChannelCount: stats.channels,
        adminRoleCount: stats.roles,
        adminInviteCount: stats.invites
    };

    Object.entries(mappings).forEach(([id, value]) => {
        const element = $(id);
        if (element) element.textContent = value;
    });
}

function fillAdminCommunityForm() {
    const community = getAdminCommunity();
    if (!community) return;

    const fields = {
        adminNameInput: community.name,
        adminDescriptionInput: community.description,
        adminIconInput: community.icon,
        adminBannerInput: community.banner,
        adminVisibilityInput: community.visibility,
        adminRulesInput: community.rules
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = $(id);
        if (element && document.activeElement !== element) {
            element.value = value || "";
        }
    });
}

function handleAdminCommunitySubmit(event) {
    event.preventDefault();

    const community = getAdminCommunity();
    if (!community) return;

    const name = cleanText($("adminNameInput")?.value, 50);

    if (name.length < 2) {
        toast("El nombre debe tener al menos 2 caracteres.", "error");
        return;
    }

    community.name = name;
    community.description = cleanText($("adminDescriptionInput")?.value, 250);
    community.icon = cleanText($("adminIconInput")?.value, 10) || "◈";
    community.banner = cleanText($("adminBannerInput")?.value, 500);
    community.visibility = $("adminVisibilityInput")?.value || "public";
    community.rules = cleanText($("adminRulesInput")?.value, 2000);

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, "Información de la comunidad actualizada");

    const title = $("communityViewName");
    const description = $("communityViewDescription");

    if (title) title.textContent = community.name;
    if (description) description.textContent = community.description;

    renderCommunities();
    renderAdmin();
    toast("Comunidad actualizada.", "success");
}

/* -------------------- CANALES -------------------- */

function renderAdminChannels() {
    const community = getAdminCommunity();
    const container = $("adminChannelsList");

    if (!community || !container) return;

    if (!community.channels.length) {
        container.innerHTML = `<div class="admin-empty">No hay canales todavía.</div>`;
        return;
    }

    container.innerHTML = community.channels.map(channel => `
        <div class="admin-managed-item">
            <div>
                <strong>${channel.type === "voice" ? "🔊" : "#"} ${escapeHTML(channel.name)}</strong>
                <small>${channel.type === "voice" ? "Canal de voz" : "Canal de texto"}</small>
                <small>${escapeHTML(channel.topic || "Sin descripción")}</small>
            </div>
            <button type="button" data-admin-action="delete-channel"
                data-id="${escapeHTML(channel.id)}">Eliminar</button>
        </div>
    `).join("");
}

function handleAdminChannelSubmit(event) {
    event.preventDefault();

    const community = getAdminCommunity();
    if (!community) return;

    const name = cleanText($("adminChannelName")?.value, 40)
        .toLowerCase()
        .replace(/\s+/g, "-");

    const type = $("adminChannelType")?.value || "text";
    const topic = cleanText($("adminChannelTopic")?.value, 150);

    if (!name) {
        toast("Escribe un nombre para el canal.", "error");
        return;
    }

    if (community.channels.some(channel => channel.name === name)) {
        toast("Ya existe un canal con ese nombre.", "warning");
        return;
    }

    community.channels.push({
        id: makeId("channel"),
        name,
        type: type === "voice" ? "voice" : "text",
        topic,
        messages: []
    });

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, `Canal ${name} creado`);

    event.target.reset();
    renderAdminChannels();
    renderAdminOverview();
    renderChannels();

    toast("Canal añadido.", "success");
}

/* -------------------- MIEMBROS -------------------- */

function renderAdminMembers(filter = "") {
    const community = getAdminCommunity();
    const container = $("adminMembersList");

    if (!community || !container) return;

    const query = filter.toLowerCase();

    const filtered = community.members.filter(member =>
        member.username.toLowerCase().includes(query)
    );

    if (!filtered.length) {
        container.innerHTML = `<div class="admin-empty">No se encontraron miembros.</div>`;
        return;
    }

    container.innerHTML = filtered.map(member => {
        const isOwner = member.username === community.owner;

        return `
            <div class="admin-managed-item">
                <div>
                    <strong>${escapeHTML(member.username)}</strong>
                    <small>${escapeHTML(member.role || "member")}</small>
                </div>
                <div class="admin-member-actions">
                    ${isOwner
                        ? `<span class="admin-badge">Propietario</span>`
                        : `<button type="button"
                            data-admin-action="change-member-role"
                            data-id="${escapeHTML(member.username)}">Cambiar rol</button>
                           <button type="button"
                            data-admin-action="remove-member"
                            data-id="${escapeHTML(member.username)}">Expulsar</button>`
                    }
                </div>
            </div>
        `;
    }).join("");
}

function changeMemberRole(username) {
    const community = getAdminCommunity();
    if (!community) return;

    const member = community.members.find(item => item.username === username);
    if (!member || username === community.owner) return;

    const roles = community.roles.map(role => role.name);
    const selected = prompt(
        `Roles disponibles:\n${roles.join(", ")}\n\nEscribe el nuevo rol:`,
        member.role || "member"
    );

    if (!selected) return;

    const role = community.roles.find(item =>
        item.name.toLowerCase() === selected.toLowerCase()
    );

    if (!role) {
        toast("Ese rol no existe.", "error");
        return;
    }

    member.role = role.name;

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, `Rol de ${username} cambiado a ${role.name}`);
    renderAdminMembers();
    renderMembers();

    toast("Rol actualizado.", "success");
}

function removeCommunityMember(username) {
    const community = getAdminCommunity();
    if (!community || username === community.owner) return;

    if (!confirm(`¿Expulsar a ${username} de esta comunidad local?`)) return;

    community.members = community.members.filter(member =>
        member.username !== username
    );

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, `${username} fue expulsado`);

    renderAdminMembers();
    renderAdminOverview();
    renderMembers();

    toast("Miembro eliminado.", "success");
}

/* -------------------- ROLES -------------------- */

function renderAdminRoles() {
    const community = getAdminCommunity();
    const container = $("adminRolesList");

    if (!community || !container) return;

    if (!community.roles.length) {
        container.innerHTML = `<div class="admin-empty">No hay roles creados.</div>`;
        return;
    }

    container.innerHTML = community.roles.map(role => `
        <div class="admin-role-card">
            <span class="role-color" style="background:${escapeHTML(role.color)}"></span>
            <strong>${escapeHTML(role.name)}</strong>
            <small>${(role.permissions || []).length} permisos</small>
            <button type="button" data-admin-action="delete-role"
                data-id="${escapeHTML(role.id)}">Eliminar</button>
        </div>
    `).join("");
}

function handleAdminRoleSubmit(event) {
    event.preventDefault();

    const community = getAdminCommunity();
    if (!community) return;

    const name = cleanText($("adminRoleName")?.value, 35);
    const color = $("adminRoleColor")?.value || "#287bff";

    if (!name) {
        toast("Escribe un nombre para el rol.", "error");
        return;
    }

    if (community.roles.some(role =>
        role.name.toLowerCase() === name.toLowerCase()
    )) {
        toast("Ya existe un rol con ese nombre.", "warning");
        return;
    }

    community.roles.push({
        id: makeId("role"),
        name,
        color,
        permissions: ["send_messages"]
    });

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, `Rol ${name} creado`);

    event.target.reset();
    renderAdminRoles();
    renderAdminOverview();

    toast("Rol creado.", "success");
}

function deleteCommunityRole(id) {
    const community = getAdminCommunity();
    if (!community) return;

    const role = community.roles.find(item => item.id === id);
    if (!role) return;

    if (role.id === "admin" || role.id === "member") {
        toast("No puedes eliminar los roles básicos.", "warning");
        return;
    }

    if (!confirm(`¿Eliminar el rol ${role.name}?`)) return;

    community.roles = community.roles.filter(item => item.id !== id);

    community.members.forEach(member => {
        if (member.role === role.name) member.role = "member";
    });

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, `Rol ${role.name} eliminado`);

    renderAdminRoles();
    renderAdminMembers();

    toast("Rol eliminado.");
}

/* -------------------- INVITACIONES -------------------- */

function renderAdminInvites() {
    const community = getAdminCommunity();
    const container = $("adminInvitesList");

    if (!community || !container) return;

    if (!community.invites.length) {
        container.innerHTML = `<div class="admin-empty">No hay invitaciones creadas.</div>`;
        return;
    }

    container.innerHTML = community.invites.map(invite => `
        <div class="admin-managed-item">
            <div>
                <strong>${escapeHTML(invite.code)}</strong>
                <small>Creada: ${formatDate(invite.createdAt)}</small>
                <small>${invite.revoked ? "Revocada" : "Activa"}</small>
            </div>
            <div>
                ${!invite.revoked ? `
                    <button type="button" data-admin-action="copy-invite"
                        data-id="${escapeHTML(invite.id)}">Copiar</button>
                    <button type="button" data-admin-action="revoke-invite"
                        data-id="${escapeHTML(invite.id)}">Revocar</button>
                ` : ""}
            </div>
        </div>
    `).join("");
}

function handleAdminInviteSubmit(event) {
    event.preventDefault();

    const community = getAdminCommunity();
    if (!community) return;

    const invite = {
        id: makeId("invite"),
        code: `chatmessaggin://invite/${community.id}`,
        createdAt: new Date().toISOString(),
        revoked: false
    };

    community.invites.push(invite);

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, "Nueva invitación creada");
    renderAdminInvites();
    renderAdminOverview();

    copyText(invite.code);
    toast("Invitación creada y copiada si el navegador lo permite.", "success");
}

function revokeInvite(id) {
    const community = getAdminCommunity();
    if (!community) return;

    const invite = community.invites.find(item => item.id === id);
    if (!invite) return;

    invite.revoked = true;

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, "Invitación revocada");
    renderAdminInvites();
    renderAdminOverview();

    toast("Invitación revocada.");
}

function copyText(text) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => toast("Copiado al portapapeles.", "success"))
            .catch(() => toast("No se pudo copiar automáticamente.", "warning"));
    } else {
        const input = document.createElement("textarea");
        input.value = text;
        document.body.appendChild(input);
        input.select();

        try {
            document.execCommand("copy");
            toast("Copiado al portapapeles.", "success");
        } catch {
            toast("No se pudo copiar.", "error");
        }

        input.remove();
    }
}

/* -------------------- HISTORIAL -------------------- */

function addAuditEntry(community, action) {
    community.audit ||= [];

    community.audit.unshift({
        id: makeId("audit"),
        action: cleanText(action, 200),
        author: profile.username,
        date: new Date().toISOString()
    });

    community.audit = community.audit.slice(0, 100);
    saveData(STORAGE.communities, communities);
}

function renderAdminAudit() {
    const community = getAdminCommunity();
    const container = $("adminAuditList");

    if (!community || !container) return;

    if (!community.audit.length) {
        container.innerHTML = `<div class="admin-empty">Todavía no hay actividad registrada.</div>`;
        return;
    }

    container.innerHTML = community.audit.map(entry => `
        <div class="admin-managed-item">
            <div>
                <strong>${escapeHTML(entry.action)}</strong>
                <small>${escapeHTML(entry.author)} · ${formatDate(entry.date)}</small>
            </div>
        </div>
    `).join("");
}

/* -------------------- EMOJIS -------------------- */

function renderAdminEmojis() {
    const community = getAdminCommunity();
    const container = $("adminEmojisList");

    if (!community || !container) return;

    if (!community.emojis.length) {
        container.innerHTML = `<div class="admin-empty">No hay emojis personalizados.</div>`;
        return;
    }

    container.innerHTML = community.emojis.map(emoji => `
        <div class="admin-managed-item">
            <div>
                <strong style="font-size:24px">${escapeHTML(emoji.value)}</strong>
                <small>${escapeHTML(emoji.name)}</small>
            </div>
            <button type="button" data-admin-action="delete-emoji"
                data-id="${escapeHTML(emoji.id)}">Eliminar</button>
        </div>
    `).join("");
}

function handleAdminEmojiSubmit(event) {
    event.preventDefault();

    const community = getAdminCommunity();
    if (!community) return;

    const name = cleanText($("adminEmojiName")?.value, 30);
    const value = cleanText($("adminEmojiValue")?.value, 12);

    if (!name || !value) {
        toast("Completa el nombre y el emoji.", "error");
        return;
    }

    community.emojis.push({
        id: makeId("emoji"),
        name,
        value
    });

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, `Emoji ${name} añadido`);

    event.target.reset();
    renderAdminEmojis();

    toast("Emoji añadido.", "success");
}

function deleteCommunityEmoji(id) {
    const community = getAdminCommunity();
    if (!community) return;

    community.emojis = community.emojis.filter(item => item.id !== id);

    saveData(STORAGE.communities, communities);
    addAuditEntry(community, "Emoji eliminado");
    renderAdminEmojis();
}

/* -------------------- SEGURIDAD Y ELIMINACIÓN -------------------- */

function renderAdminSecurity() {
    const container = $("adminSecurityInfo");
    if (!container) return;

    container.textContent =
        "ChatMessaggin está funcionando en modo local. Las invitaciones, miembros y permisos no se verifican en un servidor.";
}

function deleteAdminCommunity() {
    const community = getAdminCommunity();
    if (!community) return;

    const confirmation = $("adminDeleteConfirmation");
    const typedName = typeof confirmation?.value === "string"
        ? confirmation.value.trim()
        : "";

    if (typedName !== community.name) {
        toast("Escribe exactamente el nombre de la comunidad para confirmarlo.", "error");
        return;
    }

    if (!confirm(`¿Eliminar definitivamente "${community.name}" de este dispositivo?`)) {
        return;
    }

    communities = communities.filter(item => item.id !== community.id);

    saveData(STORAGE.communities, communities);

    activeCommunityId = null;
    activeAdminCommunityId = null;

    closeCommunityAdmin();
    renderCommunities();
    navigate("communities");

    toast("Comunidad eliminada.", "success");
}

/* =========================================================
   NOTIFICACIONES
   ========================================================= */

function renderNotifications() {
    const container = $("notificationsList");
    if (!container) return;

    if (!notifications.length) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No tienes notificaciones.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? "read" : "unread"}">
            <div>
                <strong>${escapeHTML(notification.title)}</strong>
                <p>${escapeHTML(notification.message)}</p>
                <small>${formatDate(notification.date)}</small>
            </div>
            <button type="button" data-action="delete-notification"
                data-id="${escapeHTML(notification.id)}">Eliminar</button>
        </div>
    `).join("");
}

function renderNotificationCount() {
    const count = notifications.filter(item => !item.read).length;
    const badge = $("notificationCount");

    if (!badge) return;

    badge.textContent = count;
    badge.hidden = count === 0;
}

function deleteNotification(id) {
    notifications = notifications.filter(item => item.id !== id);
    saveData(STORAGE.notifications, notifications);
    renderNotifications();
    renderNotificationCount();
}

/* =========================================================
   PANEL DE AJUSTES
   ========================================================= */

function openSettingsPanel(panel) {
    currentSettingsPanel = panel;

    document.querySelectorAll("[data-settings-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.settingsTab === panel);
    });

    document.querySelectorAll("[data-settings-panel]").forEach(section => {
        section.hidden = section.dataset.settingsPanel !== panel;
    });
}

function applySettings() {
    document.documentElement.dataset.theme = settings.theme || "dark";
    document.documentElement.style.setProperty(
        "--blue",
        settings.accent || "#287bff"
    );

    document.documentElement.style.setProperty(
        "--font-scale",
        `${settings.fontScale || 100}%`
    );

    document.body.classList.toggle("compact-mode", !!settings.compactMode);
    document.body.classList.toggle("reduced-motion", !!settings.reducedMotion);

    const themeSelect = $("themeSelect");
    if (themeSelect) themeSelect.value = settings.theme;

    const onlineStatus = $("showOnlineStatus");
    if (onlineStatus) onlineStatus.checked = !!settings.showOnlineStatus;

    const accentInput = $("accentColor");
    if (accentInput) accentInput.value = settings.accent;

    const scaleInput = $("fontScale");
    if (scaleInput) scaleInput.value = settings.fontScale;

    const notificationsInput = $("enableNotifications");
    if (notificationsInput) notificationsInput.checked = !!settings.notifications;
}

function handleSettingChange(event) {
    const element = event.target;
    if (!element) return;

    switch (element.id) {
        case "themeSelect":
            settings.theme = element.value;
            break;
        case "showOnlineStatus":
            settings.showOnlineStatus = element.checked;
            break;
        case "accentColor":
            settings.accent = element.value;
            break;
        case "fontScale":
            settings.fontScale = Number(element.value) || 100;
            break;
        case "enableNotifications":
            settings.notifications = element.checked;
            break;
        case "compactMode":
            settings.compactMode = element.checked;
            break;
        case "reducedMotion":
            settings.reducedMotion = element.checked;
            break;
        case "soundNotifications":
            settings.sound = element.checked;
            break;
        default:
            return;
    }

    saveData(STORAGE.settings, settings);
    applySettings();
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
    const friendCount = $("dashboardFriendCount");
    const communityCount = $("dashboardCommunityCount");
    const messageCount = $("dashboardMessageCount");

    if (friendCount) friendCount.textContent = friends.length;
    if (communityCount) communityCount.textContent = communities.length;

    if (messageCount) {
        const total = conversations.reduce(
            (sum, conversation) => sum + (conversation.messages?.length || 0),
            0
        );

        messageCount.textContent = total;
    }

    const welcome = $("welcomeName");
    if (welcome) welcome.textContent = profile.name;
}

/* =========================================================
   EVENTOS DINÁMICOS
   ========================================================= */

document.addEventListener("click", event => {
    const target = event.target.closest("[data-action], [data-admin-action]");

    if (!target) return;

    const action = target.dataset.action;
    const adminAction = target.dataset.adminAction;
    const id = target.dataset.id;

    if (action === "open-community") openCommunity(id);
    if (action === "open-conversation") openConversation(id);
    if (action === "message-friend") openPrivateConversation(id);
    if (action === "remove-friend") removeFriend(id);
    if (action === "delete-notification") deleteNotification(id);

    if (action === "select-channel") {
        renderCommunityMessages(id);
    }

    if (adminAction === "delete-channel") {
        const community = getAdminCommunity();
        if (!community) return;

        const channel = community.channels.find(item => item.id === id);
        if (!channel) return;

        if (!confirm(`¿Eliminar el canal ${channel.name}?`)) return;

        community.channels = community.channels.filter(item => item.id !== id);
        saveData(STORAGE.communities, communities);
        addAuditEntry(community, `Canal ${channel.name} eliminado`);

        renderAdminChannels();
        renderAdminOverview();
        renderChannels();
        toast("Canal eliminado.");
    }

    if (adminAction === "change-member-role") changeMemberRole(id);
    if (adminAction === "remove-member") removeCommunityMember(id);
    if (adminAction === "delete-role") deleteCommunityRole(id);
    if (adminAction === "revoke-invite") revokeInvite(id);
    if (adminAction === "delete-emoji") deleteCommunityEmoji(id);

    if (adminAction === "copy-invite") {
        const community = getAdminCommunity();
        const invite = community?.invites.find(item => item.id === id);
        if (invite) copyText(invite.code);
    }
});

document.addEventListener("click", event => {
    const tab = event.target.closest("[data-admin-tab]");
    if (tab) openAdminTab(tab.dataset.adminTab);

    const settingsTab = event.target.closest("[data-settings-tab]");
    if (settingsTab) openSettingsPanel(settingsTab.dataset.settingsTab);

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) navigate(viewButton.dataset.view);
});

document.addEventListener("input", event => {
    if (event.target.id === "adminMemberSearch") {
        renderAdminMembers(event.target.value);
    }
});

document.addEventListener("change", handleSettingChange);

/* =========================================================
   CONEXIÓN DE FORMULARIOS Y BOTONES
   ========================================================= */

function connectForm(id, handler) {
    const form = $(id);
    if (form) form.addEventListener("submit", handler);
}

function connectClick(id, handler) {
    const element = $(id);
    if (element) element.addEventListener("click", handler);
}

function initializeEvents() {
    connectForm("profileForm", handleProfileSubmit);
    connectForm("friendForm", handleFriendSubmit);
    connectForm("communityForm", createCommunity);
    connectForm("joinCommunityForm", joinCommunityByInvite);
    connectForm("messageForm", handleMessageSubmit);
    connectForm("communityMessageForm", handleCommunityMessage);

    connectForm("adminCommunityForm", handleAdminCommunitySubmit);
    connectForm("adminChannelForm", handleAdminChannelSubmit);
    connectForm("adminRoleForm", handleAdminRoleSubmit);
    connectForm("adminInviteForm", handleAdminInviteSubmit);
    connectForm("adminEmojiForm", handleAdminEmojiSubmit);

    connectClick("openCreateCommunity", () => navigate("createCommunity"));
    connectClick("createCommunityTop", () => navigate("createCommunity"));
    connectClick("cancelCreateCommunity", () => navigate("communities"));
    connectClick("backToCommunities", () => navigate("communities"));

    connectClick("addChannelButton", addCommunityChannel);
    connectClick("newGroupButton", createGroupConversation);

    connectClick("communitySettingsButton", openCommunityAdmin);
    connectClick("closeCommunityAdmin", closeCommunityAdmin);
    connectClick("adminCloseTop", closeCommunityAdmin);

    connectClick("adminDeleteCommunity", deleteAdminCommunity);
    connectClick("adminDeleteCommunityButton", deleteAdminCommunity);

    connectClick("profileShortcut", () => navigate("profile"));
}

/* =========================================================
   ATAJOS Y CIERRE DE VENTANAS
   ========================================================= */

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeCommunityAdmin();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        const search = $("globalSearch");
        if (search) search.focus();
    }
});

const adminOverlay = $("communityAdminOverlay");

if (adminOverlay) {
    adminOverlay.addEventListener("click", event => {
        if (event.target === adminOverlay) {
            closeCommunityAdmin();
        }
    });
}

/* =========================================================
   BÚSQUEDA GLOBAL
   ========================================================= */

function initializeSearch() {
    const search = $("globalSearch");
    if (!search) return;

    search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();

        document.querySelectorAll(
            ".friend-card, .community-card, .conversation-item"
        ).forEach(item => {
            item.hidden = !item.textContent.toLowerCase().includes(query);
        });
    });
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

function initializeApp() {
    friends = Array.isArray(friends) ? friends : [];
    communities = Array.isArray(communities)
        ? communities.map(normalizeCommunity)
        : [];
    conversations = Array.isArray(conversations) ? conversations : [];
    notifications = Array.isArray(notifications) ? notifications : [];

    profile = {
        ...structuredCloneSafe(DEFAULT_PROFILE),
        ...(profile || {})
    };

    settings = {
        ...structuredCloneSafe(DEFAULT_SETTINGS),
        ...(settings || {})
    };

    initializeEvents();
    initializeSearch();

    renderProfile();
    renderFriends();
    renderCommunities();
    renderConversations();
    renderNotifications();
    renderNotificationCount();
    renderDashboard();
    applySettings();

    const messageForm = $("communityMessageForm");
    if (messageForm) messageForm.hidden = true;

    const activeChat = $("activeChat");
    if (activeChat) activeChat.hidden = true;

    const placeholder = $("chatPlaceholder");
    if (placeholder) placeholder.hidden = false;

    const adminOverlayElement = $("communityAdminOverlay");
    if (adminOverlayElement) adminOverlayElement.hidden = true;

    openSettingsPanel("account");
    navigate("home");

    console.log("ChatMessaggin 3.0 iniciado correctamente.");
}

initializeApp();