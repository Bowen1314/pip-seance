"""pytest plugin loaded (``-p seance_shim``) in EVERY test run, old Python and new.

Python 3.12/3.13 deleted some unittest spellings that old *test files* use
(assertEquals, assertRegexpMatches, makeSuite, ...). Tests are the oracle and
nobody is allowed to edit them, so instead of counting "the test file says
assertEquals" as the library being dead, this shim puts the old spellings back.
It touches nothing outside unittest, and it is identical before and after a
revival, so it cannot make a broken library look alive.
"""

import unittest

_ALIASES = {
    "assertEquals": "assertEqual",
    "assertNotEquals": "assertNotEqual",
    "assertAlmostEquals": "assertAlmostEqual",
    "assertNotAlmostEquals": "assertNotAlmostEqual",
    "assert_": "assertTrue",
    "failUnless": "assertTrue",
    "failIf": "assertFalse",
    "failUnlessEqual": "assertEqual",
    "failIfEqual": "assertNotEqual",
    "failUnlessAlmostEqual": "assertAlmostEqual",
    "failIfAlmostEqual": "assertNotAlmostEqual",
    "failUnlessRaises": "assertRaises",
    "assertRegexpMatches": "assertRegex",
    "assertNotRegexpMatches": "assertNotRegex",
    "assertRaisesRegexp": "assertRaisesRegex",
}

for old, new in _ALIASES.items():
    if not hasattr(unittest.TestCase, old):
        setattr(unittest.TestCase, old, getattr(unittest.TestCase, new))

if not hasattr(unittest.TestCase, "assertDictContainsSubset"):
    def assertDictContainsSubset(self, subset, dictionary, msg=None):
        missing = {k: v for k, v in subset.items() if k not in dictionary or dictionary[k] != v}
        if missing:
            self.fail(msg or f"{missing!r} not contained in {dictionary!r}")
    unittest.TestCase.assertDictContainsSubset = assertDictContainsSubset

if not hasattr(unittest, "makeSuite"):
    def makeSuite(testCaseClass, prefix="test", sortUsing=None, suiteClass=unittest.TestSuite):
        loader = unittest.TestLoader()
        loader.testMethodPrefix = prefix
        return suiteClass(loader.loadTestsFromTestCase(testCaseClass))
    unittest.makeSuite = makeSuite

if not hasattr(unittest, "findTestCases"):
    def findTestCases(module, prefix="test", sortUsing=None, suiteClass=unittest.TestSuite):
        loader = unittest.TestLoader()
        loader.testMethodPrefix = prefix
        return suiteClass(loader.loadTestsFromModule(module))
    unittest.findTestCases = findTestCases
