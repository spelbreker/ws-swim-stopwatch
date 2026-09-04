// ------------------------------------------------------------------
// Settings page: load and save pool length / split cooldown
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const cooldownInput = document.getElementById('splitCooldownSec');
    const saveButton = document.getElementById('saveButton');
    const status = document.getElementById('status');

    function setStatus(text, isError = false) {
        status.textContent = text;
        status.classList.toggle('text-red-500', isError);
        status.classList.toggle('text-green-500', !isError && text !== '');
    }

    function fillForm(settings) {
        const radio = form.querySelector(`input[name="poolLength"][value="${settings.poolLength}"]`);
        if (radio) radio.checked = true;
        cooldownInput.value = settings.splitCooldownSec;
    }

    async function loadSettings() {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            fillForm(await res.json());
        } catch (err) {
            setStatus('Failed to load settings', true);
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const poolLength = Number(form.querySelector('input[name="poolLength"]:checked')?.value);
        const splitCooldownSec = Number(cooldownInput.value);
        saveButton.disabled = true;
        setStatus('Saving...');
        try {
            const res = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poolLength, splitCooldownSec }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            fillForm(body.settings);
            setStatus('Settings saved');
        } catch (err) {
            setStatus(err.message || 'Failed to save settings', true);
        } finally {
            saveButton.disabled = false;
        }
    });

    loadSettings();
});
