document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('student');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const projectsRoot = document.getElementById('projects-root');
  const membershipsRoot = document.getElementById('memberships-root');
  const joinForm = document.getElementById('join-form');
  const joinError = document.getElementById('join-error');
  const joinSuccess = document.getElementById('join-success');

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
        .map(
          (p, i) => `
        <article class="card" data-reveal style="margin-bottom: var(--space-sm); --reveal-delay:${i * 40}ms">
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
            <h3 style="font-weight:500;margin:0;flex:1">${App.escapeHtml(p.title)}</h3>
            ${p.joined ? '<span class="badge badge--joined">Joined</span>' : ''}
          </div>
          <p>${App.escapeHtml(p.description)}</p>
          <p class="meta-label">${App.escapeHtml(App.formatDate(p.created_at))}</p>
        </article>`
        )
        .join('');
      Animations.initReveal();
    } catch (err) {
      projectsRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  async function loadMemberships() {
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
          <li class="card" style="margin-bottom:0.5rem">
            ${App.escapeHtml(m.title)}
            <span class="meta-label"> · joined ${App.escapeHtml(App.formatDate(m.joined_at))}</span>
          </li>`
          )
          .join('')}
      </ul>`;
    } catch (err) {
      membershipsRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  loadProjects();
  loadMemberships();

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(joinError, '');
    joinSuccess.hidden = true;
    const code = joinForm.group_code.value.trim();
    if (!code) {
      App.showInlineError(joinError, 'Enter the group code.');
      return;
    }
    const btn = joinForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const data = await App.api('/api/projects/join', {
        method: 'POST',
        body: { group_code: code },
      });
      joinSuccess.textContent = `You joined “${data.project.title}”.`;
      joinSuccess.hidden = false;
      joinForm.reset();
      loadProjects();
      loadMemberships();
    } catch (err) {
      App.showInlineError(joinError, err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
