#!/usr/bin/env node
/**
 * AfriTrade Gateway — Blog Static Builder
 *
 * Reads blog/posts.json and generates:
 *  - blog/[slug].html  for every post  (SEO-ready individual post pages)
 *  - sitemap.xml       updated with all post URLs
 *
 * Usage:
 *   node scripts/build-blog.js
 *
 * Run this after manually adding posts to blog/posts.json, or it is called
 * automatically by generate-blog-post.js after AI generation.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const POSTS_FILE = join(ROOT, 'blog', 'posts.json');
const SITEMAP    = join(ROOT, 'sitemap.xml');
const BASE_URL   = 'https://www.afritrade.africa';

// ── Shared nav & footer partials ─────────────────────────────────────────────
const NAV = `
<a href="#main-content" class="skip-link">Skip to main content</a>
<nav id="main-nav" role="navigation" aria-label="Main navigation">
  <a href="/" class="nav-logo">
    <div class="wordmark">AfriTrade Gateway</div>
    <div class="tagline">Your Bridge to African Markets</div>
  </a>
  <ul class="nav-links">
    <li><a href="/#about">About</a></li>
    <li><a href="/#services">Services</a></li>
    <li><a href="/#commodities">Commodities</a></li>
    <li><a href="/#mandate">Compliance</a></li>
    <li><a href="/#transport">Logistics</a></li>
    <li><a href="/#regions">Regions</a></li>
    <li><a href="/blog/">Insights</a></li>
  </ul>
  <a href="/#contact" class="nav-cta">Engage Us</a>
</nav>`;

const FOOTER = `
<footer>
  <div class="section-inner">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="wordmark">AfriTrade Gateway</div>
        <div class="sub">Your Bridge to African Markets</div>
        <p>Pan-African trade facilitation spanning imports, exports, mandate services, compliance, supply chain management, and multimodal logistics across 54 nations.</p>
      </div>
      <div class="footer-col">
        <h5>Services</h5>
        <ul>
          <li><a href="/#services">Import Facilitation</a></li>
          <li><a href="/#services">Export Management</a></li>
          <li><a href="/#services">Mandate Services</a></li>
          <li><a href="/#services">Supply Chain</a></li>
          <li><a href="/#mandate">Compliance &amp; Docs</a></li>
          <li><a href="/#mandate">Security Logistics</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Sectors</h5>
        <ul>
          <li><a href="/#commodities">Petroleum &amp; Energy</a></li>
          <li><a href="/#commodities">Minerals &amp; Metals</a></li>
          <li><a href="/#commodities">Agriculture</a></li>
          <li><a href="/#commodities">Machinery</a></li>
          <li><a href="/#commodities">Fertilizers</a></li>
          <li><a href="/#commodities">Technology</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Company</h5>
        <ul>
          <li><a href="/#about">About Us</a></li>
          <li><a href="/#about">Leadership</a></li>
          <li><a href="/#regions">Our Regions</a></li>
          <li><a href="/#transport">Logistics</a></li>
          <li><a href="/blog/">Trade Insights</a></li>
          <li><a href="/#contact">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; ${new Date().getFullYear()} AfriTrade Gateway. All rights reserved. Nairobi, Kenya &mdash; Pan-African Import &amp; Export Trade Facilitation.</p>
      <div class="footer-social">
        <a href="#">LinkedIn</a>
        <a href="#">WhatsApp</a>
        <a href="#">X / Twitter</a>
      </div>
    </div>
  </div>
</footer>`;

// ── HTML helpers ──────────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Post page template ────────────────────────────────────────────────────────
function buildPostPage(post, allPosts) {
  const postIndex = allPosts.findIndex(p => p.id === post.id);
  const prevPost  = allPosts[postIndex + 1] || null; // older
  const nextPost  = allPosts[postIndex - 1] || null; // newer

  const relatedPosts = allPosts
    .filter(p => p.id !== post.id && p.category === post.category)
    .slice(0, 4);

  const tags = (post.tags || []).map(t =>
    `<span class="sidebar-tag">${esc(t)}</span>`
  ).join('');

  const relatedLinks = relatedPosts.map(r => `
    <a href="./${esc(r.slug)}.html" class="related-post-link">
      <span class="rpl-cat">${esc(r.category)}</span>
      <span class="rpl-title">${esc(r.title)}</span>
    </a>`).join('');

  const prevLink = prevPost
    ? `<a href="./${esc(prevPost.slug)}.html" class="post-nav-item prev">
        <span class="post-nav-dir">&larr; Previous</span>
        <span class="post-nav-title">${esc(prevPost.title)}</span>
      </a>`
    : `<div></div>`;

  const nextLink = nextPost
    ? `<a href="./${esc(nextPost.slug)}.html" class="post-nav-item next">
        <span class="post-nav-dir">Next &rarr;</span>
        <span class="post-nav-title">${esc(nextPost.title)}</span>
      </a>`
    : `<div></div>`;

  const schemaDate = post.date; // ISO YYYY-MM-DD

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${esc(post.title)} | AfriTrade Gateway</title>
<meta name="description" content="${esc(post.excerpt)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${BASE_URL}/blog/${esc(post.slug)}.html">

<meta property="og:type" content="article">
<meta property="og:url" content="${BASE_URL}/blog/${esc(post.slug)}.html">
<meta property="og:title" content="${esc(post.title)}">
<meta property="og:description" content="${esc(post.excerpt)}">
<meta property="og:image" content="https://images.unsplash.com/photo-1692369584496-3216a88f94c1?q=80&w=1200&auto=format&fit=crop">
<meta property="og:site_name" content="AfriTrade Gateway">
<meta property="og:locale" content="en_KE">
<meta property="article:published_time" content="${schemaDate}T07:00:00+03:00">
<meta property="article:author" content="AfriTrade Gateway">
<meta property="article:section" content="${esc(post.category)}">
${(post.tags || []).map(t => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(post.title)}">
<meta name="twitter:description" content="${esc(post.excerpt)}">
<meta name="twitter:image" content="https://images.unsplash.com/photo-1692369584496-3216a88f94c1?q=80&w=1200&auto=format&fit=crop">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "${BASE_URL}/blog/${post.slug}.html",
  "headline": ${JSON.stringify(post.title)},
  "description": ${JSON.stringify(post.excerpt)},
  "datePublished": "${schemaDate}T07:00:00+03:00",
  "dateModified": "${schemaDate}T07:00:00+03:00",
  "author": {
    "@type": "Organization",
    "name": "AfriTrade Gateway",
    "url": "${BASE_URL}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "AfriTrade Gateway",
    "url": "${BASE_URL}",
    "logo": { "@type": "ImageObject", "url": "${BASE_URL}/favicon.svg" }
  },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "${BASE_URL}/blog/${post.slug}.html" },
  "keywords": ${JSON.stringify((post.tags || []).join(', '))},
  "articleSection": "${esc(post.category)}",
  "isPartOf": { "@type": "Blog", "@id": "${BASE_URL}/blog/#blog" }
}
</script>

<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0E0B06">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
</head>
<body>
${NAV}

<main id="main-content">

<section class="post-hero" aria-label="Article header">
  <div class="section-inner">
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb">
        <li><a href="/">Home</a></li>
        <li><span aria-hidden="true">&#8250;</span></li>
        <li><a href="/blog/">Insights</a></li>
        <li><span aria-hidden="true">&#8250;</span></li>
        <li><span class="current" aria-current="page">${esc(post.category)}</span></li>
      </ol>
    </nav>
    <div class="post-meta-row">
      <span class="post-cat-badge">${esc(post.category)}</span>
      <span class="post-date-label">${fmtDate(post.date)}</span>
      <span class="post-readtime-label">${esc(post.readTime || '6 min read')}</span>
    </div>
    <h1 class="post-h1">${esc(post.title)}</h1>
  </div>
</section>

<div class="post-body-wrap">
  <div class="section-inner">
    <div class="post-layout">
      <article class="post-article" aria-label="Article content">
        ${post.content}

        <div class="post-nav-strip" aria-label="Article navigation">
          ${prevLink}
          ${nextLink}
        </div>
      </article>

      <aside class="post-sidebar" aria-label="Article sidebar">
        ${tags ? `<div class="sidebar-card">
          <h4>Topics</h4>
          <div class="sidebar-tags">${tags}</div>
        </div>` : ''}

        ${relatedLinks ? `<div class="sidebar-card">
          <h4>Related Insights</h4>
          ${relatedLinks}
        </div>` : ''}

        <div class="sidebar-card">
          <h4>About AfriTrade</h4>
          <p style="font-size:0.84rem;line-height:1.65;color:var(--cream-dim)">
            AfriTrade Gateway is a Pan-African import/export trade facilitation company headquartered in Nairobi, Kenya. We operate across all 54 African nations.
          </p>
          <a href="/#contact" class="btn-primary" style="margin-top:1.2rem;font-size:0.72rem">Engage Us &rarr;</a>
        </div>
      </aside>
    </div>
  </div>
</div>

<section class="post-cta-band" aria-label="Contact call to action">
  <div class="section-inner">
    <div class="section-eyebrow" style="justify-content:center">Get In Touch</div>
    <h2 class="section-title">Ready to Trade<br><em>Across Africa?</em></h2>
    <p>Whether you are importing, exporting, or seeking a mandate partner &mdash; our team structures the path forward.</p>
    <a href="/#contact" class="btn-primary">Start a Conversation</a>
  </div>
</section>

</main><!-- /main-content -->
${FOOTER}

<script>
(function() {
  var nav = document.getElementById('main-nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      nav.style.padding = window.scrollY > 60 ? '0.85rem 4rem' : '1.4rem 4rem';
    }, { passive: true });
  }
})();
</script>
</body>
</html>`;
}

// ── Sitemap builder ───────────────────────────────────────────────────────────
function buildSitemap(posts) {
  const today = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${BASE_URL}/`,                   priority: '1.0',  changefreq: 'weekly'  },
    { loc: `${BASE_URL}/#about`,             priority: '0.75', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#services`,          priority: '0.85', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#commodities`,       priority: '0.8',  changefreq: 'monthly' },
    { loc: `${BASE_URL}/#mandate`,           priority: '0.75', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#transport`,         priority: '0.75', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#regions`,           priority: '0.75', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#contact`,           priority: '0.8',  changefreq: 'monthly' },
    { loc: `${BASE_URL}/blog/`,              priority: '0.9',  changefreq: 'weekly'  },
  ];

  const postUrls = posts.map(p => ({
    loc: `${BASE_URL}/blog/${p.slug}.html`,
    lastmod: p.date,
    priority: '0.75',
    changefreq: 'monthly',
  }));

  const allUrls = [...staticUrls, ...postUrls];

  const entries = allUrls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : `<lastmod>${today}</lastmod>`}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries}
</urlset>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function buildBlog() {
  if (!existsSync(POSTS_FILE)) {
    console.log('No posts.json found — nothing to build.');
    return;
  }

  const data  = JSON.parse(readFileSync(POSTS_FILE, 'utf8'));
  const posts = (data.posts || []).sort((a, b) => b.date.localeCompare(a.date));

  if (posts.length === 0) {
    console.log('No posts found in posts.json — nothing to build.');
    return;
  }

  let built = 0;

  for (const post of posts) {
    if (!post.slug || !post.content) {
      console.warn(`  Skipping post "${post.title}" — missing slug or content.`);
      continue;
    }
    const outPath = join(ROOT, 'blog', `${post.slug}.html`);
    const html    = buildPostPage(post, posts);
    writeFileSync(outPath, html, 'utf8');
    built++;
  }

  // Update sitemap
  const sitemap = buildSitemap(posts);
  writeFileSync(SITEMAP, sitemap, 'utf8');

  console.log(`Blog build complete:`);
  console.log(`  Post pages : ${built} generated in blog/`);
  console.log(`  Sitemap    : sitemap.xml updated (${posts.length} post URLs + static pages)`);
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildBlog().catch(err => { console.error('Build failed:', err.message); process.exit(1); });
}
