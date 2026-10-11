document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('superadmin');
  if (!user) return;

  const regEl = document.querySelector('[data-metric="registrations"]');
  const projEl = document.querySelector('[data-metric="projects"]');
  const ideasEl = document.getElementById('ideas-breakdown');
  const dailyEl = document.getElementById('daily-active');
  const logEl = document.getElementById('activity-log');
  const purgeBtn = document.getElementById('purge-btn');
  const purgeMsg = document.getElementById('purge-msg');

  try {
    const data = await App.api('/api/super/analytics');
    regEl.textContent = String(data.registrationsLast30Days ?? 0);
    projEl.textContent = String(data.projectCount ?? 0);

    ideasEl.innerHTML = (data.ideasByStatus || [])
      .map(
        (row) =>
          `<li><span class="meta-label">${App.escapeHtml(row.status)}</span> ${App.escapeHtml(String(row.c))}</li>`
      )
      .join('') || '<li class="garamond">No ideas yet.</li>';

    dailyEl.innerHTML = (data.dailyActive || [])
      .map(
        (row) =>
          `<p><span class="meta-label">${App.escapeHtml(row.day)}</span> ${App.escapeHtml(String(row.users))} users</p>`
      )
      .join('') || '<p class="garamond">No daily activity recorded yet.</p>';

    logEl.innerHTML = (data.recentActivity || [])
      .map((row) => {
        const who = row.user_name
          ? `${row.user_name} (${row.user_email || '—'})`
          : 'System';
        return `<article class="activity-log__row">
          <span class="meta-label">${App.escapeHtml(App.formatDateTime(row.created_at))}</span>
          <strong>${App.escapeHtml(row.event_type)}</strong>
          <span class="garamond">${App.escapeHtml(who)}</span>
        </article>`;
      })
      .join('') || '<p class="garamond">No events yet.</p>';
  } catch (err) {
    logEl.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
  }

  purgeBtn.addEventListener('click', async () => {
    if (
      !window.confirm(
        'Permanently delete all ideas, projects, groups, and news? User accounts will remain.'
      )
    ) {
      return;
    }
    purgeBtn.disabled = true;
    App.showInlineError(purgeMsg, '');
    try {
      const result = await App.api('/api/super/purge-production-data', {
        method: 'POST',
        body: {},
      });
      App.showInlineError(purgeMsg, result.message || 'Purge complete.');
      purgeMsg.hidden = false;
      purgeMsg.classList.remove('form-error');
      purgeMsg.classList.add('garamond');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      App.showInlineError(purgeMsg, err.message);
    } finally {
      purgeBtn.disabled = false;
    }
  });
});
