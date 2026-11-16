document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('student');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const layout = document.getElementById('chat-layout');
  const listEl = document.getElementById('chat-list');
  const emptyEl = document.getElementById('chat-empty');
  const bodyEl = document.getElementById('chat-body');
  const titleEl = document.getElementById('chat-title');
  const messagesEl = document.getElementById('chat-messages');
  const errorEl = document.getElementById('chat-error');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const backBtn = document.getElementById('chat-back');

  let projects = [];
  let currentId = null;
  let timer = null;
  let lastSignature = '';

  function renderList() {
    if (!projects.length) {
      listEl.innerHTML = `<li class="garamond">You have not joined a project yet.
        <a href="/student/projects.html">Join one with a group code.</a></li>`;
      return;
    }
    listEl.innerHTML = projects
      .map(
        (p) => `<li>
          <button type="button" class="chat-list__item${String(p.id) === String(currentId) ? ' is-active' : ''}"
            data-project-id="${App.escapeHtml(String(p.id))}">${App.escapeHtml(p.title)}</button>
        </li>`
      )
      .join('');
  }

  async function loadMessages(forceScroll) {
    if (!currentId) return;
    const requestedId = currentId;
    try {
      const data = await App.api(`/api/chat/projects/${requestedId}/messages`);
      if (requestedId !== currentId) return; // user switched chats meanwhile
      const signature = data.messages.map((m) => m.id).join(',');
      if (signature === lastSignature) return;
      lastSignature = signature;
      const nearBottom =
        messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
      messagesEl.innerHTML = data.messages.length
        ? data.messages
            .map(
              (m) => `<div class="chat-msg${m.mine ? ' chat-msg--mine' : ''}">
                <div class="chat-msg__meta">
                  <strong>${App.escapeHtml(m.author_name)}${m.author_role === 'admin' ? ' · Teacher' : ''}</strong>
                  <span>${App.escapeHtml(App.formatDateTime(m.created_at))}</span>
                  ${m.mine ? `<button type="button" class="chat-msg__delete" data-delete-id="${App.escapeHtml(String(m.id))}">Delete</button>` : ''}
                </div>
                <p class="chat-msg__body">${App.escapeHtml(m.body)}</p>
              </div>`
            )
            .join('')
        : '<p class="empty-state garamond">No messages yet. Say hello.</p>';
      if (forceScroll || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
      App.showInlineError(errorEl, '');
    } catch (err) {
      App.showInlineError(errorEl, err.message);
    }
  }

  function stopPolling() {
    clearInterval(timer);
    timer = null;
  }

  function selectProject(id, updateUrl) {
    const project = projects.find((p) => String(p.id) === String(id));
    if (!project) return;
    currentId = project.id;
    lastSignature = '';
    titleEl.textContent = project.title;
    emptyEl.hidden = true;
    bodyEl.hidden = false;
    layout.classList.add('is-thread-open');
    messagesEl.innerHTML = '<p class="loading garamond">Loading…</p>';
    App.showInlineError(errorEl, '');
    renderList();
    if (updateUrl) {
      history.replaceState(null, '', `/student/chat.html?project=${encodeURIComponent(project.id)}`);
    }
    stopPolling();
    loadMessages(true);
    timer = setInterval(() => {
      if (!document.hidden) loadMessages(false);
    }, 5000);
    input.focus();
  }

  function closeThread() {
    currentId = null;
    stopPolling();
    bodyEl.hidden = true;
    emptyEl.hidden = false;
    layout.classList.remove('is-thread-open');
    history.replaceState(null, '', '/student/chat.html');
    renderList();
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-project-id]');
    if (btn) selectProject(btn.dataset.projectId, true);
  });

  backBtn.addEventListener('click', closeThread);

  messagesEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-delete-id]');
    if (!btn || !window.confirm('Delete this message?')) return;
    btn.disabled = true;
    try {
      await App.api(`/api/chat/messages/${btn.dataset.deleteId}`, { method: 'DELETE' });
      await loadMessages(false);
    } catch (err) {
      App.showInlineError(errorEl, err.message);
      btn.disabled = false;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body || !currentId) return;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    App.showInlineError(errorEl, '');
    try {
      await App.api(`/api/chat/projects/${currentId}/messages`, {
        method: 'POST',
        body: { body },
      });
      input.value = '';
      await loadMessages(true);
    } catch (err) {
      App.showInlineError(errorEl, err.message);
    } finally {
      btn.disabled = false;
      input.focus();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadMessages(false);
  });

  // Load the user's project groups, then open the one in ?project=ID if any
  try {
    const data = await App.api('/api/projects/my-memberships');
    projects = data.memberships || [];
    renderList();
    const wanted = new URLSearchParams(window.location.search).get('project');
    if (wanted && projects.some((p) => String(p.id) === wanted)) {
      selectProject(wanted, false);
    } else if (projects.length && window.matchMedia('(min-width: 900px)').matches) {
      selectProject(projects[0].id, false);
    }
  } catch (err) {
    listEl.innerHTML = `<li class="form-error">${App.escapeHtml(err.message)}</li>`;
  }
});
