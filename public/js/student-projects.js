document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('student');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const projectsRoot = document.getElementById('projects-root');
  const membershipsRoot = document.getElementById('memberships-root');

  const errorEl = document.createElement('p');
  errorEl.className = 'form-error';
  errorEl.hidden = true;
  errorEl.setAttribute('role', 'alert');
  projectsRoot.parentNode.insertBefore(errorEl, projectsRoot);

  async function loadProjects() {
    try {
      const data = await App.api('/api/projects');
      const projects = data.projects || [];
      if (!projects.length) {
        projectsRoot.innerHTML =
          '<p class="empty-state garamond">No approved projects yet. Submit an idea or check back after review.</p>';
        return;
      }
      projectsRoot.innerHTML = projects
        .map((p, i) => {
          const id = App.escapeHtml(String(p.id));
          const actions = p.joined
            ? `<a class="btn btn--ghost" href="/student/chat.html?project=${encodeURIComponent(p.id)}">Chat</a>
               <button type="button" class="btn btn--ghost" data-leave-id="${id}">Leave</button>`
            : `<button type="button" class="btn" data-join-id="${id}">Join</button>`;
          return `
        <article class="card" data-reveal style="margin-bottom: var(--space-sm); --reveal-delay:${i * 40}ms">
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
            <h3 style="font-weight:500;margin:0;flex:1">${App.escapeHtml(p.title)}</h3>
            ${p.joined ? '<span class="badge badge--joined">Joined</span>' : ''}
          </div>
          <p>${App.escapeHtml(p.description)}</p>
          <p class="meta-label">${App.escapeHtml(App.formatDate(p.created_at))}</p>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">${actions}</div>
        </article>`;
        })
        .join('');
      Animations.initReveal();
    } catch (err) {
      projectsRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  async function loadMemberships() {
    if (!membershipsRoot) return;
    try {
      const data = await App.api('/api/projects/my-memberships');
      const list = data.memberships || [];
      if (!list.length) {
        membershipsRoot.innerHTML =
          '<p class="empty-state garamond">You are not in a project group yet.</p>';
        return;
      }
      membershipsRoot.innerHTML = `<ul style="list-style:none;padding:0;margin:0">
        ${list
          .map(
            (m) => `
          <li class="card" style="margin-bottom:0.5rem;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
            <span style="flex:1">
              ${App.escapeHtml(m.title)}
              <span class="meta-label"> · joined ${App.escapeHtml(App.formatDate(m.joined_at))}</span>
            </span>
            <a class="btn btn--ghost" href="/student/chat.html?project=${encodeURIComponent(m.id)}">Chat</a>
          </li>`
          )
          .join('')}
      </ul>`;
    } catch (err) {
      membershipsRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  projectsRoot.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-join-id], button[data-leave-id]');
    if (!btn) return;
    const joining = Boolean(btn.dataset.joinId);
    const id = btn.dataset.joinId || btn.dataset.leaveId;
    if (!joining && !window.confirm('Leave this project? You will lose access to its chat.')) {
      return;
    }
    App.showInlineError(errorEl, '');
    btn.disabled = true;
    try {
      if (joining) {
        await App.api(`/api/projects/${id}/join`, { method: 'POST', body: {} });
        App.navigateWithFade(`/student/chat.html?project=${encodeURIComponent(id)}`);
        return;
      }
      await App.api(`/api/projects/${id}/membership`, { method: 'DELETE' });
      await Promise.all([loadProjects(), loadMemberships()]);
    } catch (err) {
      App.showInlineError(errorEl, err.message);
      btn.disabled = false;
    }
  });

  loadProjects();
  loadMemberships();
});
