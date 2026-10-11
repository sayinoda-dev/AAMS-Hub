/**
 * Client-side image compression to WebP (fallback) under maxBytes using canvas.
 */
async function compressImageFile(file, maxBytes = 300 * 1024) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Choose image files only.');
  }

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const maxDim = 1920;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  while (blob.size > maxBytes && quality > 0.35) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, 'image/webp', quality);
  }

  if (blob.size > maxBytes) {
    const scale = Math.sqrt(maxBytes / blob.size) * 0.92;
    canvas.width = Math.max(320, Math.round(width * scale));
    canvas.height = Math.max(240, Math.round(height * scale));
    ctx.drawImage(await createImageBitmap(file), 0, 0, canvas.width, canvas.height);
    quality = 0.75;
    blob = await canvasToBlob(canvas, 'image/webp', quality);
    while (blob.size > maxBytes && quality > 0.3) {
      quality -= 0.07;
      blob = await canvasToBlob(canvas, 'image/webp', quality);
    }
  }

  if (blob.size > maxBytes) {
    throw new Error(`Could not compress ${file.name} under 300KB. Try a smaller photo.`);
  }

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, mime: 'image/webp', size: blob.size };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression failed.'))),
      type,
      quality
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read compressed image.'));
    reader.readAsDataURL(blob);
  });
}

async function compressImageFiles(fileList, maxBytes = 300 * 1024) {
  const files = Array.from(fileList || []);
  const out = [];
  for (const file of files) {
    out.push(await compressImageFile(file, maxBytes));
  }
  return out;
}

window.ImageCompress = { compressImageFile, compressImageFiles };
