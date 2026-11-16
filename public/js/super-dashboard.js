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

    const esc = App.escapeHtml;
  const memberFilter = document.getElementById('member-filter');
  const membersList = document.getElementById('members-list');
  const membersMsg = document.getElementById('members-msg');
  const clubsList = document.getElementById('clubs-list');
  const clubForm = document.getElementById('club-form');
  const clubMsg = document.getElementById('club-msg');

  /* ---------- Members ---------- */

  function memberButtons(m) {
    const btns = [];
    if (m.role === 'student' && m.signup_status !== 'approved') btns.push(['approve', 'Approve']);
    if (m.role === 'student' && m.signup_status !== 'rejected') btns.push(['reject', 'Reject']);
    if (m.role === 'student' && m.signup_status !== 'rejected') btns.push(['make-admin', 'Make admin']);
    if (m.role === 'admin') btns.push(['make-student', 'Make student']);
    return btns
      .map(
        ([action, label]) =>
          `<button type="button" class="btn btn--ghost" data-action="${action}" data-id="${esc(String(m.id))}">${label}</button>`
      )
      .join(' ');
  }

  async function loadMembers() {
    App.showInlineError(membersMsg, '');
    try {
      const data = await App.api(
        `/api/super/members?status=${encodeURIComponent(memberFilter.value)}`
      );
      membersList.innerHTML =
        (data.members || [])
          .map(
            (m) => `<article class="activity-log__row">
              <strong>${esc(m.name)}</strong>
              <span class="garamond">${esc(m.email)} · ${esc(m.club_name)} · ${esc(m.role)} · ${esc(m.signup_status)}</span>
              <span>${memberButtons(m)}</span>
            </article>`
          )
          .join('') || '<p class="garamond">No members here.</p>';
    } catch (err) {
      App.showInlineError(membersMsg, err.message);
    }
  }

  const memberActions = {
    approve: (id) => [`/api/super/members/${id}/approve`, {}],
    reject: (id) => [`/api/super/members/${id}/reject`, {}],
    'make-admin': (id) => [`/api/super/members/${id}/role`, { role: 'admin' }],
    'make-student': (id) => [`/api/super/members/${id}/role`, { role: 'student' }],
  };

  membersList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const build = memberActions[btn.dataset.action];
    if (!build) return;
    if (
      btn.dataset.action === 'make-admin' &&
      !window.confirm('Give this member admin rights for their club?')
    ) {
      return;
    }
    const [url, body] = build(btn.dataset.id);
    btn.disabled = true;
    App.showInlineError(membersMsg, '');
    try {
      await App.api(url, { method: 'POST', body });
      await loadMembers();
    } catch (err) {
      App.showInlineError(membersMsg, err.message);
      btn.disabled = false;
    }
  });

  memberFilter.addEventListener('change', loadMembers);

  /* ---------- Clubs ---------- */

  async function loadClubs() {
    try {
      const data = await App.api('/api/super/clubs');
      clubsList.innerHTML =
        (data.clubs || [])
          .map(
            (c) => `<article class="activity-log__row">
              <strong>${esc(c.name)}</strong>
              <span class="garamond">${esc(c.slug)} · ${esc(String(c.member_count))} members · ${c.is_active ? 'active' : 'inactive'}</span>
              <button type="button" class="btn btn--ghost" data-club-id="${esc(String(c.id))}" data-active="${c.is_active}">
                ${c.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </article>`
          )
          .join('') || '<p class="garamond">No clubs yet.</p>';
    } catch (err) {
      clubsList.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    }
  }

  clubsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-club-id]');
    if (!btn) return;
    const makeActive = btn.dataset.active !== 'true';
    if (
      !makeActive &&
      !window.confirm('Deactivate this club? Its members will not be able to sign in.')
    ) {
      return;
    }
    btn.disabled = true;
    try {
      await App.api(`/api/super/clubs/${btn.dataset.clubId}/active`, {
        method: 'POST',
        body: { active: makeActive },
      });
      await loadClubs();
    } catch (err) {
      App.showInlineError(clubMsg, err.message);
      btn.disabled = false;
    }
  });

  clubForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(clubMsg, '');
    const name = document.getElementById('club-name').value.trim();
    const slug = document.getElementById('club-slug').value.trim().toLowerCase();
    const tagline = document.getElementById('club-tagline').value.trim();
    const btn = clubForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await App.api('/api/super/clubs', { method: 'POST', body: { name, slug, tagline } });
      clubForm.reset();
      await loadClubs();
    } catch (err) {
      App.showInlineError(clubMsg, err.message);
    } finally {
      btn.disabled = false;
    }
  });

  loadMembers();
  loadClubs();

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
