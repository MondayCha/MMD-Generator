import type { MatchingMethodDetail } from '@services/type';
import type { Position2D } from 'deck.gl';
import type { RGBColor } from '@deck.gl/core/utils/color';
import type { Bounds, CoordinateDetail } from '@services/type';
import type {
  MisMatchedArea as WasmMisMatchedArea,
  SubTrajOwner,
} from '@wasm/pre-annotation/package';
import { assert } from 'console';

interface BoundInfo {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface BoundPolygon {
  vertexs: Position2D[];
  boundInfo: BoundInfo;
}

export function getMethodColor(name: string): RGBColor {
  switch (name) {
    case 'GHMapMatching':
      return [251, 189, 35];
    case 'SimpleMapMatching':
      return [244, 63, 94];
    case 'STMatching':
      return [77, 184, 72];
    default:
      return [127, 107, 215];
  }
}

export class OptionalTraj {
  id: number;
  index_key: number = -1;
  name: string;
  bounds: Bounds = [
    [180, 90],
    [-180, -90],
  ];
  color: RGBColor;
  owners: SubTrajOwner[];
  trajectory: Position2D[];
  constructor(id: number, name: string, owners: SubTrajOwner[], trajectory: Position2D[]) {
    this.id = id;
    this.name = name;
    this.owners = owners;
    this.trajectory = trajectory;
    this.color = getMethodColor(name);
    trajectory.forEach((p) => {
      this.bounds[0][0] = Math.min(this.bounds[0][0], p[0]);
      this.bounds[0][1] = Math.min(this.bounds[0][1], p[1]);
      this.bounds[1][0] = Math.max(this.bounds[1][0], p[0]);
      this.bounds[1][1] = Math.max(this.bounds[1][1], p[1]);
    });
  }
}

export const enum AreaState {
  Unchecked,
  Checked,
  Skipped,
}

export class MismatchedArea {
  id: number;
  bounds: Bounds = [
    [180, 90],
    [-180, -90],
  ];
  optionalTrajs: OptionalTraj[] = [];
  boundInfo: BoundInfo = {
    latitude: 0,
    longitude: 0,
    zoom: 0,
  };
  areaState: AreaState = AreaState.Unchecked;
  selectedTrajIndex: number = -1;

  constructor(id: number) {
    this.id = id;
  }

  addOption(option: OptionalTraj) {
    this.optionalTrajs.push(option);
    this.optionalTrajs.sort((a, b) => b.owners.length - a.owners.length);
    for (let i = 0; i < this.optionalTrajs.length; i += 1) {
      this.optionalTrajs[i].index_key = i + 1;
    }
    this.bounds[0][0] = Math.min(this.bounds[0][0], option.bounds[0][0]);
    this.bounds[0][1] = Math.min(this.bounds[0][1], option.bounds[0][1]);
    this.bounds[1][0] = Math.max(this.bounds[1][0], option.bounds[1][0]);
    this.bounds[1][1] = Math.max(this.bounds[1][1], option.bounds[1][1]);
  }

  getAreaBackground(): BoundPolygon[] {
    return [
      {
        vertexs: [
          [this.bounds[0][0], this.bounds[0][1]],
          [this.bounds[1][0], this.bounds[0][1]],
          [this.bounds[1][0], this.bounds[1][1]],
          [this.bounds[0][0], this.bounds[1][1]],
        ],
        boundInfo: this.boundInfo,
      },
    ];
  }

  setBoundsInfo(longitude: number, latitude: number, zoom: number) {
    this.boundInfo = {
      longitude: longitude,
      latitude: latitude,
      zoom: zoom,
    };
  }

  selectTraj(name?: string): OptionalTraj | null {
    const selectedTrajIndex = name
      ? this.optionalTrajs.findIndex((method) => method.name === name)
      : -1;
    this.selectedTrajIndex = selectedTrajIndex;
    if (selectedTrajIndex > -1) {
      this.areaState = AreaState.Checked;
      return this.optionalTrajs[selectedTrajIndex];
    } else {
      this.areaState = AreaState.Skipped;
      return null;
    }
  }

  getSelectedTraj(): OptionalTraj {
    // assert(this.selectedTrajIndex > -1);
    // assert(this.areaState === AreaState.Checked);
    return this.optionalTrajs[this.selectedTrajIndex];
  }
}

// Create a Map of id for MatchingMethodDetail
export function getMismatchedAreas(wasmMismatchedAreas: WasmMisMatchedArea[]): MismatchedArea[] {
  let mismatchedAreas: MismatchedArea[] = [];
  wasmMismatchedAreas.forEach((area) => {
    const unmatchedArea = new MismatchedArea(area.last_common_id);
    area.sub_trajs.forEach((subTraj) => {
      unmatchedArea.addOption(
        new OptionalTraj(
          area.last_common_id,
          subTraj.base_owner_type.toString(),
          subTraj.owners,
          subTraj.traj.map((p) => [p.longitude, p.latitude])
        )
      );
    });
    mismatchedAreas.push(unmatchedArea);
  });
  return mismatchedAreas;
}
