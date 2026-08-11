import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ZMapManifest } from '../types/gridMap';
import type { ZWorldManifest, WorldMapNode, WorldLink } from '../types/worldMap';
import type { CharacterEntity } from '../types/character';
import { importZMapArchive } from '../engine/zmapArchive';
import { importZWorldArchive } from '../engine/zworldArchive';

export const useMapStore = defineStore('mapStore', () => {
  const manifest = ref<ZMapManifest | null>(null);
  const bgImageUrl = ref<string | null>(null);
  const isLoaded = ref<boolean>(false);

  // ZWorld 多关卡支持
  const worldManifest = ref<ZWorldManifest | null>(null);
  const mapBlobs = ref<Map<string, Blob>>(new Map());
  const activeMapId = ref<string | null>(null);

  // 玩家人物状态
  const playerCharacter = ref<CharacterEntity>({
    id: 'player-hero',
    name: '战术冒险者',
    gridPos: { qOrX: 0, rOrY: 0 },
    facing: 'down'
  });

  /**
   * 载入并解析 .zworld 世界多关卡包，或自动降级解析 .zmap
   */
  async function loadZMapArchive(file: File) {
    try {
      if (file.name.endsWith('.zworld') || file.name.endsWith('.zip')) {
        try {
          const { manifest: loadedWorld, mapBlobs: loadedBlobs } = await importZWorldArchive(file);
          worldManifest.value = loadedWorld;
          mapBlobs.value = loadedBlobs;

          if (loadedWorld.maps.length > 0) {
            await switchWorldMap(loadedWorld.maps[0].id);
          }
          isLoaded.value = true;
          return true;
        } catch {
          // 降级为单图 .zmap 解析
        }
      }

      // 单图经典关卡文件
      const { manifest: loadedManifest, imageBlob } = await importZMapArchive(file);

      if (bgImageUrl.value) {
        URL.revokeObjectURL(bgImageUrl.value);
      }

      manifest.value = loadedManifest;
      bgImageUrl.value = URL.createObjectURL(imageBlob);
      isLoaded.value = true;

      if (loadedManifest.walkableCells && loadedManifest.walkableCells.length > 0) {
        const [firstKey] = loadedManifest.walkableCells;
        const [c, r] = firstKey.split(',').map(Number);
        playerCharacter.value.gridPos = { qOrX: c, rOrY: r };
      }

      return true;
    } catch (err) {
      console.error('加载关卡文件失败:', err);
      throw err;
    }
  }

  /**
   * 切换 ZWorld 当前加载的子地图节点
   */
  async function switchWorldMap(mapId: string, spawnGridPos?: { qOrX: number; rOrY: number }) {
    if (!worldManifest.value) return;

    const targetNode = worldManifest.value.maps.find((m) => m.id === mapId);
    if (!targetNode) return;

    activeMapId.value = mapId;
    const blob = mapBlobs.value.get(mapId);

    if (bgImageUrl.value) {
      URL.revokeObjectURL(bgImageUrl.value);
    }

    bgImageUrl.value = blob ? URL.createObjectURL(blob) : null;

    manifest.value = {
      version: '1.0',
      mapId: targetNode.id,
      mapName: targetNode.name,
      createdAt: Date.now(),
      gridSize: targetNode.gridSize,
      cols: Math.ceil(targetNode.imgWidth / targetNode.gridSize),
      rows: Math.ceil(targetNode.imgHeight / targetNode.gridSize),
      bgImageFile: targetNode.bgFileName,
      walkableCells: targetNode.walkableCells
    };

    // 确定出生位置
    if (spawnGridPos) {
      playerCharacter.value.gridPos = spawnGridPos;
    } else if (targetNode.walkableCells.length > 0) {
      const [firstKey] = targetNode.walkableCells;
      const [c, r] = firstKey.split(',').map(Number);
      playerCharacter.value.gridPos = { qOrX: c, rOrY: r };
    }
  }

  /**
   * 检查玩家踏入当前格后，是否触发链接自动传送跳转
   */
  function checkPortalTrigger(col: number, row: number) {
    if (!worldManifest.value || !activeMapId.value) return;

    const currentMap = worldManifest.value.maps.find((m) => m.id === activeMapId.value);
    if (!currentMap) return;

    const currentKey = `${col},${row}`;
    const triggeredPortal = currentMap.portals.find((p) => p.gridKeys.includes(currentKey));

    if (!triggeredPortal) return;

    // 查找拓扑关系连线
    const link = worldManifest.value.links.find(
      (l) =>
        (l.fromMapId === activeMapId.value && l.fromPortalId === triggeredPortal.id) ||
        (l.isBidirectional && l.toMapId === activeMapId.value && l.toPortalId === triggeredPortal.id)
    );

    if (!link) return;

    const targetMapId = link.fromMapId === activeMapId.value ? link.toMapId : link.fromMapId;
    const targetPortalId = link.fromPortalId === triggeredPortal.id ? link.toPortalId : link.fromPortalId;

    const targetMapNode = worldManifest.value.maps.find((m) => m.id === targetMapId);
    if (!targetMapNode) return;

    const targetPortal = targetMapNode.portals.find((p) => p.id === targetPortalId);
    let targetPos = { qOrX: 0, rOrY: 0 };

    if (targetPortal && targetPortal.gridKeys.length > 0) {
      const [tc, tr] = targetPortal.gridKeys[0].split(',').map(Number);
      targetPos = { qOrX: tc, rOrY: tr };
    }

    // 触发跨场景跳转传送
    switchWorldMap(targetMapId, targetPos);
  }

  /**
   * 更新玩家物理网格坐标，并检查传送触发
   */
  function setPlayerGridPos(colOrQ: number, rowOrR: number) {
    playerCharacter.value.gridPos = { qOrX: colOrQ, rOrY: rowOrR };
    checkPortalTrigger(colOrQ, rowOrR);
  }

  return {
    manifest,
    bgImageUrl,
    isLoaded,
    worldManifest,
    activeMapId,
    playerCharacter,
    loadZMapArchive,
    switchWorldMap,
    setPlayerGridPos
  };
});
