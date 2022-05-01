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
    start_index: usize,
    end_index: usize,
}

#[derive(Serialize, Deserialize)]
struct MergedSubTrajArray {
    owners: Vec<SubTrajOwner>,
    traj: Vec<Coordinate>,
}

#[derive(Serialize, Deserialize)]
struct SubTrajArray {
    owner: SubTrajOwner,
    traj: Vec<Coordinate>,
}

#[derive(Serialize, Deserialize)]
pub struct MatchedArea {
    id: usize,
    sub_traj: SubTrajArray,
}

#[derive(Serialize, Deserialize)]
pub struct MisMatchedArea {
    last_common_id: usize,
    sub_trajs: Vec<MergedSubTrajArray>,
}

#[derive(Serialize, Deserialize)]
pub struct PreprocessAreas {
    matched_areas: Vec<MatchedArea>,
    mis_matched_areas: Vec<MisMatchedArea>,
}

struct SubAnnotator {
    method_type: AnnotatorType,
    traj: Vec<Coordinate>,
}

pub struct PreAnnotator {
    common_indexes: Vec<usize>,
    // matched_areas: Vec<MatchedArea>,
    // mismatched_areas: Vec<MisMatchedArea>,
    baseline_annotator_type: AnnotatorType,
    index_maps: HashMap<AnnotatorType, HashMap<usize, usize>>,
    sub_annotators: HashMap<AnnotatorType, SubAnnotator>,
}

/// PreAnnotator is used to annotate the trajectory with the matched area.
impl PreAnnotator {
    /// Constructs a LcsTable for matching between two sequences `a` and `b`.
    pub fn new(baseline_method: &MethodResult) -> PreAnnotator {
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
            baseline_annotator_type: base_annotator_type,
            index_maps: index_maps,
            sub_annotators: sub_annotators,
        }
    }

    fn generate_mismatched_area_from_sub_trajs(
        last_common_id: usize,
        matching_methods: &Vec<SubTrajArray>,
    ) -> MisMatchedArea {
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
        for i in 0..matching_methods.len() {
            let method_i_type = matching_methods[i].owner.owner_type;
            let method_i_traj = &matching_methods[i].traj;
            for j in i + 1..matching_methods.len() {
                let method_j_type = matching_methods[j].owner.owner_type;
                let method_j_traj = &matching_methods[j].traj;
                let lcs_table = LcsTable::new(method_i_traj, method_j_traj);
                let lcs_traj = lcs_table.longest_common_subsequence();
                if lcs_traj.len() == method_i_traj.len() {
                    method_union_find.union(method_i_type, method_j_type);
                } else if lcs_traj.len() == method_j_traj.len() {
                    method_union_find.union(method_j_type, method_i_type);
                }
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
            };
            for sub_annotator in group {
                merged_sub_traj.owners.push(SubTrajOwner {
                    owner_type: sub_annotator,
                    start_index: sub_annotator_traj_map[&sub_annotator].owner.start_index,
                    end_index: sub_annotator_traj_map[&sub_annotator].owner.end_index,
                })
            }
            merged_sub_traj.traj = sub_annotator_traj_map[&parent_sub_annotator].traj.clone();
            merged_sub_trajs.push(merged_sub_traj);
        }

        MisMatchedArea {
            last_common_id: last_common_id,
            sub_trajs: merged_sub_trajs,
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
            for (_, node) in lcss_result.iter().enumerate() {
                if self.common_indexes.contains(&node.1 .0) {
                    new_common_indexes.push(node.1 .0);
                }
            }
            self.common_indexes = new_common_indexes;
        }
    }

    pub fn get_common_indexes(&self) -> &Vec<usize> {
        &self.common_indexes
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
                mis_matched_areas: vec![],
            };
        }

        let mut area_start = self.common_indexes[0];
        for i in 1..self.common_indexes.len() {
            let last_index = self.common_indexes[i - 1];
            let current_index = self.common_indexes[i];
            let is_end = i == self.common_indexes.len() - 1;
            if is_continuous(last_index, current_index) && !is_end {
                continue;
            }
            let area_end = if is_end { current_index } else { last_index };
            // do not add single-point common area
            if (area_end - area_start) > 1 {
                matched_areas.push(MatchedArea {
                    id: matched_area_id,
                    sub_traj: SubTrajArray {
                        owner: SubTrajOwner {
                            owner_type: self.baseline_annotator_type,
                            start_index: area_start,
                            end_index: area_end,
                        },
                        traj: baseline_traj[area_start..area_end].to_vec(),
                    },
                });
                matched_area_id += 1;
            }
            area_start = current_index;
        }

        // mismatched areas
        let mut mismatched_areas: Vec<MisMatchedArea> = vec![];
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
                    unmerged_mismatched_trajs.push(SubTrajArray {
                        owner: SubTrajOwner {
                            owner_type: sub_annotator_type,
                            start_index: current_start,
                            end_index: current_end,
                        },
                        traj: sub_annotator.traj[current_start..current_end].to_vec(),
                    });
                }
            }
            if unmerged_mismatched_trajs.len() > 0 {
                let mismatched_area = PreAnnotator::generate_mismatched_area_from_sub_trajs(
                    mismatched_area_id,
                    &unmerged_mismatched_trajs,
                );
                mismatched_areas.push(mismatched_area);
                mismatched_area_id += 1;
            }
            area_start = baseline_end;
        }

        let mut unmerged_mismatched_trajs: Vec<SubTrajArray> = vec![];
        for sub_annotator in self.sub_annotators.values() {
            let sub_annotator_type = sub_annotator.method_type;
            let index_map = &self.index_maps[&sub_annotator_type];
            let current_start = index_map[&area_start];
            let current_end = sub_annotator.traj.len() - 1;
            if current_end > current_start {
                unmerged_mismatched_trajs.push(SubTrajArray {
                    owner: SubTrajOwner {
                        owner_type: sub_annotator_type,
                        start_index: current_start,
                        end_index: current_end,
                    },
                    traj: sub_annotator.traj[current_start..current_end].to_vec(),
                });
            }
        }
        if unmerged_mismatched_trajs.len() > 0 {
            let mismatched_area = PreAnnotator::generate_mismatched_area_from_sub_trajs(
                mismatched_area_id,
                &unmerged_mismatched_trajs,
            );
            mismatched_areas.push(mismatched_area);
        }

        PreprocessAreas {
            matched_areas: matched_areas,
            mis_matched_areas: mismatched_areas,
        }
    }
}
