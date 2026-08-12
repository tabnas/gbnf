"""The Python binding, graded against the repo's own corpus.

Run after building the library:

    cd go/clib && ./build.sh
    cd ../../py && python3 -m unittest -v

These are conformance tests, not smoke tests. The grammars under
test/corpus are the SAME files the TypeScript and Go suites grade, and
the samples are the same samples, so a disagreement here is a
disagreement between runtimes rather than a binding bug — which is the
property that makes a third language trustworthy at all.
"""

import json
import os
import unittest

import gbnf

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(os.path.dirname(HERE), "test", "corpus")

# Mirrors corpusAccept / corpusReject in go/gbnf_test.go and
# ts/test/corpus.test.js — read off each grammar, graded both ways.
ACCEPT = {
    "arithmetic": ["a+b=c\n", "x=y\n"],
    "c": ["int f(){return x;}", "int intx(){intx = 3;}"],
    "chess": ["1. e4 e5\n2. Nxe4 e5\n"],
    "english": ["Hello, world!", "a b c"],
    "japanese": ["こんにちは"],
    "json": ['{"answer": [1, 2, 3]}', '{"a": "\\n"}'],
    "json_arr": ["[\n1,\n2\n]"],
    "list": ["- a\n"],
}

REJECT = {
    "arithmetic": ["a=b", "a=b+c\n"],
    "c": ["int x=1;\n", "int x = 1;\n"],
    "chess": ["1. e4\n"],
    "english": ["hello world\n", "Hello world.\n"],
    "japanese": ["hello"],
    "json": ['{"a":1,}'],
    "json_arr": ["[\n1, 2\n]"],
    "list": ["-a\n"],
}


def grammar(name):
    return gbnf.Grammar.from_file(os.path.join(CORPUS, name + ".gbnf"))


def compile_corpus(name, **kw):
    with open(os.path.join(CORPUS, name + ".gbnf"), "rb") as f:
        return gbnf.compile_spec(f.read(), **kw)


def import_engine_binding(case):
    """Import tabnas, the ENGINE's Python binding, from a sibling
    tabnas/parser checkout.

    Set ``TABNAS_PY`` to point at it directly when the repos are not
    laid out as siblings — otherwise the cross-library test skips, and a
    silent skip on the one test that proves two shared libraries
    interoperate is worse than no test at all.
    """
    import sys

    repo_root = os.path.dirname(HERE)
    candidates = [
        os.environ.get("TABNAS_PY"),
        os.path.join(repo_root, "..", "parser", "py"),
        os.path.join(repo_root, "..", "..", "parser", "py"),
    ]
    for c in candidates:
        if c and os.path.exists(os.path.join(c, "tabnas.py")):
            sys.path.insert(0, c)
            try:
                import tabnas
                return tabnas
            except Exception as e:  # pragma: no cover
                case.skipTest(f"engine binding at {c} unusable: {e}")
    case.skipTest(
        "engine binding not found; set TABNAS_PY to tabnas/parser's py/ "
        "directory to run the cross-library check")


