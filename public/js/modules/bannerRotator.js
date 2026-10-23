// Bottom-bar banner rotation for the competition screen.
//
// Usage:
//   import { createBannerRotator } from '../js/modules/bannerRotator.js';
//   const rotator = createBannerRotator(container, disclaimerEl);
//   rotator.reload(); // (re)fetch GET /banners and restart the rotation
//
// The disclaimer element is always part of the container. It stays visible when
// fetching fails, when there are no enabled banners, or as its own slide when
// showDisclaimer is on. The visible slide gets the "active" class.

export function createBannerRotator(container, disclaimer) {
  let slides = [];
  let index = 0;
  let timer = null;

  function showNext() {
    slides[index].el.classList.remove('active');
    index = (index + 1) % slides.length;
    show();
  }

  function show() {
    const slide = slides[index];
    slide.el.classList.add('active');
    if (slides.length > 1) timer = setTimeout(showNext, slide.sec * 1000);
  }

  async function reload() {
    let config = null;
    try {
      const res = await fetch('/banners');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      config = await res.json();
    } catch (err) {
      console.warn('[Banners] Could not load banners:', err);
    }

    // Rebuild after the await so overlapping reloads cannot leave a second timer running
    clearTimeout(timer);
    // The disclaimer starts out active in the HTML; old images are removed below
    disclaimer.classList.remove('active');
    container.querySelectorAll('img.bottom-bar-slide').forEach((img) => img.remove());

    const banners = (config?.banners ?? []).filter((b) => b.enabled);
    slides = [];
    if (!config || config.showDisclaimer || banners.length === 0) {
      slides.push({ el: disclaimer, sec: config?.disclaimerSec ?? 10 });
    }
    banners.forEach((banner) => {
      const img = document.createElement('img');
      img.className = 'bottom-bar-slide';
      img.src = `/banners/image/${encodeURIComponent(banner.filename)}`;
      img.alt = '';
      container.appendChild(img);
      slides.push({ el: img, sec: banner.durationSec });
    });
    index = 0;
    show();
  }

  return { reload };
}
