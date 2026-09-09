/* ============================================================
   UniteX client. Hash router + render functions per section.
   All state lives on the server; every mutation POSTs and gets
   a fresh snapshot back.
   ============================================================ */
'use strict';

const S = { data: null, mode: 'memory', query: '', filters: {}, active: {} };

/* --- utilities --- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function num(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

function ago(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clock(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function dayStamp(iso) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    mon: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    full: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

function stars(rating) {
  const full = Math.round(Number(rating) || 0);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

function toast(text, icon = '✓', accent = 'lime') {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.accent = accent;
  el.innerHTML = `<span class="toast-ico" data-accent="${accent}">${icon}</span><span>${esc(text)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

// Animate every .bar and .ring on the page from 0 to its data-value.
function animateBars(root = document) {
  requestAnimationFrame(() => {
    $$('.bar > i', root).forEach((el) => { el.style.width = (el.dataset.v || 0) + '%'; });
    $$('.ring .fill', root).forEach((el) => {
      const pct = Number(el.dataset.v || 0);
      el.style.strokeDashoffset = String(377 - (377 * pct) / 100);
    });
  });
}

function matches(haystack, query) {
  if (!query) return true;
  const raw = String(haystack).toLowerCase();
  // Squashed form lets "machine learning" match "#MachineLearning" / "r/MachineLearning".
  const squashed = raw.replace(/[^a-z0-9]/g, '');
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((t) => {
    if (raw.includes(t)) return true;
    const st = t.replace(/[^a-z0-9]/g, '');
    return st ? squashed.includes(st) : true;
  }) || squashed.includes(query.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/* --- api --- */
