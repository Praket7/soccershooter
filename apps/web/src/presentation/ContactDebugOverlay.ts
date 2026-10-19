import * as THREE from 'three';
import type { FootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';

export class ContactDebugOverlay {
  readonly group: THREE.Group;
  readonly footMarker: THREE.Mesh;
  readonly labelGroup: THREE.Group;
  #enabled = false;
  #plan: Readonly<FootballContactPlan> | null = null;
  #tick = 0;
  #line: THREE.Line;

  get enabled(): boolean { return this.#enabled; }

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'stage05r-contact-ghost';
    this.group.visible = false;

    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x8de0a4, wireframe: true });
    this.footMarker = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), markerMaterial);
    this.footMarker.name = 'stage05r-contact-foot-marker';
    this.group.add(this.footMarker);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe6c45e, transparent: true, opacity: 0.8 });
    this.#line = new THREE.Line(new THREE.BufferGeometry(), lineMaterial);
    this.#line.name = 'stage05r-contact-vector';
    this.group.add(this.#line);

    this.labelGroup = new THREE.Group();
    this.labelGroup.name = 'stage05r-contact-label';
    this.group.add(this.labelGroup);
    scene.add(this.group);
  }

  get label(): string {
    if (!this.#plan) return 'NO CONTACT PLAN';
    const remaining = this.#plan.contactTick - this.#tick;
    const status = Math.abs(remaining) <= this.#plan.timingWindowTicks
      ? 'CONTACT'
      : remaining > 0
        ? `${remaining} TICKS`
        : 'MISSED';
    return `${this.#plan.foot.toUpperCase()} · ${this.#plan.surface.toUpperCase()} · ${status}`;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.#syncVisibility();
  }

  update(plan: Readonly<FootballContactPlan> | null, simulationTick: number): void {
    this.#plan = plan;
    this.#tick = simulationTick;
    if (!plan) {
      this.#syncVisibility();
      return;
    }

    this.footMarker.position.set(
      plan.expectedFootPoint.x,
      plan.expectedFootPoint.y,
      plan.expectedFootPoint.z,
    );
    const start = new THREE.Vector3(plan.expectedFootPoint.x, plan.expectedFootPoint.y, plan.expectedFootPoint.z);
    const end = new THREE.Vector3(plan.expectedBallPoint.x, plan.expectedBallPoint.y, plan.expectedBallPoint.z);
    this.#line.geometry.setFromPoints([start, end]);
    const material = this.footMarker.material as THREE.MeshBasicMaterial;
    material.color.set(simulationTick > plan.contactTick + plan.timingWindowTicks ? 0xf46b6b : 0x8de0a4);
    this.#syncVisibility();
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
  }

  #syncVisibility(): void {
    this.group.visible = this.#enabled && this.#plan !== null;
  }
}
