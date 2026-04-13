// TAB SWITCHING — passes event explicitly, no implicit global
function switchTab(evt, id) {
  var btns = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-content');
  btns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
  panels.forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('tab-' + id).classList.add('active');
  evt.currentTarget.classList.add('active');
  evt.currentTarget.setAttribute('aria-selected','true');
}

// SCROLL FADE-IN
var fadeEls = document.querySelectorAll('.fade-up');
if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.07 });
  fadeEls.forEach(function(el) { io.observe(el); });
} else {
  // fallback: show everything
  fadeEls.forEach(function(el) { el.classList.add('visible'); });
}

// STAGGER children inside grids
document.querySelectorAll('.region-grid, .transport-modes, .about-right').forEach(function(parent) {
  parent.querySelectorAll('.fade-up').forEach(function(child, i) {
    child.style.transitionDelay = (i * 85) + 'ms';
  });
});

// NAV SHRINK
var nav = document.getElementById('main-nav');
window.addEventListener('scroll', function() {
  nav.style.padding = window.scrollY > 60 ? '0.85rem 4rem' : '1.4rem 4rem';
}, { passive: true });

// ── BLOG TEASER: Latest 3 posts on homepage — cards link to individual post pages ──
(function() {
  var grid = document.getElementById('blog-grid');
  if (!grid) return; // only run on pages that have the blog grid

  // Detect if we're on the homepage (root) or a sub-page to resolve the posts.json path
  var isRoot = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
  var postsUrl = isRoot ? '/blog/posts.json' : '../blog/posts.json';
  var postBase = isRoot ? '/blog/' : './';

  function fmtDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function makeCard(post, delay) {
    var a = document.createElement('a');
    a.className = 'blog-card fade-up';
    a.href = postBase + post.slug + '.html';
    a.style.transitionDelay = delay + 'ms';
    a.innerHTML =
      '<div class="blog-card-meta">' +
        '<span class="blog-category">' + esc(post.category) + '</span>' +
        '<span class="blog-date">' + fmtDate(post.date) + '</span>' +
      '</div>' +
      '<div class="blog-card-body">' +
        '<h3 class="blog-title">' + esc(post.title) + '</h3>' +
        '<p class="blog-excerpt">' + esc(post.excerpt) + '</p>' +
        '<div class="blog-card-footer">' +
          '<span class="blog-readtime">' + esc(post.readTime || '6 min read') + '</span>' +
          '<span class="blog-read-link">Read Article &#x2192;</span>' +
        '</div>' +
      '</div>';
    return a;
  }

  // Homepage teaser: latest 3 only. blog/index.html handles full pagination.
  var TEASER_COUNT = 3;

  fetch(postsUrl)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      var posts = (data.posts || []).sort(function(a, b) { return b.date.localeCompare(a.date); });
      grid.innerHTML = '';
      if (posts.length === 0) {
        grid.innerHTML = '<div class="blog-loading">No insights published yet &mdash; check back soon.</div>';
        return;
      }
      var show = posts.slice(0, TEASER_COUNT);
      show.forEach(function(post, i) {
        var card = makeCard(post, i * 80);
        grid.appendChild(card);
        (function(c){ setTimeout(function(){ c.classList.add('visible'); }, 60 + i * 80); })(card);
      });
    })
    .catch(function() {
      grid.innerHTML = '<div class="blog-loading">Insights temporarily unavailable. Please check back shortly.</div>';
    });
})();


// ── LAZY BACKGROUND IMAGE LOADER ──
(function() {
  var lazyBgs = [
    { sel: '.about-top',       url: 'https://images.unsplash.com/photo-1605732563938-8f8d4e7ad651?q=80&w=1920&auto=format&fit=crop' },
    { sel: '.leadership-band', url: 'https://images.unsplash.com/photo-1535379453347-1ffd615e2e08?q=80&w=1920&auto=format&fit=crop' },
    { sel: '#services',        url: 'https://images.unsplash.com/photo-1692369584496-3216a88f94c1?q=80&w=1920&auto=format&fit=crop' },
    { sel: '#commodities',     url: 'https://images.unsplash.com/photo-1523660778745-247ed0bcce31?q=80&w=1920&auto=format&fit=crop' },
    { sel: '#mandate',         url: 'https://images.unsplash.com/photo-1764344487357-0a4f9b4cb512?q=80&w=1920&auto=format&fit=crop' },
    { sel: '#transport',       url: 'https://images.unsplash.com/photo-1769752803898-e7e9a843a120?q=80&w=1920&auto=format&fit=crop' },
    { sel: '#regions',         url: 'https://images.unsplash.com/photo-1752219346775-fe086c57081b?q=80&w=1920&auto=format&fit=crop' },
    { sel: '#contact',         url: 'https://images.unsplash.com/photo-1605256585681-455837661b18?q=80&w=1920&auto=format&fit=crop' },
    { sel: 'footer',           url: 'https://images.unsplash.com/photo-1627920769541-daa658ed6b59?q=80&w=1920&auto=format&fit=crop' }
  ];

  if (!('IntersectionObserver' in window)) return; // fallback: CSS handles it normally

  var imgObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var url = el.getAttribute('data-bg');
        if (url) {
          var img = new Image();
          img.onload = function() {
            // Inject as inline style override
            var existing = el.style.backgroundImage || '';
            // Replace none or append
            el.style.backgroundImage = existing.replace('none', 'url("' + url + '")') ||
              el.style.cssText.replace('background-image: none', 'background-image: url("' + url + '")');
            // Simpler: just set the CSS var
            el.style.setProperty('--loaded-bg', 'url("' + url + '")');
            el.classList.add('bg-img-loaded');
          };
          img.src = url;
        }
        imgObserver.unobserve(el);
      }
    });
  }, { rootMargin: '200px 0px' });

  lazyBgs.forEach(function(item) {
    var el = document.querySelector(item.sel);
    if (el) {
      el.setAttribute('data-bg', item.url);
      imgObserver.observe(el);
    }
  });
})();

