import JSZip from 'jszip';
import type { ZWorldManifest, WorldMapNode, WorldLink } from '../types/worldMap';

export interface LoadedWorldArchive {
  manifest: ZWorldManifest;
  mapBlobs: Map<string, Blob>; // mapId -> imageBlob
}

/**
 * 将多地图工程打包导出为 .zworld (ZIP) 存档文件
 */
export async function exportZWorldArchive(
  worldTitle: string,
  mapNodes: WorldMapNode[],
  links: WorldLink[]
): Promise<Blob> {
  const zip = new JSZip();
  const worldId = `world_${Date.now()}`;

  const manifest: ZWorldManifest = {
    version: '1.0',
    worldId,
    worldName: worldTitle || '未命名奇幻世界',
    createdAt: Date.now(),
    maps: mapNodes.map((n) => ({
      id: n.id,
      name: n.name,
      canvasPos: n.canvasPos,
      gridType: n.gridType,
      gridSize: n.gridSize,
      imgWidth: n.imgWidth,
      imgHeight: n.imgHeight,
      bgFileName: n.bgFileName || `bg_${n.id}.png`,
      walkableCells: n.walkableCells,
      portals: n.portals
    })),
    links
  };

  // 添加 manifest.json
  zip.file('world_manifest.json', JSON.stringify(manifest, null, 2));

  // 添加每张地图的背景图片 Blob
  for (const node of mapNodes) {
    if (node.bgImageBlob) {
      const fileName = node.bgFileName || `bg_${node.id}.png`;
      zip.file(fileName, node.bgImageBlob);
    }
  }

  // 打包解压缩
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/x-zip-compressed',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return zipBlob;
}

/**
 * 解包 .zworld 或 .zip 文件，解压得到 manifest 与各地图的 Image Blobs
 */
export async function importZWorldArchive(file: File): Promise<LoadedWorldArchive> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const manifestFile = loadedZip.file('world_manifest.json');
  if (!manifestFile) {
    throw new Error('格式错误：解压包中未找到 world_manifest.json 文件！');
  }

  const manifestStr = await manifestFile.async('string');
  const manifest: ZWorldManifest = JSON.parse(manifestStr);

  const mapBlobs = new Map<string, Blob>();

  for (const m of manifest.maps) {
    const bgFileName = m.bgFileName || `bg_${m.id}.png`;
    const imgZipFile = loadedZip.file(bgFileName);
    if (imgZipFile) {
      const arrBuf = await imgZipFile.async('arraybuffer');
      const blob = new Blob([arrBuf], { type: 'image/png' });
      mapBlobs.set(m.id, blob);
    }
  }

  return {
    manifest,
    mapBlobs
  };
}
