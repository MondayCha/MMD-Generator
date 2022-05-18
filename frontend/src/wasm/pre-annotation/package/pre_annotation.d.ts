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
    traj: Coordinate[];
    owners: SubTrajOwner[];
    base_owner_type: AnnotatorType;
}

export interface SubTrajArray {
    traj: Coordinate[];
    owner: SubTrajOwner;
    has_circle: boolean;
}

export interface MatchedArea {
    id: number;
    sub_traj: SubTrajArray;
}

export interface PreMatchedArea {
    id: number;
    sub_traj: MergedSubTrajArray;
}

export interface MisMatchedArea {
    id: number;
    sub_trajs: MergedSubTrajArray[];
}

export interface PreprocessAreas {
    matched_areas: MatchedArea[];
    prematched_areas: PreMatchedArea[];
    mismatched_areas: MisMatchedArea[];
}

export interface PreAnnotationConfig {
    auto_merge_circle: boolean;
    simplify_threshold: number;
    disabled_annotators: AnnotatorType[];
}

/**
* @param {MethodResult[]} val
* @param {boolean} auto_merge_circle
* @returns {PreprocessAreas}
*/
export function pre_annotate(val: MethodResult[], config: PreAnnotationConfig): PreprocessAreas;
