//! This crate provides utilities around [least common subsequences][wiki]. From a least common
//! subsequences table, you can also calculate diffs (see `LcsTable::diff`).
//!
//! Usage of this crate is centered around `LcsTable`, so most interesting documentation can be
//! found there.
//!
//! [wiki]: https://en.wikipedia.org/wiki/Longest_common_subsequence_problem

mod lcs;
mod union_find;

use lcs::LcsTable;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::vec::Vec;
use union_find::UnionFind;

#[derive(Copy, Clone, Debug, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct Coordinate {
    pub longitude: f64,
    pub latitude: f64,
}

impl Eq for Coordinate {}

#[derive(Serialize, Deserialize)]
pub struct MethodResult {
    pub method_name: String,
    pub trajectory: Vec<Coordinate>,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AnnotatorType {
    Annotator, // not map-matching method
    STMatching,
    SimpleMapMatching,
    GHMapMatching,
}

fn get_annotator_type(method_name: &str) -> AnnotatorType {
    match method_name {
        "STMatching" => AnnotatorType::STMatching,
        "SimpleMapMatching" => AnnotatorType::SimpleMapMatching,
        "GHMapMatching" => AnnotatorType::GHMapMatching,
        _ => AnnotatorType::Annotator,
    }
}

#[derive(Serialize, Deserialize)]
struct SubTrajOwner {
    owner_type: AnnotatorType,
    has_error: bool,
    start_index: usize,
    end_index: usize,
}

#[derive(Serialize, Deserialize)]
struct MergedSubTrajArray {
    owners: Vec<SubTrajOwner>,
    base_owner_type: AnnotatorType,
    traj: Vec<Coordinate>,
}

#[derive(Serialize, Deserialize)]
struct SubTrajArray {
    owner: SubTrajOwner,
    traj: Vec<Coordinate>,
    has_circle: bool,
}

impl SubTrajArray {
    pub fn new(owner: SubTrajOwner, traj: Vec<Coordinate>) -> Self {
        let mut has_circle = false;
        for i in 0..traj.len() {
            for j in i + 1..traj.len() {
                if &traj[i] == &traj[j] {
                    has_circle = true;
                    break;
                }
            }
        }
        SubTrajArray {
            owner: owner,
            traj: traj,
            has_circle: has_circle,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct MatchedArea {
    id: usize,
    sub_traj: SubTrajArray,
}

#[derive(Serialize, Deserialize)]
pub struct PreMatchedArea {
    last_common_id: usize,
    sub_traj: MergedSubTrajArray,
}

#[derive(Serialize, Deserialize)]
pub struct MisMatchedArea {
    last_common_id: usize,
    sub_trajs: Vec<MergedSubTrajArray>,
}

enum EitherMatchedArea {
    PreMatched(PreMatchedArea),
    MisMatched(MisMatchedArea),
    None,
}

#[derive(Serialize, Deserialize)]
pub struct PreprocessAreas {
    matched_areas: Vec<MatchedArea>,
    prematched_areas: Vec<PreMatchedArea>,
    mismatched_areas: Vec<MisMatchedArea>,
}

#[derive(Serialize, Deserialize)]
struct SubAnnotator {
    method_type: AnnotatorType,
    traj: Vec<Coordinate>,
}

#[derive(Copy, Clone, Serialize, Deserialize)]
pub struct AnnotatorConfig {
    pub auto_merge_circle: bool,
}

#[derive(Serialize, Deserialize)]
pub struct PreAnnotator {
    common_indexes: Vec<usize>,
    baseline_annotator_type: AnnotatorType,
    annotator_config: AnnotatorConfig,
    index_maps: HashMap<AnnotatorType, HashMap<usize, usize>>,
    sub_annotators: HashMap<AnnotatorType, SubAnnotator>,
    // unmerged_mismatched_all_trajs: Vec<Vec<SubTrajArray>>,
}

/// PreAnnotator is used to annotate the trajectory with the matched area.
impl PreAnnotator {
    /// Constructs a LcsTable for matching between two sequences `a` and `b`.
    pub fn new(baseline_method: &MethodResult, config: AnnotatorConfig) -> Self {
        let base_annotator_type = get_annotator_type(&baseline_method.method_name);
        let mut index_maps: HashMap<AnnotatorType, HashMap<usize, usize>> = HashMap::new();
        let mut sub_annotators: HashMap<AnnotatorType, SubAnnotator> = HashMap::new();

        let base_index_map: HashMap<usize, usize> = (0..baseline_method.trajectory.len())
            .map(|i| (i, i))
            .into_iter()
            .collect();
        index_maps.insert(base_annotator_type, base_index_map);
        sub_annotators.insert(
            base_annotator_type,
            SubAnnotator {
                method_type: base_annotator_type,
                traj: baseline_method.trajectory.clone(),
            },
        );

        PreAnnotator {
            common_indexes: vec![],
            annotator_config: config,
            baseline_annotator_type: base_annotator_type,
            index_maps: index_maps,
            sub_annotators: sub_annotators,
            // unmerged_mismatched_all_trajs: vec![],
        }
    }

    fn generate_mismatched_area_from_sub_trajs(
        &self,
        last_common_id: usize,
        matching_methods: &Vec<SubTrajArray>,
    ) -> EitherMatchedArea {
        let sub_annotators: Vec<AnnotatorType> = matching_methods
            .iter()
            .map(|m| m.owner.owner_type)
            .collect();
        let sub_annotator_traj_map: HashMap<AnnotatorType, &SubTrajArray> = matching_methods
            .into_iter()
            .map(|m| (m.owner.owner_type, m))
            .collect();
        let mut merged_sub_trajs: Vec<MergedSubTrajArray> = vec![];
        let mut method_union_find = UnionFind::new(&sub_annotators);
        let mut prematched_failed_annotator_types: Vec<AnnotatorType> = vec![];
        for i in 0..matching_methods.len() {
            let i_traj = &matching_methods[i].traj;
            for j in i + 1..matching_methods.len() {
                let j_traj = &matching_methods[j].traj;
                let lcs_table = LcsTable::new(&matching_methods[i].traj, &matching_methods[j].traj);
                let lcs_traj = lcs_table.longest_common_subsequence();

                let can_union = i_traj.len() == lcs_traj.len() || lcs_traj.len() == j_traj.len();
                if !can_union {
                    continue;
                }

                let mut father = j;
                let mut son = i;
                if lcs_traj.len() == i_traj.len() {
                    father = i;
                    son = j;
                }

                if matching_methods[father].has_circle != matching_methods[son].has_circle {
                    if self.annotator_config.auto_merge_circle {
                        prematched_failed_annotator_types
                            .push(matching_methods[son].owner.owner_type);
                    } else {
                        continue;
                    }
                }

                method_union_find.union(
                    matching_methods[father].owner.owner_type,
                    matching_methods[son].owner.owner_type,
                );
            }
        }

        let mut merged_group_map: HashMap<AnnotatorType, Vec<AnnotatorType>> = HashMap::new();
        for sub_annotator in sub_annotators {
            let parent_sub_annotator = method_union_find.find(sub_annotator);
            let group = if merged_group_map.contains_key(&parent_sub_annotator) {
                let mut tmp_group = merged_group_map[&parent_sub_annotator].clone();
                tmp_group.push(sub_annotator);
                tmp_group
            } else {
                vec![sub_annotator]
            };
            merged_group_map.insert(parent_sub_annotator, group);
        }

        for (parent_sub_annotator, group) in merged_group_map {
            let mut merged_sub_traj = MergedSubTrajArray {
                owners: vec![],
                traj: vec![],
                base_owner_type: parent_sub_annotator,
            };
            for sub_annotator in group {
                merged_sub_traj.owners.push(SubTrajOwner {
                    owner_type: sub_annotator,
                    has_error: prematched_failed_annotator_types.contains(&sub_annotator),
                    start_index: sub_annotator_traj_map[&sub_annotator].owner.start_index,
                    end_index: sub_annotator_traj_map[&sub_annotator].owner.end_index,
                })
            }
            merged_sub_traj.traj = sub_annotator_traj_map[&parent_sub_annotator].traj.clone();
            merged_sub_trajs.push(merged_sub_traj);
        }

        if merged_sub_trajs.len() > 1 {
            EitherMatchedArea::MisMatched(MisMatchedArea {
                last_common_id: last_common_id,
                sub_trajs: merged_sub_trajs,
            })
        } else if merged_sub_trajs.len() == 1 {
            EitherMatchedArea::PreMatched(PreMatchedArea {
                last_common_id: last_common_id,
                sub_traj: merged_sub_trajs.pop().unwrap(),
            })
        } else {
            EitherMatchedArea::None
        }
    }

    pub fn add_sub_annotator(&mut self, matching_method: &MethodResult) {
        let annotator_type = get_annotator_type(&matching_method.method_name);
        self.sub_annotators.insert(
            annotator_type,
            SubAnnotator {
                method_type: annotator_type,
                traj: matching_method.trajectory.clone(),
            },
        );
        // Run Longest Common Subsequence algorithm to find the common indexes between the two
        // trajectories.
        let lcss_table = LcsTable::new(
            &self.sub_annotators[&self.baseline_annotator_type].traj,
            &matching_method.trajectory,
        );
        let lcss_result = lcss_table.longest_common_subsequence();
        self.index_maps.insert(
            annotator_type,
            lcss_result.iter().map(|n| n.1).into_iter().collect(),
        );
        if self.common_indexes.len() == 0 {
            self.common_indexes = lcss_result.iter().map(|node| node.1 .0).collect();
        } else {
            let mut new_common_indexes = vec![];
            for node in lcss_result.iter() {
                if self.common_indexes.contains(&node.1 .0) {
                    new_common_indexes.push(node.1 .0);
                }
            }
            self.common_indexes = new_common_indexes;
        }
    }

    pub fn generate_matched_areas(&self) -> PreprocessAreas {
        let baseline_traj = &self.sub_annotators[&self.baseline_annotator_type].traj;
        let mut matched_areas: Vec<MatchedArea> = vec![];
        let mut matched_area_id = 1;

        let is_continuous = |last_index, current_index| {
            for index_map in self.index_maps.values() {
                if index_map[&last_index] + 1 == index_map[&current_index] {
                    return true;
                }
            }
            false
        };

        if self.common_indexes.len() < 1 {
            return PreprocessAreas {
                matched_areas: matched_areas,
                prematched_areas: vec![],
                mismatched_areas: vec![],
            };
        }

        let mut area_start = self.common_indexes[0];
        for i in 1..self.common_indexes.len() {
            let last_index = self.common_indexes[i - 1];
            let current_index = self.common_indexes[i];
            let is_now_continuous = is_continuous(last_index, current_index);
            let is_end = i == self.common_indexes.len() - 1;
            if !is_end && is_now_continuous {
                continue;
            }
            let area_end = if is_end && is_now_continuous {
                current_index
            } else {
                last_index
            };
            // do not add single-point common area
            if (area_end - area_start) > 0 {
                matched_areas.push(MatchedArea {
                    id: matched_area_id,
                    sub_traj: SubTrajArray {
                        owner: SubTrajOwner {
                            owner_type: self.baseline_annotator_type,
                            has_error: false,
                            start_index: area_start,
                            end_index: area_end,
                        },
                        traj: baseline_traj[area_start..area_end + 1].to_vec(),
                        has_circle: false,
                    },
                });
                matched_area_id += 1;
            }
            area_start = current_index;
        }

        // mismatched areas
        let mut mismatched_areas: Vec<MisMatchedArea> = vec![];
        let mut prematched_areas: Vec<PreMatchedArea> = vec![];
        // let mut unmerged_mismatched_all_trajs: Vec<Vec<SubTrajArray>> = vec![];
        let mut mismatched_area_id = 0;
        area_start = 0;
        for matched_area in matched_areas.iter() {
            let baseline_start = matched_area.sub_traj.owner.start_index;
            let baseline_end = matched_area.sub_traj.owner.end_index;
            let mut unmerged_mismatched_trajs: Vec<SubTrajArray> = vec![];
            for sub_annotator in self.sub_annotators.values() {
                let sub_annotator_type = sub_annotator.method_type;
                let index_map = &self.index_maps[&sub_annotator_type];
                let current_start = if area_start == 0 {
                    0
                } else {
                    index_map[&area_start]
                };
                let current_end = index_map[&baseline_start];
                if current_end > current_start {
                    unmerged_mismatched_trajs.push(SubTrajArray::new(
                        SubTrajOwner {
                            owner_type: sub_annotator_type,
                            has_error: false,
                            start_index: current_start,
                            end_index: current_end,
                        },
                        sub_annotator.traj[current_start..current_end + 1].to_vec(),
                    ));
                }
            }
            if unmerged_mismatched_trajs.len() > 0 {
                let mismatched_area = self.generate_mismatched_area_from_sub_trajs(
                    mismatched_area_id,
                    &unmerged_mismatched_trajs,
                );
                match mismatched_area {
                    EitherMatchedArea::MisMatched(area) => mismatched_areas.push(area),
                    EitherMatchedArea::PreMatched(area) => prematched_areas.push(area),
                    EitherMatchedArea::None => (),
                }
                // unmerged_mismatched_all_trajs.push(unmerged_mismatched_trajs);
            }
            area_start = baseline_end;
            mismatched_area_id = matched_area.id;
        }

        let mut unmerged_mismatched_trajs: Vec<SubTrajArray> = vec![];
        for sub_annotator in self.sub_annotators.values() {
            let sub_annotator_type = sub_annotator.method_type;
            let index_map = &self.index_maps[&sub_annotator_type];
            let current_start = index_map[&area_start];
            let current_end = sub_annotator.traj.len() - 1;
            if current_end > current_start {
                unmerged_mismatched_trajs.push(SubTrajArray::new(
                    SubTrajOwner {
                        owner_type: sub_annotator_type,
                        has_error: false,
                        start_index: current_start,
                        end_index: current_end,
                    },
                    sub_annotator.traj[current_start..current_end + 1].to_vec(),
                ));
            }
        }
        if unmerged_mismatched_trajs.len() > 0 {
            let mismatched_area = self.generate_mismatched_area_from_sub_trajs(
                mismatched_area_id,
                &unmerged_mismatched_trajs,
            );
            match mismatched_area {
                EitherMatchedArea::MisMatched(area) => mismatched_areas.push(area),
                EitherMatchedArea::PreMatched(area) => prematched_areas.push(area),
                EitherMatchedArea::None => (),
            }
            // unmerged_mismatched_all_trajs.push(unmerged_mismatched_trajs);
        }

        // self.unmerged_mismatched_all_trajs = unmerged_mismatched_all_trajs;

        PreprocessAreas {
            matched_areas: matched_areas,
            prematched_areas: prematched_areas,
            mismatched_areas: mismatched_areas,
        }
    }
}
