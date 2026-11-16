document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await App.api('/api/auth/me');
    if (!data.user) {
      App.navigateWithFade('/login.html');
      return;
    }
    if (data.user.signupStatus === 'approved') {
      App.navigateWithFade(
        data.user.role === 'admin' ? '/admin/dashboard.html' : '/student/news.html'
      );
    }
  } catch (_) {
    /* stay on this page */
  }
});
