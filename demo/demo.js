/* Rent Hub interactive demo: static SPA, no backend, sample data only. */
(() => {
  "use strict";

  const app = document.getElementById("app");
  const tabbar = document.getElementById("tabbar");
  const toast = document.getElementById("toast");
  const modalRoot = document.getElementById("modalRoot");
  const player = document.getElementById("player");
  const savedCountEl = document.getElementById("savedCount");
  const roleChip = document.getElementById("roleChip");
  const menuBtn = document.getElementById("menuBtn");
  const topnav = document.querySelector(".topnav");

  const state = {
    data: null,
    role: null, // tenant | agent | admin
    screen: "welcome",
    listingId: null,
    chatId: null,
    filters: { q: "", type: "all", price: null, pets: false },
    saved: new Set(loadSaved()),
    deck: [],
    deckIndex: 0,
    deckHistory: [],
    bookings: new Set(),
    messages: [],
    pending: [],
    threadId: "peter",
    audioTrack: null,
  };

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem("rh-demo-saved") || "[]");
    } catch {
      return [];
    }
  }
  function persistSaved() {
    try {
      localStorage.setItem("rh-demo-saved", JSON.stringify([...state.saved]));
    } catch {
      /* private mode */
    }
  }

  let toastTimer = null;
  function say(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  const money = (n) => "$" + Number(n || 0).toLocaleString("en-AU");
  const titleCase = (s) => (s || "").replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  function typeLabel(t) {
    return { unit: "Unit", house: "House", studio: "Studio", townhouse: "Townhouse" }[t] || titleCase(t || "Home");
  }
  function parkingLabel(p) {
    return { none: "No parking", carspot: "1 car", garage: "Garage", street: "Street" }[p] || "No parking";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function getListing(id) {
    return state.data.listings.find((l) => l.id === id) || null;
  }

  function updateChrome() {
    const loggedIn = Boolean(state.role);
    tabbar.hidden = !loggedIn || state.screen === "welcome";
    savedCountEl.textContent = state.saved.size;
    roleChip.hidden = !loggedIn;
    roleChip.textContent = state.role === "agent" ? "Agent demo" : state.role === "admin" ? "Admin demo" : "Tenant demo";
    document.querySelectorAll(".navlink").forEach((b) => {
      const go = b.dataset.go;
      const active = go === state.screen || (go === "browse" && state.screen === "detail");
      b.setAttribute("aria-current", active ? "true" : "false");
    });
    document.querySelectorAll(".tab").forEach((b) => {
      b.setAttribute("aria-current", b.dataset.go === state.screen || (b.dataset.go === "browse" && state.screen === "detail") ? "true" : "false");
    });
  }

  function go(screen) {
    state.screen = screen;
    topnav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "instant" });
    render();
  }

  function setRole(role) {
    state.role = role;
    if (role === "admin") {
      go("admin");
      return;
    }
    go("browse");
    say(role === "agent" ? "Signed in as Angela, agent demo" : "Signed in as Mia, tenant demo");
  }

  // ---------------------------------------------------------------- screens
  function welcome() {
    return `
      <section class="welcome">
        <div class="hero-copy">
          <div class="kicker">Interactive demo · sample Sydney data</div>
          <h1>Rent direct.<br><em>Skip the agency.</em></h1>
          <p class="lead">Click through the product: browse live-looking listings, open a home, swipe to save, send a message and approve a synced Facebook post. No sign-up, nothing to install.</p>
        </div>
        <div class="roles">
          <button class="role-card" data-action="role" data-role="tenant">
            <span class="glyph">⌂</span>
            <b>I'm looking for a rental</b>
            <span>Browse, swipe, save and message owners as a tenant.</span>
          </button>
          <button class="role-card" data-action="role" data-role="agent">
            <span class="glyph">⌘</span>
            <b>I'm listing a place</b>
            <span>Open the agent dashboard and publish flow.</span>
          </button>
          <button class="role-card" data-action="role" data-role="admin">
            <span class="glyph">☰</span>
            <b>Admin console</b>
            <span>Review the Facebook sync queue and approve posts.</span>
          </button>
        </div>
        <p class="demo-note">Account, payments and Facebook posting run in the installed app and web console. This page is a read-only product tour built from real seeded data.</p>
      </section>`;
  }

  function filteredListings() {
    const f = state.filters;
    const q = f.q.trim().toLowerCase();
    return state.data.listings.filter((l) => {
      if (f.type === "house" && l.type !== "house") return false;
      if (f.type === "unit" && l.type !== "unit" && l.type !== "studio") return false;
      if (f.price && l.rent > f.price) return false;
      if (f.pets && !l.petFriendly) return false;
      if (!q) return true;
      return (l.title + " " + l.suburb + " " + l.postcode).toLowerCase().includes(q);
    });
  }

  function card(l) {
    const saved = state.saved.has(l.id);
    return `
      <article class="listing-card">
        <button class="shot" data-action="open" data-id="${l.id}" aria-label="Open ${escapeHtml(l.title)}${l.featured ? ", featured" : ""}${l.source === "facebook" ? ", synced from Facebook" : l.isAgent ? ", agent" : ""}">
          <img src="${l.photos[0]}" alt="" loading="lazy" width="600" height="450" />
          <span class="badges">
            ${l.featured ? '<span class="pill ink">Featured</span>' : ""}
            ${l.source === "facebook" ? '<span class="pill green">Synced from Facebook</span>' : l.isAgent ? '<span class="pill">Agent</span>' : ""}
          </span>
        </button>
        <button class="heart" data-action="save" data-id="${l.id}" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save home"}">${saved ? "♥" : "♡"}</button>
        <div class="body">
          <div class="price">${money(l.rent)}<small>/wk</small></div>
          <h3>${escapeHtml(l.title)}</h3>
          <div class="meta">${escapeHtml(l.suburb)} ${l.postcode} · ${l.beds || "Studio"} bed · ${l.baths} bath · ${parkingLabel(l.parking)}</div>
        </div>
      </article>`;
  }

  function browse() {
    const list = filteredListings();
    return `
      <div class="screen-head">
        <div><div class="kicker">Sydney rentals</div><h1>Browse</h1></div>
        <div class="pill">${state.data.listings.length} homes in Sydney</div>
      </div>
      <div class="searchrow">
        <label class="searchbox">
          <span aria-hidden="true">⌕</span>
          <input id="search" type="search" placeholder="Suburb, postcode or station" value="${escapeHtml(state.filters.q)}" aria-label="Search rentals" />
        </label>
        <button class="btn btn-pink" data-action="search">Search</button>
      </div>
      <div class="filters" role="group" aria-label="Filters">
        ${[["all", "All"], ["house", "Houses"], ["unit", "Units"]].map(([k, label]) => `<button class="chip" data-action="filter" data-type="${k}" aria-pressed="${state.filters.type === k}">${label}</button>`).join("")}
        <button class="chip" data-action="filter" data-price="700" aria-pressed="${state.filters.price === 700}">Under $700</button>
        <button class="chip" data-action="filter" data-pets="1" aria-pressed="${state.filters.pets}">Pets okay</button>
      </div>
      <p class="results">${list.length} ${list.length === 1 ? "home" : "homes"}${state.filters.q ? ` for “${escapeHtml(state.filters.q)}”` : " in Sydney"}</p>
      ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<div class="empty"><b>Nothing matches yet</b>Try another suburb or clear the filters.</div>`}`;
  }

  function detail() {
    const l = getListing(state.listingId);
    if (!l) return browse();
    const saved = state.saved.has(l.id);
    const booked = state.bookings.has(l.id);
    return `
      <button class="btn btn-ghost btn-sm" data-action="back" style="margin-bottom:14px">← Back to browse</button>
      <div class="detail">
        <div>
          <div class="gallery" id="gallery">
            <div class="track" id="galleryTrack" tabindex="0" role="region" aria-label="Photo gallery, use the arrow buttons to change photo">
              ${l.photos.map((p, i) => `<img src="${p}" alt="${escapeHtml(l.title)}, photo ${i + 1} of ${l.photos.length}" loading="${i ? "lazy" : "eager"}" />`).join("")}
            </div>
            <button class="nav prev" data-action="gallery" data-dir="-1" aria-label="Previous photo">‹</button>
            <button class="nav next" data-action="gallery" data-dir="1" aria-label="Next photo">›</button>
            <div class="dots" id="galleryDots">${l.photos.map((_, i) => `<button class="dot" data-action="gallery-dot" data-i="${i}" aria-current="${i === 0}" aria-label="Photo ${i + 1}"></button>`).join("")}</div>
          </div>
          <div class="panel" style="margin-top:16px">
            <div class="kicker">${typeLabel(l.type)} · ${escapeHtml(l.suburb)}</div>
            <h1>${escapeHtml(l.title)}</h1>
            <div class="price">${money(l.rent)}<small>/wk</small> <span class="muted small">Bond ${money(l.bond)}</span></div>
            <div class="specs">
              <div class="spec"><b>${l.beds || "Studio"}</b>bed</div>
              <div class="spec"><b>${l.baths}</b>bath</div>
              <div class="spec"><b>${parkingLabel(l.parking)}</b>parking</div>
              <div class="spec"><b>${escapeHtml(l.available)}</b>available</div>
            </div>
            <p class="desc">${escapeHtml(l.description)}</p>
            ${l.music ? `
              <div class="music">
                <button class="play" data-action="music" data-id="${l.id}" aria-label="Play soundtrack ${escapeHtml(l.music.title)}">▶</button>
                <div><b>Soundtrack · ${escapeHtml(l.music.title)}</b><div class="small muted">${escapeHtml(l.music.mood)} · ${state.data.tracks.find((t) => t.title === l.music.title)?.duration || 23}s · muted by default</div></div>
              </div>` : ""}
            <h3 style="margin-top:18px;font-size:17px">Inspection times</h3>
            ${l.inspections.map((s) => `
              <div class="inspection">
                <span>${s.day} · ${s.time}</span>
                <button class="btn btn-ghost btn-sm" data-action="book" data-id="${l.id}" ${booked ? "disabled" : ""}>${booked ? "Booked" : "Book"}</button>
              </div>`).join("")}
            <div class="source-note">${l.source === "facebook" ? `Synced from the Landlords &amp; Tenants Direct Facebook group · posted by ${escapeHtml(l.sourceAuthor || "a member")}` : l.isAgent ? "Listed by an agent · verified" : "Listed directly by the owner"}</div>
          </div>
        </div>
        <aside class="panel">
          <h3 style="font-size:19px">${l.isAgent ? "Contact the agent" : "Message the owner"}</h3>
          <p class="small muted">${l.isAgent ? "Angela usually replies within a day." : "Peter usually replies within a day."} Phone numbers are shared after the first message, to keep spam calls off good landlords.</p>
          <div class="detail-actions" style="flex-direction:column">
            <button class="btn btn-pink" data-action="message" data-id="${l.id}">Message ${l.isAgent ? "agent" : "owner"}</button>
            <button class="btn btn-outline" data-action="share" data-id="${l.id}">Share this home</button>
            <button class="btn btn-ghost" data-action="save" data-id="${l.id}" aria-pressed="${saved}">${saved ? "♥ Saved to shortlist" : "♡ Save to shortlist"}</button>
          </div>
          <hr class="hr" />
          <p class="small muted">Why Rent Hub: six photos per listing, no agency fees, every synced post checked by an admin before it appears.</p>
        </aside>
      </div>`;
  }

  function swipeCard() {
    const l = state.deck[state.deckIndex];
    if (!l) return `
      <div class="end">
        <div class="kicker">That's a wrap</div>
        <h1 style="font-size:34px;margin:8px 0">That's every rental for now</h1>
        <p class="muted">You saved ${state.saved.size} ${state.saved.size === 1 ? "home" : "homes"}. The installed app keeps refreshing the deck as new group posts are approved.</p>
        <div class="detail-actions" style="max-width:340px;margin:20px auto"><button class="btn btn-pink" data-action="deck-reset">Start again</button><button class="btn btn-outline" data-action="go" data-go="saved">See saved</button></div>
      </div>`;
    const saved = state.saved.has(l.id);
    return `
      <div class="swipe-wrap">
        <div class="progress">${state.deckIndex + 1} of ${state.deck.length}</div>
        <div class="deck" id="deck">
          <article class="swipe-card" id="swipeCard">
            <img src="${l.photos[0]}" alt="${escapeHtml(l.title)}" draggable="false" />
            <div class="shade"></div>
            <div class="stamp save">Save</div><div class="stamp pass">Pass</div>
            <button class="heart" data-action="save" data-id="${l.id}" aria-pressed="${saved}" aria-label="Save home" style="right:14px;top:14px;z-index:3">${saved ? "♥" : "♡"}</button>
            <div class="info">
              <div class="pill pink">${l.source === "facebook" ? "Synced from Facebook" : l.isAgent ? "Agent" : "Direct owner"}</div>
              <div class="price" style="color:#fff;margin-top:6px">${money(l.rent)}<small style="color:rgba(255,255,255,.75)">/wk</small></div>
              <h3>${escapeHtml(l.title)}</h3>
              <div class="meta">${escapeHtml(l.suburb)} ${l.postcode} · ${l.beds || "Studio"} bed · ${l.baths} bath</div>
            </div>
          </article>
        </div>
        <div class="actions">
          <button class="round" data-action="pass" aria-label="Pass">✕</button>
          <button class="round" data-action="undo" aria-label="Undo">↶</button>
          <button class="round" data-action="open" data-id="${l.id}" aria-label="Details">i</button>
          <button class="round primary" data-action="like" aria-label="Save">♥</button>
        </div>
        <p class="small muted" style="text-align:center;margin-top:14px">Drag right to save · left to pass · tap i for the full listing</p>
      </div>`;
  }

  function saved() {
    const list = state.data.listings.filter((l) => state.saved.has(l.id));
    return `
      <div class="screen-head"><div><div class="kicker">Your shortlist</div><h1>Saved homes</h1></div><div class="pill">${list.length} saved</div></div>
      ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` : `<div class="empty"><b>Nothing saved yet</b>Tap the heart on a home, or swipe right in the Swipe tab, and it lands here.</div>`}`;
  }

  function messages() {
    return `
      <div class="screen-head"><div><div class="kicker">Direct messages</div><h1>Messages</h1></div></div>
      <div class="threads">
        <button class="thread" data-action="chat" data-id="peter">
          <span class="avatar">P</span>
          <span style="flex:1;text-align:left"><b>Peter Morgan</b><span class="small muted" style="display:block">Bright 2-Bed Unit Steps from Bondi Beach · $780/wk</span></span>
          <span class="small muted">2h</span>
        </button>
        <button class="thread" data-action="chat" data-id="angela">
          <span class="avatar" style="background:#F52874">AS</span>
          <span style="flex:1;text-align:left"><b>Angela Sharp</b><span class="small muted" style="display:block">Managed 2-Bed Apartment with Harbour Glimpses</span></span>
          <span class="small muted">1d</span>
        </button>
      </div>`;
  }

  function chat() {
    const thread = state.threadId === "angela" ? { name: "Angela Sharp", initial: "AS" } : { name: "Peter Morgan", initial: "P" };
    return `
      <button class="btn btn-ghost btn-sm" data-action="go" data-go="messages" style="margin-bottom:14px">← All messages</button>
      <div class="panel">
        <h1 style="font-size:24px">${thread.name}</h1>
        <p class="small muted">Demo conversation · the installed app sends real messages to the owner</p>
        <div class="chat" id="chat">
          ${state.messages.map((m) => `<div class="bubble ${m.me ? "me" : ""}">${escapeHtml(m.text)}<span class="time">${m.time}</span></div>`).join("")}
        </div>
      </div>
      <div class="composer">
        <input id="chatInput" placeholder="Write a message" aria-label="Message" />
        <button data-action="send" aria-label="Send message">↑</button>
      </div>`;
  }

  function profile() {
    const p = state.role === "agent" ? state.data.agent : state.data.profile;
    return `
      <div class="screen-head"><div><div class="kicker">Your account</div><h1>Profile</h1></div></div>
      <div class="profile-card">
        <div class="profile-head">
          <span class="avatar">${p.initial}</span>
          <div><h2>${escapeHtml(p.name)}</h2><span class="pill">${state.role === "agent" ? "Agent demo" : "Tenant demo"}</span></div>
        </div>
        <div class="rows">
          ${state.role === "agent" ? '<button class="row" data-action="go" data-go="dashboard"><span><b>Dashboard</b><span>Your listings, views and enquiries</span></span><span>›</span></button>' : ""}
          <button class="row" data-action="go" data-go="saved"><span><b>Saved homes</b><span>${state.saved.size} in your shortlist</span></span><span>›</span></button>
          <button class="row" data-action="go" data-go="messages"><span><b>Messages</b><span>Your conversations with owners</span></span><span>›</span></button>
          <button class="row" data-action="go" data-go="admin"><span><b>Admin sync queue</b><span>${state.pending.length} posts waiting for review</span></span><span>›</span></button>
        </div>
        <hr class="hr" />
        <button class="btn btn-outline" data-action="signout" style="width:100%">Sign out of demo</button>
      </div>`;
  }

  function dashboard() {
    const mine = state.data.listings.filter((l) => l.isAgent);
    const views = mine.reduce((n, l) => n + l.views, 0);
    return `
      <div class="screen-head"><div><div class="kicker">Agent demo</div><h1>Dashboard</h1><p class="muted small">Sharp Realty · Angela Sharp</p></div><button class="btn btn-pink" data-action="new-listing">+ New listing</button></div>
      <div class="stats">
        <div class="stat"><b>${mine.length || 1}</b><span>active listings</span></div>
        <div class="stat"><b>${views + 1242}</b><span>total views</span></div>
        <div class="stat"><b>1</b><span>enquiry</span></div>
      </div>
      <h3 style="margin:18px 0 10px;font-size:19px">Your listings</h3>
      <div class="grid">
        ${(mine.length ? mine : state.data.listings.slice(0, 2)).map((l) => `
          <article class="listing-card">
            <button class="shot" data-action="open" data-id="${l.id}"><img src="${l.photos[0]}" alt="" loading="lazy" /></button>
            <div class="body"><div class="price">${money(l.rent)}<small>/wk</small></div><h3>${escapeHtml(l.title)}</h3><div class="meta">${l.views + 165} views · ${escapeHtml(l.suburb)}</div></div>
          </article>`).join("")}
      </div>
      <p class="small muted" style="margin-top:16px">The create-listing wizard (photos, details, review, six-photo limit) runs in the installed app and web console. This page is the demo dashboard.</p>`;
  }

  function admin() {
    return `
      <div class="screen-head"><div><div class="kicker">Admin demo</div><h1>Facebook sync</h1></div><button class="btn btn-ink" data-action="run-sync">Sync now</button></div>
      <div class="stats">
        <div class="stat"><b>8</b><span>synced</span></div>
        <div class="stat"><b>${state.pending.length}</b><span>pending</span></div>
        <div class="stat"><b>6</b><span>published</span></div>
      </div>
      <div class="panel" style="margin-bottom:16px">
        <b>Landlords &amp; Tenants Direct group</b>
        <p class="small muted" style="margin:4px 0 0">Mode: demo fixtures · last run 1h ago · adapter: fixtures · every post is parsed and held for approval before publishing.</p>
      </div>
      <h3 style="font-size:19px;margin-bottom:10px">Pending posts (${state.pending.length})</h3>
      ${state.pending.length ? `<div class="queue">
        ${state.pending.map((p) => `
          <article class="queue-card">
            <div class="queue-head"><span class="avatar" style="width:32px;height:32px;font-size:12px">${escapeHtml((p.author || "?").charAt(0))}</span><span>${escapeHtml(p.author)} · ${p.notAListing ? "not a rental" : "rental"}</span><span style="margin-left:auto"><span class="pill ${p.notAListing ? "" : "green"}">${p.notAListing ? "Warning" : "Parsed"}</span></span></div>
            <h3>${escapeHtml(p.title || "Group post")}</h3>
            <p class="small muted" style="margin:0">${escapeHtml(p.text).slice(0, 180)}</p>
            ${p.photos.length ? `<img src="${p.photos[0]}" alt="" style="width:110px;height:80px;object-fit:cover;border-radius:10px;margin-top:10px" loading="lazy" />` : ""}
            ${p.warnings.length ? `<p class="small muted" style="margin:8px 0 0">${escapeHtml(p.warnings.join(" · "))}</p>` : ""}
            <div class="queue-actions">
              <button class="btn btn-outline btn-sm" data-action="reject" data-id="${p.id}">Reject</button>
              <button class="btn btn-ink btn-sm" data-action="approve" data-id="${p.id}">${p.notAListing ? "Approve anyway" : "Approve"}</button>
            </div>
          </article>`).join("")}
      </div>` : `<div class="empty"><b>Queue is clear</b>All synced posts have been reviewed. New group posts arrive every sync.</div>`}
      <h3 style="font-size:19px;margin:20px 0 10px">Recent runs</h3>
      <div class="rows">
        <div class="row"><span><b>Fixtures sync</b><span>8 imported · 0 updated · 0 skipped</span></span><span class="pill green">success</span></div>
        <div class="row"><span><b>Fixtures sync</b><span>8 imported · 0 updated · 0 skipped</span></span><span class="pill green">success</span></div>
      </div>`;
  }

  // ---------------------------------------------------------------- render
  function render() {
    let html = "";
    switch (state.screen) {
      case "welcome": html = welcome(); break;
      case "browse": html = browse(); break;
      case "detail": html = detail(); break;
      case "swipe": html = swipeCard(); break;
      case "saved": html = saved(); break;
      case "messages": html = messages(); break;
      case "chat": html = chat(); break;
      case "profile": html = profile(); break;
      case "dashboard": html = dashboard(); break;
      case "admin": html = admin(); break;
      default: html = welcome();
    }
    app.innerHTML = html;
    updateChrome();
    bindScreen();
  }

  function bindScreen() {
    if (state.screen === "detail") {
      const track = document.getElementById("galleryTrack");
      if (track) track.addEventListener("scroll", () => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        document.querySelectorAll("#galleryDots .dot").forEach((d, n) => d.setAttribute("aria-current", n === i ? "true" : "false"));
      });
    }
    if (state.screen === "swipe") bindSwipe();
    if (state.screen === "chat") scrollChat();
  }

  function scrollChat() {
    const chat = document.getElementById("chat");
    if (chat) chat.scrollIntoView({ block: "end" });
  }

  // ---------------------------------------------------------------- swipe drag
  function bindSwipe() {
    const cardEl = document.getElementById("swipeCard");
    if (!cardEl) return;
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    const save = cardEl.querySelector(".stamp.save");
    const pass = cardEl.querySelector(".stamp.pass");
    const setX = (x) => {
      cardEl.style.transform = `translate(${x}px, ${dy * 0.15}px) rotate(${x / 22}deg)`;
      save.style.opacity = x > 20 ? Math.min(1, x / 110) : 0;
      pass.style.opacity = x < -20 ? Math.min(1, -x / 110) : 0;
    };
    cardEl.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true; startX = e.clientX; startY = e.clientY; dx = 0; dy = 0;
      cardEl.setPointerCapture(e.pointerId);
      cardEl.style.transition = "none";
    });
    cardEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      setX(dx);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      cardEl.style.transition = "transform .28s ease, opacity .28s ease";
      if (dx > 100) { decide("like"); }
      else if (dx < -100) { decide("pass"); }
      else setX(0);
    };
    cardEl.addEventListener("pointerup", end);
    cardEl.addEventListener("pointercancel", end);
  }

  function decide(kind) {
    const l = state.deck[state.deckIndex];
    if (!l) return;
    if (kind === "like") {
      state.saved.add(l.id);
      persistSaved();
      say(`Saved ${l.title}`);
    }
    state.deckHistory.push({ index: state.deckIndex, liked: kind === "like", id: l.id });
    state.deckIndex += 1;
    render();
  }

  function undoDeck() {
    const last = state.deckHistory.pop();
    if (!last) { say("Nothing to undo"); return; }
    state.deckIndex = last.index;
    if (last.liked) { state.saved.delete(last.id); persistSaved(); }
    render();
    say("Put the last card back");
  }

  // ---------------------------------------------------------------- actions
  function openShare(l) {
    modalRoot.innerHTML = `
      <div class="modal" data-action="close-modal">
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Share this home">
          <div class="sheet-head"><h2>Share this home</h2><button class="btn btn-ghost btn-sm" data-action="close-modal" aria-label="Close">Close</button></div>
          <p class="small muted" style="margin-top:-6px">${escapeHtml(l.title)}</p>
          ${[
            ["Facebook feed", "Post it to your timeline", "f"],
            ["Landlords & Tenants Direct", "Post as the group's page", "⌂"],
            ["Facebook Marketplace", "Create a rental listing", "▤"],
            ["Instagram", "Copy the caption for your story", "◎"],
            ["WhatsApp", "Send it to a group chat", "✆"],
            ["Copy link", "Anyone with the link can view", "⧉"],
          ].map(([title, sub, g]) => `
            <button class="channel" data-action="share-channel" data-channel="${title}">
              <span class="glyph">${g}</span>
              <span><b>${title}</b><span>${sub}</span></span>
              <span class="go">›</span>
            </button>`).join("")}
          <p class="small muted" style="margin-bottom:0">Every share links back to the original listing. Rent direct, no agent fees.</p>
        </div>
      </div>`;
  }

  function openChatFor(l) {
    state.threadId = l.isAgent ? "angela" : "peter";
    state.messages = [
      { me: false, text: "Hi! Yes, it's still available. I have 10:00am and 10:15am slots on Saturday. Let me know what suits.", time: "2h ago" },
      { me: true, text: `Hi, is this still available? I'd like to inspect ${escapeHtml(l.title)}.`, time: "Just now" },
    ];
    go("chat");
  }

  function closeModal() { modalRoot.innerHTML = ""; }

  document.addEventListener("click", (e) => {
    const goEl = e.target.closest("[data-go]");
    if (goEl) { go(goEl.dataset.go); return; }
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const l = el.dataset.id ? getListing(el.dataset.id) : null;
    switch (action) {
      case "role": setRole(el.dataset.role); break;
      case "open": state.listingId = el.dataset.id; go("detail"); break;
      case "back": go("browse"); break;
      case "save": {
        if (!l) break;
        if (state.saved.has(l.id)) { state.saved.delete(l.id); say("Removed from saved"); }
        else { state.saved.add(l.id); say("Saved to your shortlist"); }
        persistSaved(); render();
        break;
      }
      case "filter": {
        state.filters.type = el.dataset.type || state.filters.type;
        state.filters.price = el.dataset.price ? Number(el.dataset.price) : null;
        state.filters.pets = el.dataset.pets === "1";
        render();
        break;
      }
      case "search": {
        const input = document.getElementById("search");
        state.filters.q = input ? input.value : "";
        render();
        break;
      }
      case "gallery": {
        const track = document.getElementById("galleryTrack");
        if (track) track.scrollBy({ left: Number(el.dataset.dir) * track.clientWidth, behavior: "smooth" });
        break;
      }
      case "gallery-dot": {
        const track = document.getElementById("galleryTrack");
        if (track) track.scrollTo({ left: Number(el.dataset.i) * track.clientWidth, behavior: "smooth" });
        break;
      }
      case "book": {
        state.bookings.add(el.dataset.id);
        say("Inspection requested (demo). The app confirms by message.");
        render();
        break;
      }
      case "message": if (l) openChatFor(l); break;
      case "share": if (l) openShare(l); break;
      case "share-channel": {
        const channel = el.dataset.channel;
        if (channel === "Copy link") {
          const url = "https://renthub.de5.net/";
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => say("Link copied")).catch(() => say("Link copied"));
          else say("Link copied");
        } else {
          say(`${channel}: the installed app opens the real composer`);
        }
        closeModal();
        break;
      }
      case "close-modal": closeModal(); break;
      case "music": {
        const track = l && l.music;
        if (!track) break;
        if (state.audioTrack === track.url && !player.paused) { player.pause(); say("Soundtrack paused"); el.textContent = "▶"; break; }
        player.src = track.url;
        player.play().then(() => { state.audioTrack = track.url; say(`Playing ${track.title}`); el.textContent = "⏸"; }).catch(() => say("Tap again to allow audio"));
        break;
      }
      case "go": go(el.dataset.go); break;
      case "pass": decide("pass"); break;
      case "like": decide("like"); break;
      case "undo": undoDeck(); break;
      case "deck-reset": state.deck = [...state.data.listings]; state.deckIndex = 0; state.deckHistory = []; render(); say("Deck reset"); break;
      case "chat": {
        state.threadId = el.dataset.id;
        state.messages = el.dataset.id === "angela" ? [
          { me: false, text: "Hi Mia, thanks for the enquiry. The apartment is available from Saturday.", time: "1d ago" },
        ] : [
          { me: false, text: "Hi! Yes, it's still available. I have 10:00am and 10:15am slots on Saturday.", time: "2h ago" },
        ];
        go("chat");
        break;
      }
      case "send": {
        const input = document.getElementById("chatInput");
        const text = (input && input.value || "").trim();
        if (!text) break;
        state.messages.push({ me: true, text, time: "Just now" });
        input.value = "";
        render();
        setTimeout(scrollChat, 30);
        break;
      }
      case "signout": state.role = null; go("welcome"); say("Signed out of the demo"); break;
      case "new-listing": say("The create wizard (photos, details, review) lives in the installed app"); break;
      case "run-sync": say("Sync started (demo): 8 imported, 0 updated, 0 skipped"); break;
      case "approve": {
        const p = state.pending.find((x) => x.id === el.dataset.id);
        if (!p) break;
        if (p.notAListing) { say("Blocked: this post is not a rental listing"); break; }
        state.pending = state.pending.filter((x) => x.id !== p.id);
        say(`Approved: ${p.title} published as a listing`);
        render();
        break;
      }
      case "reject": {
        const p = state.pending.find((x) => x.id === el.dataset.id);
        if (!p) break;
        state.pending = state.pending.filter((x) => x.id !== p.id);
        say(`Rejected: ${p.title}`);
        render();
        break;
      }
      default: break;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); topnav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
    if (e.key === "Enter" && state.screen === "chat" && document.activeElement && document.activeElement.id === "chatInput") {
      const btn = document.querySelector('[data-action="send"]');
      if (btn) btn.click();
    }
  });

  menuBtn.addEventListener("click", () => {
    const open = topnav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // ---------------------------------------------------------------- PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline support is optional */
      });
    });
  }

  let installEvent = null;
  const installBtn = document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice && choice.outcome === "accepted") say("Rent Hub demo installed");
    installEvent = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    say("Rent Hub demo installed");
  });

  // ---------------------------------------------------------------- boot
  fetch("data.json")
    .then((r) => r.json())
    .then((data) => {
      state.data = data;
      state.deck = [...data.listings];
      state.pending = [...data.pending];
      render();
      if (window.matchMedia("(max-width: 720px)").matches) {
        document.body.classList.add("is-mobile");
      }
    })
    .catch(() => {
      app.innerHTML = `<div class="empty"><b>The demo data could not load</b>Refresh the page, or open the installed app for the full experience.</div>`;
    });
})();
