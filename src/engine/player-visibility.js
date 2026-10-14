import * as THREE from 'three';

// Render a depth-tested silhouette after scenery, then the real player above
// its visible parts. This avoids tinting self-occluded hair, eyes and limbs.
export class PlayerVisibility {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'player-behind-cover';
    scene.add(this.group);
    this.material = new THREE.MeshBasicMaterial({
      color: '#ffd36a',
      depthFunc: THREE.GreaterDepth, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      toneMapped: false,
    });
    this.source = null;
    this.pairs = [];
  }

  update(source) {
    if (source !== this.source) {
      for (const [node, , order] of this.pairs) node.renderOrder = order;
      this.group.clear();
      this.pairs = [];
      this.source = source;
      source?.traverse(node => {
        if (!node.isMesh) return;
        const mesh = new THREE.Mesh(node.geometry, this.material);
        mesh.matrixAutoUpdate = false;
        mesh.renderOrder = 10000;
        this.group.add(mesh);
        this.pairs.push([node, mesh, node.renderOrder]);
        node.renderOrder = 10001;
      });
    }
    this.group.visible = !!source?.visible;
    if (!this.group.visible) return;
    source.updateWorldMatrix(true, true);
    for (const [node, mesh] of this.pairs) {
      mesh.matrix.copy(node.matrixWorld);
      mesh.visible = node.visible;
    }
  }

  dispose() {
    for (const [node, , order] of this.pairs) node.renderOrder = order;
    this.group.removeFromParent();
    this.group.clear();
    this.pairs = [];
    this.source = null;
    this.material.dispose();
  }
}
