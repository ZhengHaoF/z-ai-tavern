import JSZip from 'jszip';
import type { ZMapManifest } from '../types/gridMap';

/**
 * Packs a ZMap manifest and background image Blob into a .zmap (ZIP) archive Blob.
 */
export async function exportZMapArchive(
  manifest: ZMapManifest,
  imageBlob: Blob
): Promise<Blob> {
  const zip = new JSZip();

  // Add manifest.json
  const manifestStr = JSON.stringify(manifest, null, 2);
  zip.file('manifest.json', manifestStr);

  // Add background image (e.g. background.png)
  const bgFileName = manifest.bgImageFile || 'background.png';
  zip.file(bgFileName, imageBlob);

  // Generate zip archive as Blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/x-zip-compressed',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return zipBlob;
}

/**
 * Unpacks a .zmap or .zip file and extracts manifest and background image Blob.
 */
export async function importZMapArchive(
  file: File
): Promise<{ manifest: ZMapManifest; imageBlob: Blob }> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // Parse manifest.json
  const manifestFile = loadedZip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('未在关卡包中找到 manifest.json 配置文件！');
  }

  const manifestStr = await manifestFile.async('string');
  const manifest: ZMapManifest = JSON.parse(manifestStr);

  // Find background image file
  const bgFileName = manifest.bgImageFile || 'background.png';
  let bgImgZipFile = loadedZip.file(bgFileName);

  // Fallback: search for any image in zip if specified filename is not found
  if (!bgImgZipFile) {
    const files = Object.keys(loadedZip.files);
    const imgName = files.find(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f));
    if (imgName) {
      bgImgZipFile = loadedZip.file(imgName);
    }
  }

  if (!bgImgZipFile) {
    throw new Error('未在关卡包中找到地图背景图片！');
  }

  const imageArrayBuffer = await bgImgZipFile.async('arraybuffer');
  const imageBlob = new Blob([imageArrayBuffer], { type: 'image/png' });

  return {
    manifest,
    imageBlob
  };
}
