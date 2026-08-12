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

import os
import unittest

import gbnf

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(os.path.dirname(HERE), "test", "corpus")

# Mirrors corpusAccept / corpusReject in go/gbnf_test.go and
# ts/test/corpus.test.js — read off each grammar, graded both ways.
ACCEPT = {
    "arithmetic": ["a+b=c\n", "x=y\n"],
    "chess": ["1. e4 e5\n2. Nxe4 e5\n"],
    "english": ["Hello, world!", "a b c"],
    "japanese": ["こんにちは"],
    "json": ['{"answer": [1, 2, 3]}', '{"a": "\\n"}'],
    "json_arr": ["[\n1,\n2\n]"],
    "list": ["- a\n"],
}

REJECT = {
    "arithmetic": ["a=b", "a=b+c\n"],
    "chess": ["1. e4\n"],
    "english": ["hello world\n", "Hello world.\n"],
    "japanese": ["hello"],
    "json": ['{"a":1,}'],
    "json_arr": ["[\n1, 2\n]"],
    "list": ["-a\n"],
}


def grammar(name):
    return gbnf.Grammar.from_file(os.path.join(CORPUS, name + ".gbnf"))


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

    def test_context_manager_and_reuse(self):
        with grammar("list") as g:
            for _ in range(3):
                self.assertTrue(g.accepts("- a\n"))
                self.assertFalse(g.accepts("-a\n"))


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
