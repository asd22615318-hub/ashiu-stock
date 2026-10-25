import unittest
from broker_daily import daily_row

class DailyTests(unittest.TestCase):
    def setUp(self):
        self.report=dict(start='2026-10-22',end='2026-10-22',unit='lots',top_n=15,buy_lots=100,sell_lots=40,net_lots=60,buyers=[{}]*15,sellers=[{}]*15,source='https://example.com')
        self.bar=dict(date='2026-10-22',volume=200)
    def test_same_day_formula(self):
        self.assertEqual(daily_row(self.report,self.bar)['concentration_pct'],30)
    def test_negative(self):
        self.report.update(buy_lots=40,sell_lots=100,net_lots=-60)
        self.assertEqual(daily_row(self.report,self.bar)['concentration_pct'],-30)
    def test_wrong_date(self):
        self.report['start']='2026-10-19'
        with self.assertRaises(ValueError):daily_row(self.report,self.bar)
    def test_zero_volume(self):
        self.bar['volume']=0
        with self.assertRaises(ValueError):daily_row(self.report,self.bar)
    def test_incomplete(self):
        self.report['buyers'].pop()
        with self.assertRaises(ValueError):daily_row(self.report,self.bar)
    def test_bad_total(self):
        self.report['net_lots']=59
        with self.assertRaises(ValueError):daily_row(self.report,self.bar)

if __name__=='__main__':unittest.main()