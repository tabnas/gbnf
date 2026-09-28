// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

// Performance regression guard.
//
// Every check here is machine-INDEPENDENT: each compares two ways of
// doing the same work on the SAME machine in the SAME run, so a slow or
// busy box cannot make it flaky. There is deliberately NO absolute
// wall-clock budget.
//
// The last check is the fleet's rule on repetition, held here on a long
// input in GBNF's own notation (`../../AGENTS.md`, "Repetition is
// replacement, never a push chain"): the shared compiler emits every
// `*`, `+` and `{m,}` as a same-depth replace loop, so ten thousand
// items reach the rule depth one item does and cost linear time. Until
// tabnas/bnf#80 the compiler spelled it as a push chain, and this port
// parsed a repetition in time quadratic in the input length
// (`DIVERGENCE.md` 3, closed).

mod common;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

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
/// comparison below to be about compiling.
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

/// The deepest rule a parse ran, read from the engine's rule events.
fn deepest_rule(parser: &mut Tabnas, input: &str) -> usize {
    let deepest = Arc::new(AtomicUsize::new(0));
    let seen = deepest.clone();
    parser.subscribe_rule_done(move |rule, _context, _done| {
        seen.fetch_max(rule.d, Ordering::Relaxed);
    });
    assert!(parser.parse(input).is_ok(), "{input:.40?} parses");
    deepest.load(Ordering::Relaxed)
}

/// The cost of one parse of `input`, as the fastest of five batches each
/// run to at least 50 ms. Contention only ever slows a batch, so the
/// fastest is the nearest to the real cost, and one slowed batch of the
/// short input cannot shrink a ratio the way a single slowed round could.
fn per_parse(parser: &Tabnas, input: &str) -> f64 {
    let mut best = f64::INFINITY;
    for _ in 0..5 {
        let started = Instant::now();
        let mut runs = 0u32;
        loop {
            assert!(parser.parse(input).is_ok());
            runs += 1;
            if started.elapsed() >= Duration::from_millis(50) {
                break;
            }
        }
        best = best.min(started.elapsed().as_secs_f64() / f64::from(runs));
    }
    best
}

/// Every repetition GBNF can write, over ten thousand items: the deepest
/// rule is the deepest over the fewest items that run one full iteration
/// of every loop in the grammar (`few`: a `+` and a `{2,}` reach their
/// loop only past their first items), and four times the input costs
/// about four times the work. Depth is judged first, because it needs no
/// clock: a loop that still pushed per item would fail here however fast
/// it ran. Time is a ratio within one run, never a budget.
#[test]
fn a_repetition_adds_no_rule_depth_and_parses_in_linear_time() {
    // A grammar, what it repeats, the fewest items that run one full
    // iteration of every loop in it, and the input for n items.
    type Case = (&'static str, &'static str, usize, fn(usize) -> String);
    let cases: [Case; 5] = [
        ("root ::= [a-z]+", "a class", 2, |n| "a".repeat(n)),
        ("root ::= item*\nitem ::= [a-z] \" \"", "a rule", 1, |n| {
            "a ".repeat(n)
        }),
        (
            "root ::= item ( \",\" item )*\nitem ::= [a-z]+",
            "a group with a separator",
            2,
            |n| vec!["ab"; n].join(","),
        ),
        (
            "root ::= row*\nrow ::= \"[\" cell* \"]\"\ncell ::= [a-z]",
            "a repetition inside the item",
            1,
            |n| "[abc]".repeat(n),
        ),
        ("root ::= [a-z]{2,}", "an open count", 3, |n| "a".repeat(n)),
    ];
    for (grammar, what, few, make) in cases {
        let mut probe = compile(grammar);
        let one = deepest_rule(&mut probe, &make(few));
        let many = deepest_rule(&mut probe, &make(10_000));
        assert_eq!(
            many, one,
            "{what}: ten thousand items reach rule depth {many} where {few} reach \
             {one}; the loop's iterations must add no depth"
        );

        let parser = compile(grammar);
        let small = per_parse(&parser, &make(250));
        let large = per_parse(&parser, &make(1_000));
        let ratio = large / small;
        assert!(
            ratio < 8.0,
            "{what}: four times the input cost {ratio:.1} times the work ({small:.5}s \
             against {large:.5}s per parse); linear would be about four"
        );
    }
}
