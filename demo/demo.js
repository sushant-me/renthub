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

  const initialScreen = new URLSearchParams(window.location.search).get("screen");
  const state = {
    data: null,
    role: initialScreen === "notices" ? "tenant" : null, // tenant | agent | admin
    screen: initialScreen === "notices" ? "notices" : "welcome",
    listingId: null,
    chatId: null,
    filters: { q: "", type: "all", price: null, pets: false, sort: "featured" },
    saved: new Set(loadSaved()),
    deck: [],
    deckIndex: 0,
    deckHistory: [],
    bookings: new Set(),
    messages: [],
    pending: [],
    notices: [
      { name: "Mia P.", initial: "M", text: "Hi, I’m a mum of 3 looking for a 2-bedroom house with a garage in the Bankstown area.", meta: "2-bed house · Bankstown · $750/wk", time: "2h ago" },
      { name: "Liam T.", initial: "L", text: "Young family with a friendly dog seeking a 3-bed house with a yard, near schools and parks in Parramatta.", meta: "3-bed house · Parramatta · $950/wk", time: "1d ago" },
      { name: "Olivia R.", initial: "O", text: "Solo professional working near the ferry. Looking for a tidy studio in Manly, non-smoker, move-in flexible.", meta: "Studio · Manly · $550/wk", time: "2d ago" },
      { name: "Priya S.", initial: "P", text: "Relocating family needs a 2-bedroom unit close to Chatswood station and schools. Ready to move in.", meta: "2-bed unit · Chatswood · $800/wk", time: "3d ago" },
      { name: "Alex K.", initial: "A", text: "Professional couple looking for a quiet 1-bedroom unit with parking near Newtown. No pets, long lease.", meta: "1-bed unit · Newtown · $650/wk", time: "4d ago" },
    ],
    threadId: "peter",
    audioTrack: null,
    listingStep: 1,
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
    tabbar.hidden = !loggedIn || state.screen === "welcome" || state.screen === "list-property";
    savedCountEl.textContent = state.saved.size;
    roleChip.hidden = !loggedIn;
    roleChip.textContent = state.role === "agent" ? "Agent demo" : state.role === "admin" ? "Admin demo" : state.role === "landlord" ? "Landlord demo" : "Tenant demo";
    document.querySelectorAll(".navlink").forEach((b) => {
      const go = b.dataset.go;
      const active = go === state.screen || (go === "browse" && state.screen === "detail") || (go === "list-property" && state.screen === "list-property");
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
  function noticeRail() {
    const card = (n) => `
      <article class="notice-mini">
        <div class="notice-mini-head"><span class="avatar">${n.initial}</span><b>${escapeHtml(n.name)}</b><span>${escapeHtml(n.time)}</span></div>
        <p>${escapeHtml(n.text)}</p>
        <span class="notice-mini-meta">${escapeHtml(n.meta)}</span>
      </article>`;
    return `
      <aside class="notice-rail" aria-label="Latest tenant notices">
        <div class="notice-rail-head">
          <span class="notice-live"><span class="dot"></span> Tenant notices</span>
          <span>40 words max</span>
        </div>
        <div class="notice-rail-window">
          <div class="notice-rail-track">${state.notices.map(card).join("")}${state.notices.map(card).join("")}</div>
        </div>
        <button class="btn btn-outline btn-sm" data-action="notice-new">Post what you’re looking for</button>
      </aside>`;
  }

  function welcome() {
    return `
      <section class="welcome">
        <div class="welcome-grid">
        <div class="hero-copy">
          <div class="kicker">Interactive demo · sample Sydney data</div>
          <h1><em>RENT HUB</em><br>Landlords list<br><em>Tenants find</em></h1>
          <p class="lead">Click through Sydney rentals listed by landlords or their agent, skip the runaround, and message the owner directly.</p>
        </div>
        ${noticeRail()}
        </div>
        <div class="hero-stats" aria-label="Demo snapshot">
          <span><b>${state.data.listings.length}</b> Sydney homes</span>
          <span><b>${state.notices.length}</b> tenant notices</span>
          <span><b>100%</b> direct</span>
        </div>
        <div class="roles">
          <button class="role-card role-photo" data-action="role" data-role="tenant">
            <img class="role-bg" src="${state.data.listings[0]?.photos?.[0] || "img/syd-apartment-block.jpg"}" alt="" loading="lazy" />
            <span class="role-scrim" aria-hidden="true"></span>
            <span class="role-content"><span class="glyph">⌂</span><b>I'm looking for a rental</b><span>Browse, swipe, save and message landlords direct — and post what you're looking for.</span></span>
            <span class="role-go" aria-hidden="true">→</span>
          </button>
          <button class="role-card role-photo" data-action="tenant-notice">
            <img class="role-bg" src="${state.data.listings[2]?.photos?.[0] || "img/syd-house-weatherboard.jpg"}" alt="" loading="lazy" />
            <span class="role-scrim" aria-hidden="true"></span>
            <span class="role-content"><span class="glyph">✎</span><b>I'm a Tenant making Enquiries</b><span>Post a short 40-word notice to Sydney landlords and agents.</span></span>
            <span class="role-go" aria-hidden="true">→</span>
          </button>
          <button class="role-card role-photo" data-action="list-property">
            <img class="role-bg" src="${state.data.listings[1]?.photos?.[0] || "img/syd-apartment-white.jpg"}" alt="" loading="lazy" />
            <span class="role-scrim" aria-hidden="true"></span>
            <span class="role-content"><span class="glyph">⌘</span><b>I'm listing a place</b><span>Create a landlord listing — photos, rent and details in one flow.</span></span>
            <span class="role-go" aria-hidden="true">→</span>
          </button>
          <button class="role-card role-photo" data-action="role" data-role="admin">
            <img class="role-bg" src="img/syd-apartment-sky.jpg" alt="" loading="lazy" />
            <span class="role-scrim" aria-hidden="true"></span>
            <span class="role-content"><span class="glyph">☰</span><b>Admin console</b><span>Review the Facebook sync queue and approve posts.</span></span>
            <span class="role-go" aria-hidden="true">→</span>
          </button>
        </div>
        <p class="demo-note">Account, payments and Facebook posting run in the installed app and web console. This page is a read-only product tour built from real seeded data.</p>
      </section>`;
  }

  function filteredListings() {
    const f = state.filters;
    const q = f.q.trim().toLowerCase();
    const list = state.data.listings.filter((l) => {
      if (f.type !== "all" && l.type !== f.type) return false;
      if (f.price && l.rent > f.price) return false;
      if (f.pets && !l.petFriendly) return false;
      if (!q) return true;
      return (l.title + " " + l.suburb + " " + l.postcode).toLowerCase().includes(q);
    });
    if (f.sort === "price-low") list.sort((a, b) => a.rent - b.rent);
    else if (f.sort === "price-high") list.sort((a, b) => b.rent - a.rent);
    else list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.views - a.views);
    return list;
  }

  function card(l) {
    const saved = state.saved.has(l.id);
    const badges = [l.featured ? "Featured" : "", l.source === "facebook" ? "Synced from Facebook" : l.isAgent ? "Agent" : ""].filter(Boolean);
    return `
      <article class="listing-card">
        <button class="shot" data-action="open" data-id="${l.id}" aria-label="Open ${escapeHtml(l.title)}${badges.length ? `, ${badges.join(", ")}` : ""}">
          <img src="${l.photos[0]}" alt="" loading="lazy" width="600" height="450" />
          <span class="badges">
            ${l.featured ? '<span class="pill ink">Featured</span>' : ""}
            ${l.source === "facebook" ? '<span class="pill green">Synced from Facebook</span>' : l.isAgent ? '<span class="pill">Agent</span>' : ""}
          </span>
        </button>
        <span class="photo-count">▧ ${l.photos.length}</span>
        <button class="heart" data-action="save" data-id="${l.id}" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save home"}">${saved ? "♥" : "♡"}</button>
        <div class="body">
          <div class="price">${money(l.rent)}<small>/wk</small></div>
          <h3>${escapeHtml(l.title)}</h3>
          <div class="meta">${escapeHtml(l.suburb)} ${l.postcode} · ${l.beds || "Studio"} bed · ${l.baths} bath · ${parkingLabel(l.parking)}</div>
        </div>
      </article>`;
  }

  function notices() {
    const cards = state.notices.map((n) => `
      <article class="notice-card">
        <div class="notice-head">
          <span class="avatar">${n.initial}</span>
          <div><b>${escapeHtml(n.name)}</b><span>${escapeHtml(n.meta)}</span></div>
          <span class="small muted">${escapeHtml(n.time)}</span>
        </div>
        <p>${escapeHtml(n.text)}</p>
        <div class="notice-foot"><span class="pill green">Active notice</span><span class="small muted">14 days left</span></div>
      </article>`).join("");
    return `
      <div class="screen-head notices-head">
        <div>
          <div class="kicker">Tenant notices</div>
          <h1>I’m a Tenant<br>Making Enquiries</h1>
          <p class="muted small">Post a short notice to Sydney landlords and agents. Up to 40 words, live for two weeks.</p>
        </div>
        <button class="btn btn-pink" data-action="notice-new">+ Post an enquiry</button>
      </div>
      <div class="notice-grid">${cards}</div>
      <p class="small muted" style="margin-top:18px">This demo notice board uses sample data. Posting and replies work in the installed app and web console.</p>`;
  }

  function browse() {
    const list = filteredListings();
    return `
      <div class="screen-head browse-head">
        <div><div class="kicker">Sydney rentals</div><h1>Browse <em>Rent Hub</em></h1></div>
        <div class="browse-head-actions"><button class="btn btn-outline btn-sm" data-go="notices">Tenant notice board</button><span class="pill">${state.data.listings.length} homes</span></div>
      </div>
      <div class="searchrow">
        <label class="searchbox">
          <span aria-hidden="true">⌕</span>
          <input id="search" type="search" placeholder="Suburb, postcode or station" value="${escapeHtml(state.filters.q)}" aria-label="Search rentals" />
        </label>
        <button class="btn btn-pink" data-action="search">Search</button>
      </div>
      <div class="filters" role="group" aria-label="Filters">
        ${[["all", "All"], ["house", "Houses"], ["unit", "Units"], ["granny-flat", "Granny flats"], ["studio", "Studios"], ["room", "Rooms"], ["sharehouse", "Sharehouses"]].map(([k, label]) => `<button class="chip" data-action="filter" data-type="${k}" aria-pressed="${state.filters.type === k}">${label}</button>`).join("")}
        <span class="filter-divider" aria-hidden="true"></span>
        <button class="chip" data-action="filter" data-price="600" aria-pressed="${state.filters.price === 600}">Under $600</button>
        <button class="chip" data-action="filter" data-price="800" aria-pressed="${state.filters.price === 800}">Under $800</button>
        <button class="chip" data-action="filter" data-pets="1" aria-pressed="${state.filters.pets}">Pets okay</button>
        <span class="filter-divider" aria-hidden="true"></span>
        <button class="chip" data-action="filter" data-sort="featured" aria-pressed="${state.filters.sort === "featured"}">Featured</button>
        <button class="chip" data-action="filter" data-sort="price-low" aria-pressed="${state.filters.sort === "price-low"}">Lowest rent</button>
        <button class="chip" data-action="filter" data-sort="price-high" aria-pressed="${state.filters.sort === "price-high"}">Highest rent</button>
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
          <h3 style="font-size:19px">Message the landlord</h3>
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

  function listProperty() {
    const sample = state.data.listings[0];
    return `
      <div class="screen-head listing-head">
        <div>
          <div class="kicker">Landlord listing</div>
          <h1>List a property</h1>
          <p class="muted small">One clear flow: property, details, photos and review. Nothing is published until you confirm.</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-go="browse">Cancel</button>
      </div>
      <div class="stepbar" aria-label="Listing steps">
        <button class="step active" data-action="listing-step" data-step="1"><b>1</b> Property</button><button class="step" data-action="listing-step" data-step="2"><b>2</b> Details</button><button class="step" data-action="listing-step" data-step="3"><b>3</b> Review</button>
      </div>
      <div class="listing-layout">
        <div class="panel listing-form">
          <section class="form-section form-step" data-step="1">
            <h2>1. The property</h2>
            <div class="form-grid">
              <label class="field">Property type
                <select id="lpType"><option value="unit">Unit or apartment</option><option value="house">House</option><option value="studio">Studio</option><option value="granny-flat">Granny flat</option><option value="room">Room</option><option value="sharehouse">Sharehouse</option></select>
              </label>
              <label class="field">Suburb
                <input id="lpSuburb" value="Bondi" autocomplete="off" />
              </label>
              <label class="field field-wide">Street address
                <input id="lpAddress" value="12/34 Campbell Parade" placeholder="12/34 Campbell Parade" />
              </label>
              <label class="field">Weekly rent (AUD)
                <input id="lpRent" type="number" min="50" value="780" inputmode="numeric" />
              </label>
              <label class="field">Bond (AUD)
                <input id="lpBond" type="number" min="0" value="3120" inputmode="numeric" />
              </label>
              <label class="field">Bedrooms
                <select id="lpBeds"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5+</option></select>
              </label>
              <label class="field">Bathrooms
                <select id="lpBaths"><option>1</option><option selected>2</option><option>3</option><option>4</option></select>
              </label>
              <label class="field">Parking
                <select id="lpParking"><option value="none">No parking</option><option value="street">Street</option><option value="carspot">1 car space</option><option value="garage" selected>Garage</option></select>
              </label>
              <label class="field">Available from
                <input id="lpDate" type="date" value="2026-12-12" />
              </label>
            </div>
          </section>
          <section class="form-section form-step" data-step="2" hidden>
            <h2>2. Listing details</h2>
            <label class="field">Headline
              <input id="lpTitle" value="Bright 2-bed unit steps from Bondi Beach" maxlength="90" />
            </label>
            <label class="field">Description
              <textarea id="lpDescription" rows="4">Sunny two-bedroom apartment with a balcony, built-in wardrobes and a secure garage. Walk to the beach, cafes and buses.</textarea>
            </label>
            <div class="photo-row">
              <div><b>Photos</b><span class="small muted">Up to 6 · first photo is the cover</span></div>
              <div class="photo-slots">
                ${(sample?.photos || []).slice(0,3).map((src) => `<span class="photo-slot"><img src="${src}" alt="" /></span>`).join("")}
                <button class="photo-add" type="button" data-action="demo-photo" aria-label="Add another photo">+</button>
              </div>
            </div>
          </section>
          <section class="form-section form-step" data-step="3" hidden>
            <h2>3. Review</h2>
            <div class="review-card" aria-live="polite">
              <img id="lpReviewPhoto" src="${sample?.photos?.[0] || ''}" alt="" />
              <div>
                <div class="price"><span id="lpReviewRent">$780</span><small>/wk</small></div>
                <h3 id="lpReviewTitle">Bright 2-bed unit steps from Bondi Beach</h3>
                <p class="small muted" id="lpReviewMeta">Unit · Bondi · 2 bed · 2 bath · Garage</p>
                <p class="small" id="lpReviewDesc">Sunny two-bedroom apartment with a balcony, built-in wardrobes and a secure garage.</p>
              </div>
            </div>
            <label class="checkline"><input type="checkbox" id="lpConfirm" checked /> I'm the owner or acting for the owner, and the details are correct.</label>
          </section>
          <div class="wizard-nav">
            <button class="btn btn-ghost" type="button" data-action="listing-back" id="lpBack" disabled>← Back</button>
            <span class="wizard-step-label" id="lpStepLabel">Step 1 of 3 · Property</span>
            <button class="btn btn-pink" type="button" data-action="listing-next" id="lpNext">Continue →</button>
            <button class="btn btn-pink" type="button" data-action="publish-listing" id="lpPublish" hidden>Publish listing</button>
          </div>
          <p class="small muted wizard-note">Free for private landlords · agent listings use a token. Nothing is published until you confirm.</p>
        </div>
        <aside class="listing-preview panel">
          <div class="preview-head"><span class="notice-live"><span class="dot"></span> Live preview</span><span class="small muted">How tenants see it</span></div>
          <article class="preview-card">
            <img src="${sample?.photos?.[0] || ''}" alt="" />
            <div class="body">
              <div class="price" id="lpPreviewRent">$${Number(780).toLocaleString("en-AU")}<small>/wk</small></div>
              <h3 id="lpPreviewTitle">Bright 2-bed unit steps from Bondi Beach</h3>
              <div class="meta"><span id="lpPreviewType">Unit</span> · <span id="lpPreviewSuburb">Bondi</span> · 2 bed · 2 bath</div>
              <p class="small muted" id="lpPreviewDesc">Sunny two-bedroom apartment with a balcony, built-in wardrobes and a secure garage.</p>
            </div>
          </article>
          <div class="preview-note">Your listing appears in Browse and the home feed as soon as you publish.</div>
        </aside>
      </div>`;
  }

  function dashboard() {
    const mine = state.data.listings.filter((l) => l.isAgent);
    const views = mine.reduce((n, l) => n + l.views, 0);
    return `
      <div class="screen-head"><div><div class="kicker">Agent demo</div><h1>Dashboard</h1><p class="muted small">Sharp Realty · Angela Sharp</p></div><button class="btn btn-pink" data-go="list-property">+ New listing</button></div>
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
      case "list-property": html = listProperty(); break;
      case "notices": html = notices(); break;
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
    if (state.screen === "list-property") bindListingPreview();
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

  function openNoticeModal() {
    modalRoot.innerHTML = `
      <div class="modal">
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Post a tenant enquiry">
          <div class="sheet-head"><h2>I’m a Tenant making Enquiries</h2><button class="btn btn-ghost btn-sm" data-action="close-modal" aria-label="Close">Close</button></div>
          <p class="small muted">Tell landlords and agents what you need. 40 words max, live for two weeks.</p>
          <div class="notice-form-grid">
            <label class="field">Looking for
              <select id="noticeType"><option value="house">House</option><option value="unit" selected>Unit or apartment</option><option value="studio">Studio</option><option value="granny-flat">Granny flat</option><option value="room">Room</option><option value="sharehouse">Sharehouse</option></select>
            </label>
            <label class="field">Area
              <input id="noticeSuburb" value="Bankstown" />
            </label>
            <label class="field">Budget / week
              <input id="noticeRent" type="number" min="50" value="750" inputmode="numeric" />
            </label>
          </div>
          <textarea id="noticeBio" class="notice-textarea" rows="4" placeholder="Hi, I’m a mum of 3 looking for a 2-bedroom house with a garage in the Bankstown area."></textarea>
          <div class="word-meter"><span id="noticeMeter"></span></div>
          <div class="notice-live-preview">
            <div class="notice-live-preview-head"><span class="avatar">M</span><span><b>Your notice</b><small id="noticePreviewMeta">Unit · Bankstown · $750/wk</small></span></div>
            <p id="noticePreviewText">Your notice will appear here.</p>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px">
            <span id="noticeWords" class="small muted">0/40 words</span>
            <button class="btn btn-pink" data-action="notice-post">Post enquiry</button>
          </div>
        </div>
      </div>`;
    const input = document.getElementById("noticeBio");
    const update = () => {
      const words = input.value.trim() ? input.value.trim().split(/\s+/).length : 0;
      const meter = document.getElementById("noticeMeter");
      const counter = document.getElementById("noticeWords");
      counter.textContent = `${words}/40 words`;
      counter.classList.toggle("over", words > 40);
      if (meter) meter.style.width = `${Math.min(100, (words / 40) * 100)}%`;
      const type = document.getElementById("noticeType")?.value || "unit";
      const area = document.getElementById("noticeSuburb")?.value || "Sydney";
      const rent = Number(document.getElementById("noticeRent")?.value) || 0;
      const meta = document.getElementById("noticePreviewMeta");
      const preview = document.getElementById("noticePreviewText");
      if (meta) meta.textContent = `${typeLabel(type)} · ${area} · ${money(rent)}/wk`;
      if (preview) preview.textContent = input.value.trim() || "Your notice will appear here.";
    };
    ["input", "change"].forEach((evt) => {
      input.addEventListener(evt, update);
      ["noticeType", "noticeSuburb", "noticeRent"].forEach((id) => document.getElementById(id)?.addEventListener(evt, update));
    });
    update();
    input.focus();
  }

  function postNotice() {
    const input = document.getElementById("noticeBio");
    if (!input) return;
    const text = input.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    if (!words) { say("Write a short notice first"); return; }
    if (words > 40) { say("Keep it to 40 words or fewer"); return; }
    const type = document.getElementById("noticeType")?.value || "unit";
    const area = document.getElementById("noticeSuburb")?.value.trim() || "Sydney";
    const rent = Number(document.getElementById("noticeRent")?.value) || 0;
    state.notices.unshift({ name: "Mia P.", initial: "M", text, meta: `${typeLabel(type)} · ${area} · ${money(rent)}/wk`, time: "Just now" });
    closeModal();
    render();
    say("Enquiry posted to the demo notice board");
  }

  function setListingStep(step) {
    state.listingStep = Math.min(3, Math.max(1, step));
    document.querySelectorAll(".form-step").forEach((section) => {
      section.hidden = Number(section.dataset.step) !== state.listingStep;
    });
    document.querySelectorAll(".stepbar .step").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.step) <= state.listingStep);
    });
    const back = document.getElementById("lpBack");
    const next = document.getElementById("lpNext");
    const publish = document.getElementById("lpPublish");
    const label = document.getElementById("lpStepLabel");
    if (back) back.disabled = state.listingStep === 1;
    if (next) next.hidden = state.listingStep === 3;
    if (publish) publish.hidden = state.listingStep !== 3;
    if (label) label.textContent = `Step ${state.listingStep} of 3 · ${["Property", "Details", "Review"][state.listingStep - 1]}`;
    if (state.listingStep === 3) syncListingReview();
  }

  function nextListingStep() {
    if (state.listingStep === 1) {
      for (const id of ["lpSuburb", "lpRent", "lpAddress"]) {
        const field = document.getElementById(id);
        if (field && !field.value.trim()) { field.focus(); say("Fill in the property details to continue"); return; }
      }
    }
    if (state.listingStep === 2) {
      for (const id of ["lpTitle", "lpDescription"]) {
        const field = document.getElementById(id);
        if (field && !field.value.trim()) { field.focus(); say("Add a headline and description"); return; }
      }
    }
    setListingStep(state.listingStep + 1);
  }

  function syncListingReview() {
    const get = (id) => document.getElementById(id);
    const rent = Number(get("lpRent")?.value) || 0;
    const title = get("lpTitle")?.value || "Your listing";
    const suburb = get("lpSuburb")?.value || "Sydney";
    const type = typeLabel(get("lpType")?.value || "unit");
    const beds = get("lpBeds")?.value || "2";
    const baths = get("lpBaths")?.value || "1";
    const parking = parkingLabel(get("lpParking")?.value || "none");
    const desc = get("lpDescription")?.value || "";
    const photo = state.data.listings[0]?.photos?.[0] || "";
    if (get("lpReviewRent")) get("lpReviewRent").textContent = money(rent);
    if (get("lpReviewTitle")) get("lpReviewTitle").textContent = title;
    if (get("lpReviewMeta")) get("lpReviewMeta").textContent = `${type} · ${suburb} · ${beds} bed · ${baths} bath · ${parking}`;
    if (get("lpReviewDesc")) get("lpReviewDesc").textContent = desc;
    if (get("lpReviewPhoto")) get("lpReviewPhoto").src = photo;
  }

  function bindListingPreview() {
    const map = [["lpTitle", "lpPreviewTitle"], ["lpSuburb", "lpPreviewSuburb"], ["lpType", "lpPreviewType"], ["lpDescription", "lpPreviewDesc"]];
    map.forEach(([from, to]) => {
      const input = document.getElementById(from);
      const out = document.getElementById(to);
      if (!input || !out) return;
      const sync = () => { out.textContent = from === "lpType" ? typeLabel(input.value) : input.value; syncListingReview(); };
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
      sync();
    });
    const rent = document.getElementById("lpRent");
    const rentOut = document.getElementById("lpPreviewRent");
    if (rent && rentOut) {
      const syncRent = () => { rentOut.innerHTML = money(Number(rent.value) || 0) + "<small>/wk</small>"; syncListingReview(); };
      rent.addEventListener("input", syncRent);
      syncRent();
    }
    ["lpBeds", "lpBaths", "lpParking", "lpAddress"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", syncListingReview);
    });
    setListingStep(state.listingStep || 1);
  }

  function publishListing() {
    const get = (id) => document.getElementById(id);
    const title = get("lpTitle")?.value.trim();
    const suburb = get("lpSuburb")?.value.trim();
    const rent = Number(get("lpRent")?.value);
    const confirm = get("lpConfirm")?.checked;
    if (!title || !suburb || !rent || rent < 50) { say("Add a headline, suburb and weekly rent first"); return; }
    if (!confirm) { say("Please confirm you're the owner or acting for the owner"); return; }
    const photos = state.data.listings[0]?.photos?.slice(0, 3) || [];
    const listing = {
      id: "demo-" + Date.now(),
      title,
      type: get("lpType")?.value || "unit",
      rent,
      bond: Number(get("lpBond")?.value) || rent * 4,
      suburb,
      postcode: "2026",
      beds: get("lpBeds")?.value || "2",
      baths: Number(get("lpBaths")?.value) || 1,
      parking: get("lpParking")?.value || "none",
      petFriendly: false,
      photos,
      description: get("lpDescription")?.value.trim() || "",
      available: get("lpDate")?.value || "Available now",
      inspections: [{ day: "Saturday", time: "10:00am" }, { day: "Saturday", time: "10:15am" }],
      views: 0,
      isAgent: false,
      featured: false,
      source: "native",
      sourceAuthor: null,
      sourceUrl: null,
      music: null,
    };
    state.data.listings.unshift(listing);
    state.listingId = listing.id;
    go("detail");
    say("Listing published in the demo");
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
      case "tenant-notice": state.role = "tenant"; go("notices"); break;
      case "list-property": state.role = "landlord"; state.listingStep = 1; go("list-property"); break;
      case "demo-photo": say("Photo picker runs in the installed app"); break;
      case "listing-step": setListingStep(Number(el.dataset.step)); break;
      case "listing-back": setListingStep(Math.max(1, state.listingStep - 1)); break;
      case "listing-next": nextListingStep(); break;
      case "publish-listing": publishListing(); break;
      case "notice-new": openNoticeModal(); break;
      case "notice-post": postNotice(); break;
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
        if (el.dataset.type) state.filters.type = el.dataset.type;
        if (el.dataset.price) state.filters.price = state.filters.price === Number(el.dataset.price) ? null : Number(el.dataset.price);
        if (el.dataset.pets) state.filters.pets = !state.filters.pets;
        if (el.dataset.sort) state.filters.sort = el.dataset.sort;
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
      case "new-listing": go("list-property"); break;
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
      navigator.serviceWorker.register("sw.js?v=20261123b", { updateViaCache: "none" }).then((reg) => reg.update()).catch(() => {
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
