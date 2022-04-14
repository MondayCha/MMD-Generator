import type { MatchingMethodDetail, SubTrajectoryDetail, CoordinateDetail } from '@services/type';
import type { Position2D } from 'deck.gl';

/**
 * @param {Array} bounds - [[lon, lat], [lon, lat]]
 */
type Bounds = [[number, number], [number, number]];

function getMethodColor(name: string) {
  switch (name) {
    case 'GHMapMatching':
      return '#ffe800';
    case 'SimpleMapMatching':
      return '#ed1c24';
    case 'STMatching':
      return '#4db848 ';
    case 'RawTraj':
      return '#a855f7';
    default:
      return '#22c55e';
  }
}

export class UnmatchedMethod {
  id: number;
  name: string;
  bounds: Bounds;
  color: string;
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
  constructor(id: number) {
    this.id = id;
    this.bounds = [
      [180, 90],
      [-180, -90],
    ];
    this.unmatchedMethods = [];
  }

  addMethod(method: UnmatchedMethod) {
    this.unmatchedMethods.push(method);
    this.bounds[0][0] = Math.min(this.bounds[0][0], method.bounds[0][0]);
    this.bounds[0][1] = Math.min(this.bounds[0][1], method.bounds[0][1]);
    this.bounds[1][0] = Math.max(this.bounds[1][0], method.bounds[1][0]);
    this.bounds[1][1] = Math.max(this.bounds[1][1], method.bounds[1][1]);
  }
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
