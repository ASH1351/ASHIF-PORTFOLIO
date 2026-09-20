import Lenis from 'lenis';

// ================= CONSTANTS & STATE =================
const TOTAL_FRAMES = 300;
const FRAME_PATH = (idx) => `/frames/ezgif-frame-${String(idx + 1).padStart(3, '0')}.jpg`;

const frames = new Array(TOTAL_FRAMES);
let loadedFramesCount = 0;
let isLoaded = false;
let targetFrame = 0;
let currentFrame = 0;
let lastRenderedFrame = -1;

// Hero DOM Elements
const heroCanvas = document.getElementById('hero-canvas');
const heroCtx = heroCanvas.getContext('2d', { alpha: false });
const heroTrack = document.getElementById('hero-track');
const heroOpeningTitle = document.getElementById('hero-opening-title');
const preloader = document.getElementById('preloader');
const loaderPercent = document.getElementById('loader-percent');
const loaderBar = document.getElementById('loader-bar');

// Universe DOM Elements
const universeSection = document.getElementById('universe-section');
const universeFloor = document.getElementById('universe-floor');
const universeCharWrap = document.getElementById('universe-character-wrap');
const universeHeader = document.getElementById('universe-header');
const universeCards = document.querySelectorAll('.universe-card');
const mobileCards = document.querySelectorAll('.mobile-card');
const particlesCanvas = document.getElementById('universe-particles');
const particlesCtx = particlesCanvas ? particlesCanvas.getContext('2d') : null;
const trailPath = document.getElementById('trail-path');
const trailHead = document.getElementById('trail-head');

let isUniverseVisible = false;
let universeProgress = 0;
let smoothUniverseProgress = 0;

// Pointer Parallax State
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

// Card Geometry & Floating State
const cardStates = Array.from(universeCards).map((card, i) => {
  return {
    el: card,
    wing: card.dataset.wing || (i < 5 ? 'left' : 'right'),
    depth: i === 0 || i === 5 ? 1.25 : (i === 1 || i === 7 ? 0.95 : (i === 3 || i === 6 ? 0.8 : 1.1)),
    phase: i * 0.85 + Math.PI * 0.3,
    speed: 0.7 + (i % 3) * 0.25,
    baseX: 0,
    baseY: 0,
  };
});

// Particles (Restrained Crimson Embers)
const PARTICLE_COUNT = 38;
const particles = [];
function initParticles() {
  particles.length = 0;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.8 + Math.random() * 2.2,
      vy: 0.3 + Math.random() * 0.65,
      vx: (Math.random() - 0.5) * 0.4,
      alpha: 0.15 + Math.random() * 0.65,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

// Light Trail History
const TRAIL_POINTS = 35;
const trailHistory = [];

// ================= LENIS SMOOTH MOMENTUM SCROLL =================
const lenis = new Lenis({
  duration: 0.9,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1.0,
  touchMultiplier: 1.5,
});

function updateHeroTitle(heroProgress) {
  // Direct dynamic video scrubbing: Starts immediately as the user scrolls
  targetFrame = Math.max(0, Math.min(TOTAL_FRAMES - 1, heroProgress * (TOTAL_FRAMES - 1)));

  if (!heroOpeningTitle) return;

  // Title fades out smoothly in the first 8-10% of scroll while video begins moving
  const FADE_THRESHOLD = 0.09;
  if (heroProgress <= FADE_THRESHOLD) {
    const fadeRatio = heroProgress / FADE_THRESHOLD;
    const opacity = Math.max(0, 1 - fadeRatio);
    heroOpeningTitle.style.opacity = opacity.toFixed(3);
    heroOpeningTitle.style.transform = `translate3d(0, ${(-fadeRatio * 32).toFixed(1)}px, 0) scale(${(1 - fadeRatio * 0.03).toFixed(3)})`;
    heroOpeningTitle.style.visibility = opacity > 0 ? 'visible' : 'hidden';
  } else {
    heroOpeningTitle.style.opacity = '0';
    heroOpeningTitle.style.visibility = 'hidden';
  }
}

function handleScrollProgress() {
  // 1. Update Hero Track Progress
  if (heroTrack) {
    const heroRect = heroTrack.getBoundingClientRect();
    const heroMaxScroll = heroTrack.offsetHeight - window.innerHeight;
    if (heroMaxScroll > 0) {
      const heroScrolled = -heroRect.top;
      const heroProgress = Math.max(0, Math.min(1, heroScrolled / heroMaxScroll));
      updateHeroTitle(heroProgress);
    }
  }

  // 2. Update Universe Section Progress
  if (universeSection) {
    const uRect = universeSection.getBoundingClientRect();
    const uMaxScroll = universeSection.offsetHeight - window.innerHeight;
    if (uMaxScroll > 0) {
      const uScrolled = -uRect.top;
      universeProgress = Math.max(0, Math.min(1, uScrolled / uMaxScroll));
      isUniverseVisible = uRect.top < window.innerHeight && uRect.bottom > 0;
    }
  }
}

lenis.on('scroll', handleScrollProgress);
window.addEventListener('scroll', handleScrollProgress, { passive: true });

// ================= HIGH-PERFORMANCE HERO CANVAS =================
function resizeCanvases() {
  // Hero canvas
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  heroCanvas.width = Math.round(window.innerWidth * dpr);
  heroCanvas.height = Math.round(window.innerHeight * dpr);
  heroCtx.imageSmoothingEnabled = true;
  heroCtx.imageSmoothingQuality = 'high';

  const frameIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));
  drawHeroFrame(frameIdx);

  // Universe particles canvas
  if (particlesCanvas) {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
    initParticles();
  }
}

