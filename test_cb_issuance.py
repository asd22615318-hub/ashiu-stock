import unittest
from convertible_data import issuance_schedule


class IssuanceTest(unittest.TestCase):
    def row(self, **changes):
        return dict(BondCode='12341', IssuerCode='1234', BondType='5', IssueDate='20261020',
                    ListingDate='20261022', Date='20261017', IssueAmount='1,000,000,000',
                    **changes)

    def test_future_and_recent_boundaries(self):
        rows=[]
        for index, issued in enumerate(['20261020','20261018','20260918','20260917']):
            row=self.row();row.update(BondCode=f'1234{index+1}',IssueDate=issued);rows.append(row)
        result=issuance_schedule(rows,'2026-10-18')
        self.assertEqual(len(result['bonds']),3)
        self.assertEqual(result['source_date'],'2026-10-17')

    def test_separate_listing_date_and_price_missing(self):
        bond=issuance_schedule([self.row()],'2026-10-18')['bonds'][0]
        self.assertEqual(bond['issue_date'],'2026-10-20')
        self.assertEqual(bond['listing_date'],'2026-10-22')
        self.assertIsNone(bond['issue_conversion_price'])
        self.assertEqual(bond['issue_amount'],1_000_000_000)

    def test_exchange_private_invalid_and_duplicates(self):
        valid=self.row();exchange={**valid,'BondType':'6'};private={**valid,'BondCode':''}
        undated={**valid,'IssueDate':''}
        self.assertEqual(len(issuance_schedule([valid,valid,exchange,private,undated],'2026-10-18')['bonds']),1)


if __name__=='__main__':unittest.main()
