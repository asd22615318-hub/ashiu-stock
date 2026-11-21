import unittest
from industry_taxonomy import normalize, nodes

class TaxonomyTests(unittest.TestCase):
    def setUp(self):
        self.snapshot={"updated_at":"2026-10-09","stocks":[
            {"code":"1234","name":"測試上市","market":"上市","industry":"電子零組件業"},
            {"code":"5678","name":"測試上櫃","market":"上櫃","industry":"半導體業"}]}
    def test_preserves_official_classification(self):
        data=normalize(self.snapshot)
        self.assertEqual(len(data["stocks"]),2)
        self.assertEqual(data["stocks"][0]["official_industry"],"電子零組件業")
        self.assertEqual(data["coverage"]["product_verified_stocks"],0)
        self.assertEqual(data["coverage"]["product_pending_stocks"],2)
    def test_taxonomy_parents(self):
        all_nodes=nodes()
        ids={n["id"] for n in all_nodes}
        self.assertEqual(sum(n["level"]==1 for n in all_nodes),20)
        self.assertTrue(all(n["parent_id"] is None or n["parent_id"] in ids for n in all_nodes))
    def test_evidence_required(self):
        with self.assertRaises(ValueError):
            normalize(self.snapshot,[{"stock_id":"上市:1234","industry_id":"pcb.01","status":"verified"}])
    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            normalize({"stocks":[self.snapshot["stocks"][0]]*2})
    def test_verified_evidence(self):
        evidence=[{"stock_id":"上市:1234","industry_id":"pcb.01","status":"verified",
                   "source_url":"https://example.org/filing","reviewed_at":"2026-10-09"}]
        data=normalize(self.snapshot,evidence)
        self.assertEqual(data["coverage"]["product_verified_stocks"],1)

if __name__=="__main__": unittest.main()
