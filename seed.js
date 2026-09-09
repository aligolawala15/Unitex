'use strict';

// UniteX seed data. All collections are plain JSON so they can be persisted
// wholesale into the key/value table and hydrated back into memory.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = (ms) => new Date(now - ms).toISOString();

const users = require('./seed/users');
const posts = require('./seed/posts')(ago, MIN, HOUR, DAY);
const communities = require('./seed/communities');
const events = require('./seed/events');
const learning = require('./seed/learning');
const social = require('./seed/social')(ago, MIN, HOUR, DAY);

module.exports = {
  users,
  posts,
  communities,
  events,
  specializations: learning.specializations,
  courses: learning.courses,
  checklist: learning.checklist,
  roadmap: learning.roadmap,
  recommendations: learning.recommendations,
  achievements: social.achievements,
  conversations: social.conversations,
  activity: social.activity,
  trending: social.trending,
  profile: social.profile,
  connections: social.connections,
};
