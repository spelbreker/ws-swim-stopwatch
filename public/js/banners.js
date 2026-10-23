// Settings page: manage the bottom-bar banners of the competition screen.
// Upload and delete apply immediately; order, durations, on/off and the
// disclaimer slide are saved together with "Save banners".

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('bannerList');
  const empty = document.getElementById('bannerEmpty');
  const fileInput = document.getElementById('bannerFile');
  const uploadButton = document.getElementById('uploadBannerButton');
  const saveButton = document.getElementById('saveBannersButton');
  const showDisclaimer = document.getElementById('showDisclaimer');
  const disclaimerSec = document.getElementById('disclaimerSec');
  const status = document.getElementById('bannerStatus');

  // Local copy of GET /banners; edited in place until saved
  let config = { showDisclaimer: true, disclaimerSec: 10, banners: [] };

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('text-red-500', isError);
    status.classList.toggle('text-green-500', !isError && text !== '');
  }

  const buttonClass = 'px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30';

  // Disclaimer inputs are only filled from the server, so re-rendering the list keeps unsaved edits
  function fillDisclaimer() {
    showDisclaimer.checked = config.showDisclaimer;
    disclaimerSec.value = config.disclaimerSec;
  }

  function render() {
    empty.classList.toggle('hidden', config.banners.length > 0);
    list.replaceChildren(...config.banners.map((banner, i) => {
      const li = document.createElement('li');
      li.className = 'py-3 flex flex-wrap items-center gap-4';
      li.dataset.id = banner.id;
      li.innerHTML = `
        <img alt="Banner ${i + 1}" class="h-12 w-48 object-contain bg-gray-900 rounded">
        <label class="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          Duration (s)
          <input type="number" min="1" max="300" step="1" data-field="durationSec"
            class="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-white">
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" data-field="enabled" class="h-4 w-4"> Enabled
        </label>
        <span class="ml-auto flex gap-2">
          <button type="button" data-action="up" class="${buttonClass}" aria-label="Move up">&uarr;</button>
          <button type="button" data-action="down" class="${buttonClass}" aria-label="Move down">&darr;</button>
          <button type="button" data-action="delete" class="px-2 py-1 text-sm rounded-md text-white bg-red-600 hover:bg-red-700">Delete</button>
        </span>`;
      li.querySelector('img').src = `/banners/image/${encodeURIComponent(banner.filename)}`;
      li.querySelector('[data-field="durationSec"]').value = banner.durationSec;
      li.querySelector('[data-field="enabled"]').checked = banner.enabled;
      li.querySelector('[data-action="up"]').disabled = i === 0;
      li.querySelector('[data-action="down"]').disabled = i === config.banners.length - 1;
      return li;
    }));
  }

  async function request(url, options) {
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  }

  async function loadBanners() {
    try {
      config = await request('/banners');
      fillDisclaimer();
      render();
    } catch {
      setStatus('Failed to load banners', true);
    }
  }

  list.addEventListener('input', (e) => {
    const banner = config.banners.find((b) => b.id === e.target.closest('li')?.dataset.id);
    if (!banner) return;
    if (e.target.dataset.field === 'durationSec') banner.durationSec = Number(e.target.value);
    if (e.target.dataset.field === 'enabled') banner.enabled = e.target.checked;
  });

  list.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const id = button.closest('li').dataset.id;
    const i = config.banners.findIndex((b) => b.id === id);
    const action = button.dataset.action;
    if (action === 'up' || action === 'down') {
      const j = action === 'up' ? i - 1 : i + 1;
      [config.banners[i], config.banners[j]] = [config.banners[j], config.banners[i]];
      render();
      setStatus('Order changed, not saved yet');
      return;
    }
    if (!window.confirm('Delete this banner? This cannot be undone.')) return;
    try {
      await request(`/banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
      // Update the local list instead of reloading, so unsaved edits stay
      config.banners = config.banners.filter((b) => b.id !== id);
      render();
      setStatus('Banner deleted');
    } catch (err) {
      setStatus(err.message || 'Failed to delete banner', true);
      loadBanners();
    }
  });

  uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
      setStatus('Choose an image first', true);
      return;
    }
    const data = new FormData();
    data.append('banner', file);
    uploadButton.disabled = true;
    setStatus('Uploading...');
    try {
      const body = await request('/banners/upload', { method: 'POST', body: data });
      // The server appends new banners too, so the local order stays in sync
      config.banners.push(body.banner);
      render();
      fileInput.value = '';
      setStatus('Banner uploaded');
    } catch (err) {
      setStatus(err.message || 'Failed to upload banner', true);
    } finally {
      uploadButton.disabled = false;
    }
  });

  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    setStatus('Saving...');
    try {
      const body = await request('/banners/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showDisclaimer: showDisclaimer.checked,
          disclaimerSec: Number(disclaimerSec.value),
          banners: config.banners.map(({ id, durationSec, enabled }) => ({ id, durationSec, enabled })),
        }),
      });
      config = body.config;
      fillDisclaimer();
      render();
      setStatus('Banners saved');
    } catch (err) {
      setStatus(err.message || 'Failed to save banners', true);
    } finally {
      saveButton.disabled = false;
    }
  });

  loadBanners();
});