async function apiGet(path) {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function apiPost(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  if (json.data) S.data = json.data;
  return json;
}

async function boot() {
  const json = await apiGet('/api/bootstrap');
  S.data = json.data;
  S.mode = json.mode;
}

/* --- shared components --- */
function avatar(initials, accent, size = '') {
  return `<span class="av ${size}" data-accent="${esc(accent || 'coral')}">${esc(initials)}</span>`;
}

function bar(pct, accent = 'coral', thin = false) {
  return `<div class="bar ${thin ? 'bar-thin' : ''}" data-accent="${esc(accent)}"><i data-v="${Number(pct) || 0}"></i></div>`;
}

function sectionHead(eyebrow, title, sub, actions = '') {
  return `
    <div class="sec-head">
      <div style="flex:1;min-width:240px">
        <div class="eyebrow">${esc(eyebrow)}</div>
        <h2 class="sec-title">${title}</h2>
        ${sub ? `<p class="sec-sub">${esc(sub)}</p>` : ''}
      </div>
      ${actions ? `<div style="display:flex;gap:9px;flex-wrap:wrap">${actions}</div>` : ''}
    </div>`;
}

function statBlock(value, label) {
  return `<div class="stat"><b>${value}</b><span>${esc(label)}</span></div>`;
}

function railCard(title, body, opts = {}) {
  return `
    <section class="rail-card">
      <div class="rail-head">
        <h3>${title}</h3>
        ${opts.live ? '<span class="live"><i></i>Live</span>' : (opts.aside || '')}
      </div>
      <div class="rail-body">${body}</div>
      ${opts.foot ? `<div class="rail-foot">${opts.foot}</div>` : ''}
    </section>`;
}

function postCard(post, opts = {}) {
  const a = post.author;
  const showAll = S.active['post:' + post.id];
  const long = (post.body || '').length > 220;
  return `
    <article class="post" data-post="${esc(post.id)}">
      <div class="post-head">
        ${avatar(a.initials, a.accent)}
        <div class="post-who">
          <div class="post-name">
            ${esc(a.name)}
            ${post.authorId === null ? '<span class="pill pill-solid" data-accent="lime" style="color:var(--ink)">You</span>' : ''}
          </div>
          <div class="post-meta">
            <span>${esc(a.institution || '')}</span>
            <i class="sep"></i>
            <span>${esc(post.community)}</span>
            <i class="sep"></i>
            <time>${ago(post.createdAt)}</time>
          </div>
        </div>
        <button class="icon-btn" style="width:32px;height:32px;font-size:13px" data-save="${esc(post.id)}" title="Save post">☆</button>
      </div>

      <h3 class="post-title">${esc(post.title)}</h3>
      <p class="post-body ${long && !showAll ? 'is-clamped' : ''}">${esc(post.body)}</p>
      ${long ? `<button class="post-more" data-expand="${esc(post.id)}">${showAll ? 'Show less' : 'Read more'}</button>` : ''}

      <div class="post-tags">
        ${(post.tags || []).map((t) => `<button class="tag" data-accent="${tagAccent(t)}" data-tagsearch="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>

      <div class="post-actions">
        <button class="act ${post.liked ? 'is-on' : ''}" data-like="${esc(post.id)}">
          <span class="arrow">▲</span> <span data-points>${num(post.points)}</span> points
        </button>
        <button class="act" data-comments="${esc(post.id)}">
          ✦ ${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}
        </button>
        <button class="act" data-share="${esc(post.id)}">↗ Share</button>
        <span style="margin-left:auto;font-family:var(--font-mono);font-size:10.5px;color:var(--ink-3)">
          ${esc(a.year || '')}
        </span>
      </div>

      ${renderComments(post, opts)}
    </article>`;
}

function renderComments(post, opts = {}) {
  const open = S.active['comments:' + post.id] || opts.alwaysOpen;
  const list = post.comments || [];
  const visible = open ? list : list.slice(0, 2);
  if (!list.length && !open) return '';
  return `
    <div class="comments">
      ${visible.map((c) => `
        <div class="comment">
          ${avatar(c.initials || (c.author || '?').slice(0, 2).toUpperCase(), c.mine ? 'lime' : 'slate', 'av-sm')}
          <div class="comment-body ${c.mine ? 'mine' : ''}">
            <div class="comment-name">${esc(c.author)} <time>${ago(c.createdAt)}</time></div>
            <div class="comment-text">${esc(c.text)}</div>
          </div>
        </div>`).join('')}
      ${!open && list.length > 2
        ? `<button class="post-more" data-comments="${esc(post.id)}">View all ${list.length} comments</button>`
        : ''}
      ${open ? `
        <form class="comment-form" data-commentform="${esc(post.id)}">
          ${avatar(S.data.profile.initials, 'indigo', 'av-sm')}
          <input type="text" placeholder="Add a comment…" aria-label="Add a comment" maxlength="600" required>
          <button class="btn btn-sm btn-ink" type="submit">Post</button>
        </form>` : ''}
    </div>`;
}

const TAG_ACCENTS = ['coral', 'indigo', 'lime', 'amber', 'violet', 'teal', 'rose', 'slate'];
function tagAccent(tag) {
  let h = 0;
  const s = String(tag);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return TAG_ACCENTS[h % TAG_ACCENTS.length];
}

function personCard(user) {
  const connected = S.data.connectedUsers.includes(user.id);
  return `
    <article class="person" data-accent="${esc(user.accent)}">
      <div class="person-top">
        ${avatar(user.initials, user.accent)}
        <div style="min-width:0;flex:1">
          <div class="person-name">${esc(user.name)}</div>
          <div class="person-inst">${esc(user.institution)}</div>
        </div>
      </div>
      <p class="person-bio">${esc(user.bio)}</p>
      <div class="chips">
        ${user.specialties.map((s) => `<span class="tag" data-accent="${tagAccent(s)}">${esc(s)}</span>`).join('')}
      </div>
      <div class="person-foot">
        <span class="level-dot" data-accent="${esc(user.accent)}"><i></i>${esc(user.level)}</span>
        <span class="pill">${num(user.mutuals)} mutual</span>
        <button class="btn btn-sm ${connected ? 'is-on' : 'btn-primary'}" style="margin-left:auto" data-connect="${esc(user.id)}">
          ${connected ? '✓ Connected' : '+ Connect'}
        </button>
      </div>
    </article>`;
}

function eventCard(ev, opts = {}) {
  const d = dayStamp(ev.date);
  const fill = Math.round((ev.attendees / ev.capacity) * 100);
  return `
    <article class="ev" data-accent="${esc(ev.accent)}">
      <div class="ev-date">
        <span class="mon">${d.mon}</span>
        <span class="day">${d.day}</span>
        <span class="time">${d.time}</span>
      </div>
      <div class="ev-main">
        <div class="ev-top">
          <h3 class="ev-title">${esc(ev.title)}</h3>
          <span class="pill pill-solid" data-accent="${esc(ev.accent)}">${esc(ev.type)}</span>
        </div>
        <p class="ev-blurb">${esc(ev.blurb)}</p>
        <div class="ev-facts">
          <span class="pill">◷ ${esc(ev.duration)}</span>
          <span class="pill">${ev.mode === 'Online' ? '⌨' : '⚲'} ${esc(ev.mode)}</span>
          <span class="pill">${esc(ev.location)}</span>
          <span class="pill">by ${esc(ev.hostedBy)}</span>
        </div>
        ${opts.agenda && (ev.agenda || []).length ? `
          <div class="ev-agenda">
            ${ev.agenda.map((a, i) => `<span><i>${i + 1}</i>${esc(a)}</span>`).join('')}
          </div>` : ''}
        <div class="ev-foot">
          <div class="ev-fill">
            <div class="row"><span>${num(ev.attendees)} / ${num(ev.capacity)} attending</span><span>${fill}% full</span></div>
            ${bar(fill, ev.accent, true)}
          </div>
          <button class="btn btn-sm ${ev.going ? 'is-on' : 'btn-primary'}" data-rsvp="${esc(ev.id)}">
            ${ev.going ? '✓ Going' : 'Attend'}
          </button>
        </div>
      </div>
    </article>`;
}

function communityCard(c) {
  return `
    <article class="comm" data-accent="${esc(c.accent)}">
      <div class="comm-banner">
        <span class="comm-trend">↗ ${c.growth}%</span>
        <span class="comm-ico">${esc(c.icon)}</span>
      </div>
      <div class="comm-body">
        <div class="comm-name">
          ${esc(c.name)}
          ${c.joined ? '<span class="pill pill-solid" data-accent="teal">Joined</span>' : ''}
        </div>
        <span class="pill" style="align-self:flex-start">${esc(c.category)}</span>
        <p class="comm-blurb">${esc(c.blurb)}</p>
        <div class="comm-stats">
          <span><b>${num(c.members)}</b> members</span>
          <span><b>${num(c.posts)}</b> posts</span>
          <span><b>${num(c.activeToday)}</b> today</span>
        </div>
        <button class="btn btn-block btn-sm ${c.joined ? 'is-on' : 'btn-indigo'}" data-join="${esc(c.id)}">
          ${c.joined ? '✓ Member — leave' : '+ Join community'}
        </button>
      </div>
    </article>`;
}

function achievementCard(a) {
  const done = a.progress >= 100;
  return `
    <article class="ach ${done ? '' : 'is-locked'}" data-accent="${esc(a.accent)}">
      <span class="ach-ribbon rarity-${esc(a.rarity)}">${esc(a.rarity)}</span>
      <div class="ach-ico">${esc(a.icon)}</div>
      <div>
        <b>${esc(a.name)}</b>
        <p>${esc(a.detail)}</p>
      </div>
      ${done ? '' : bar(a.progress, a.accent, true)}
      <div class="ach-foot">
        <span>${done ? '✓ Unlocked' : a.progress + '% complete'}</span>
        <span class="ach-pts">${a.points} pts</span>
      </div>
    </article>`;
}

/* --- section: home --- */
const QUICK_ACTIONS = [
  { key: 'post', accent: 'coral', icon: '✎', title: 'Create Post', sub: 'Share a guide, story or question' },
  { key: 'community', accent: 'indigo', icon: '◎', title: 'Join Community', sub: 'Find groups that match you' },
  { key: 'event', accent: 'lime', icon: '◈', title: 'Create Event', sub: 'Run a workshop or hackathon' },
  { key: 'achievements', accent: 'amber', icon: '★', title: 'View Achievements', sub: 'Badges, points, milestones' },
  { key: 'roadmap', accent: 'violet', icon: '➔', title: 'Resume Learning', sub: 'Pick up your roadmap' },
  { key: 'network', accent: 'teal', icon: '⌘', title: 'Find Mentors', sub: 'Connect with seniors & experts' },
];

const FEED_FILTERS = [
  { id: 'all', label: 'All posts' },
  { id: 'joined', label: 'My communities' },
  { id: 'top', label: 'Top rated' },
  { id: 'help', label: 'Questions' },
  { id: 'guides', label: 'Study guides' },
];

function feedPosts() {
  const f = S.filters.feed || 'all';
  const joined = S.data.communities.filter((c) => c.joined).map((c) => c.name);
  let list = S.data.posts.slice();
  if (f === 'joined') list = list.filter((p) => joined.includes(p.community));
  if (f === 'top') list = list.slice().sort((a, b) => b.points - a.points);
  if (f === 'help') list = list.filter((p) => /help|query|stuck|\?/i.test(p.title + ' ' + p.tags.join(' ')));
  if (f === 'guides') list = list.filter((p) => /guide|resource|cheat|explain/i.test(p.title + ' ' + p.tags.join(' ')));
  if (S.query) {
    list = list.filter((p) => matches(p.title + ' ' + p.body + ' ' + p.tags.join(' ') + ' ' + p.author.name, S.query));
  }
  return list;
}

function viewHome() {
  const d = S.data;
  const joinedCount = d.communities.filter((c) => c.joined).length;
  const going = d.events.filter((e) => e.going).length;
  const posts = feedPosts();
  const upcoming = d.events.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
  const spotlight = d.communities.filter((c) => c.spotlight).slice(0, 4);
  const nearBadges = d.achievements.filter((a) => a.progress < 100).sort((a, b) => b.progress - a.progress).slice(0, 4);

  return `
    <section class="hero reveal">
      <div class="eyebrow">Home / Main feed</div>
      <h1>What the campus is<br><span class="hl">actually talking about</span></h1>
      <p>A live stream of study guides, wins, failures and genuine questions from ${num(d.users.length * 1040)} students across ${num(48)} institutions. Everything you do here is saved server-side.</p>
      <div class="hero-stats">
        ${statBlock(num(d.posts.length), 'posts in feed')}
        ${statBlock(joinedCount, 'communities joined')}
        ${statBlock(going, 'events attending')}
        ${statBlock(d.totals.points, 'achievement points')}
        ${statBlock(d.roadmap.streak + 'd', 'learning streak')}
      </div>
    </section>

    <section class="quick reveal">
      <div class="quick-head">
        <span>Quick actions — one click away</span>
        <div class="quick-nav">
          <button data-slide="-1" aria-label="Scroll left">‹</button>
          <button data-slide="1" aria-label="Scroll right">›</button>
        </div>
      </div>
      <div class="quick-track" id="quickTrack">
        ${QUICK_ACTIONS.map((q) => `
          <button class="qa" data-accent="${q.accent}" data-quick="${q.key}">
            <span class="qa-ico">${q.icon}</span>
            <b>${esc(q.title)}</b>
            <small>${esc(q.sub)}</small>
          </button>`).join('')}
      </div>
    </section>

    <div class="home-grid">
      <div>
        <div class="feed-filters">
          ${FEED_FILTERS.map((f) => `
            <button class="chip ${(S.filters.feed || 'all') === f.id ? 'is-active' : ''}" data-feedfilter="${f.id}">${esc(f.label)}</button>`).join('')}
          <button class="btn btn-sm btn-primary" style="margin-left:auto" data-quick="post">✎ New post</button>
        </div>
        ${S.query ? `<p class="sec-sub" style="margin-bottom:14px">Filtering feed by “<b>${esc(S.query)}</b>” — ${posts.length} match${posts.length === 1 ? '' : 'es'}.</p>` : ''}
        <div class="stagger">
          ${posts.length ? posts.map((p) => postCard(p)).join('')
            : `<div class="card empty"><b>Nothing here yet</b>Try a different filter or clear your search.</div>`}
        </div>
      </div>

      <aside class="rail">
        ${railCard('◈ Trending topics', `
          ${d.trending.slice(0, 6).map((t, i) => `
            <button class="trend-row" data-accent="${t.accent}" data-tagsearch="${esc(t.tag)}">
              <span class="trend-rank">${i + 1}</span>
              <span style="min-width:0;flex:1;text-align:left">
                <span class="trend-tag">${esc(t.tag)}</span>
                <span class="trend-meta" style="display:block">${num(t.posts)} posts</span>
              </span>
              <span class="trend-growth">↗ ${t.growth}%</span>
            </button>`).join('')}
        `, { live: true, foot: `<span>Updated continuously</span><button data-goto="#/explore">Explore all →</button>` })}

        ${railCard('◷ Upcoming events', `
          ${upcoming.map((e) => {
            const d2 = dayStamp(e.date);
            return `
            <button class="mini-event" data-accent="${e.accent}" data-goto="#/events">
              <span class="mini-event-top">
                <span class="mini-date"><b>${d2.day}</b><span>${d2.mon}</span></span>
                <span style="min-width:0;flex:1">
                  <b class="name">${esc(e.title)}</b>
                  <span class="where">${esc(e.type)} · ${esc(e.mode)}</span>
                </span>
              </span>
              <span class="who-count">
                <span class="face-stack">
                  ${['PS', 'AM', 'NI', 'RV'].map((f, i) => avatar(f, TAG_ACCENTS[i], 'av-sm')).join('')}
                </span>
                <span class="trend-meta">${num(e.attendees)} attending</span>
              </span>
            </button>`;
          }).join('')}
        `, { foot: `<span>${d.events.length} events scheduled</span><button data-goto="#/events">See all →</button>` })}

        ${railCard('◎ Community spotlight', `
          ${spotlight.map((c) => `
            <button class="spot" data-accent="${c.accent}" data-goto="#/communities">
              <span class="spot-ico">${esc(c.icon)}</span>
              <span style="min-width:0">
                <b>${esc(c.name)}</b>
                <small>${num(c.members)} members · ${num(c.posts)} posts</small>
              </span>
              <span class="up">↗ ${c.growth}%</span>
            </button>`).join('')}
        `, { foot: `<span>Fast-growing groups</span><button data-goto="#/communities">Browse →</button>` })}

        ${railCard('★ Achievements in progress', `
          <div class="badge-strip" style="padding:5px">
            ${nearBadges.map((a) => `
              <div class="badge-mini" data-accent="${a.accent}">
                <span class="badge-ico">${esc(a.icon)}</span>
                <span class="badge-mini-body">
                  <span class="badge-mini-top">${esc(a.name)}<span>${a.progress}%</span></span>
                  ${bar(a.progress, a.accent, true)}
                </span>
              </div>`).join('')}
          </div>
        `, { foot: `<span>${d.totals.earnedCount}/${d.totals.totalCount} unlocked · ${d.totals.points} pts</span><button data-goto="#/profile">Profile →</button>` })}
      </aside>
    </div>`;
}

/* --- section: explore --- */
const EXPLORE_SCOPES = [
  { id: 'all', label: 'Everything' },
  { id: 'posts', label: 'Posts' },
  { id: 'people', label: 'Students' },
  { id: 'communities', label: 'Communities' },
  { id: 'events', label: 'Events' },
];

function viewExplore() {
  const d = S.data;
  const q = S.query;
  const scope = S.filters.scope || 'all';

  const posts = d.posts.filter((p) => matches(p.title + p.body + p.tags.join(' '), q));
  const people = d.users.filter((u) => matches(u.name + u.institution + u.bio + u.specialties.join(' '), q));
  const comms = d.communities.filter((c) => matches(c.name + c.category + c.blurb, q));
  const events = d.events.filter((e) => matches(e.title + e.type + e.blurb + e.location, q));
  const show = (id) => scope === 'all' || scope === id;
  const totalHits = posts.length + people.length + comms.length + events.length;

  const topicCards = [
    { name: 'Web Development', posts: 1520, events: 3, accent: 'coral', icon: '{ }' },
    { name: 'Machine Learning', posts: 986, events: 2, accent: 'indigo', icon: '∑' },
    { name: 'Career Advice', posts: 2040, events: 2, accent: 'amber', icon: '◎' },
    { name: 'Open Source', posts: 660, events: 1, accent: 'teal', icon: '⑃' },
    { name: 'UI/UX Design', posts: 1130, events: 1, accent: 'violet', icon: '◐' },
    { name: 'Cybersecurity', posts: 430, events: 1, accent: 'slate', icon: '⌾' },
  ];

  return `
    <section class="explore-search reveal">
      <div class="eyebrow">Explore</div>
      <h2 class="sec-title">Search everything on <span class="hl">UniteX</span></h2>
      <p class="sec-sub">Posts, people, communities and events — one box, live filtering as you type.</p>
      <div class="big-search">
        <div class="field">
          <span class="mag">⌕</span>
          <input type="search" id="exploreInput" value="${esc(q)}" placeholder="Try “react”, “resume”, “open source”, “Bangalore”…" aria-label="Search UniteX">
        </div>
        <button class="btn btn-ink" data-clearsearch>Clear</button>
      </div>
      <div class="chips" style="margin-top:14px;position:relative">
        ${EXPLORE_SCOPES.map((s) => `
          <button class="chip ${scope === s.id ? 'is-active' : ''}" data-scope="${s.id}">${esc(s.label)}</button>`).join('')}
      </div>
      ${q ? `<p class="sec-sub" style="margin-top:14px"><b>${totalHits}</b> result${totalHits === 1 ? '' : 's'} for “${esc(q)}”</p>` : ''}
    </section>

    ${!q ? `
      <div class="result-group">
        <h4>Trending topics <i></i></h4>
        <div class="grid grid-3 stagger">
          ${topicCards.map((t) => `
            <button class="card card-hover" data-accent="${t.accent}" data-topicsearch="${esc(t.name)}" style="text-align:left;display:flex;gap:13px;align-items:flex-start">
              <span class="spot-ico">${t.icon}</span>
              <span style="min-width:0">
                <b style="font-family:var(--font-display);font-size:16.5px;letter-spacing:-.03em;display:block">${esc(t.name)}</b>
                <span class="trend-meta">${num(t.posts)} posts · ${t.events} upcoming event${t.events === 1 ? '' : 's'}</span>
              </span>
            </button>`).join('')}
        </div>
      </div>

      <div class="home-grid" style="margin-bottom:22px">
        <div class="result-group" style="margin:0">
          <h4>Discover people <i></i></h4>
          <div class="grid grid-2 stagger">
            ${d.users.filter((u) => !d.connectedUsers.includes(u.id)).slice(0, 4).map(personCard).join('')}
          </div>
        </div>
        <aside class="rail">
          ${railCard('◔ Recent activity', `
            <div class="activity-feed" style="padding:0 5px">
              ${d.activity.slice(0, 8).map((a) => `
                <div class="activity-row">
                  <span class="activity-dot" data-accent="${a.accent}"></span>
                  <span class="activity-text">${esc(a.text)}</span>
                  <span class="activity-time">${ago(a.at)}</span>
                </div>`).join('')}
            </div>
          `, { live: true, foot: `<span>Platform-wide, last hour</span>` })}

          ${railCard('◈ New communities', `
            ${d.communities.slice().sort((a, b) => a.createdDaysAgo - b.createdDaysAgo).slice(0, 4).map((c) => `
              <button class="spot" data-accent="${c.accent}" data-goto="#/communities">
                <span class="spot-ico">${esc(c.icon)}</span>
                <span style="min-width:0">
                  <b>${esc(c.name)}</b>
                  <small>${num(c.members)} members · ${c.createdDaysAgo}d old</small>
                </span>
                <span class="up">↗ ${c.growth}%</span>
              </button>`).join('')}
          `, { foot: `<span>Newest first</span><button data-goto="#/communities">All →</button>` })}
        </aside>
      </div>
    ` : ''}

    ${q && show('posts') && posts.length ? `
      <div class="result-group">
        <h4>Posts · ${posts.length} <i></i></h4>
        <div class="stagger">${posts.map((p) => postCard(p)).join('')}</div>
      </div>` : ''}

    ${q && show('people') && people.length ? `
      <div class="result-group">
        <h4>Students · ${people.length} <i></i></h4>
        <div class="grid grid-3 stagger">${people.map(personCard).join('')}</div>
      </div>` : ''}

    ${q && show('communities') && comms.length ? `
      <div class="result-group">
        <h4>Communities · ${comms.length} <i></i></h4>
        <div class="grid grid-3 stagger">${comms.map(communityCard).join('')}</div>
      </div>` : ''}

    ${q && show('events') && events.length ? `
      <div class="result-group">
        <h4>Events · ${events.length} <i></i></h4>
        <div class="grid grid-2 stagger">${events.map((e) => eventCard(e)).join('')}</div>
      </div>` : ''}

    ${q && totalHits === 0 ? `
      <div class="card empty"><b>No matches for “${esc(q)}”</b>Try a broader term, or clear the search to browse trending topics.</div>` : ''}`;
}

/* --- section: roadmap --- */
function viewRoadmap() {
  const d = S.data;
  const r = d.roadmap;
  const doneTasks = d.checklist.filter((k) => k.done).length;
  const trackFilter = S.filters.courseTrack || 'all';
  const tracks = ['all', ...new Set(d.courses.map((c) => c.track))];
  const courses = trackFilter === 'all' ? d.courses : d.courses.filter((c) => c.track === trackFilter);

  return `
    <section class="journey reveal">
      <div class="journey-grid">
        <div>
          <div class="eyebrow">Roadmap / Learning journey</div>
          <h2>${esc(r.track)}<br><span class="hl">${r.percent}% complete</span></h2>
          <div class="journey-stats">
            ${statBlock(esc(r.currentLevel), 'current level')}
            ${statBlock(esc(r.targetLevel), 'target')}
            ${statBlock(r.weeksRemaining + 'w', 'est. remaining')}
            ${statBlock(r.hoursPerWeek + 'h', 'per week')}
            ${statBlock('🔥 ' + r.streak, 'day streak')}
          </div>
        </div>
        <div class="ring-wrap">
          <div class="ring">
            <svg viewBox="0 0 138 138" width="138" height="138">
              <circle class="track" cx="69" cy="69" r="60"></circle>
              <circle class="fill" cx="69" cy="69" r="60" data-v="${r.percent}"></circle>
            </svg>
            <div class="ring-label"><div><b>${r.percent}%</b><span>Journey</span></div></div>
          </div>
          <div class="milestone-next" style="flex:1">
            <span class="tag-next">Next milestone</span>
            <b>${esc(r.nextMilestone.title)}</b>
            <p>${esc(r.nextMilestone.detail)}</p>
            ${bar(r.nextMilestone.percent, 'lime', true)}
            <div class="row">
              <span>Due in ${esc(r.nextMilestone.dueIn)}</span>
              <span>+${r.nextMilestone.reward} pts</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="home-grid" style="margin-bottom:26px">
      <div>
        <div class="card">
          <div class="eyebrow">Milestone track</div>
          <h3 style="font-size:21px;margin-bottom:6px">Your seven steps to job ready</h3>
          <div class="track-list">
            ${r.milestones.map((m, i) => `
              <div class="track-step is-${m.status}">
                <span class="step-node">${m.status === 'done' ? '✓' : m.status === 'locked' ? '🔒' : i + 1}</span>
                <span class="step-body">
                  <b>${esc(m.title)}</b>
                  <span>${m.weeks} week${m.weeks === 1 ? '' : 's'} · ${m.status === 'done' ? 'completed' : m.status === 'active' ? 'in progress' : m.status === 'next' ? 'up next' : 'locked'}</span>
                </span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <aside class="rail">
        ${railCard('☑ Daily checklist', `
          <div style="padding:5px">
            ${d.checklist.map((k) => `
              <button class="task ${k.done ? 'is-done' : ''}" data-task="${esc(k.id)}">
                <span class="task-box">${k.done ? '✓' : ''}</span>
                <span class="task-label">${esc(k.label)}</span>
                <span class="task-pts">+${k.points}</span>
              </button>`).join('')}
          </div>
        `, {
          aside: `<span class="live" style="color:var(--ink-2)">${doneTasks}/${d.checklist.length} done</span>`,
          foot: `<span>${d.totals.checklistPoints} of ${d.totals.checklistTotal} points today</span><button data-resetchecklist>Reset →</button>`,
        })}

        ${railCard('✦ Personalised for you', `
          <div style="padding:5px;display:flex;flex-direction:column;gap:11px">
            ${d.recommendations.map((rec) => `
              <div class="reco" data-accent="${rec.accent}">
                <span class="pill pill-solid" data-accent="${rec.accent}" style="margin-bottom:7px">${esc(rec.tag)}</span>
                <b>${esc(rec.title)}</b>
                <p>${esc(rec.detail)}</p>
              </div>`).join('')}
          </div>
        `, { foot: `<span>Based on your quiz results & activity</span>` })}
      </aside>
    </div>

    ${sectionHead('Specializations', 'Pick a <span class="hl">skill track</span>', 'Six structured tracks. Each one bundles courses, projects and a capstone into a single path.')}
    <div class="grid grid-3 stagger" style="margin-bottom:30px">
      ${d.specializations.map((s) => `
        <article class="spec" data-accent="${s.accent}">
          <div class="spec-top">
            <span class="spec-ico">${esc(s.icon)}</span>
            <span style="min-width:0">
              <b>${esc(s.name)}</b>
              <small>${esc(s.difficulty)}</small>
            </span>
          </div>
          <div class="spec-body">
            <p>${esc(s.blurb)}</p>
            <div class="spec-facts">
              <span>◷ <b>${esc(s.duration)}</b></span>
              <span>▤ <b>${s.courses}</b> courses</span>
              <span>◎ <b>${num(s.students)}</b> students</span>
              <span class="stars">${stars(s.rating)} <b style="color:var(--ink)">${s.rating}</b></span>
            </div>
            <button class="btn btn-block btn-sm ${s.enrolled ? 'is-on' : 'btn-primary'}" data-track="${esc(s.id)}">
              ${s.enrolled ? '✓ Enrolled — leave track' : 'Start this track'}
            </button>
          </div>
        </article>`).join('')}
    </div>

    ${sectionHead('All courses', 'Browse and <span class="hl">enrol</span>', 'Individual modules you can take on their own or as part of a track.', `
      ${tracks.map((t) => `<button class="chip ${trackFilter === t ? 'is-active' : ''}" data-coursetrack="${esc(t)}">${t === 'all' ? 'All tracks' : esc(t)}</button>`).join('')}
    `)}
    <div class="grid grid-3 stagger">
      ${courses.map((c) => `
        <article class="course" data-accent="${c.accent}">
          <div class="course-top">
            <span class="course-badge">${esc(c.level.slice(0, 3).toUpperCase())}</span>
            <span style="min-width:0;flex:1">
              <b>${esc(c.name)}</b>
              <small>${esc(c.track)} · ${esc(c.instructor)}</small>
            </span>
          </div>
          <div class="course-facts">
            <span>▤ ${c.lessons} lessons</span>
            <span>◷ ${c.hours}h</span>
            <span>◎ ${num(c.students)}</span>
            <span class="stars">${stars(c.rating)}</span>
          </div>
          ${c.enrolled ? `
            <div>
              <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10.5px;color:var(--ink-3);margin-bottom:5px">
                <span>Your progress</span><span>${c.progress}%</span>
              </div>
              ${bar(c.progress, c.accent, true)}
            </div>` : ''}
          <button class="btn btn-block btn-sm ${c.enrolled ? 'is-on' : 'btn-ghost'}" data-course="${esc(c.id)}">
            ${c.enrolled ? '✓ Enrolled' : '+ Enrol now'}
          </button>
        </article>`).join('')}
    </div>`;
}

/* --- section: network --- */
function viewNetwork() {
  const d = S.data;
  const group = S.filters.group || 'all';
  const level = S.filters.level || null;

  let list = d.users.slice();
  if (group !== 'all') list = list.filter((u) => u.tags.includes(group));
  if (level) list = list.filter((u) => u.level === level);
  if (S.query) list = list.filter((u) => matches(u.name + u.institution + u.bio + u.specialties.join(' '), S.query));

  const byLevel = (id) => d.users.filter((u) => u.level === id).length;
  const connectedCount = d.connectedUsers.length;

  return `
    ${sectionHead('Network', 'Build a network that <span class="hl">answers back</span>',
      'Peers to study with, seniors who have been through it, and industry folks who reply. Filter by level or by what you need.',
      `<button class="btn btn-primary" data-goto="#/explore">⌕ Discover people</button>`)}

    <div class="level-grid">
      ${d.connections.levels.map((l, i) => `
        <button class="level-card ${level === l.id ? 'is-active' : ''}" data-accent="${TAG_ACCENTS[i]}" data-level="${l.id}">
          <b>${byLevel(l.id)}</b>
          <div class="level-name">${esc(l.label)}</div>
          <div class="level-note">${esc(l.note)}</div>
          <span class="rungs">${[0, 1, 2, 3].map((n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</span>
        </button>`).join('')}
    </div>

    <div class="card" style="margin-bottom:22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div class="stat-row" style="flex:1">
        ${statBlock(num(d.profile.stats.connections), 'total connections')}
        ${statBlock(connectedCount, 'active this session')}
        ${statBlock(d.users.filter((u) => u.tags.includes('expert')).length, 'industry experts')}
        ${statBlock(d.users.filter((u) => u.tags.includes('study-partner')).length, 'study partners')}
      </div>
      ${level ? `<button class="btn btn-sm btn-ghost" data-level="">✕ Clear level: ${esc(level)}</button>` : ''}
    </div>

    <div class="chips" style="margin-bottom:18px">
      ${d.connections.groups.map((g) => `
        <button class="chip ${group === g.id ? 'is-active' : ''}" data-group="${g.id}">${esc(g.label)}</button>`).join('')}
    </div>

    <div class="grid grid-3 stagger">
      ${list.length ? list.map(personCard).join('')
        : `<div class="card empty" style="grid-column:1/-1"><b>No one matches those filters</b>Try a different category or clear the level filter.</div>`}
    </div>`;
}

/* --- section: communities --- */
const COMM_SORTS = [
  { id: 'popular', label: 'Most popular' },
  { id: 'newest', label: 'Newest' },
  { id: 'active', label: 'Most active' },
  { id: 'trending', label: 'Trending' },
];

function viewCommunities() {
  const d = S.data;
  const sort = S.filters.commSort || 'popular';
  const cat = S.filters.commCat || 'all';
  const cats = ['all', ...new Set(d.communities.map((c) => c.category))];

  let list = d.communities.slice();
  if (cat !== 'all') list = list.filter((c) => c.category === cat);
  if (S.query) list = list.filter((c) => matches(c.name + c.category + c.blurb, S.query));
  if (sort === 'popular') list.sort((a, b) => b.members - a.members);
  if (sort === 'newest') list.sort((a, b) => a.createdDaysAgo - b.createdDaysAgo);
  if (sort === 'active') list.sort((a, b) => b.activeToday - a.activeToday);
  if (sort === 'trending') list.sort((a, b) => b.growth - a.growth);

  const joined = d.communities.filter((c) => c.joined);
  const spotlight = d.communities.slice().sort((a, b) => b.growth - a.growth).slice(0, 3);

  return `
    ${sectionHead('Communities', 'Find your <span class="hl">people</span>',
      `${num(d.communities.reduce((s, c) => s + c.members, 0))} students across ${d.communities.length} communities. Join as many as you like — membership is saved to your account.`,
      `<button class="btn btn-indigo" data-quick="community">+ Browse & join</button>`)}

    <div class="card" style="margin-bottom:22px">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div class="stat-row" style="flex:1">
          ${statBlock(joined.length, 'your communities')}
          ${statBlock(num(joined.reduce((s, c) => s + c.members, 0)), 'peers reachable')}
          ${statBlock(num(d.communities.reduce((s, c) => s + c.activeToday, 0)), 'active today')}
        </div>
        <div style="min-width:200px;flex:1;max-width:300px">
          <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10.5px;color:var(--ink-3);margin-bottom:6px">
            <span>Community Builder badge</span>
            <span>${joined.length}/5</span>
          </div>
          ${bar(Math.min(100, (joined.length / 5) * 100), 'indigo')}
        </div>
      </div>
      ${joined.length ? `
        <div style="margin-top:16px;padding-top:14px;border-top:1.5px dashed var(--line-2)">
          <div class="eyebrow" style="margin-bottom:9px">Your memberships</div>
          <div class="chips">
            ${joined.map((c) => `<span class="tag" data-accent="${c.accent}">${esc(c.icon)} ${esc(c.name)}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>

    <div class="result-group">
      <h4>Community spotlight — fastest growing <i></i></h4>
      <div class="grid grid-3 stagger">
        ${spotlight.map((c) => `
          <article class="card card-hover" data-accent="${c.accent}" style="display:flex;gap:13px;align-items:flex-start">
            <span class="spot-ico" style="width:46px;height:46px;font-size:19px">${esc(c.icon)}</span>
            <div style="min-width:0;flex:1">
              <b style="font-family:var(--font-display);font-size:16.5px;letter-spacing:-.03em;display:block">${esc(c.name)}</b>
              <span class="trend-meta">${num(c.members)} members · ${num(c.activeToday)} active today</span>
              <div style="margin-top:9px">${bar(Math.min(100, c.growth * 3.6), c.accent, true)}</div>
              <span class="trend-meta" style="display:block;margin-top:5px;color:var(--teal);font-weight:700">↗ ${c.growth}% growth this week</span>
            </div>
          </article>`).join('')}
      </div>
    </div>

    <div class="feed-filters" style="margin:22px 0 16px">
      ${COMM_SORTS.map((s) => `<button class="chip ${sort === s.id ? 'is-active' : ''}" data-commsort="${s.id}">${esc(s.label)}</button>`).join('')}
      <span style="width:1px;height:24px;background:var(--line-2);margin:0 4px"></span>
      ${cats.map((c) => `<button class="chip ${cat === c ? 'is-active' : ''}" data-commcat="${esc(c)}">${c === 'all' ? 'All categories' : esc(c)}</button>`).join('')}
    </div>

    <div class="grid grid-3 stagger">
      ${list.length ? list.map(communityCard).join('')
        : `<div class="card empty" style="grid-column:1/-1"><b>No communities match</b>Try another category or clear your search.</div>`}
    </div>`;
}

/* --- section: events --- */
function viewEvents() {
  const d = S.data;
  const type = S.filters.evType || 'all';
  const types = ['all', 'Workshop', 'Bootcamp', 'Competition', 'Hackathon'];

  let list = d.events.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  if (type !== 'all') list = list.filter((e) => e.type === type);
  if (S.query) list = list.filter((e) => matches(e.title + e.type + e.blurb + e.location + e.hostedBy, S.query));

  const going = d.events.filter((e) => e.going).sort((a, b) => new Date(a.date) - new Date(b.date));
  const count = (t) => d.events.filter((e) => e.type === t).length;

  return `
    ${sectionHead('Events', 'Workshops, bootcamps<br><span class="hl">hackathons & comps</span>',
      'Everything happening across UniteX. RSVP is saved server-side, so your schedule persists.',
      `<button class="btn btn-lime" data-quick="event">◈ Create event</button>`)}

    <div class="grid grid-4" style="margin-bottom:22px">
      ${[
        { t: 'Workshop', icon: '✎', accent: 'coral' },
        { t: 'Bootcamp', icon: '⚑', accent: 'indigo' },
        { t: 'Competition', icon: '★', accent: 'lime' },
        { t: 'Hackathon', icon: '⚡', accent: 'amber' },
      ].map((k) => `
        <button class="card card-hover" data-accent="${k.accent}" data-evtype="${k.t}" style="text-align:left;display:flex;gap:12px;align-items:center">
          <span class="spot-ico">${k.icon}</span>
          <span>
            <b style="font-family:var(--font-display);font-size:22px;display:block;line-height:1">${count(k.t)}</b>
            <span class="trend-meta">${esc(k.t)}${count(k.t) === 1 ? '' : 's'}</span>
          </span>
        </button>`).join('')}
    </div>

    ${going.length ? `
      <div class="result-group">
        <h4>Your schedule · ${going.length} confirmed <i></i></h4>
        <div class="card" style="display:flex;flex-direction:column;gap:2px">
          ${going.map((e) => {
            const ds = dayStamp(e.date);
            return `
            <div style="display:flex;gap:13px;align-items:center;padding:11px 4px;border-bottom:1.5px dashed var(--line)" data-accent="${e.accent}">
              <span class="mini-date" style="width:46px"><b>${ds.day}</b><span>${ds.mon}</span></span>
              <span style="min-width:0;flex:1">
                <b style="font-size:14.5px;display:block;letter-spacing:-.02em">${esc(e.title)}</b>
                <span class="trend-meta">${ds.full} · ${ds.time} · ${esc(e.mode)} · ${esc(e.location)}</span>
              </span>
              <span class="pill pill-solid" data-accent="${e.accent}">${esc(e.type)}</span>
              <button class="btn btn-sm btn-ghost" data-rsvp="${esc(e.id)}">Cancel</button>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

    <div class="feed-filters" style="margin:22px 0 16px">
      ${types.map((t) => `<button class="chip ${type === t ? 'is-active' : ''}" data-evtype="${esc(t)}">${t === 'all' ? 'All events' : esc(t) + 's'}</button>`).join('')}
    </div>

    <div class="grid grid-2 stagger">
      ${list.length ? list.map((e) => eventCard(e, { agenda: true })).join('')
        : `<div class="card empty" style="grid-column:1/-1"><b>No events of that type</b>Try another category, or create your own.</div>`}
    </div>`;
}

/* --- section: messages --- */
function viewMessages() {
  const d = S.data;
  const q = S.filters.msgQuery || '';
  let list = d.conversations.slice();
  if (q) {
    list = list.filter((c) => matches(c.name + ' ' + c.messages.map((m) => m.text).join(' '), q));
  }
  const activeId = S.active.convo && list.some((c) => c.id === S.active.convo)
    ? S.active.convo
    : (list[0] ? list[0].id : null);
  S.active.convo = activeId;
  const convo = d.conversations.find((c) => c.id === activeId);

  return `
    <div class="msg-shell ${S.active.threadOpen ? 'thread-open' : ''}">
      <div class="msg-list">
        <div class="msg-list-head">
          <h3>Messages</h3>
          <div class="msg-search">
            <span class="mag">⌕</span>
            <input type="search" id="msgSearch" value="${esc(q)}" placeholder="Search conversations…" aria-label="Search conversations">
          </div>
        </div>
        <div class="convo-scroll">
          ${list.length ? list.map((c) => {
            const last = c.messages[c.messages.length - 1] || {};
            return `
            <button class="convo ${c.id === activeId ? 'is-active' : ''}" data-convo="${esc(c.id)}">
              ${avatar(c.initials, c.accent)}
              <span class="convo-body">
                <span class="convo-top">
                  <span class="convo-name">${esc(c.name)}</span>
                  <span class="convo-when">${ago(last.at)}</span>
                </span>
                <span class="convo-preview">${last.from === 'me' ? 'You: ' : (last.author ? esc(last.author) + ': ' : '')}${esc(last.text || '')}</span>
                <span style="display:flex;gap:6px;align-items:center;margin-top:6px">
                  <span class="kind-pill" data-accent="${c.accent}">${c.kind === 'group' ? 'Group' : 'Direct'}</span>
                  <span class="convo-when" style="margin:0">${new Date(last.at).toLocaleDateString()}</span>
                </span>
              </span>
              ${c.unread ? `<span class="convo-unread">${c.unread}</span>` : ''}
            </button>`;
          }).join('') : `<div class="empty"><b>No conversations</b>Nothing matches that search.</div>`}
        </div>
      </div>

      ${convo ? `
        <div class="thread">
          <div class="thread-head">
            <button class="icon-btn" style="width:32px;height:32px" data-closethread title="Back to list">←</button>
            ${avatar(convo.initials, convo.accent)}
            <div style="flex:1;min-width:0">
              <b>${esc(convo.name)}</b>
              <small>${esc(convo.subtitle)}</small>
            </div>
            <span class="kind-pill" data-accent="${convo.accent}">${convo.kind === 'group' ? 'Group chat' : 'Direct message'}</span>
          </div>
          <div class="thread-scroll" id="threadScroll">
            ${convo.messages.map((m) => `
              <div class="bubble-row ${m.from === 'me' ? 'mine' : ''}">
                ${avatar(m.from === 'me' ? d.profile.initials : (m.author ? m.author.split(' ').map((w) => w[0]).join('').slice(0, 2) : convo.initials),
                  m.from === 'me' ? 'indigo' : convo.accent, 'av-sm')}
                <div class="bubble">
                  ${m.from !== 'me' && m.author ? `<div class="bubble-author">${esc(m.author)}</div>` : ''}
                  <div>${esc(m.text)}</div>
                  <time>${clock(m.at)}</time>
                </div>
              </div>`).join('')}
          </div>
          <form class="composer" id="composer">
            <button type="button" class="icon-btn" title="Attach">＋</button>
            <input type="text" id="msgInput" placeholder="Type a message…" aria-label="Type a message" maxlength="2000" autocomplete="off" required>
            <button class="btn btn-primary" type="submit">Send ↗</button>
          </form>
        </div>` : `<div class="thread"><div class="empty" style="margin:auto"><b>Pick a conversation</b>Select a chat on the left to start reading.</div></div>`}
    </div>`;
}

/* --- section: profile --- */
function viewProfile() {
  const d = S.data;
  const p = d.profile;
  const earned = d.achievements.filter((a) => a.progress >= 100);
  const inProgress = d.achievements.filter((a) => a.progress < 100);
  const joined = d.communities.filter((c) => c.joined);
  const going = d.events.filter((e) => e.going);
  const myPosts = d.posts.filter((x) => x.authorId === null);

  return `
    <section class="profile-hero reveal">
      <div class="profile-cover">
        <span class="sticker s1">🔥 ${d.roadmap.streak}-day streak</span>
        <span class="sticker s2">${d.totals.points} pts</span>
      </div>
      <div class="profile-main">
        <div class="profile-top">
          <span class="av av-lg" data-accent="indigo">${esc(p.initials)}</span>
          <div class="profile-id">
            <h1>${esc(p.name)}</h1>
            <div class="handle">@${esc(p.handle)} · ${esc(p.institution)}</div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-ink" data-editprofile>✎ Edit profile</button>
            <button class="btn btn-ghost" data-quick="post">New post</button>
          </div>
        </div>
        <p class="profile-bio">${esc(p.bio)}</p>
        <div class="chips" style="margin-top:13px">
          ${p.interests.map((i) => `<span class="tag" data-accent="${tagAccent(i)}">${esc(i)}</span>`).join('')}
        </div>
        <div class="profile-meta">
          <span>▤ ${esc(p.year)}</span>
          <span>⚲ ${esc(p.location)}</span>
          <span>◷ ${esc(p.joined)}</span>
        </div>
        <div class="profile-stats">
          ${statBlock(myPosts.length || p.stats.posts, 'posts')}
          ${statBlock(num(p.stats.connections), 'connections')}
          ${statBlock(joined.length, 'communities')}
          ${statBlock(going.length, 'events')}
          ${statBlock(d.totals.earnedCount + '/' + d.totals.totalCount, 'badges')}
        </div>
      </div>
    </section>

    <section class="points-banner reveal">
      <div class="points-big">${d.totals.points}<small>Total points earned</small></div>
      <span class="divider"></span>
      <div class="stat-row" style="flex:1">
        ${statBlock(d.totals.earnedCount, 'achievements unlocked')}
        ${statBlock(inProgress.length, 'in progress')}
        ${statBlock(d.roadmap.percent + '%', 'roadmap complete')}
        ${statBlock(d.totals.checklistPoints, 'points today')}
      </div>
      <button class="btn btn-lime" data-goto="#/roadmap">Continue learning →</button>
    </section>

    <div class="home-grid" style="margin-bottom:26px">
      <div>
        ${sectionHead('Achievements & badges', 'Your <span class="hl">collection</span>', 'Eight badges, four rarities. Progress updates automatically as you participate.')}
        <div class="grid grid-3 stagger">
          ${d.achievements.map(achievementCard).join('')}
        </div>
      </div>

      <aside class="rail">
        ${railCard('⌘ Connect', `
          <div style="padding:5px;display:flex;flex-direction:column;gap:9px">
            ${p.links.map((l) => `
              <button class="link-tile" data-accent="${l.accent}" data-link="${esc(l.label)}">
                <span class="link-glyph">${esc(l.glyph)}</span>
                <span style="min-width:0;flex:1">
                  <b>${esc(l.label)}</b>
                  <small>${esc(l.handle)}</small>
                </span>
                <span style="font-size:13px;color:var(--ink-3)">↗</span>
              </button>`).join('')}
          </div>
        `, { foot: `<span>Shown on your public profile</span><button data-editprofile>Edit →</button>` })}

        ${railCard('◎ Engagement', `
          <div style="padding:7px;display:flex;flex-direction:column;gap:14px">
            ${[
              { label: 'Network building', v: Math.min(100, Math.round((p.stats.connections / 200) * 100)), accent: 'rose', note: `${num(p.stats.connections)} of 200 target` },
              { label: 'Mentoring students', v: 60, accent: 'violet', note: '6 of 10 students helped' },
              { label: 'Project sharing', v: 40, accent: 'teal', note: '2 of 5 projects shared' },
              { label: 'Learning goals', v: d.roadmap.percent, accent: 'lime', note: `${d.roadmap.track}` },
              { label: 'Community activity', v: Math.min(100, joined.length * 20), accent: 'indigo', note: `${joined.length} communities joined` },
            ].map((r) => `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:6px">
                  <span>${esc(r.label)}</span><span style="font-family:var(--font-mono);color:var(--ink-3);font-weight:400">${r.v}%</span>
                </div>
                ${bar(r.v, r.accent, true)}
                <div class="trend-meta" style="margin-top:4px">${esc(r.note)}</div>
              </div>`).join('')}
          </div>
        `, { foot: `<span>Tracked automatically from your activity</span>` })}

        ${railCard('✎ Your posts', `
          <div style="padding:5px;display:flex;flex-direction:column;gap:8px">
            ${myPosts.length ? myPosts.slice(0, 5).map((x) => `
              <button class="spot" data-accent="coral" data-goto="#/home">
                <span style="min-width:0">
                  <b>${esc(x.title.slice(0, 52))}${x.title.length > 52 ? '…' : ''}</b>
                  <small>${num(x.points)} points · ${x.commentCount} comments · ${ago(x.createdAt)}</small>
                </span>
              </button>`).join('')
              : `<div class="empty" style="padding:18px 10px"><b>No posts yet</b>Share something with the community.</div>`}
          </div>
        `, { foot: `<span>${myPosts.length} authored by you</span><button data-quick="post">Write →</button>` })}

        ${railCard('⟲ Session', `
          <div style="padding:9px">
            <p style="font-size:13px;color:var(--ink-2)">Everything you create is stored server-side in the page database. Reset restores the original seeded dataset.</p>
            <button class="btn btn-block btn-ghost btn-sm" style="margin-top:11px" data-reset>⟲ Reset all data</button>
          </div>
        `, { foot: `<span>Storage: ${S.mode === 'database' ? 'TiDB (persistent)' : 'in-memory (preview)'}</span>` })}
      </aside>
    </div>`;
}

/* --- modals --- */
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="overlay" data-overlay>${html}</div>`;
  document.body.style.overflow = 'hidden';
  const focusable = root.querySelector('input, textarea, select, button');
  if (focusable) setTimeout(() => focusable.focus(), 60);
}

function closeModal() {
  $('#modalRoot').innerHTML = '';
  document.body.style.overflow = '';
}

function modalShell(title, body, foot, accent = 'coral') {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <span class="spot-ico" data-accent="${accent}" style="width:38px;height:38px;border-radius:11px">✦</span>
        <h3>${esc(title)}</h3>
        <button class="icon-btn" data-closemodal aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${foot}</div>
    </div>`;
}

function modalCreatePost() {
  const comms = S.data.communities;
  openModal(modalShell('Create a post', `
    <form id="postForm" style="display:flex;flex-direction:column;gap:16px">
      <div class="field-group">
        <label for="pTitle">Title</label>
        <input id="pTitle" type="text" maxlength="180" required placeholder="What did you learn, build or get stuck on?">
      </div>
      <div class="field-group">
        <label for="pCommunity">Post to</label>
        <select id="pCommunity">
          ${comms.map((c) => `<option value="${esc(c.name)}" ${c.joined ? 'selected' : ''}>${esc(c.name)} — ${num(c.members)} members</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label for="pBody">Body</label>
        <textarea id="pBody" maxlength="4000" placeholder="Share the detail. Study guides, war stories and honest questions all do well here."></textarea>
      </div>
      <div class="field-group">
        <label for="pTags">Tags</label>
        <input id="pTags" type="text" placeholder="react, career, studyguide">
        <span class="field-hint">Comma separated. Up to 5. The # is added for you.</span>
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" data-closemodal>Cancel</button>
    <button class="btn btn-primary" form="postForm" type="submit">Publish post ↗</button>
  `, 'coral'));

  $('#postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('[form="postForm"]');
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
      await apiPost('/api/posts', {
        title: $('#pTitle').value,
        body: $('#pBody').value,
        community: $('#pCommunity').value,
        tags: $('#pTags').value,
      });
      closeModal();
      S.filters.feed = 'all';
      S.query = '';
      go('#/home');
      toast('Post published to the feed', '✎', 'coral');
    } catch (err) {
      toast(err.message, '!', 'amber');
      btn.disabled = false;
      btn.textContent = 'Publish post ↗';
    }
  });
}

function modalCreateEvent() {
  const comms = S.data.communities;
  const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16);
  openModal(modalShell('Create an event', `
    <form id="evForm" style="display:flex;flex-direction:column;gap:16px">
      <div class="field-group">
        <label for="eTitle">Event name</label>
        <input id="eTitle" type="text" maxlength="140" required placeholder="e.g. Intro to Docker for students">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label for="eType">Type</label>
          <select id="eType">
            <option>Workshop</option><option>Bootcamp</option>
            <option>Competition</option><option>Hackathon</option>
          </select>
        </div>
        <div class="field-group">
          <label for="eMode">Format</label>
          <select id="eMode">
            <option>Online</option><option>In person</option><option>Hybrid</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label for="eDate">Date & time</label>
          <input id="eDate" type="datetime-local" value="${soon}" required>
        </div>
        <div class="field-group">
          <label for="eDuration">Duration</label>
          <input id="eDuration" type="text" value="2h" placeholder="2h">
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label for="eLocation">Location</label>
          <input id="eLocation" type="text" placeholder="Zoom · link on RSVP">
        </div>
        <div class="field-group">
          <label for="eCapacity">Capacity</label>
          <input id="eCapacity" type="number" min="2" max="5000" value="100">
        </div>
      </div>
      <div class="field-group">
        <label for="eHost">Hosting community</label>
        <select id="eHost">
          ${comms.map((c) => `<option value="${esc(c.name)}" ${c.joined ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label for="eBlurb">Description</label>
        <textarea id="eBlurb" maxlength="400" style="min-height:84px" placeholder="What will attendees walk away with?"></textarea>
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" data-closemodal>Cancel</button>
    <button class="btn btn-lime" form="evForm" type="submit">Create event ◈</button>
  `, 'lime'));

  $('#evForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('[form="evForm"]');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      await apiPost('/api/events', {
        title: $('#eTitle').value,
        type: $('#eType').value,
        mode: $('#eMode').value,
        date: $('#eDate').value,
        duration: $('#eDuration').value,
        location: $('#eLocation').value || ($('#eMode').value === 'Online' ? 'Online · link on RSVP' : 'Venue TBC'),
        capacity: $('#eCapacity').value,
        host: $('#eHost').value,
        blurb: $('#eBlurb').value,
      });
      closeModal();
      go('#/events');
      toast('Event created — Event Organizer badge unlocked', '◈', 'lime');
    } catch (err) {
      toast(err.message, '!', 'amber');
      btn.disabled = false;
      btn.textContent = 'Create event ◈';
    }
  });
}

function modalJoinCommunity() {
  const list = S.data.communities.slice().sort((a, b) => b.growth - a.growth);
  openModal(modalShell('Join a community', `
    <p class="sec-sub" style="margin:0">Tap to join or leave. Membership is saved to your account instantly.</p>
    <div style="display:flex;flex-direction:column;gap:9px" id="joinList">
      ${list.map((c) => `
        <button class="spot" data-accent="${c.accent}" data-join="${esc(c.id)}" style="padding:12px">
          <span class="spot-ico">${esc(c.icon)}</span>
          <span style="min-width:0;flex:1">
            <b>${esc(c.name)}</b>
            <small>${num(c.members)} members · ${esc(c.category)} · ↗ ${c.growth}%</small>
          </span>
          <span class="pill ${c.joined ? 'pill-solid' : ''}" data-accent="teal">${c.joined ? '✓ Joined' : '+ Join'}</span>
        </button>`).join('')}
    </div>
  `, `<button class="btn btn-ink" data-closemodal>Done</button>`, 'indigo'));
}

function modalEditProfile() {
  const p = S.data.profile;
  openModal(modalShell('Edit your profile', `
    <form id="profForm" style="display:flex;flex-direction:column;gap:16px">
      <div class="field-group">
        <label for="prName">Display name</label>
        <input id="prName" type="text" maxlength="60" value="${esc(p.name)}" required>
      </div>
      <div class="field-group">
        <label for="prBio">Short bio</label>
        <textarea id="prBio" maxlength="600" style="min-height:120px">${esc(p.bio)}</textarea>
      </div>
      <div class="field-group">
        <label for="prInterests">Interests & objectives</label>
        <input id="prInterests" type="text" value="${esc(p.interests.join(', '))}">
        <span class="field-hint">Comma separated. These show as tags on your profile.</span>
      </div>
      <div class="field-group" style="gap:10px">
        <label>Connection links</label>
        ${p.links.map((l, i) => `
          <div style="display:flex;gap:9px;align-items:center">
            <span class="link-glyph" data-accent="${l.accent}" style="width:32px;height:32px;font-size:12px">${esc(l.glyph)}</span>
            <input type="text" data-linkfield="${esc(l.label)}" value="${esc(l.handle)}" placeholder="${esc(l.label)} handle or URL" style="flex:1">
          </div>`).join('')}
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" data-closemodal>Cancel</button>
    <button class="btn btn-ink" form="profForm" type="submit">Save changes</button>
  `, 'violet'));

  $('#profForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('/api/profile', {
        name: $('#prName').value,
        bio: $('#prBio').value,
        interests: $('#prInterests').value.split(',').map((s) => s.trim()).filter(Boolean),
        links: $$('[data-linkfield]').map((el) => ({ label: el.dataset.linkfield, handle: el.value })),
      });
      closeModal();
      render();
      toast('Profile updated', '✓', 'violet');
    } catch (err) {
      toast(err.message, '!', 'amber');
    }
  });
}

function modalEventDetail(ev) {
  const d = dayStamp(ev.date);
  openModal(modalShell(ev.title, `
    <div class="ev-facts">
      <span class="pill pill-solid" data-accent="${esc(ev.accent)}">${esc(ev.type)}</span>
      <span class="pill">${d.full} · ${d.time}</span>
      <span class="pill">◷ ${esc(ev.duration)}</span>
      <span class="pill">${esc(ev.mode)}</span>
    </div>
    <p style="color:var(--ink-2)">${esc(ev.blurb)}</p>
    <div class="field-group">
      <label>Location</label>
      <p style="font-size:14px">${esc(ev.location)} · hosted by ${esc(ev.hostedBy)} in ${esc(ev.host)}</p>
    </div>
    ${(ev.agenda || []).length ? `
      <div class="ev-agenda" data-accent="${esc(ev.accent)}">
        ${ev.agenda.map((a, i) => `<span><i>${i + 1}</i>${esc(a)}</span>`).join('')}
      </div>` : ''}
    <div>
      <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);margin-bottom:6px">
        <span>${num(ev.attendees)} of ${num(ev.capacity)} attending</span>
        <span>${Math.round((ev.attendees / ev.capacity) * 100)}% full</span>
      </div>
      ${bar(Math.round((ev.attendees / ev.capacity) * 100), ev.accent)}
    </div>
  `, `
    <button class="btn btn-ghost" data-closemodal>Close</button>
    <button class="btn ${ev.going ? 'is-on' : 'btn-primary'}" data-rsvp="${esc(ev.id)}">${ev.going ? '✓ Going — cancel' : 'Attend this event'}</button>
  `, ev.accent));
}

/* --- shell: nav, router, boot --- */
const ROUTES = [
  { id: 'home', label: 'Home', icon: '⌂', accent: 'coral', view: viewHome, group: 'Feed' },
  { id: 'explore', label: 'Explore', icon: '⌕', accent: 'amber', view: viewExplore, group: 'Feed' },
  { id: 'roadmap', label: 'Roadmap', icon: '➔', accent: 'lime', view: viewRoadmap, group: 'Grow' },
  { id: 'network', label: 'Network', icon: '⌘', accent: 'teal', view: viewNetwork, group: 'Grow' },
  { id: 'communities', label: 'Communities', icon: '◎', accent: 'indigo', view: viewCommunities, group: 'Connect' },
  { id: 'events', label: 'Events', icon: '◈', accent: 'violet', view: viewEvents, group: 'Connect' },
  { id: 'messages', label: 'Messages', icon: '✉', accent: 'rose', view: viewMessages, group: 'Connect' },
  { id: 'profile', label: 'Profile', icon: '★', accent: 'slate', view: viewProfile, group: 'You' },
];

function currentRoute() {
  const id = (location.hash || '#/home').replace('#/', '').split('?')[0];
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function unreadTotal() {
  return S.data.conversations.reduce((s, c) => s + (c.unread || 0), 0);
}

function renderNav() {
  const active = currentRoute().id;
  const unread = unreadTotal();
  const groups = [];
  ROUTES.forEach((r) => {
    let g = groups.find((x) => x.name === r.group);
    if (!g) groups.push((g = { name: r.group, items: [] }));
    g.items.push(r);
  });

  $('#nav').innerHTML = groups.map((g) => `
    <div class="nav-label">${esc(g.name)}</div>
    ${g.items.map((r) => `
      <button class="nav-item ${r.id === active ? 'is-active' : ''}" data-accent="${r.accent}" data-nav="${r.id}">
        <span class="ico">${r.icon}</span>
        <span>${esc(r.label)}</span>
        ${r.id === 'messages' && unread ? `<span class="badge-count">${unread}</span>` : ''}
      </button>`).join('')}
  `).join('');

  const d = S.data;
  $('#sideFoot').innerHTML = `
    <div class="side-streak">
      <span class="streak-flame">🔥</span>
      <span>
        <span class="side-points">${d.totals.points} pts</span>
        <span class="side-meta" style="display:block">${d.totals.earnedCount} of ${d.totals.totalCount} badges</span>
      </span>
    </div>
    ${bar(Math.round((d.totals.earnedCount / d.totals.totalCount) * 100), 'amber', true)}
    <div class="db-chip"><span class="db-dot"></span>${S.mode === 'database' ? 'Saved to database' : 'Preview · in memory'}</div>`;

  $('#msgDot').textContent = unread;
  $('#msgDot').style.display = unread ? 'grid' : 'none';
  $('#meAv').textContent = d.profile.initials;
  $('#meName').innerHTML = `${esc(d.profile.name.split(' ')[0])}<span>${esc(d.profile.year.split('·')[0].trim())}</span>`;
  $('#crumb').innerHTML = `UniteX / <b>${esc(currentRoute().label)}</b>`;
}

function render() {
  const route = currentRoute();
  renderNav();
  const page = $('#page');
  page.innerHTML = route.view();
  animateBars(page);
  // Keep the message thread pinned to the newest message.
  const scroll = $('#threadScroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  const gs = $('#globalSearch');
  if (gs && gs.value !== S.query) gs.value = S.query;
}

/* --- global event delegation --- */
document.addEventListener('click', async (e) => {
  const hit = (attr) => e.target.closest(`[${attr}]`);

  // navigation
  const nav = hit('data-nav');
  if (nav) {
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('on');
    go('#/' + nav.dataset.nav);
    return;
  }
  const goto = hit('data-goto');
  if (goto) { go(goto.dataset.goto); return; }

  // modal plumbing
  if (hit('data-closemodal')) { closeModal(); return; }
  if (e.target.matches('[data-overlay]')) { closeModal(); return; }

  // quick actions
  const quick = hit('data-quick');
  if (quick) {
    const k = quick.dataset.quick;
    if (k === 'post') modalCreatePost();
    else if (k === 'event') modalCreateEvent();
    else if (k === 'community') modalJoinCommunity();
    else if (k === 'achievements') go('#/profile');
    else if (k === 'roadmap') go('#/roadmap');
    else if (k === 'network') go('#/network');
    return;
  }

  // quick slider arrows
  const slide = hit('data-slide');
  if (slide) {
    const track = $('#quickTrack');
    if (track) track.scrollBy({ left: Number(slide.dataset.slide) * 380, behavior: 'smooth' });
    return;
  }

  // post interactions
  const like = hit('data-like');
  if (like) {
    like.classList.toggle('is-on');
    try {
      const r = await apiPost('/api/posts/like', { id: like.dataset.like });
      const el = like.querySelector('[data-points]');
      if (el) { el.textContent = num(r.points); el.classList.add('pop-num'); }
      renderNav();
    } catch (err) { toast(err.message, '!', 'amber'); render(); }
    return;
  }

  const expand = hit('data-expand');
  if (expand) {
    const k = 'post:' + expand.dataset.expand;
    S.active[k] = !S.active[k];
    render();
    return;
  }

  const commentsBtn = hit('data-comments');
  if (commentsBtn) {
    const k = 'comments:' + commentsBtn.dataset.comments;
    S.active[k] = !S.active[k];
    render();
    return;
  }

  const share = hit('data-share');
  if (share) {
    const post = S.data.posts.find((p) => p.id === share.dataset.share);
    const url = location.origin + '/#/home';
    try {
      await navigator.clipboard.writeText(`${post.title} — ${url}`);
      toast('Link copied to clipboard', '↗', 'teal');
    } catch { toast('Sharing is blocked in this browser', '!', 'amber'); }
    return;
  }

  const save = hit('data-save');
  if (save) {
    save.textContent = save.textContent.trim() === '☆' ? '★' : '☆';
    toast(save.textContent.trim() === '★' ? 'Saved for later' : 'Removed from saved', '☆', 'amber');
    return;
  }

  // tag / topic search
  const tagsearch = hit('data-tagsearch');
  if (tagsearch) {
    S.query = tagsearch.dataset.tagsearch.replace(/^#/, '');
    S.filters.scope = 'all';
    go('#/explore');
    return;
  }
  const topicsearch = hit('data-topicsearch');
  if (topicsearch) {
    S.query = topicsearch.dataset.topicsearch;
    S.filters.scope = 'all';
    go('#/explore');
    return;
  }

  // filters
  const map = [
    ['data-feedfilter', 'feed'], ['data-scope', 'scope'], ['data-group', 'group'],
    ['data-commsort', 'commSort'], ['data-commcat', 'commCat'], ['data-evtype', 'evType'],
    ['data-coursetrack', 'courseTrack'],
  ];
  for (const [attr, key] of map) {
    const el = hit(attr);
    if (el) {
      S.filters[key] = el.getAttribute(attr);
      render();
      return;
    }
  }
  const lvl = hit('data-level');
  if (lvl) { S.filters.level = lvl.getAttribute('data-level') || null; render(); return; }

  if (hit('data-clearsearch')) { S.query = ''; render(); return; }

  // joins, rsvps, connections, tasks, courses
  const join = hit('data-join');
  if (join) {
    try {
      const r = await apiPost('/api/communities/join', { id: join.dataset.join });
      const c = S.data.communities.find((x) => x.id === join.dataset.join);
      toast(r.joined ? `Joined ${c.name}` : `Left ${c.name}`, r.joined ? '✓' : '↩', r.joined ? 'teal' : 'slate');
      if (r.joined && r.badge === 100) toast('Community Builder badge unlocked! +50 pts', '★', 'amber');
      if ($('#modalRoot').innerHTML) modalJoinCommunity();
      else render();
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  const rsvp = hit('data-rsvp');
  if (rsvp) {
    try {
      const r = await apiPost('/api/events/rsvp', { id: rsvp.dataset.rsvp });
      const ev = S.data.events.find((x) => x.id === rsvp.dataset.rsvp);
      toast(r.going ? `You're going to ${ev.title}` : `RSVP cancelled`, r.going ? '✓' : '↩', r.going ? 'lime' : 'slate');
      closeModal();
      render();
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  const connect = hit('data-connect');
  if (connect) {
    try {
      const r = await apiPost('/api/connections/toggle', { id: connect.dataset.connect });
      const u = S.data.users.find((x) => x.id === connect.dataset.connect);
      toast(r.connected ? `Connected with ${u.name}` : `Removed ${u.name}`, r.connected ? '✓' : '↩', r.connected ? 'teal' : 'slate');
      render();
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  const task = hit('data-task');
  if (task) {
    try {
      const r = await apiPost('/api/checklist/toggle', { id: task.dataset.task });
      const item = S.data.checklist.find((k) => k.id === task.dataset.task);
      if (r.done) toast(`+${item.points} points — nice`, '✓', 'lime');
      render();
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  const course = hit('data-course');
  if (course) {
    try {
      const r = await apiPost('/api/courses/enroll', { id: course.dataset.course });
      const c = S.data.courses.find((x) => x.id === course.dataset.course);
      toast(r.enrolled ? `Enrolled in ${c.name}` : `Left ${c.name}`, r.enrolled ? '✓' : '↩', r.enrolled ? 'lime' : 'slate');
      render();
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  const track = hit('data-track');
  if (track) {
    try {
      const r = await apiPost('/api/tracks/enroll', { id: track.dataset.track });
      const t = S.data.specializations.find((x) => x.id === track.dataset.track);
      toast(r.enrolled ? `Started ${t.name}` : `Left ${t.name}`, r.enrolled ? '✓' : '↩', r.enrolled ? 'lime' : 'slate');
      render();
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  // messages
  const convo = hit('data-convo');
  if (convo) {
    S.active.convo = convo.dataset.convo;
    S.active.threadOpen = true;
    try { await apiPost('/api/messages/read', { id: convo.dataset.convo }); } catch {}
    render();
    return;
  }
  if (hit('data-closethread')) { S.active.threadOpen = false; render(); return; }

  // profile
  if (hit('data-editprofile')) { modalEditProfile(); return; }
  const link = hit('data-link');
  if (link) { toast(`${link.dataset.link} link — demo profile, not a live URL`, '↗', 'indigo'); return; }

  if (hit('data-resetchecklist')) {
    const done = S.data.checklist.filter((k) => k.done);
    for (const k of done) await apiPost('/api/checklist/toggle', { id: k.id });
    render();
    toast('Checklist reset for a fresh day', '⟲', 'slate');
    return;
  }

  if (hit('data-reset')) {
    if (!confirm('Reset all UniteX data back to the original seeded dataset? Your posts, joins and messages will be discarded.')) return;
    try {
      await apiPost('/api/reset');
      S.query = ''; S.filters = {}; S.active = {};
      render();
      toast('All data reset to seed', '⟲', 'slate');
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }
});

/* forms: comments + composer */
document.addEventListener('submit', async (e) => {
  const cf = e.target.closest('[data-commentform]');
  if (cf) {
    e.preventDefault();
    const input = cf.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await apiPost('/api/posts/comment', { id: cf.dataset.commentform, text });
      render();
      toast('Comment added', '✦', 'teal');
    } catch (err) { toast(err.message, '!', 'amber'); }
    return;
  }

  if (e.target.id === 'composer') {
    e.preventDefault();
    const input = $('#msgInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await apiPost('/api/messages/send', { id: S.active.convo, text });
      render();
    } catch (err) { toast(err.message, '!', 'amber'); }
  }
});

/* live search inputs */
let searchTimer;
document.addEventListener('input', (e) => {
  if (e.target.id === 'globalSearch') {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => {
      S.query = v;
      if (currentRoute().id !== 'explore' && v) go('#/explore');
      else render();
    }, 220);
  }
  if (e.target.id === 'exploreInput') {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => {
      S.query = v;
      render();
      const el = $('#exploreInput');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 240);
  }
  if (e.target.id === 'msgSearch') {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => {
      S.filters.msgQuery = v;
      render();
      const el = $('#msgSearch');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 240);
  }
});

/* keyboard + chrome */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('on');
  }
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    e.preventDefault();
    $('#globalSearch').focus();
  }
});

window.addEventListener('hashchange', () => {
  render();
  $('#page').scrollIntoView({ block: 'start' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* --- start --- */
(async function start() {
  const bootEl = $('#boot');
  try {
    await boot();
  } catch (err) {
    $('#bootText').textContent = 'Could not reach the server. Retrying…';
    setTimeout(() => location.reload(), 2500);
    return;
  }

  $('#menuBtn').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#scrim').classList.toggle('on');
  });
  $('#scrim').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('on');
  });
  $('#msgBtn').addEventListener('click', () => go('#/messages'));
  $('#meBtn').addEventListener('click', () => go('#/profile'));
  $('#bellBtn').addEventListener('click', () => {
    const a = S.data.activity[0];
    toast(a ? a.text : 'Nothing new right now', '◔', 'indigo');
  });

  if (!location.hash) location.hash = '#/home';
  render();

  bootEl.classList.add('gone');
  setTimeout(() => bootEl.remove(), 500);
})();
