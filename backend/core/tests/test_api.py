import json
from django.test import TestCase
from core.tests.test_analysis import sample
from core.models import Scenario

class APITests(TestCase):
    def test_health(self):
        self.assertEqual(self.client.get("/api/health/").json()["status"], "ok")

    def test_analyze(self):
        response = self.client.post("/api/analyze/", json.dumps(sample()),
                                    content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["topsis"][0]["name"], "A")

    def test_bad_input(self):
        self.assertEqual(self.client.post(
            "/api/analyze/", "{}", content_type="application/json"
        ).status_code, 400)

    def test_history(self):
        created = self.client.post(
            "/api/scenarios/", json.dumps({"name": "Demo", "payload": sample()}),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201)
        ident = created.json()["id"]
        self.assertEqual(Scenario.objects.count(), 1)
        self.assertEqual(len(self.client.get("/api/scenarios/").json()), 1)
        self.assertEqual(self.client.get(f"/api/scenarios/{ident}/").json()["name"], "Demo")
        self.assertEqual(self.client.delete(f"/api/scenarios/{ident}/").status_code, 204)
        self.assertEqual(Scenario.objects.count(), 0)
