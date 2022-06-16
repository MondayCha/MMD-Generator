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
use std::collections::{HashMap, HashSet};
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

fn get_simplified_traj(raw_traj: &Vec<Coordinate>, threshold: f64) -> Vec<Coordinate> {
    if raw_traj.len() == 0 {
        return vec![];
    }
    let mut simplified_traj: Vec<Coordinate> = vec![raw_traj[0].clone()];
    let mut i = 0;
    let mut j = 1;
    while j + 1 < raw_traj.len() {
        // vector 1: (x1, y1) = j - i
        // vector 2: (x2, y2) = (j + 1) - i
        let x1 = raw_traj[j].longitude - raw_traj[i].longitude;
        let y1 = raw_traj[j].latitude - raw_traj[i].latitude;
        let x2 = raw_traj[j + 1].longitude - raw_traj[i].longitude;
        let y2 = raw_traj[j + 1].latitude - raw_traj[i].latitude;
        if (x1 * y2 - y1 * x2).abs() < threshold && x1 * x2 > 0.0 && y1 * y2 > 0.0 {
            // can be simplified
            if j + 1 == raw_traj.len() - 1 {
                simplified_traj.push(raw_traj[j + 1].clone());
            }
        } else {
            // cannot be simplified
            if j + 1 == raw_traj.len() - 1 {
                simplified_traj.push(raw_traj[j].clone());
                simplified_traj.push(raw_traj[j + 1].clone());
            } else {
                simplified_traj.push(raw_traj[j].clone());
                i = j;
            }
        }
        j += 1;
    }
    simplified_traj
}

#[test]
fn test_get_simplified_traj() {
    let node1 = Coordinate {
        longitude: 12.44574999315478,
        latitude: 52.70388691210494,
    };
    let node2 = Coordinate {
        longitude: 12.44582263021672,
        latitude: 52.70387212360696,
    };
    let node3 = Coordinate {
        longitude: 12.447169887583774,
        latitude: 52.703597829571315,
    };
    let node4 = Coordinate {
        longitude: 12.44574999315478,
        latitude: 52.70388691210494,
    };
    let a: Vec<Coordinate> = vec![node1, node2, node3, node4];
    let b = get_simplified_traj(&a, 1e-4);
    println!("{:?}", b);
    assert_eq!(b.len(), 3);
    assert_eq!(b[0], node1);
    assert_eq!(b[1], node3);
    assert_eq!(b[2], node4);
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
    id: usize,
    sub_traj: MergedSubTrajArray,
}

#[derive(Serialize, Deserialize)]
pub struct MisMatchedArea {
    id: usize,
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
    metric_u_turns_count: usize,
    metric_single_lcs_count: usize,
    metric_simplified_traj_count: usize,
}

#[derive(Serialize, Deserialize)]
struct SubAnnotator {
    method_type: AnnotatorType,
    traj: Vec<Coordinate>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AnnotatorConfig {
    pub auto_merge_circle: bool,
    pub simplify_threshold: f64,
    pub disabled_annotators: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct PreAnnotator {
    common_indexes: Vec<usize>,
    baseline_annotator_type: AnnotatorType,
    annotator_config: AnnotatorConfig,
    index_maps: HashMap<AnnotatorType, HashMap<usize, usize>>,
    sub_annotators: HashMap<AnnotatorType, SubAnnotator>,
    // unmerged_mismatched_all_trajs: Vec<Vec<SubTrajArray>>,
    // metrics
    metric_u_turns_count: usize,
    metric_single_lcs_count: usize,
    metric_simplified_traj_count: usize,
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
            metric_u_turns_count: 0,
            metric_single_lcs_count: 0,
            metric_simplified_traj_count: 0,
        }
    }