function drawHeroFrame(frameIndex) {
  let img = frames[frameIndex];
  if (!img) {
    // If target frame is still decoding, find nearest loaded frame
    for (let offset = 1; offset < 25; offset++) {
      if (frameIndex - offset >= 0 && frames[frameIndex - offset]) {
        img = frames[frameIndex - offset];
        break;
      } else if (frameIndex + offset < TOTAL_FRAMES && frames[frameIndex + offset]) {
        img = frames[frameIndex + offset];
        break;
      }
    }
  }
  if (!img) return;

  const cw = heroCanvas.width;
  const ch = heroCanvas.height;
  const iw = img.naturalWidth || img.width || 1920;
  const ih = img.naturalHeight || img.height || 1080;

  // Clear canvas with deep cinema black
  heroCtx.fillStyle = '#000000';
  heroCtx.fillRect(0, 0, cw, ch);

  // Responsive video sizing:
  // Video width is 100% of canvas width across all devices (mobile, tablet, desktop)
  // No cropped edges, full video width is identical on all devices
  const scale = cw / iw;
  const dw = cw;
  const dh = Math.round(ih * scale);
  const dx = 0;
  const dy = Math.round((ch - dh) / 2);

  heroCtx.drawImage(img, dx, dy, dw, dh);
}

// ================= HERO BATCHED PRELOADER =================
async function preloadFrames() {
  const batchSize = 20;

  for (let i = 0; i < TOTAL_FRAMES; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, TOTAL_FRAMES); j++) {
      batch.push(loadSingleFrame(j));
    }
    await Promise.all(batch);
  }

  isLoaded = true;
  if (preloader) {
    preloader.style.opacity = '0';
    preloader.style.pointerEvents = 'none';
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 600);
  }
}

function loadSingleFrame(idx) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = FRAME_PATH(idx);

    img.onload = () => {
      if (img.decode) {
        img.decode()
          .then(() => {
            frames[idx] = img;
            onFrameLoaded(idx);
            resolve();
          })
          .catch(() => {
            frames[idx] = img;
            onFrameLoaded(idx);
            resolve();
          });
      } else {
        frames[idx] = img;
        onFrameLoaded(idx);
        resolve();
      }
    };

    img.onerror = () => {
      const retry = new Image();
      retry.src = FRAME_PATH(idx);
      retry.onload = () => {
        frames[idx] = retry;
        onFrameLoaded(idx);
        resolve();
      };
      retry.onerror = () => {
        onFrameLoaded(idx);
        resolve();
      };
    };
  });
}

function onFrameLoaded(idx) {
  loadedFramesCount++;
  const pct = Math.round((loadedFramesCount / TOTAL_FRAMES) * 100);
  if (loaderPercent) loaderPercent.textContent = `${pct}%`;
  if (loaderBar) loaderBar.style.width = `${pct}%`;

  if (idx === 0 && lastRenderedFrame === -1) {
    drawHeroFrame(0);
    lastRenderedFrame = 0;
  }
}

