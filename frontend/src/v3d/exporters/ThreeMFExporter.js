import * as THREE from 'three';
import JSZip from 'jszip';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(6)).toString();
}

function colorToDisplayColor(material) {
  const mat = Array.isArray(material) ? material[0] : material;
  const color = mat?.color instanceof THREE.Color ? mat.color : new THREE.Color(0xffffff);
  const opacity = mat?.transparent ? Math.max(0, Math.min(1, mat.opacity ?? 1)) : 1;
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  const a = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`.toUpperCase();
}

function collectMeshes(root) {
  const meshes = [];
  if (!root) return meshes;
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry?.attributes?.position) {
      meshes.push(child);
    }
  });
  return meshes;
}

function geometryToXml(mesh, objectId, materialId) {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);

  const position = geometry.attributes.position;
  const index = geometry.index;
  const vertexLines = [];
  const triangleLines = [];

  for (let i = 0; i < position.count; i++) {
    vertexLines.push(
      `<vertex x="${formatNumber(position.getX(i))}" y="${formatNumber(position.getY(i))}" z="${formatNumber(position.getZ(i))}"/>`
    );
  }

  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      triangleLines.push(
        `<triangle v1="${index.getX(i)}" v2="${index.getX(i + 1)}" v3="${index.getX(i + 2)}"/>`
      );
    }
  } else {
    for (let i = 0; i + 2 < position.count; i += 3) {
      triangleLines.push(
        `<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`
      );
    }
  }

  geometry.dispose();

  return [
    `<object id="${objectId}" type="model" pid="${materialId}" pindex="0" name="${escapeXml(mesh.name || `mesh-${objectId}`)}">`,
    '<mesh>',
    '<vertices>',
    vertexLines.join(''),
    '</vertices>',
    '<triangles>',
    triangleLines.join(''),
    '</triangles>',
    '</mesh>',
    '</object>',
  ].join('');
}

export class ThreeMFExporter {
  async parse(object, options = {}) {
    const zip = new JSZip();
    const modelXml = this.createModelXml(object, options);

    zip.file('[Content_Types].xml', this.createContentTypesXml());
    zip.folder('_rels').file('.rels', this.createRelsXml());
    zip.folder('3D').file('3dmodel.model', modelXml);

    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  createModelXml(object) {
    const meshes = collectMeshes(object);
    let nextObjectId = 1;
    let nextMaterialId = 1000;
    const resources = [];
    const buildItems = [];

    for (const mesh of meshes) {
      const objectId = nextObjectId++;
      const materialId = nextMaterialId++;
      const displayColor = colorToDisplayColor(mesh.material);

      resources.push(
        `<basematerials id="${materialId}"><base name="${escapeXml(mesh.material?.name || 'material')}" displaycolor="${displayColor}"/></basematerials>`
      );
      resources.push(geometryToXml(mesh, objectId, materialId));
      buildItems.push(`<item objectid="${objectId}"/>`);
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
      '<metadata name="Application">VSQR</metadata>',
      '<resources>',
      resources.join(''),
      '</resources>',
      '<build>',
      buildItems.join(''),
      '</build>',
      '</model>',
    ].join('');
  }

  createContentTypesXml() {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
      '</Types>',
    ].join('');
  }

  createRelsXml() {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>',
      '</Relationships>',
    ].join('');
  }
}
