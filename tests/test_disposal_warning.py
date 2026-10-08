import unittest
from disposal_warning import AttentionDay, assess_attention, parse_kinds, image_validation_cases

class WarningTests(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(parse_kinds('﹝第一款﹞且﹝第四款﹞'),frozenset({1,4}))
        self.assertEqual(parse_kinds('無公告'),frozenset())
    def test_three_first_kind(self):
        rows=[AttentionDay(str(i),frozenset({1})) for i in range(3)]
        self.assertTrue(assess_attention(rows)['triggered'])
    def test_two_not_trigger(self):
        rows=[AttentionDay(str(i),frozenset({1})) for i in range(2)]
        self.assertFalse(assess_attention(rows)['triggered'])
    def test_six_of_ten(self):
        rows=[AttentionDay(str(i),frozenset({4}) if i%2==0 or i==1 else frozenset()) for i in range(10)]
        self.assertTrue(assess_attention(rows)['triggered'])
    def test_image_reference(self):
        cases=image_validation_cases()
        self.assertEqual(cases['2492']['reference_close_high'],'420.00')
        self.assertEqual(cases['2492']['reference_close_low'],'420.00')
        self.assertEqual(cases['4556']['reference_close_high'],'145.00')
        self.assertEqual(cases['4556']['reference_close_low'],'145.00')
if __name__=='__main__':unittest.main()