// ================= CREATIVE UNIVERSE SCROLL REVEAL & COORDINATION =================
function updateUniverseScene(timeSec) {
  if (!isUniverseVisible) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Smooth progress interpolation
  smoothUniverseProgress += (universeProgress - smoothUniverseProgress) * 0.16;
  const p = reducedMotion ? 1.0 : smoothUniverseProgress;

  // 1. Stage 1: Floor Ring & Header (0.00 -> 0.30)
  const floorT = Math.max(0, Math.min(1, p / 0.28));
  if (universeFloor) {
    universeFloor.style.opacity = floorT.toFixed(3);
    const floorScale = 0.72 + 0.28 * floorT;
    universeFloor.style.transform = `scale(${floorScale}) rotateX(76deg)`;
  }
  if (universeHeader) {
    const headerT = Math.max(0, Math.min(1, (p - 0.05) / 0.25));
    universeHeader.style.opacity = headerT.toFixed(3);
    universeHeader.style.transform = `translateY(${(1 - headerT) * 20}px)`;
  }

  // 2. Stage 2: Character Reveal (0.18 -> 0.58)
  const charT = Math.max(0, Math.min(1, (p - 0.18) / 0.36));
  if (universeCharWrap) {
    universeCharWrap.style.opacity = charT.toFixed(3);
    const charY = (1 - charT) * 60;
    // Character subtle parallax counter-shift
    const charParallaxX = mouseX * -7;
    const charParallaxY = mouseY * -4;
    universeCharWrap.style.transform = `translate3d(${charParallaxX}px, ${charY + charParallaxY}px, 0)`;
  }

  // 3. Stage 3: All 10 Cards Coordinated Convergence (0.42 -> 0.86)
  const cardsT = Math.max(0, Math.min(1, (p - 0.42) / 0.38));
  const isSettled = p >= 0.82;

  cardStates.forEach((state, i) => {
    const el = state.el;
    el.style.opacity = cardsT.toFixed(3);

    // Initial dispersed offset before convergence
    const disperseX = (state.wing === 'left' ? -80 : 80) * (1 - cardsT);
    const disperseY = (i % 2 === 0 ? -40 : 40) * (1 - cardsT);
    const disperseScale = 0.82 + 0.18 * cardsT;

    // Floating motion after cards arrive
    let floatX = 0;
    let floatY = 0;
    let floatRot = 0;
    if (isSettled && !reducedMotion) {
      floatY = Math.sin(timeSec * state.speed + state.phase) * 6.5;
      floatX = Math.cos(timeSec * (state.speed * 0.7) + state.phase) * 3;
      floatRot = Math.sin(timeSec * 0.6 + state.phase) * 1.2;
    }

    // Pointer Parallax (depth-scaled)
    const parallaxX = mouseX * (14 * state.depth);
    const parallaxY = mouseY * (9 * state.depth);

    const totalX = disperseX + floatX + parallaxX;
    const totalY = disperseY + floatY + parallaxY;

    // Preserve base tilt and combine
    const baseRotY = state.wing === 'left' ? 10 : -10;
    el.style.transform = `translate3d(${totalX}px, ${totalY}px, 0) scale(${disperseScale}) rotateY(${baseRotY + floatRot}deg)`;
  });

  // Mobile grid opacity
  if (mobileCards.length > 0) {
    mobileCards.forEach((c) => {
      c.style.opacity = cardsT.toFixed(3);
    });
  }

  // 4. Light Trail behind character
  updateLightTrail(timeSec, p);

  // 5. Ambient Particles
  updateParticles();
}

// ================= AMBIENT PARTICLES (EMBERS) =================
function updateParticles() {
  if (!particlesCtx || !isUniverseVisible) return;

  const w = particlesCanvas.width;
  const h = particlesCanvas.height;
  particlesCtx.clearRect(0, 0, w, h);

  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    pt.y -= pt.vy;
    pt.x += pt.vx;
    pt.pulse += 0.04;

    if (pt.y < -10) {
      pt.y = h + 10;
      pt.x = Math.random() * w;
    }

    const alpha = pt.alpha * (0.6 + 0.4 * Math.sin(pt.pulse));
    particlesCtx.beginPath();
    particlesCtx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    particlesCtx.fillStyle = `rgba(255, 55, 65, ${alpha.toFixed(3)})`;
    particlesCtx.shadowColor = 'rgba(255, 42, 59, 0.7)';
    particlesCtx.shadowBlur = 8;
    particlesCtx.fill();
  }
}

