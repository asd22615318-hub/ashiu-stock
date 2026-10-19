import gzip
import json
import unittest
from publish_snapshots import can_replace


def quote(listed,otc):
    return gzip.compress(json.dumps({'stocks':[
        {'market':'上市','bars':[{'date':listed}]},
        {'market':'上櫃','bars':[{'date':otc}]}]}).encode())


class RegressionGuardTest(unittest.TestCase):
    def test_no_market_date_regression(self):
        current=quote('2026-10-19','2026-10-19')
        self.assertFalse(can_replace('seed.json.gz',current,quote('2026-10-16','2026-10-19')))
        self.assertFalse(can_replace('seed.json.gz',current,quote('2026-10-19','2026-10-16')))
        self.assertTrue(can_replace('seed.json.gz',current,quote('2026-10-19','2026-10-19')))
        self.assertTrue(can_replace('seed.json.gz',current,quote('2026-10-20','2026-10-20')))

    def test_index_date_regression(self):
        row=lambda date:json.dumps({'rows':[{'d':date}]}).encode()
        self.assertFalse(can_replace('taiwan-sentiment-seed.json',row('2026-10-19'),row('2026-10-16')))


if __name__=='__main__':unittest.main()
