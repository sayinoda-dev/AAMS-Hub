document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('admin');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  try {
    const stats = await App.api('/api/admin/stats');
    document.querySelectorAll('[data-count-up]').forEach((el, i) => {
      const vals = [stats.pendingIdeas, stats.newsCount, stats.projectCount];
      el.setAttribute('data-count-up', String(vals[i] ?? 0));
    });
    Animations.initCountUp();
    Animations.initReveal();
  } catch (err) {
    console.error(err);
  }
});