// ================= THIN RED LIGHT TRAIL (BEHIND CHARACTER) =================
function updateLightTrail(timeSec, p) {
  if (!trailPath || !trailHead || !isUniverseVisible) return;

  if (p < 0.25) {
    trailPath.setAttribute('d', '');
    trailHead.setAttribute('cx', '-100');
    trailHead.setAttribute('cy', '-100');
    return;
  }

  const cx = window.innerWidth * 0.5;
  const cy = window.innerHeight * 0.58;
  const rx = window.innerWidth * 0.26;
  const ry = window.innerHeight * 0.16;

  // Parametric orbital loop that weaves behind the character
  const angle = timeSec * 1.15;
  const hx = cx + Math.cos(angle) * (rx + Math.sin(timeSec * 0.8) * 35);
  const hy = cy + Math.sin(angle * 1.3) * (ry + Math.cos(timeSec * 0.6) * 20);

  trailHistory.unshift({ x: hx, y: hy });
  if (trailHistory.length > TRAIL_POINTS) {
    trailHistory.pop();
  }

  if (trailHistory.length > 2) {
    let d = `M ${trailHistory[0].x.toFixed(1)} ${trailHistory[0].y.toFixed(1)}`;
    for (let i = 1; i < trailHistory.length; i++) {
      d += ` L ${trailHistory[i].x.toFixed(1)} ${trailHistory[i].y.toFixed(1)}`;
    }
    trailPath.setAttribute('d', d);
    trailHead.setAttribute('cx', hx.toFixed(1));
    trailHead.setAttribute('cy', hy.toFixed(1));
  }
}

// ================= MOUSE PARALLAX TRACKER =================
window.addEventListener('pointermove', (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ================= ULTRA-SMOOTH MAIN RENDER LOOP =================
function renderLoop(time) {
  lenis.raf(time);
  handleScrollProgress();

  const timeSec = time * 0.001;

  // 1. Hero Scrubbing Engine - snappy, responsive interpolation
  const diff = targetFrame - currentFrame;
  if (Math.abs(diff) > 0.001) {
    currentFrame += diff * 0.28;
  } else {
    currentFrame = targetFrame;
  }

  const frameToRender = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));
  if (frameToRender !== lastRenderedFrame) {
    drawHeroFrame(frameToRender);
    lastRenderedFrame = frameToRender;
  }

  // 2. Mouse Parallax Smoothing
  mouseX += (targetMouseX - mouseX) * 0.06;
  mouseY += (targetMouseY - mouseY) * 0.06;

  // 3. Creative Universe Scene Update
  updateUniverseScene(timeSec);

  requestAnimationFrame(renderLoop);
}

// ================= INITIALIZATION =================
window.addEventListener('resize', () => {
  resizeCanvases();
  handleScrollProgress();
});

resizeCanvases();
handleScrollProgress();
preloadFrames();
requestAnimationFrame(renderLoop);

// ================= SECTION 03: SELECTED WORK & LIGHTBOX =================
const WORKS_DATA = [
  {
    title: 'Minimalist Poster',
    category: 'Editorial Poster · Visual Hierarchy',
    full: '/works/minimalist-poster.png',
  },
  {
    title: 'Energy Drink Creative',
    category: 'CGI Advertising · Brand Campaign',
    full: '/works/energy-drink-creative.jpg',
  },
  {
    title: 'Jewellery Poster',
    category: 'Luxury Branding · High Fashion',
    full: '/works/jewellery-poster.jpg',
  },
  {
    title: 'Juice Poster',
    category: 'Packaging Concept · Commercial Art',
    full: '/works/juice-poster.png',
  },
  {
    title: 'Perfume Creative',
    category: 'Luxury Still Life · Brand Identity',
    full: '/works/perfume-creative.jpg',
  },
  {
    title: 'Footwear Poster',
    category: 'Sports Apparel · Campaign Visual',
    full: '/works/footwear-poster.jpg',
  },
  {
    title: 'Story Poster',
    category: 'Cinematic Poster · Narrative Art',
    full: '/works/story-poster.jpg',
  },
  {
    title: 'Watch Creative',
    category: 'Precision Timepiece · Product Visual',
    full: '/works/watch-creative.jpg',
  },
];

// Work Cards Reveal on Scroll
const workCards = document.querySelectorAll('.work-card');

if ('IntersectionObserver' in window) {
  const worksObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  workCards.forEach((card) => worksObserver.observe(card));
} else {
  workCards.forEach((card) => card.classList.add('is-revealed'));
}

// Lightbox Elements & State
const lightbox = document.getElementById('lightbox');
const lbTitle = document.getElementById('lb-title');
const lbCategory = document.getElementById('lb-category');
const lbCounter = document.getElementById('lb-counter');
const lbImg = document.getElementById('lb-img');
const lbClose = document.getElementById('lb-close');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');
const lbStage = document.getElementById('lb-stage');

