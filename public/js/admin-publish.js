document.addEventListener('DOMContentLoaded', async () => {
  const user = await App.requireSession('admin');
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = user.name;
  });

  const form = document.getElementById('news-form');
  const errorEl = document.getElementById('news-error');
  const successEl = document.getElementById('news-success');
  const imagesInput = document.getElementById('images');
  const previewEl = document.getElementById('image-preview');
  let compressedPayload = [];

  imagesInput.addEventListener('change', async () => {
    previewEl.hidden = true;
    previewEl.innerHTML = '';
    compressedPayload = [];
    const files = imagesInput.files;
    if (!files?.length) return;

    try {
      compressedPayload = await ImageCompress.compressImageFiles(files);
      previewEl.innerHTML = compressedPayload
        .map(
          (img, i) =>
            `<img src="${img.dataUrl}" alt="Preview ${i + 1}" width="96" height="96" loading="lazy" />`
        )
        .join('');
      previewEl.hidden = false;
    } catch (err) {
      App.showInlineError(errorEl, err.message);
      imagesInput.value = '';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.showInlineError(errorEl, '');
    successEl.hidden = true;
    const title = form.title.value.trim();
    const body = form.body.value.trim();
    if (!title || !body) {
      App.showInlineError(errorEl, 'Headline and body are required.');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (imagesInput.files?.length && !compressedPayload.length) {
        compressedPayload = await ImageCompress.compressImageFiles(imagesInput.files);
      }
      await App.api('/api/news', {
        method: 'POST',
        body: {
          title,
          body,
          images: compressedPayload.map((img) => img.dataUrl),
        },
      });
      form.reset();
      compressedPayload = [];
      previewEl.hidden = true;
      previewEl.innerHTML = '';
      successEl.textContent = 'Published. It is live on the student news board.';
      successEl.hidden = false;
    } catch (err) {
      App.showInlineError(errorEl, err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