class TestSurface(unittest.TestCase):
    def test_version(self):
        v = gbnf.version()
        self.assertRegex(v["gbnf"], r"^\d+\.\d+\.\d+")
        self.assertRegex(v["engine"], r"^\d+\.\d+\.\d+")

    def test_rejection_is_an_answer_not_an_exception(self):
        with grammar("json") as g:
            v = g.check("{oops")
            self.assertFalse(v.accept)
            self.assertFalse(v)  # Verdict is falsy when rejected
            self.assertIn("message", v.error)
            self.assertNotIn("\n", v.error["message"])
            self.assertNotIn("\x1b", v.error["message"])

    def test_a_broken_grammar_raises_rather_than_rejecting(self):
        # The distinction that stops a tool blaming a model's output for
        # a grammar's mistake.
        for src in ("root ::= [", "root ::= nosuchrule", "other ::= \"a\""):
            with self.assertRaises(gbnf.GbnfError):
                gbnf.Grammar(src)

    def test_closed_grammar_raises(self):
        g = grammar("list")
        g.close()
        with self.assertRaises(gbnf.GbnfError):
            g.check("- a\n")

    def test_bytes_input_is_not_truncated_at_nul(self):
        # The bug an FFI binding gets for free if it passes C strings.
        with grammar("list") as g:
            self.assertFalse(g.accepts(b"- a\n\x00trailing"))

    def test_unicode_round_trips(self):
        with grammar("japanese") as g:
            self.assertTrue(g.accepts("こんにちは"))

    def test_explicit_path_is_remembered(self):
        # The documented load(path=...) then Grammar(src) sequence. If
        # only auto-discovered libraries were cached, the second call
        # would go back to discovery and fail for anyone whose library
        # is not on the default search path.
        lib = gbnf._default_lib_path()
        gbnf._lib = None
        try:
            gbnf.load(lib)
            with grammar("list") as g:
                self.assertTrue(g.accepts("- a\n"))
        finally:
            gbnf._lib = None

    def test_context_manager_and_reuse(self):
        with grammar("list") as g:
            for _ in range(3):
                self.assertTrue(g.accepts("- a\n"))
                self.assertFalse(g.accepts("-a\n"))


class TestCompileSpec(unittest.TestCase):
    """compile here, validate anywhere."""

    def test_emits_a_loadable_spec(self):
        spec = compile_corpus("list")
        self.assertIn("rule", spec)
        self.assertIn("options", spec)

    def test_as_text_round_trips(self):
        text = compile_corpus("list", as_text=True)
        self.assertIsInstance(text, str)
        self.assertEqual(json.loads(text), compile_corpus("list"))

    def test_a_broken_grammar_raises_and_yields_no_spec(self):
        for src in ("root ::= [", "root ::= nosuchrule", ""):
            with self.assertRaises(gbnf.GbnfError):
                gbnf.compile_spec(src)

    def test_compiled_spec_runs_on_the_bare_engine(self):
        """The whole point, end to end and across two libraries.

        A grammar compiled by libtabnasgbnf, then loaded and run by
        libtabnas with no GBNF front-end present — which is exactly what
        a caller in another language would do. Needs the engine's own
        Python binding, from the sibling tabnas/parser checkout.
        """
        tabnas = import_engine_binding(self)

        checked = 0
        for name in ACCEPT:
            spec = compile_corpus(name, as_text=True)
            with tabnas.Grammar(spec) as g:
                for s in ACCEPT[name]:
                    self.assertTrue(
                        g.accepts(s),
                        f"{name}: compiled spec rejected {s!r}, which is in "
                        f"its language")
                    checked += 1
                for s in REJECT.get(name, []):
                    self.assertFalse(
                        g.accepts(s),
                        f"{name}: compiled spec accepted {s!r}, which is "
                        f"outside it")
                    checked += 1
        self.assertEqual(checked, 23, "expected the full 23-sample census")


class TestCorpus(unittest.TestCase):
    """Both directions. A validator that only ever accepted would pass
    half of this, which is why the reject table is not optional."""

    def test_accepts_what_is_in_the_language(self):
        checked = 0
        for name, samples in ACCEPT.items():
            with grammar(name) as g:
                for s in samples:
                    self.assertTrue(
                        g.accepts(s),
                        f"{name}.gbnf rejected {s!r}, which is in its language")
                    checked += 1
        self.assertGreater(checked, 0)

    def test_rejects_what_is_outside_it(self):
        checked = 0
        for name, samples in REJECT.items():
            with grammar(name) as g:
                for s in samples:
                    self.assertFalse(
                        g.accepts(s),
                        f"{name}.gbnf accepted {s!r}, which is outside it")
                    checked += 1
        self.assertGreater(checked, 0)


if __name__ == "__main__":
    unittest.main()
