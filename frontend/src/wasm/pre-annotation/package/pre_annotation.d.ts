/**
*/
export function greet(): void;

export interface Coordinate {
    longitude: number;
    latitude: number;
}

export interface MethodResult {
    method_name: string;
    trajectory: Coordinate[];
}

export type AnnotatorType = 'STMatching' | 'SimpleMapMatching' | 'GHMapMatching' | 'Annotator';

export interface SubTrajOwner {
    owner_type: AnnotatorType;
    has_error: boolean;
    start_index: number;
    end_index: number;
}

export interface MergedSubTrajArray {
    owners: SubTrajOwner[];
    base_owner_type: AnnotatorType;
    traj: Coordinate[];
}

export interface SubTrajArray {
    owner: SubTrajOwner;
    traj: Coordinate[];
    has_circle: boolean;
}

export interface MatchedArea {
    id: number;
    sub_traj: SubTrajArray;
}

export interface PreMatchedArea {
    last_common_id: number;
    sub_traj: SubTrajArray;
}

export interface MisMatchedArea {
    last_common_id: number;
    sub_trajs: MergedSubTrajArray[];
}

export interface PreprocessAreas {
    matched_areas: MatchedArea[];
    prematched_areas: PreMatchedArea[];
    mismatched_areas: MisMatchedArea[];
}

/**
* @param {MethodResult[]} val
* @param {boolean} auto_merge_circle
* @returns {PreprocessAreas}
*/
export function pre_annotate(val: MethodResult[], auto_merge_circle: boolean): PreprocessAreas;
