//! Rust Wasm Analyzer
//! @Author: MondayCha
//! @Date: 2022-04-30 21:27:51
mod annotator;
mod utils;

use annotator::{MethodResult, PreAnnotator};
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, analysis!");
    utils::set_panic_hook();
}

#[wasm_bindgen]
pub fn pre_annotate(val: &JsValue) -> JsValue {
    utils::set_panic_hook();
    let method_results: Vec<MethodResult> = val.into_serde().unwrap();
    if method_results.len() < 2 {
        return JsValue::null();
    }
    let mut annotator = PreAnnotator::new(&method_results[0]);
    for i in 1..method_results.len() {
        annotator.add_sub_annotator(&method_results[i]);
    }
    let result = annotator.generate_matched_areas();
    JsValue::from_serde(&result).unwrap()
}
