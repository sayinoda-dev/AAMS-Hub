document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('admin');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const queueRoot = document.getElementById('queue-root');
  const projectsRoot = document.getElementById('admin-projects-root');

  async function loadQueue() {
    try {
      const data = await App.api('/api/admin/ideas/pending');
      const ideas = data.ideas || [];
      if (!ideas.length) {
        queueRoot.innerHTML =
          '<p class="empty-state garamond">The queue is clear. No pending ideas.</p>';
        return;
      }
      queueRoot.innerHTML = ideas
        .map(
          (idea) => `
        <article class="queue-item" data-idea-id="${idea.id}" data-reveal>
          <span class="meta-label">${App.escapeHtml(App.formatDateTime(idea.created_at))}</span>
          <h3>${App.escapeHtml(idea.title)}</h3>
          <p>${App.escapeHtml(idea.description)}</p>
          <p class="form-hint">From ${App.escapeHtml(idea.submitter_name)} · ${App.escapeHtml(idea.submitter_email)}</p>
          <div class="queue-actions">
            <button type="button" class="btn btn--copper" data-accept>Create project</button>
            <button type="button" class="btn" data-reject>Reject</button>
          </div>
          <div class="code-banner" hidden data-code-banner></div>
          <p class="form-error" hidden data-item-error role="alert"></p>
        </article>`
        )
        .join('');
      Animations.initReveal();
      bindQueueActions();
    } catch (err) {
      queueRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  function bindQueueActions() {
    queueRoot.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const article = btn.closest('[data-idea-id]');
        const id = article.getAttribute('data-idea-id');
        const errEl = article.querySelector('[data-item-error]');
        const banner = article.querySelector('[data-code-banner]');
        App.showInlineError(errEl, '');
        btn.disabled = true;
        try {
          const data = await App.api(`/api/admin/ideas/${id}/accept`, {
            method: 'POST',
            body: {},
          });
          banner.hidden = false;
          banner.innerHTML = `
            <p class="meta-label">Group code (share with students)</p>
            <p class="code">${App.escapeHtml(data.project.group_code)}</p>
            <p class="form-hint">Expires ${App.escapeHtml(App.formatDateTime(data.project.code_expires_at))}</p>`;
          article.querySelector('[data-reject]').disabled = true;
          loadQueue();
          loadProjects();
        } catch (err) {
          App.showInlineError(errEl, err.message);
          btn.disabled = false;
        }
      });
    });

    queueRoot.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const article = btn.closest('[data-idea-id]');
        const id = article.getAttribute('data-idea-id');
        const errEl = article.querySelector('[data-item-error]');
        App.showInlineError(errEl, '');
        btn.disabled = true;
        try {
          await App.api(`/api/admin/ideas/${id}/reject`, { method: 'POST', body: {} });
          article.remove();
          if (!queueRoot.querySelector('[data-idea-id]')) {
            queueRoot.innerHTML =
              '<p class="empty-state garamond">The queue is clear. No pending ideas.</p>';
          }
        } catch (err) {
          App.showInlineError(errEl, err.message);
          btn.disabled = false;
        }
      });
    });
  }

  async function loadProjects() {
    try {
      const data = await App.api('/api/admin/projects');
      const projects = data.projects || [];
      if (!projects.length) {
        projectsRoot.innerHTML = '<p class="empty-state garamond">No projects yet.</p>';
        return;
      }
      const now = Date.now();
      projectsRoot.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Code</th>
                <th>Expires</th>
                <th>Members</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${projects
                .map((p) => {
                  const expired = new Date(p.code_expires_at).getTime() < now;
                  return `
                <tr data-project-id="${p.id}">
                  <td>${App.escapeHtml(p.title)}</td>
                  <td><span class="code" style="font-size:1rem">${App.escapeHtml(p.group_code)}</span>
                    ${expired ? '<br><span class="form-error" style="font-size:0.8125rem">Expired</span>' : ''}</td>
                  <td>${App.escapeHtml(App.formatDateTime(p.code_expires_at))}</td>
                  <td>${p.member_count}</td>
                  <td><button type="button" class="btn btn--ghost" data-regen>New code</button></td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>`;
      projectsRoot.querySelectorAll('[data-regen]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const row = btn.closest('[data-project-id]');
          const id = row.getAttribute('data-project-id');
          btn.disabled = true;
          try {
            await App.api(`/api/admin/projects/${id}/regenerate-code`, {
              method: 'POST',
              body: {},
            });
            loadProjects();
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      projectsRoot.innerHTML = `<p class="form-error">${App.escapeHtml(err.message)}</p>`;
    }
  }

  loadQueue();
  loadProjects();
});
