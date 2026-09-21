// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// Performance regression guard.
//
// Every check here is machine-INDEPENDENT: each compares two ways of
// doing the same work on the SAME machine in the SAME run, so a slow or
// busy box cannot make it flaky. There is deliberately NO absolute
// wall-clock budget.
//
// The one absolute cost this crate has is recorded elsewhere, because it
// is not this crate's: a repetition parses in time quadratic in the
// input length here, which `DIVERGENCE.md` 3 measures against the other
// two runtimes and `tests/divergence_test.rs` pins.

mod common;

use std::time::Instant;

use tabnas::Tabnas;
use tabnas_gbnf::{gbnf, parse_gbnf};

use common::compile;

/// A grammar with enough shape to cost something: a repetition, a group,
/// an option, a character class and several productions.
const PERF_GRAMMAR: &str = concat!(
    "root  ::= \"[\" item ( \",\" item )* \"]\"\n",
    "item  ::= word | num | root\n",
    "word  ::= [a-z]+\n",
    "num   ::= \"-\"? [0-9]+\n"
);

/// Small on purpose. The parse has to stay the CHEAP half for the
/// comparison below to be about compiling, and a repetition costs time
/// quadratic in the input length here (`../DIVERGENCE.md` 3), so a long
/// sample would drown the thing being measured.
const PERF_INPUT: &str = "[ab,-3]";

/// How many repetitions each half of a comparison does. Small enough
/// that `cargo test` on the unoptimised profile stays quick, large
/// enough to average out scheduler noise.
const PERF_N: u32 = 20;

/// Compile ONCE and parse many, which is what the documentation
/// recommends for bulk work. Recompiling per document is the
/// anti-pattern, and it has to stay dramatically more expensive, or the
/// advice is wrong.
#[test]
fn compile_once_parse_many() {
    let parser = compile(PERF_GRAMMAR);

    // Warm both paths, and check the parse result en route.
    for _ in 0..3 {
        parser.parse(PERF_INPUT).expect("parses");
        let mut fresh = Tabnas::new();
        gbnf(&mut fresh, PERF_GRAMMAR, None).expect("compiles");
    }

    let started = Instant::now();
    for _ in 0..PERF_N {
        parser.parse(PERF_INPUT).expect("parses");
    }
    let reuse = started.elapsed().as_secs_f64().max(1e-9);

    let started = Instant::now();
    for _ in 0..PERF_N {
        let mut fresh = Tabnas::new();
        gbnf(&mut fresh, PERF_GRAMMAR, None).expect("compiles");
        fresh.parse(PERF_INPUT).expect("parses");
    }
    let rebuild = started.elapsed().as_secs_f64();

    assert!(
        reuse * 4.0 < rebuild,
        "reusing a compiled grammar ({reuse:.4}s for {PERF_N}) should be far cheaper than \
         recompiling per document ({rebuild:.4}s); compiling is the expensive half and the \
         documentation says so"
    );
}

/// The meta-parser that reads GBNF is built once and shared, so the
/// hundredth compile costs what the tenth did. A per-call rebuild, or
/// state accumulating on the shared instance, would show up as a second
/// half slower than the first.
#[test]
fn repeated_compiles_do_not_accumulate() {
    for _ in 0..3 {
        parse_gbnf(PERF_GRAMMAR).expect("parses");
    }

    let started = Instant::now();
    for _ in 0..PERF_N {
        parse_gbnf(PERF_GRAMMAR).expect("parses");
    }
    let first = started.elapsed().as_secs_f64().max(1e-6);

    let started = Instant::now();
    for _ in 0..PERF_N {
        parse_gbnf(PERF_GRAMMAR).expect("parses");
    }
    let second = started.elapsed().as_secs_f64();

    assert!(
        second < first * 3.0,
        "the second batch of {PERF_N} compiles took {second:.4}s against the first's \
         {first:.4}s; repeated compiles must not get slower"
    );
}

/// The shared meta-parser is used from several threads at once.
///
/// `Tabnas` parses through `&self` and is `Send + Sync`, and this crate
/// keeps one cached instance for every caller, so per-parse state has to
/// live on the rules and the context. Anything kept on the shared
/// instance would show up here as a wrong answer rather than as a
/// compile failure.
///
/// The terminal decoders are the sharp edge: their diagnostics travel
/// out of a rule action through a THREAD LOCAL, so a source that fails to
/// decode must not leak its complaint into another thread's parse.
#[test]
fn the_shared_meta_parser_is_used_from_several_threads() {
    let sources = [
        "root ::= \"x\" b\nb ::= [a-z]+",
        "root ::= ( \"p\" | \"q\" )* \"end\"",
        "root ::= \"\\q\"",
        "root ::= [z-a]",
        "root ::= \"ok\"",
    ];
    let handles: Vec<_> = (0..16)
        .map(|index| {
            let src = sources[index % sources.len()].to_string();
            std::thread::spawn(move || {
                let answer = parse_gbnf(&src);
                (src.clone(), answer.is_ok())
            })
        })
        .collect();
    for handle in handles {
        let (src, ok) = handle.join().expect("the thread finished");
        let should = !src.contains("\\q") && !src.contains("[z-a]");
        assert_eq!(ok, should, "{src:?} answered differently on its own thread");
    }
}

/// A decoder failure on one parse must not survive into the next one on
/// the same thread. The diagnostic is recorded in a thread local, and a
/// slot left full would refuse the next grammar for a reason that
/// belongs to the last one.
#[test]
fn a_decoder_failure_does_not_leak_into_the_next_parse() {
    for _ in 0..3 {
        assert!(parse_gbnf(r#"root ::= "\q""#).is_err());
        assert!(
            parse_gbnf("root ::= \"ok\"").is_ok(),
            "the next parse inherited the last one's complaint"
        );
    }
}
