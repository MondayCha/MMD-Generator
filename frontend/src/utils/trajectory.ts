import type { MatchingMethodDetail } from '@services/type';
import type { Position2D } from 'deck.gl';
import type { RGBColor } from '@deck.gl/core/utils/color';
import type { Bounds } from '@services/type';

interface BoundInfo {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface BoundPolygon {
  vertexs: Position2D[];
  boundInfo: BoundInfo;
}

function getMethodColor(name: string): RGBColor {
  switch (name) {
    case 'GHMapMatching':
      return [255, 232, 0];
    case 'SimpleMapMatching':
      return [237, 28, 36];
    case 'STMatching':
      return [77, 184, 72];
    default:
      return [0, 0, 0];
  }
}

export class UnmatchedMethod {
  id: number;
  name: string;
  bounds: Bounds;
  color: RGBColor;
  trajectory: Position2D[];
  constructor(id: number, name: string, trajectory: Position2D[]) {
    this.id = id;
    this.name = name;
    this.bounds = [
      [180, 90],
      [-180, -90],
    ];
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

export class UnmatchedArea {
  id: number;
  bounds: Bounds;
  unmatchedMethods: UnmatchedMethod[];
  boundInfo: BoundInfo;
  constructor(id: number) {
    this.id = id;
    this.bounds = [
      [180, 90],
      [-180, -90],
    ];
    this.unmatchedMethods = [];
    this.boundInfo = {
      latitude: 0,
      longitude: 0,
      zoom: 0,
    };
  }

  addMethod(method: UnmatchedMethod) {
    this.unmatchedMethods.push(method);
    this.bounds[0][0] = Math.min(this.bounds[0][0], method.bounds[0][0]);
    this.bounds[0][1] = Math.min(this.bounds[0][1], method.bounds[0][1]);
    this.bounds[1][0] = Math.max(this.bounds[1][0], method.bounds[1][0]);
    this.bounds[1][1] = Math.max(this.bounds[1][1], method.bounds[1][1]);
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

  // getGeoJsonCircle() {
  //   const center = [
  //     (this.bounds[0][0] + this.bounds[1][0]) / 2,
  //     (this.bounds[0][1] + this.bounds[1][1]) / 2,
  //   ];
  //   const radius = Math.sqrt(
  //     Math.pow(Math.abs(this.bounds[0][0] - this.bounds[1][0]), 2) +
  //       Math.pow(Math.abs(this.bounds[0][1] - this.bounds[1][1]), 2)
  //   );
  //   return {
  //     name: `UnmatchedAreaBound-${this.id}`,
  //     type: 'FeatureCollection',
  //     features: [
  //       {
  //         type: 'Feature',
  //         geometry: {
  //           type: 'Point',
  //           coordinates: center,
  //         },
  //         properties: {
  //           radius,
  //         },
  //       },
  //     ],
  //   };
  // }
}

// Create a Map of id for MatchingMethodDetail
export function getUnmatchedAreas(matchingMethods: MatchingMethodDetail[]): UnmatchedArea[] {
  let unmatchedAreas: Map<number, UnmatchedArea> = new Map();
  matchingMethods.forEach((method) => {
    method.unmatched_trajs.forEach((traj) => {
      let unmatchedArea = unmatchedAreas.get(traj.id);
      if (!unmatchedArea) {
        unmatchedArea = new UnmatchedArea(traj.id);
        unmatchedAreas.set(traj.id, unmatchedArea);
      }
      unmatchedArea.addMethod(
        new UnmatchedMethod(
          traj.id,
          method.name,
          traj.trajectory.map((p) => [p.longitude, p.latitude])
        )
      );
    });
  });
  return Array.from(unmatchedAreas.values());
}
