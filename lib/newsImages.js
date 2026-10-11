const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'news');
const ALLOWED_MIME = new Set(['image/webp', 'image/avif']);
const MAX_BYTES = 300 * 1024;
const MAX_IMAGES = 8;

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/(?:webp|avif));base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) return null;
  let buf;
  try {
    buf = Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { mime, buf };
}

async function saveNewsImages(newsId, images, client) {
  if (!Array.isArray(images) || !images.length) return [];
  ensureUploadDir();
  const saved = [];
  const slice = images.slice(0, MAX_IMAGES);
  for (let i = 0; i < slice.length; i++) {
    const parsed = parseDataUrl(slice[i]);
    if (!parsed) continue;
    const ext = parsed.mime === 'image/avif' ? 'avif' : 'webp';
    const filename = `${newsId}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, parsed.buf);
    const publicPath = `/uploads/news/${filename}`;
    await client.query(
      `INSERT INTO news_images (news_id, file_path, mime_type, sort_order) VALUES ($1, $2, $3, $4)`,
      [newsId, publicPath, parsed.mime, i]
    );
    saved.push(publicPath);
  }
  return saved;
}

function deleteNewsImageFiles(filePaths) {
  for (const fp of filePaths) {
    if (!fp || !fp.startsWith('/uploads/news/')) continue;
    const full = path.join(__dirname, '..', 'public', fp);
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
      console.error('delete image file:', err.message);
    }
  }
}

module.exports = { saveNewsImages, deleteNewsImageFiles, MAX_IMAGES, MAX_BYTES };
