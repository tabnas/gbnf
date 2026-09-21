// Copyright (c) 2026 Richard Rodger and other contributors, MIT License

//! The `gbnf-check` command. The implementation is
//! `tabnas_gbnf::cli::run`, which takes its streams as arguments so the
//! tests can drive it in process; this is the launcher, the port of the
//! `require.main === module` block at the foot of `ts/src/cli.ts`.

fn main() {
    // Arguments AFTER the program name, as `process.argv.slice(2)` gives
    // the canonical command.
    let argv: Vec<String> = std::env::args().skip(1).collect();

    let code = tabnas_gbnf::cli::run(
        &argv,
        &mut std::io::stdin().lock(),
        &mut std::io::stdout().lock(),
        &mut std::io::stderr().lock(),
    );
    std::process::exit(code);
}