    fn generate_mismatched_area_from_sub_trajs(
        &mut self,
        id: usize,
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
        let threshold = self.annotator_config.simplify_threshold;
        let sim_method_trajs: Vec<Vec<Coordinate>> = matching_methods
            .iter()
            .map(|m| get_simplified_traj(&m.traj, threshold))
            .collect();

        let mut merged_sub_trajs: Vec<MergedSubTrajArray> = vec![];
        let mut method_union_find = UnionFind::new(&sub_annotators);
        let mut prematched_failed_annotator_types: HashSet<AnnotatorType> =
            HashSet::with_capacity(sub_annotators.len());

        for i in 0..matching_methods.len() {
            let i_traj = &matching_methods[i].traj;
            let i_sim_traj = &sim_method_trajs[i];
            for j in i + 1..matching_methods.len() {
                let j_traj = &matching_methods[j].traj;
                let j_sim_traj = &sim_method_trajs[j];
                // judge if the two trajs are the same
                let mut i_j_can_union = false;
                // choose which one to be union-find parent
                let mut father = j;
                let mut son = i;

                // check if i and j can be unioned directly
                let raw_lcs_table = LcsTable::new(&i_traj, &j_traj);
                let raw_lcs_len = raw_lcs_table.longest_common_subsequence().len();
                if i_traj.len() == raw_lcs_len || j_traj.len() == raw_lcs_len {
                    if (i_sim_traj.len() as f32 / j_sim_traj.len() as f32) < 4.1
                        && (j_sim_traj.len() as f32 / i_sim_traj.len() as f32) < 4.1
                    {
                        i_j_can_union = true;
                    }
                } else {
                    let sim_lcs_table = LcsTable::new(&i_sim_traj, &j_sim_traj);
                    let sim_lcs_len = sim_lcs_table.longest_common_subsequence().len();
                    if self.annotator_config.auto_merge_circle {
                        if i_sim_traj.len() == sim_lcs_len || j_sim_traj.len() == sim_lcs_len {
                            i_j_can_union = true;
                        }
                    } else {
                        if i_sim_traj.len() == j_sim_traj.len() && sim_lcs_len == i_sim_traj.len() {
                            i_j_can_union = true;
                        }
                    }
                }

                if i_j_can_union {
                    self.metric_simplified_traj_count += 1;
                    if i_traj.len() == raw_lcs_len {
                        father = i;
                        son = j;
                    }
                    if matching_methods[father].has_circle != matching_methods[son].has_circle {
                        if self.annotator_config.auto_merge_circle {
                            prematched_failed_annotator_types
                                .insert(matching_methods[son].owner.owner_type);
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

        self.metric_u_turns_count += prematched_failed_annotator_types.len();

        if merged_sub_trajs.len() > 1 {
            EitherMatchedArea::MisMatched(MisMatchedArea {
                id: id,
                sub_trajs: merged_sub_trajs,
            })
        } else if merged_sub_trajs.len() == 1 {
            EitherMatchedArea::PreMatched(PreMatchedArea {
                id: id,
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

    pub fn generate_matched_areas(&mut self) -> PreprocessAreas {
        let baseline_traj = &self.sub_annotators[&self.baseline_annotator_type].traj;
        let mut matched_areas: Vec<MatchedArea> = vec![];
        let mut matched_area_id = 1;

        let is_continuous = |last_index, current_index| {
            let config = &self.annotator_config;
            if config.auto_merge_circle {
                for index_map in self.index_maps.values() {
                    if index_map[&last_index] + 1 == index_map[&current_index] {
                        return true;
                    }
                }
                false
            } else {
                for index_map in self.index_maps.values() {
                    if index_map[&last_index] + 1 != index_map[&current_index] {
                        return false;
                    }
                }
                true
            }
        };

        if self.common_indexes.len() < 1 {
            return PreprocessAreas {
                matched_areas: matched_areas,
                prematched_areas: vec![],
                mismatched_areas: vec![],
                metric_u_turns_count: self.metric_u_turns_count,
                metric_single_lcs_count: self.metric_single_lcs_count,
                metric_simplified_traj_count: self.metric_simplified_traj_count,
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
                matched_area_id += 2;
            } else {
                self.metric_single_lcs_count += 1;
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
            mismatched_area_id = matched_area.id + (1 as usize);
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
            metric_u_turns_count: self.metric_u_turns_count,
            metric_single_lcs_count: self.metric_single_lcs_count,
            metric_simplified_traj_count: self.metric_simplified_traj_count,
        }
    }
}
