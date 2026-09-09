'use strict';

/**
 * Persistence for UniteX.
 *
 * The whole app state is a single JSON document. On boot we hydrate it from
 * the database (or seed it if empty); every mutation writes the document back.
 * That keeps one read path for the API while still giving real server-side
 * persistence that survives cold starts and re-deploys.
 *
 * If DATABASE_URL is absent (sandbox preview) we fall back to a memory-only
 * store so the UI can be exercised end to end before publishing.
 */

const seed = require('./seed');

const STATE_KEY = 'unitex_state_v1';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freshState() {
  const state = deepClone(seed);
  state.meta = { version: 1, createdAt: new Date().toISOString() };
  // Derived / mutable user-facing collections.
  state.joinedCommunities = state.communities.filter((c) => c.joined).map((c) => c.id);
  state.rsvpEvents = state.events.filter((e) => e.going).map((e) => e.id);
  state.connectedUsers = ['u_priya', 'u_neha', 'u_rahul', 'u_dev', 'u_farhan', 'u_ishita'];
  state.likedPosts = [];
  state.enrolledCourses = state.courses.filter((c) => c.enrolled).map((c) => c.id);
  state.enrolledTracks = state.specializations.filter((s) => s.enrolled).map((s) => s.id);
  return state;
}

class MemoryStore {
  constructor() {
    this.state = freshState();
    this.mode = 'memory';
  }
  async init() {
    return this;
  }
  async read() {
    return this.state;
  }
  async write(state) {
    this.state = state;
  }
}

class SqlStore {
  constructor(url) {
    this.url = url;
    this.mode = 'database';
    this.cache = null;
  }

  async init() {
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool(this.url);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        state_key VARCHAR(64) PRIMARY KEY,
        payload LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Append-only audit log so activity is genuinely server-side.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS events_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        kind VARCHAR(48) NOT NULL,
        detail VARCHAR(512),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await this.pool.query('SELECT payload FROM app_state WHERE state_key = ?', [STATE_KEY]);
    if (rows.length) {
      try {
        this.cache = JSON.parse(rows[0].payload);
      } catch (err) {
        console.error('[store] corrupt payload, reseeding');
        this.cache = freshState();
        await this.write(this.cache);
      }
    } else {
      this.cache = freshState();
      await this.write(this.cache);
      await this.log('seed', 'initial dataset created');
    }
    return this;
  }

  async read() {
    return this.cache;
  }

  async write(state) {
    this.cache = state;
    const payload = JSON.stringify(state);
    await this.pool.query(
      'INSERT INTO app_state (state_key, payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)',
      [STATE_KEY, payload]
    );
  }

  async log(kind, detail) {
    try {
      await this.pool.query('INSERT INTO events_log (kind, detail) VALUES (?, ?)', [kind, String(detail).slice(0, 500)]);
    } catch (err) {
      console.error('[store] log failed:', err.message);
    }
  }

  async recentLog(limit = 12) {
    try {
      const [rows] = await this.pool.query(
        'SELECT kind, detail, created_at FROM events_log ORDER BY id DESC LIMIT ?',
        [limit]
      );
      return rows;
    } catch (err) {
      return [];
    }
  }
}

async function createStore() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[store] DATABASE_URL not set — using in-memory store (preview mode)');
    const store = new MemoryStore();
    store.log = async () => {};
    store.recentLog = async () => [];
    return store.init();
  }
  const store = new SqlStore(url);
  return store.init();
}

module.exports = { createStore, freshState };