let currentWorkIndex = 0;
let isLightboxOpen = false;
let lastFocusedElement = null;

function updateLightboxContent(index) {
  const item = WORKS_DATA[index];
  if (!item) return;

  if (lbTitle) lbTitle.textContent = item.title;
  if (lbCategory) lbCategory.textContent = item.category ? `· ${item.category}` : '';
  if (lbCounter) {
    lbCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(WORKS_DATA.length).padStart(2, '0')}`;
  }

  if (lbImg) {
    lbImg.style.opacity = '0.35';
    lbImg.style.transform = 'scale(0.98)';
    lbImg.src = item.full;
    lbImg.alt = `${item.title} - ${item.category}`;

    lbImg.onload = () => {
      lbImg.style.opacity = '1';
      lbImg.style.transform = 'scale(1)';
    };
  }
}

function openLightbox(index) {
  if (index < 0 || index >= WORKS_DATA.length) return;
  lastFocusedElement = document.activeElement;
  currentWorkIndex = index;
  updateLightboxContent(index);

  isLightboxOpen = true;
  if (lightbox) {
    lightbox.classList.remove('hidden');
    void lightbox.offsetWidth; // Trigger reflow for transition
    lightbox.classList.add('is-open');
  }

  lenis.stop();
  document.body.classList.add('lightbox-open');

  setTimeout(() => {
    lbClose?.focus();
  }, 60);
}

function closeLightbox() {
  if (!isLightboxOpen) return;
  isLightboxOpen = false;

  if (lightbox) {
    lightbox.classList.remove('is-open');
    setTimeout(() => {
      if (!isLightboxOpen) {
        lightbox.classList.add('hidden');
        if (lbImg) lbImg.src = '';
      }
    }, 300);
  }

  lenis.start();
  document.body.classList.remove('lightbox-open');

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

function showPrevWork() {
  currentWorkIndex = (currentWorkIndex - 1 + WORKS_DATA.length) % WORKS_DATA.length;
  updateLightboxContent(currentWorkIndex);
}

function showNextWork() {
  currentWorkIndex = (currentWorkIndex + 1) % WORKS_DATA.length;
  updateLightboxContent(currentWorkIndex);
}

// Card Click & Enter/Space Keydown
workCards.forEach((card) => {
  const idx = parseInt(card.dataset.workId, 10);
  card.addEventListener('click', () => {
    openLightbox(idx);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(idx);
    }
  });
});

// Lightbox Controls
lbClose?.addEventListener('click', closeLightbox);
lbPrev?.addEventListener('click', (e) => {
  e.stopPropagation();
  showPrevWork();
});
lbNext?.addEventListener('click', (e) => {
  e.stopPropagation();
  showNextWork();
});

// Click outside image stage to close
lightbox?.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target === lbStage) {
    closeLightbox();
  }
});

// Keyboard Navigation & Focus Trap
window.addEventListener('keydown', (e) => {
  if (!isLightboxOpen) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeLightbox();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    showPrevWork();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    showNextWork();
  } else if (e.key === 'Tab') {
    const focusable = [lbClose, lbPrev, lbNext].filter(Boolean);
    if (focusable.length === 0) return;
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
});

// ================= SECTION 04: ABOUT ME =================
const aboutReveals = document.querySelectorAll('.about-reveal');

if ('IntersectionObserver' in window) {
  const aboutObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  aboutReveals.forEach((el) => aboutObserver.observe(el));
} else {
  aboutReveals.forEach((el) => el.classList.add('is-revealed'));
}

// "Explore My Work" Smooth Scroll Button
const aboutExploreBtn = document.getElementById('about-explore-btn');
aboutExploreBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  const worksSection = document.getElementById('works-section');
  if (!worksSection) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    worksSection.scrollIntoView();
  } else if (typeof lenis !== 'undefined' && lenis) {
    lenis.scrollTo(worksSection, {
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
  } else {
    worksSection.scrollIntoView({ behavior: 'smooth' });
  }
});

// "Back to top" Smooth Scroll Button
const backToTopBtn = document.getElementById('back-to-top-btn');
backToTopBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    window.scrollTo(0, 0);
    updateHeroTitle(0);
  } else if (typeof lenis !== 'undefined' && lenis) {
    lenis.scrollTo(0, {
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      onComplete: () => {
        updateHeroTitle(0);
      },
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateHeroTitle(0);
  }
});







