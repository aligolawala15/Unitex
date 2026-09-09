'use strict';

/**
 * API surface for UniteX. Every mutation goes through the store so it is
 * persisted server-side; reads assemble a single bootstrap payload plus a
 * few narrower endpoints.
 */

const crypto = require('crypto');

const id = (prefix) => `${prefix}_${crypto.randomBytes(5).toString('hex')}`;

function userMap(state) {
  const map = {};
  for (const u of state.users) map[u.id] = u;
  return map;
}

// Shape posts for the client: resolve author, apply liked/points overlay.
function hydratePosts(state) {
  const users = userMap(state);
  const liked = new Set(state.likedPosts || []);
  return [...state.posts]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((p) => {
      const author = p.authorId ? users[p.authorId] : null;
      return {
        ...p,
        liked: liked.has(p.id),
        commentCount: (p.comments || []).length,
        author: author
          ? {
              id: author.id,
              name: author.name,
              initials: author.initials,
              accent: author.accent,
              institution: author.institution,
              year: author.year,
            }
          : {
              id: 'me',
              name: state.profile.name,
              initials: state.profile.initials,
              accent: 'coral',
              institution: state.profile.institution,
              year: state.profile.year,
            },
      };
    });
}

function totals(state) {
  const earned = state.achievements.filter((a) => a.progress >= 100);
  return {
    points: earned.reduce((sum, a) => sum + a.points, 0),
    earnedCount: earned.length,
    totalCount: state.achievements.length,
    checklistPoints: state.checklist.filter((k) => k.done).reduce((s, k) => s + k.points, 0),
    checklistTotal: state.checklist.reduce((s, k) => s + k.points, 0),
  };
}

function snapshot(state) {
  return {
    profile: state.profile,
    posts: hydratePosts(state),
    users: state.users,
    communities: state.communities.map((c) => ({
      ...c,
      joined: (state.joinedCommunities || []).includes(c.id),
    })),
    events: state.events.map((e) => ({
      ...e,
      going: (state.rsvpEvents || []).includes(e.id),
    })),
    specializations: state.specializations.map((s) => ({
      ...s,
      enrolled: (state.enrolledTracks || []).includes(s.id),
    })),
    courses: state.courses.map((c) => ({
      ...c,
      enrolled: (state.enrolledCourses || []).includes(c.id),
    })),
    checklist: state.checklist,
    roadmap: state.roadmap,
    recommendations: state.recommendations,
    achievements: state.achievements,
    conversations: state.conversations,
    activity: state.activity,
    trending: state.trending,
    connections: state.connections,
    connectedUsers: state.connectedUsers || [],
    totals: totals(state),
  };
}

// --- mutations -------------------------------------------------------------

