//! Union Find data structure.
use std::cmp::Eq;
use std::collections::HashMap;
use std::hash::Hash;

pub struct UnionFind<T> {
    parent_map: HashMap<T, T>,
}

impl<T> UnionFind<T>
where
    T: Copy + Clone + Eq + PartialEq + Hash,
{
    pub fn new(nodes: &Vec<T>) -> UnionFind<T> {
        let mut parent_map = HashMap::new();
        for node in nodes.iter() {
            parent_map.insert(node.clone(), node.clone());
        }
        UnionFind {
            parent_map: parent_map,
        }
    }

    pub fn union(&mut self, i: T, j: T) {
        let i_parent = self.find(i);
        let j_parent = self.find(j);
        self.parent_map.insert(j_parent, i_parent);
    }

    pub fn find(&mut self, i: T) -> T {
        let mut p = i;
        while self.parent_map[&p] != p {
            p = self.parent_map[&p];
        }
        let mut s = i;
        while s != p {
            let t = self.parent_map[&s];
            self.parent_map.insert(s, p);
            s = t;
        }
        p
    }
}
