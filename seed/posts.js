'use strict';

// Main feed content. Each post carries author, community, tags, engagement
// metrics and a preview of recent comments (per the Home > Main Feed spec).
module.exports = (ago, MIN, HOUR, DAY) => [
  {
    id: 'p_1',
    authorId: 'u_priya',
    community: 'r/WebDevelopment',
    createdAt: ago(22 * MIN),
    title: 'I rebuilt my portfolio 4 times — here is the version that finally got replies',
    body:
      "Recruiters skimmed the first three. Version four gets a reply rate of about one in three. What changed: one hero project instead of nine, a 20-second loom walkthrough on each case study, and metrics instead of adjectives (\"cut bundle size 61%\" beats \"performant\"). Full write-up and the Next.js template are in the comments — take it, it's MIT.",
    tags: ['#WebDevelopment', '#Career', '#React'],
    points: 412,
    comments: [
      { author: 'Farhan Ali', initials: 'FA', text: 'The loom idea is genius. Stealing it tonight.', createdAt: ago(9 * MIN) },
      { author: 'Neha Iyer', initials: 'NI', text: 'Case study structure > visual polish. People underrate this.', createdAt: ago(15 * MIN) },
    ],
  },
  {
    id: 'p_2',
    authorId: 'u_arjun',
    community: 'r/MachineLearning',
    createdAt: ago(1 * HOUR + 40 * MIN),
    title: 'Attention, explained without a single summation symbol',
    body:
      'Every student I tutor hits the same wall on transformers, so here is the intuition I wish I had in semester one. Think of a sentence as a room of people. Each word asks the room a question (query), everyone answers with a badge describing themselves (key), and the asker listens loudest to whoever matches. That weighted listening is attention. The math is just bookkeeping on "how loudly." Full 12-page guide with diagrams linked below — free, no email wall.',
    tags: ['#MachineLearning', '#DeepLearning', '#StudyGuide'],
    points: 689,
    comments: [
      { author: 'Meera Nair', initials: 'MN', text: 'Best explanation on this platform. Sending to my whole team.', createdAt: ago(52 * MIN) },
      { author: 'Rahul Verma', initials: 'RV', text: 'The room analogy unlocked it for me. Thank you.', createdAt: ago(70 * MIN) },
    ],
  },
  {
    id: 'p_3',
    authorId: 'u_sana',
    community: 'r/CareerGuidance',
    createdAt: ago(3 * HOUR + 10 * MIN),
    title: 'What I actually look for when I interview a 3rd-year student',
    body:
      'I have run 200+ intern loops. The bar is lower than you fear and different than you think. I am not testing whether you memorised Dijkstra. I am testing: can you say "I do not know" and then reason forward anyway? Do you ask what the constraints are before writing code? When your solution breaks on an edge case, do you get defensive or curious? Every strong candidate I have hired failed part of their own interview and narrated it well.',
    tags: ['#Career', '#Interviews', '#Mentorship'],
    points: 934,
    comments: [
      { author: 'Priya Sharma', initials: 'PS', text: 'Pinning this above my desk before Monday.', createdAt: ago(2 * HOUR) },
      { author: 'Kabir Singh', initials: 'KS', text: 'The "narrate the failure" point is so underrated.', createdAt: ago(2 * HOUR + 30 * MIN) },
    ],
  },
  {
    id: 'p_4',
    authorId: 'u_neha',
    community: 'r/UIUXDesign',
    createdAt: ago(5 * HOUR),
    title: 'Free resource dump: 40 design systems worth reading end to end',
    body:
      'Spent the semester break reading public design systems instead of watching tutorials and learned more than any course gave me. Shopify Polaris for content guidelines, Atlassian for component API design, GOV.UK for accessibility discipline, Stripe for motion restraint. Notion table with all 40, tagged by what each one does best. Bookmark it, work through one per week.',
    tags: ['#UIUX', '#DesignSystems', '#Resources'],
    points: 356,
    comments: [
      { author: 'Ishita Bose', initials: 'IB', text: 'GOV.UK is a genuinely great read. Not a joke.', createdAt: ago(3 * HOUR) },
    ],
  },
  {
    id: 'p_5',
    authorId: 'u_rahul',
    community: 'r/WebDevelopment',
    createdAt: ago(8 * HOUR),
    title: 'Query: my Node API dies at ~200 concurrent users. Where do I even look?',
    body:
      'Express + Postgres, deployed on a small VPS. Fine in testing, falls over during our college fest registration. Response times climb to 12s then time out. I have no idea how to profile this properly — is it the connection pool, the event loop, or the box? Happy to share the repo. Genuinely stuck and would love a pointer rather than a full answer.',
    tags: ['#Node', '#Backend', '#HelpWanted'],
    points: 128,
    comments: [
      { author: 'Sana Qureshi', initials: 'SQ', text: 'Check pool size first — default is 10. Then look for a sync call in your hot path.', createdAt: ago(6 * HOUR) },
      { author: 'Dev Patel', initials: 'DP', text: 'Add clinic.js doctor to your start command, it will point straight at it.', createdAt: ago(7 * HOUR) },
    ],
  },
  {
    id: 'p_6',
    authorId: 'u_ananya',
    community: 'r/StartupFounders',
    createdAt: ago(12 * HOUR),
    title: 'We got 1,200 signups for a product that did not exist yet',
    body:
      'Story time. Our campus founders circle wanted to validate a notes-marketplace idea without building it. We made one landing page, put a fake "reserve your seat" button on it, and posted in exactly six WhatsApp groups. 1,200 signups in nine days. Then we emailed all of them asking what they would pay — median answer was zero. Best failure of my degree. Cost us a weekend instead of a semester.',
    tags: ['#Startups', '#Validation', '#Lessons'],
    points: 517,
    comments: [
      { author: 'Vikram Chauhan', initials: 'VC', text: 'Learning your idea is dead in 9 days is a win. Well run.', createdAt: ago(9 * HOUR) },
      { author: 'Arjun Mehta', initials: 'AM', text: 'The follow-up email is the part everyone skips.', createdAt: ago(10 * HOUR) },
    ],
  },
  {
    id: 'p_7',
    authorId: 'u_dev',
    community: 'r/OpenSource',
    createdAt: ago(1 * DAY + 2 * HOUR),
    title: 'Your first open source PR should be boring, and that is the point',
    body:
      'Everyone tries to fix a hard bug for their first contribution and burns out on the setup instructions. Do the opposite. Fix a typo in docs. Add a missing test. Improve an error message. My first merged PR changed one word. It taught me the fork flow, the CLA, the review culture and the CI pipeline — all the things that would have made a real fix impossible. 40 PRs later I still start every new repo with something boring.',
    tags: ['#OpenSource', '#Git', '#Beginners'],
    points: 743,
    comments: [
      { author: 'Farhan Ali', initials: 'FA', text: 'Opened my first PR after reading this. Merged in 3 hours!', createdAt: ago(20 * HOUR) },
    ],
  },
  {
    id: 'p_8',
    authorId: 'u_kabir',
    community: 'r/CyberSecurity',
    createdAt: ago(1 * DAY + 9 * HOUR),
    title: 'We found hardcoded API keys in 31 of 50 student projects on GitHub',
    body:
      'Ran a small audit for our security club, only on public repos, and reported privately to each owner. 31 out of 50 had live credentials in commit history — Firebase, Razorpay test keys, one production database URL. Note: deleting the file does not help, git keeps history. Rotate the key, then scrub with git-filter-repo. Add gitleaks as a pre-commit hook today and never think about it again.',
    tags: ['#CyberSecurity', '#Git', '#BestPractices'],
    points: 605,
    comments: [
      { author: 'Rahul Verma', initials: 'RV', text: 'Just checked mine. Found one. Rotating now. Thanks for the scare.', createdAt: ago(1 * DAY),
      },
      { author: 'Dev Patel', initials: 'DP', text: 'gitleaks in pre-commit is a 2-minute setup. Do it.', createdAt: ago(1 * DAY + 3 * HOUR) },
    ],
  },
  {
    id: 'p_9',
    authorId: 'u_meera',
    community: 'r/CareerGuidance',
    createdAt: ago(2 * DAY),
    title: 'The resume line that gets you an interview vs the one that gets skipped',
    body:
      'I screen a lot of student resumes. The difference is almost never talent. Skipped: "Worked on a machine learning project using Python." Interviewed: "Built a churn model on 40k rows; beat the baseline by 14pp; deployed it as a Flask endpoint the ops team used for 3 months." Same project, both true. One has a number, a comparison and a consequence. Rewrite your top three bullets tonight in that shape.',
    tags: ['#Career', '#Resume', '#DataScience'],
    points: 1104,
    comments: [
      { author: 'Ananya Rao', initials: 'AR', text: 'Number, comparison, consequence. That is the whole framework.', createdAt: ago(1 * DAY + 12 * HOUR) },
      { author: 'Priya Sharma', initials: 'PS', text: 'Rewrote mine. It is 40% shorter and reads 10x stronger.', createdAt: ago(1 * DAY + 18 * HOUR) },
    ],
  },
  {
    id: 'p_10',
    authorId: 'u_ishita',
    community: 'r/WebDevelopment',
    createdAt: ago(2 * DAY + 7 * HOUR),
    title: 'Study guide: CSS Grid in 9 rules I wish someone had just told me',
    body:
      'I avoided Grid for two years because every tutorial started with 30 properties. You need nine. display:grid, grid-template-columns with repeat/minmax, gap, grid-column spanning, place-items, grid-template-areas for layout sketching, auto-fit vs auto-fill, implicit rows, and dense packing. That is a full responsive layout with no media queries. Cheatsheet PDF in comments, one page, printable.',
    tags: ['#CSS', '#StudyGuide', '#WebDevelopment'],
    points: 488,
    comments: [
      { author: 'Neha Iyer', initials: 'NI', text: 'auto-fit + minmax is the single best trick in CSS.', createdAt: ago(2 * DAY + 2 * HOUR) },
    ],
  },
];