const routes = {
  async 'POST /api/posts'({ state, body }) {
    const title = String(body.title || '').trim();
    if (!title) throw Object.assign(new Error('A title is required'), { status: 400 });
    const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(/[,\s]+/))
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .slice(0, 5);

    const post = {
      id: id('p'),
      authorId: null, // null => authored by the current profile
      community: body.community || 'r/WebDevelopment',
      createdAt: new Date().toISOString(),
      title: title.slice(0, 180),
      body: String(body.body || '').slice(0, 4000),
      tags: tags.length ? tags : ['#UniteX'],
      points: 1,
      comments: [],
    };
    state.posts.unshift(post);

    // First Post achievement.
    const first = state.achievements.find((a) => a.id === 'a_first');
    if (first && first.progress < 100) first.progress = 100;

    state.activity.unshift({
      text: `${state.profile.name} posted in ${post.community}`,
      at: post.createdAt,
      accent: 'coral',
    });
    state.activity = state.activity.slice(0, 14);
    return { created: post.id, log: ['post_create', post.title] };
  },

  async 'POST /api/posts/like'({ state, body }) {
    const post = state.posts.find((p) => p.id === body.id);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    state.likedPosts = state.likedPosts || [];
    const idx = state.likedPosts.indexOf(post.id);
    if (idx === -1) {
      state.likedPosts.push(post.id);
      post.points += 1;
    } else {
      state.likedPosts.splice(idx, 1);
      post.points = Math.max(0, post.points - 1);
    }
    return { points: post.points, liked: idx === -1, log: ['post_like', post.id] };
  },

  async 'POST /api/posts/comment'({ state, body }) {
    const post = state.posts.find((p) => p.id === body.id);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    const text = String(body.text || '').trim();
    if (!text) throw Object.assign(new Error('Comment cannot be empty'), { status: 400 });
    post.comments = post.comments || [];
    post.comments.unshift({
      author: state.profile.name,
      initials: state.profile.initials,
      text: text.slice(0, 600),
      createdAt: new Date().toISOString(),
      mine: true,
    });
    return { count: post.comments.length, log: ['post_comment', post.id] };
  },

  async 'POST /api/communities/join'({ state, body }) {
    const community = state.communities.find((c) => c.id === body.id);
    if (!community) throw Object.assign(new Error('Community not found'), { status: 404 });
    state.joinedCommunities = state.joinedCommunities || [];
    const idx = state.joinedCommunities.indexOf(community.id);
    let joined;
    if (idx === -1) {
      state.joinedCommunities.push(community.id);
      community.members += 1;
      joined = true;
      state.activity.unshift({
        text: `${state.profile.name} joined ${community.name}`,
        at: new Date().toISOString(),
        accent: community.accent,
      });
      state.activity = state.activity.slice(0, 14);
    } else {
      state.joinedCommunities.splice(idx, 1);
      community.members = Math.max(0, community.members - 1);
      joined = false;
    }

    // Community Builder achievement tracks joined count against a goal of 5.
    const badge = state.achievements.find((a) => a.id === 'a_builder');
    if (badge) badge.progress = Math.min(100, Math.round((state.joinedCommunities.length / 5) * 100));
    state.profile.stats.communities = state.joinedCommunities.length;

    return {
      joined,
      members: community.members,
      communities: state.joinedCommunities.length,
      totals: totals(state),
      badge: badge ? badge.progress : null,
      log: ['community_join', community.name],
    };
  },

  async 'POST /api/events/rsvp'({ state, body }) {
    const event = state.events.find((e) => e.id === body.id);
    if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
    state.rsvpEvents = state.rsvpEvents || [];
    const idx = state.rsvpEvents.indexOf(event.id);
    let going;
    if (idx === -1) {
      if (event.attendees >= event.capacity) {
        throw Object.assign(new Error('This event is full'), { status: 409 });
      }
      state.rsvpEvents.push(event.id);
      event.attendees += 1;
      going = true;
    } else {
      state.rsvpEvents.splice(idx, 1);
      event.attendees = Math.max(0, event.attendees - 1);
      going = false;
    }
    return { going, attendees: event.attendees, log: ['event_rsvp', event.title] };
  },

  async 'POST /api/events'({ state, body }) {
    const title = String(body.title || '').trim();
    if (!title) throw Object.assign(new Error('An event title is required'), { status: 400 });
    const event = {
      id: id('e'),
      title: title.slice(0, 140),
      type: body.type || 'Workshop',
      host: body.host || 'r/WebDevelopment',
      hostedBy: state.profile.name,
      date: body.date ? new Date(body.date).toISOString() : new Date(Date.now() + 7 * 864e5).toISOString(),
      duration: body.duration || '2h',
      mode: body.mode || 'Online',
      location: body.location || 'Online · link on RSVP',
      attendees: 1,
      capacity: Number(body.capacity) || 100,
      accent: 'lime',
      blurb: String(body.blurb || 'Details coming soon.').slice(0, 400),
      agenda: [],
      mine: true,
    };
    state.events.push(event);
    state.rsvpEvents = state.rsvpEvents || [];
    state.rsvpEvents.push(event.id);

    const badge = state.achievements.find((a) => a.id === 'a_organizer');
    if (badge && badge.progress < 100) badge.progress = 100;

    state.activity.unshift({
      text: `${state.profile.name} created the event "${event.title}"`,
      at: new Date().toISOString(),
      accent: 'lime',
    });
    state.activity = state.activity.slice(0, 14);
    return { created: event.id, totals: totals(state), log: ['event_create', event.title] };
  },

  async 'POST /api/connections/toggle'({ state, body }) {
    const user = state.users.find((u) => u.id === body.id);
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
    state.connectedUsers = state.connectedUsers || [];
    const idx = state.connectedUsers.indexOf(user.id);
    let connected;
    if (idx === -1) {
      state.connectedUsers.push(user.id);
      connected = true;
    } else {
      state.connectedUsers.splice(idx, 1);
      connected = false;
    }
    // Networking Pro tracks toward 100 connections; base of 122 existing.
    const base = 122;
    const count = base + state.connectedUsers.length;
    state.profile.stats.connections = count;
    const badge = state.achievements.find((a) => a.id === 'a_network');
    if (badge) badge.progress = Math.min(100, Math.round(((count - 100) / 100) * 100) || 25);
    return { connected, connections: count, log: ['connection_toggle', user.name] };
  },

  async 'POST /api/checklist/toggle'({ state, body }) {
    const item = state.checklist.find((k) => k.id === body.id);
    if (!item) throw Object.assign(new Error('Task not found'), { status: 404 });
    item.done = !item.done;
    return { done: item.done, totals: totals(state), log: ['checklist_toggle', item.label] };
  },

  async 'POST /api/courses/enroll'({ state, body }) {
    const course = state.courses.find((c) => c.id === body.id);
    if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });
    state.enrolledCourses = state.enrolledCourses || [];
    const idx = state.enrolledCourses.indexOf(course.id);
    let enrolled;
    if (idx === -1) {
      state.enrolledCourses.push(course.id);
      course.students += 1;
      enrolled = true;
    } else {
      state.enrolledCourses.splice(idx, 1);
      course.students = Math.max(0, course.students - 1);
      enrolled = false;
    }
    return { enrolled, students: course.students, log: ['course_enroll', course.name] };
  },

  async 'POST /api/tracks/enroll'({ state, body }) {
    const track = state.specializations.find((s) => s.id === body.id);
    if (!track) throw Object.assign(new Error('Track not found'), { status: 404 });
    state.enrolledTracks = state.enrolledTracks || [];
    const idx = state.enrolledTracks.indexOf(track.id);
    let enrolled;
    if (idx === -1) {
      state.enrolledTracks.push(track.id);
      track.students += 1;
      enrolled = true;
    } else {
      state.enrolledTracks.splice(idx, 1);
      track.students = Math.max(0, track.students - 1);
      enrolled = false;
    }
    return { enrolled, students: track.students, log: ['track_enroll', track.name] };
  },

  async 'POST /api/messages/send'({ state, body }) {
    const convo = state.conversations.find((c) => c.id === body.id);
    if (!convo) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    const text = String(body.text || '').trim();
    if (!text) throw Object.assign(new Error('Message cannot be empty'), { status: 400 });
    convo.messages.push({ from: 'me', text: text.slice(0, 2000), at: new Date().toISOString() });
    convo.unread = 0;
    return { count: convo.messages.length, log: ['message_send', convo.name] };
  },

  async 'POST /api/messages/read'({ state, body }) {
    const convo = state.conversations.find((c) => c.id === body.id);
    if (!convo) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    convo.unread = 0;
    return { ok: true };
  },

  async 'POST /api/profile'({ state, body }) {
    if (typeof body.name === 'string' && body.name.trim()) {
      state.profile.name = body.name.trim().slice(0, 60);
    }
    if (typeof body.bio === 'string') {
      state.profile.bio = body.bio.trim().slice(0, 600);
    }
    if (Array.isArray(body.interests)) {
      state.profile.interests = body.interests.map((i) => String(i).trim()).filter(Boolean).slice(0, 10);
    }
    if (Array.isArray(body.links)) {
      body.links.forEach((incoming) => {
        const link = state.profile.links.find((l) => l.label === incoming.label);
        if (link && typeof incoming.handle === 'string') {
          link.handle = incoming.handle.trim().slice(0, 80);
        }
      });
    }
    return { profile: state.profile, log: ['profile_update', state.profile.name] };
  },

  async 'POST /api/reset'({ store }) {
    const { freshState } = require('./store');
    const next = freshState();
    await store.write(next);
    return { reset: true, __state: next, log: ['reset', 'state restored to seed'] };
  },
};

async function handle({ store, method, url, body }) {
  const clean = url.split('?')[0].replace(/\/+$/, '') || '/api';
  const key = `${method} ${clean}`;

  if (key === 'GET /api/bootstrap') {
    const state = await store.read();
    return { status: 200, body: { ok: true, mode: store.mode, data: snapshot(state) } };
  }

  if (key === 'GET /api/log') {
    const rows = await store.recentLog(15);
    return { status: 200, body: { ok: true, rows } };
  }

  const route = routes[key];
  if (!route) return { status: 404, body: { error: `No route for ${key}` } };

  const state = await store.read();
  try {
    const result = await route({ state, body, store });
    const logEntry = result.log;
    delete result.log;
    const nextState = result.__state || state;
    delete result.__state;
    await store.write(nextState);
    if (logEntry) await store.log(logEntry[0], logEntry[1]);
    return { status: 200, body: { ok: true, ...result, data: snapshot(nextState) } };
  } catch (err) {
    return { status: err.status || 500, body: { error: err.message } };
  }
}

module.exports = { handle, snapshot };
