#!/usr/bin/env node
/**
 * Wambugu Kamotho — AI Blog Post Generator
 *
 * Generates trade intelligence articles via Claude API and appends them to
 * blog/posts.json so the static website serves fresh content automatically.
 *
 * Usage:
 *   node scripts/generate-blog-post.js              # auto-selects topic
 *   node scripts/generate-blog-post.js "topic text" # override topic
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { buildBlog } from './build-blog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = join(__dirname, '..');
const POSTS_FILE = join(REPO_ROOT, 'blog', 'posts.json');

// ── Topic rotation pool ───────────────────────────────────────────────────────
const TOPIC_POOL = [
  'AfCFTA tariff liberalisation: what the phase-in schedule means for intra-African commodity traders',
  'DRC copper cathode export corridors and the EV battery supply chain demand outlook',
  'East Africa fertilizer import logistics: landed cost breakdown and pre-positioning strategy',
  'West Africa cocoa processing: why 80% of beans still leave as raw and what is changing',
  'Kenya Northern Corridor vs. Central Corridor: comparative freight cost and transit time analysis',
  'Nigeria crude oil sector: production recovery, Dangote refinery, and NLNG export volumes',
  'African gold export compliance: LBMA Good Delivery, OECD due diligence, and responsible sourcing',
  'Zambia copper cathode: Copperbelt investment outlook, power constraints, and Chinese offtake terms',
  'Port of Mombasa vs. Port of Dar es Salaam: capacity, congestion, and East Africa hinterland access',
  'PAPSS: Pan-African Payment and Settlement System and implications for cross-border trade settlement',
  'Africa agriculture EU market access: phytosanitary compliance, SPS measures, and EUDR obligations',
  'Tanzania critical minerals: lithium, graphite, and nickel in the battery materials supply chain',
  'South Africa as trade gateway: automotive export corridors, AGOA utilisation, and SADC logistics',
  'Ethiopian Yirgacheffe and Sidama coffee: specialty export models, farmgate certification, and direct trade',
  'AfDB trade finance facility and the African trade finance gap: what it funds and what remains unfunded',
  'Ghana Tema Port and West Africa container throughput: congestion trends and shipping line strategy',
  'Critical minerals geopolitics: Africa lithium and cobalt in the US-China supply chain competition',
  'Red Sea disruption and African trade routes: Suez Canal detours and impact on East-West freight rates',
  'Structured commodity finance in Africa: prepayment, warehouse receipts, and offtake security structures',
  'Zimbabwe platinum group metals: pgm export revenue, royalty regime, and Zimplats output recovery',
  'Rwanda and East African horticulture: cut flower export logistics, cold chain, and European market access',
  'Morocco phosphate and fertilizer exports: OCP Group strategy, African market penetration, and pricing',
  'Horn of Africa trade: Djibouti free zone, Somalia port rehabilitation, and Ethiopia landlocked corridor',
  'Sudan and South Sudan oilfield rehabilitation: crude oil export resumption and pipeline transit disputes',
  'Senegal and Guinea-Bissau cashew supply chain: world market position, processing investment, and quality standards',
  'Lobito Atlantic Corridor: DRC-Zambia copper export route, US and EU infrastructure investment, and timeline',
  'African trade insurance and political risk: ATIDI, MIGA, and commodity finance risk mitigation tools',
  'Nigeria non-oil exports: sesame, cashew, ginger, and horticulture — logistics, certification, and scale',
  'Egypt as Africa-EU trade bridge: Suez Canal Zone free trade, nearshoring investment, and logistics capacity',
  'AfCFTA Phase II negotiations: services protocol, investment chapter, and implications for trade finance',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadPosts() {
  if (!existsSync(POSTS_FILE)) {
    mkdirSync(join(REPO_ROOT, 'blog'), { recursive: true });
    return { posts: [] };
  }
  return JSON.parse(readFileSync(POSTS_FILE, 'utf8'));
}

function savePosts(data) {
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function makeId(title, date) {
  return createHash('md5').update(title + date).digest('hex').slice(0, 8);
}

function pickTopic(existingPosts) {
  // Avoid recently-used topics by checking keyword overlap with last 12 post titles
  const recentTitles = existingPosts.slice(0, 12).map(p => p.title.toLowerCase());

  const available = TOPIC_POOL.filter(topic => {
    const words = topic.toLowerCase().split(/\W+/).filter(w => w.length > 5);
    return !recentTitles.some(title =>
      words.some(word => title.includes(word))
    );
  });

  const pool = available.length > 0 ? available : TOPIC_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const data   = loadPosts();

  // Topic: CLI override or auto-selected
  const topicArg = process.argv[2] ? process.argv[2].trim() : null;
  const topic    = topicArg || pickTopic(data.posts);
  console.log(`\nTopic selected: "${topic}"\n`);

  const today = new Date().toISOString().split('T')[0];

  // Summary of already-published posts to guide the model away from overlap
  const publishedSummary = data.posts
    .slice(0, 15)
    .map(p => `- [${p.category}] ${p.title} (${p.date})`)
    .join('\n') || '(none yet)';

  // ── System prompt (cached — stable across runs) ──────────────────────────
  const systemPrompt = `You are the editorial intelligence for the Wambugu Kamotho trade intelligence blog. Wambugu Kamotho is a Pan-African import/export trade facilitation company headquartered in Nairobi, Kenya. We facilitate:
- Imports into Africa: crude oil, refined fuels, industrial machinery, fertilizers, agrochemicals, pharmaceuticals
- Exports from Africa: copper, gold, cobalt, coltan, lithium, cocoa, coffee, tea, grains, oilseeds, horticultural produce
- Services: trade mandate origination and verification, supply chain aggregation, AfCFTA compliance, customs clearance, multimodal logistics

TARGET READERS: Senior commodity traders, EXIM executives, logistics directors, trade finance professionals, and investors engaged with African markets.

WRITING STANDARDS:
- Authoritative and analytically rigorous — the quality of an FT Commodity Notes piece or African Business Magazine long-form
- Ground every claim in specific data: volumes, prices, timelines, policy citations (indicate year of data where it may be time-sensitive)
- Avoid trade-journalism clichés: "Africa rising", "untapped potential", "leapfrogging", "game-changer" — write with specificity
- Each article must leave the reader with concrete, actionable intelligence — a "so what" that informs a real trade decision
- No generic introductions; open with a data point, a contradiction, or a structural observation
- Paragraphs are tight: one idea per paragraph, max 4 sentences

OUTPUT FORMAT: Respond with ONLY valid JSON — no markdown fences, no preamble, no text after the closing brace.

{
  "title": "Specific, informative title (max 90 chars) — not a headline cliché",
  "category": "one of: Trade Policy | Commodities | Logistics | EXIM Finance | Supply Chain | Market Intelligence",
  "excerpt": "2–3 sentence compelling summary for blog card display, max 200 characters",
  "readTime": "N min read",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "content": "<html content — professional article of 700–950 words using h2, h3, p, ul/li, strong tags only. No inline styles or classes.>"
}

The content field must be valid HTML with:
- <h2> for main section headings (2–4 per article)
- <h3> for subsection headings where needed
- <p> for paragraphs
- <ul><li> for bullet lists
- <strong> for emphasis
- No <div>, no <span>, no inline styles, no class attributes`;

  // ── User message ─────────────────────────────────────────────────────────
  const userMessage = `Write a trade intelligence article for the Wambugu Kamotho insights blog.

TOPIC: ${topic}
PUBLISH DATE: ${today}

Recently published posts (avoid thematic duplication):
${publishedSummary}

Requirements:
1. Open with a specific data point or structural contradiction — no generic scene-setting
2. Include at least one section with concrete operational detail (cost figures, volumes, corridor names, policy references, or timeline milestones)
3. Close with practical implications for a commodity trader, logistics operator, or trade finance professional
4. Maintain consistent Wambugu Kamotho voice: authoritative, specific, commercially grounded

Return ONLY the JSON object as specified.`;

  console.log('Calling Claude API...');

  const response = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 2500,
    system: [
      {
        type:          'text',
        text:          systemPrompt,
        cache_control: { type: 'ephemeral' },  // prompt caching — saves tokens on repeated runs
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0]?.text?.trim() ?? '';

  // Parse JSON — handle models that wrap in markdown fences despite instructions
  let post;
  try {
    post = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('ERROR: Could not parse JSON from model response.');
      console.error('Raw response:', raw.slice(0, 400));
      process.exit(1);
    }
    post = JSON.parse(match[0]);
  }

  // Validate required fields
  const required = ['title', 'category', 'excerpt', 'content'];
  for (const field of required) {
    if (!post[field]) {
      console.error(`ERROR: Generated post is missing required field: "${field}"`);
      process.exit(1);
    }
  }

  const newPost = {
    id:       makeId(post.title, today),
    title:    post.title,
    slug:     slugify(post.title),
    date:     today,
    category: post.category,
    excerpt:  post.excerpt,
    readTime: post.readTime || '6 min read',
    tags:     Array.isArray(post.tags) ? post.tags : [],
    content:  post.content,
  };

  // Prepend (newest first)
  data.posts.unshift(newPost);
  savePosts(data);

  console.log('Post generated successfully:');
  console.log(`  Title    : ${newPost.title}`);
  console.log(`  Category : ${newPost.category}`);
  console.log(`  Date     : ${newPost.date}`);
  console.log(`  Slug     : ${newPost.slug}`);
  console.log(`  Tags     : ${newPost.tags.join(', ')}`);
  console.log(`  Read time: ${newPost.readTime}`);
  console.log(`\n  Saved to : blog/posts.json  (${data.posts.length} total posts)\n`);

  // Rebuild all static post pages and sitemap
  console.log('Building static blog pages...');
  await buildBlog();

  // Log token usage if available (useful for cost monitoring)
  if (response.usage) {
    const u = response.usage;
    console.log(`  Tokens   : input=${u.input_tokens}, output=${u.output_tokens}` +
      (u.cache_read_input_tokens  ? `, cache_read=${u.cache_read_input_tokens}`   : '') +
      (u.cache_creation_input_tokens ? `, cache_write=${u.cache_creation_input_tokens}` : ''));
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
