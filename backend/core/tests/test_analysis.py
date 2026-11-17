from django.test import SimpleTestCase
from core.analysis import ahp_priorities, run_analysis
from core.validation import DataError, validate_payload

def sample():
    return {
        "criteria": [
            {"key": "price", "label": "Цена", "direction": "min", "weight": 0.6},
            {"key": "quality", "label": "Качество", "direction": "max", "weight": 0.4},
        ],
        "alternatives": [
            {"name": "A", "values": {"price": 100, "quality": 10}},
            {"name": "B", "values": {"price": 200, "quality": 5}},
            {"name": "C", "values": {"price": 150, "quality": 7}},
        ],
    }

class AnalysisTests(SimpleTestCase):
    def test_topsis_dominance(self):
        result = run_analysis(sample())
        self.assertEqual(result["recommendation"]["name"], "A")
        self.assertEqual(result["topsis"][0]["score"], 1)
        self.assertEqual(result["electre"]["ranking"][0]["name"], "A")

    def test_ahp_consistency(self):
        result = ahp_priorities([[1, 3, 6], [1/3, 1, 2], [1/6, 1/2, 1]])
        self.assertTrue(result["consistent"])
        self.assertAlmostEqual(result["weights"][0], 2/3, places=6)

    def test_ahp_pairwise_controls_weights(self):
        data = sample()
        data["pairwise"] = [[1, 1/3], [3, 1]]
        result = run_analysis(data)
        self.assertAlmostEqual(result["weights"][1]["weight"], .75, places=6)

    def test_constant_criteria(self):
        data = sample()
        for item in data["alternatives"]:
            item["values"] = {"price": 0, "quality": 0}
        result = run_analysis(data)
        self.assertTrue(all(r["score"] == .5 for r in result["topsis"]))
        self.assertTrue(all(r["flow"] == 0 for r in result["electre"]["ranking"]))

    def test_nonfinite_value_rejected(self):
        data = sample()
        data["alternatives"][0]["values"]["price"] = float("nan")
        with self.assertRaises(DataError):
            validate_payload(data)

    def test_nonreciprocal_ahp_rejected(self):
        data = sample()
        data["pairwise"] = [[1, 3], [3, 1]]
        with self.assertRaises(DataError):
            validate_payload(data)

    def test_sensitivity(self):
        self.assertEqual(len(run_analysis(sample())["sensitivity"]), 4)
