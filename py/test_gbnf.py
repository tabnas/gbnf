"""The Python binding, graded against the repo's own corpus.

Run after building both libraries (see README.md):

    cd go/clib && ./build.sh
    cd ../../py && python3 -m unittest -v

The GBNF front-end, libtabnasgbnf, is this repository's. The engine,
libtabnasparser, is tabnas/parser's; it is found through TABNAS_LIB, or
beside this module, or in a sibling checkout's go/clib/dist. Without it
every test that checks text is SKIPPED, and says so — only the
compile_spec tests need nothing but this repository.

These are conformance tests, not smoke tests. The grammars under
test/corpus are the SAME files the TypeScript and Go suites grade, and
the samples are the same samples, so a disagreement here is a
disagreement between runtimes rather than a binding bug — which is the
property that makes a third language trustworthy at all. Every verdict
here also crosses both libraries: GBNF compiled by one, the spec run by
the other, which is exactly the path a caller in any other language
takes.
"""

import json
import os
import unittest

import gbnf

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(os.path.dirname(HERE), "test", "corpus")

# Mirrors corpusAccept / corpusReject in go/gbnf_test.go, go/clib's
# value_test.go and ts/test/corpus.test.js — read off each grammar,
# graded both ways.
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

# GBNF that must not compile: one per condition the library's format
# notes name for acceptance.
BROKEN = {
    "unparseable": "root ::= [",
    "undefined reference": "root ::= nosuchrule",
    "no root rule": 'other ::= "a"',
    "empty": "",
    "tokenizer-token terminal": "root ::= <[1000]>\n",
    "purely left-recursive": 'root ::= root "a"\n',
}


def grammar(name):
    return gbnf.Grammar.from_file(os.path.join(CORPUS, name + ".gbnf"))


def compile_corpus(name, **kw):
    with open(os.path.join(CORPUS, name + ".gbnf"), "rb") as f:
        return gbnf.compile_spec(f.read(), **kw)


def engine_path_or_skip():
    """The engine library's path, or a visible skip when there is none.

    Only a library that cannot be FOUND skips. One that is found and
    then fails to load, or turns out to be the wrong library, fails.
    """
    try:
        return gbnf._default_engine_path()
    except gbnf.GbnfError as e:
        raise unittest.SkipTest(str(e)) from e


def assert_one_clean_line(case, msg):
    case.assertTrue(msg)
    case.assertNotIn("\n", msg)
    case.assertNotIn("\x1b", msg)


class TestSurface(unittest.TestCase):
    def test_version(self):
        v = gbnf.version()
        self.assertEqual(v["lib"], "libtabnasgbnf")
        self.assertEqual(v["format"], "gbnf")
        self.assertRegex(v["template"], r"^v\d+$")

    def test_explicit_path_is_remembered(self):
        # The documented load(path=...) then use sequence. If only
        # auto-discovered libraries were cached, the second call would
        # go back to discovery and fail for anyone whose library is not
        # on the default search path.
        lib = gbnf._default_lib_path()
        gbnf._lib = None
        try:
            gbnf.load(lib)
            self.assertIn("rule", compile_corpus("list"))
        finally:
            gbnf._lib = None

    def test_the_front_end_is_not_an_engine(self):
        # Both libraries export the same five symbols, so a swapped
        # path must be caught by what the library says it is.
        with self.assertRaises(gbnf.GbnfError):
            gbnf.load_engine(gbnf._default_lib_path())


class TestCompileSpec(unittest.TestCase):
    """Compile here, validate anywhere. Needs only libtabnasgbnf."""

    def test_emits_a_loadable_spec(self):
        spec = compile_corpus("list")
        self.assertIn("rule", spec)
        self.assertIn("options", spec)

    def test_as_text_round_trips(self):
        text = compile_corpus("list", as_text=True)
        self.assertIsInstance(text, str)
        self.assertEqual(json.loads(text), compile_corpus("list"))

    def test_a_broken_grammar_raises_and_yields_no_spec(self):
        for why, src in BROKEN.items():
            with self.subTest(why), self.assertRaises(gbnf.GbnfError) as cm:
                gbnf.compile_spec(src)
            assert_one_clean_line(self, str(cm.exception))
            self.assertIsInstance(cm.exception.error, dict)

    def test_nul_is_not_a_terminator(self):
        # A grammar followed by a zero byte and more text is not the
        # grammar before the zero byte.
        with self.assertRaises(gbnf.GbnfError):
            gbnf.compile_spec(b'root ::= "a"\n\x00root ::= [')


class TestGrammar(unittest.TestCase):
    """GBNF in, verdicts out, across both libraries."""

    @classmethod
    def setUpClass(cls):
        cls.engine = engine_path_or_skip()

    def test_rejection_is_an_answer_not_an_exception(self):
        with grammar("json") as g:
            v = g.check("{oops")
            self.assertFalse(v.accept)
            self.assertFalse(v)  # Verdict is falsy when rejected
            self.assertEqual(v.error["code"], "unexpected")
            assert_one_clean_line(self, v.error["message"])

    def test_a_broken_grammar_raises_rather_than_rejecting(self):
        # The distinction that stops a tool blaming a model's output for
        # a grammar's mistake.
        for why, src in BROKEN.items():
            with self.subTest(why), self.assertRaises(gbnf.GbnfError):
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

    def test_context_manager_and_reuse(self):
        with grammar("list") as g:
            for _ in range(3):
                self.assertTrue(g.accepts("- a\n"))
                self.assertFalse(g.accepts("-a\n"))

    def test_explicit_engine_path_is_remembered(self):
        gbnf._engine = None
        try:
            gbnf.load_engine(self.engine)
            with grammar("list") as g:
                self.assertTrue(g.accepts("- a\n"))
        finally:
            gbnf._engine = None

    def test_the_engine_is_not_a_front_end(self):
        with self.assertRaises(gbnf.GbnfError):
            gbnf.load(self.engine)


class TestCorpus(unittest.TestCase):
    """Both directions. A validator that only ever accepted would pass
    half of this, which is why the reject table is not optional."""

    @classmethod
    def setUpClass(cls):
        engine_path_or_skip()

    def test_the_full_census_grades_both_ways(self):
        self.assertEqual(len(ACCEPT), 8)
        self.assertEqual(set(ACCEPT), set(REJECT))
        checked = 0
        for name in ACCEPT:
            with grammar(name) as g:
                for s in ACCEPT[name]:
                    self.assertTrue(
                        g.accepts(s),
                        f"{name}.gbnf rejected {s!r}, which is in its language")
                    checked += 1
                for s in REJECT[name]:
                    self.assertFalse(
                        g.accepts(s),
                        f"{name}.gbnf accepted {s!r}, which is outside it")
                    checked += 1
        self.assertEqual(checked, 23, "expected the full 23-sample census")


if __name__ == "__main__":
    unittest.main()
