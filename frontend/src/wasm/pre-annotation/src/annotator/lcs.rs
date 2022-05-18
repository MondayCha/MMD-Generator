//! This crate provides utilities around [least common subsequences][wiki]. From a least common
//! subsequences table, you can also calculate diffs (see `LcsTable::diff`).
//!
//! Usage of this crate is centered around `LcsTable`, so most interesting documentation can be
//! found there.
//!
//! [wiki]: https://en.wikipedia.org/wiki/Longest_common_subsequence_problem

#![allow(dead_code)]
#![allow(unused_variables)]

use std::cmp;

#[derive(Debug)]
pub struct LcsTable<'a, T: 'a> {
    lengths: Vec<Vec<i64>>,

    a: &'a [T],
    b: &'a [T],
}

#[derive(Debug, PartialEq, Eq)]
pub enum DiffComponent<T> {
    Insertion(T),
    Unchanged(T, T),
    Deletion(T),
}

/// Finding longest common subsequences ("LCS") between two sequences requires constructing a *n x
/// m* table (where the two sequences are of lengths *n* and *m*). This is expensive to construct
/// and there's a lot of stuff you can calculate using it, so `LcsTable` holds onto this data.
impl<'a, T> LcsTable<'a, T>
where
    T: Eq,
{
    /// Constructs a LcsTable for matching between two sequences `a` and `b`.
    pub fn new(a: &'a [T], b: &'a [T]) -> LcsTable<'a, T> {
        let mut lengths = vec![vec![0; b.len() + 1]; a.len() + 1];

        for i in 0..a.len() {
            for j in 0..b.len() {
                lengths[i + 1][j + 1] = if a[i] == b[j] {
                    1 + lengths[i][j]
                } else {
                    cmp::max(lengths[i + 1][j], lengths[i][j + 1])
                }
            }
        }

        LcsTable {
            lengths: lengths,
            a: a,
            b: b,
        }
    }

    /// Gets the longest common subsequence between `a` and `b`. Returned elements are in the form
    /// `(elem_a, elem_b)`, where `elem_a` is a reference to an element in `a`, `elem_b` is a
    /// reference to an element in `b`, and `elem_a == elem_b`.
    ///
    /// Example:
    ///
    /// ```
    /// use lcs::LcsTable;
    ///
    /// let a: Vec<_> = "a--b---c".chars().collect();
    /// let b: Vec<_> = "abc".chars().collect();
    ///
    /// let table = LcsTable::new(&a, &b);
    /// let lcs = table.longest_common_subsequence();
    ///
    /// assert_eq!(vec![(&'a', &'a'), (&'b', &'b'), (&'c', &'c')], lcs);
    /// ```
    pub fn longest_common_subsequence(&self) -> Vec<(&T, (usize, usize))> {
        self.find_lcs(self.a.len(), self.b.len())
    }

    fn find_lcs(&self, i: usize, j: usize) -> Vec<(&T, (usize, usize))> {
        if i == 0 || j == 0 {
            return vec![];
        }

        if self.a[i - 1] == self.b[j - 1] {
            let mut prefix_lcs = self.find_lcs(i - 1, j - 1);
            prefix_lcs.push((&self.a[i - 1], (i - 1, j - 1)));
            prefix_lcs
        } else {
            if self.lengths[i][j - 1] > self.lengths[i - 1][j] {
                self.find_lcs(i, j - 1)
            } else {
                self.find_lcs(i - 1, j)
            }
        }
    }
}

#[test]
fn test_lcs_table() {
    // Example taken from:
    //
    // https://en.wikipedia.org/wiki/Longest_common_subsequence_problem#Worked_example

    let a: Vec<_> = "gac".chars().collect();
    let b: Vec<_> = "agcat".chars().collect();

    let actual_lengths = LcsTable::new(&a, &b).lengths;
    let expected_lengths = vec![
        vec![0, 0, 0, 0, 0, 0],
        vec![0, 0, 1, 1, 1, 1],
        vec![0, 1, 1, 1, 2, 2],
        vec![0, 1, 1, 2, 2, 2],
    ];

    assert_eq!(expected_lengths, actual_lengths);
}
