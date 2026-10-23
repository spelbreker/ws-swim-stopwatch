// Splash Meet Manager export page: list, download and delete heat files.

const rows = document.getElementById('fileRows');
const emptyMessage = document.getElementById('emptyMessage');
const showBackups = document.getElementById('showBackups');
const status = document.getElementById('status');
const deleteButton = document.getElementById('deleteButton');

let files = [];

function setStatus(text, isError = false) {
  status.textContent = text;
  status.classList.toggle('text-red-500', isError);
}

function cell(content, className = '') {
  const td = document.createElement('td');
  td.className = `px-4 py-2 ${className}`;
  if (content instanceof Node) td.appendChild(content);
  else td.textContent = content;
  return td;
}

function renderRow(file) {
  const tr = document.createElement('tr');
  tr.className = 'border-t border-gray-200 dark:border-gray-700';
  if (file.backup) tr.classList.add('opacity-60');

  const link = document.createElement('a');
  link.href = `/exports/splashme/${encodeURIComponent(file.name)}`;
  link.download = file.name;
  link.textContent = 'Download';
  link.className = 'text-blue-600 dark:text-blue-400 hover:underline';

  const name = file.backup ? `${file.name} (backup)` : file.name;
  tr.append(
    // Event/heat are also in the file name; hidden on narrow screens
    cell(String(file.event), 'hidden sm:table-cell'),
    cell(String(file.heat), 'hidden sm:table-cell'),
    cell(name, 'font-mono break-all'),
    cell(new Date(file.modified).toLocaleString()),
    cell(link, 'text-right'),
  );
  return tr;
}

function render() {
  const visible = showBackups.checked ? files : files.filter((f) => !f.backup);
  // Group by event/heat; within a heat the newest file comes first
  visible.sort((a, b) => a.event - b.event || a.heat - b.heat || b.modified.localeCompare(a.modified));
  rows.replaceChildren(...visible.map(renderRow));
  emptyMessage.classList.toggle('hidden', visible.length > 0);
}

async function loadFiles() {
  try {
    const res = await fetch('/exports/splashme', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    files = await res.json();
    // Clear a previous load error, but keep a success message such as "3 file(s) deleted"
    if (status.classList.contains('text-red-500')) setStatus('');
    render();
  } catch (err) {
    setStatus(`Failed to load heat files: ${err.message}`, true);
  }
}

deleteButton.addEventListener('click', async () => {
  if (!window.confirm('Delete all heat files, including backups? This cannot be undone.')) return;
  deleteButton.disabled = true;
  try {
    const res = await fetch('/exports/splashme', { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { deleted } = await res.json();
    setStatus(`${deleted} file(s) deleted`);
    await loadFiles();
  } catch (err) {
    setStatus(`Failed to delete heat files: ${err.message}`, true);
  } finally {
    deleteButton.disabled = false;
  }
});

document.getElementById('refreshButton').addEventListener('click', loadFiles);
showBackups.addEventListener('change', render);

loadFiles();
setInterval(loadFiles, 10000);
