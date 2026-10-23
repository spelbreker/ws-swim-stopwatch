// Tab switching for the competition remote on small screens.
// From the lg breakpoint all panels are visible side by side (CSS), the tabs are hidden.
//
// Exports:
//   initTabs()
//   setActiveTab(name)

export function setActiveTab(name) {
  document.querySelectorAll('[data-tab-target]').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.getAttribute('data-tab-target') === name));
  });
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    const active = panel.getAttribute('data-tab-panel') === name;
    panel.classList.toggle('hidden', !active);
    panel.classList.toggle('flex', active);
  });
}

/** Wire the tab buttons with event delegation. */
export function initTabs() {
  const nav = document.getElementById('remote-tabs');
  if (!nav) return;
  nav.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab-target]');
    if (tab) setActiveTab(tab.getAttribute('data-tab-target'));
  });
}
