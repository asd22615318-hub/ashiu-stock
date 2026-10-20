import unittest
from overnight_data import signals, limit_up
from publish_snapshots import can_replace

class DailyBranchTests(unittest.TestCase):
    def test_exact_branches_and_positive_net_only(self):
        stock={'code':'2330','name':'台積電','bars':[{'date':'2026-10-16','close':100,'volume':1000},{'date':'2026-10-19','close':110,'volume':1000}]}
        report={'start':'2026-10-19','end':'2026-10-19','unit':'lots','source':'test',
                'buyers':[{'name':'凱基－台北','buy_lots':80,'sell_lots':30,'net_lots':50},
                          {'name':'凱基-台中','buy_lots':200,'sell_lots':0,'net_lots':200},
                          {'name':'凱基-松山','buy_lots':10,'sell_lots':20,'net_lots':-10}]}
        row=signals(report,stock,'2026-10-19')
        self.assertEqual(row['net_lots'],50)
        self.assertEqual(row['ratio'],5)
        stock['bars'][-1]['close']=109.5
        self.assertIsNone(signals(report,stock,'2026-10-19'))
        stock['bars'][-2]['close']=10
        stock['bars'][-1]['close']=11
        self.assertIsNone(signals(report,stock,'2026-10-19'))
        report['start']='2026-10-16'
        with self.assertRaises(ValueError):signals(report,stock,'2026-10-19')

    def test_snapshot_date_never_regresses(self):
        self.assertFalse(can_replace('overnight-seed.json',b'{"date":"2026-10-20"}',b'{"date":"2026-10-19"}'))

    def test_stock_tick_rounding(self):
        self.assertEqual(float(limit_up(40.6)),44.65)
        self.assertEqual(float(limit_up(49)),53.9)
        self.assertEqual(float(limit_up(90.9)),99.9)

if __name__=='__main__':unittest.main()
