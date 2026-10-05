import tempfile
import unittest
from pathlib import Path

from app import create_app


class EspressoApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database_path = Path(self.temp_dir.name) / "test.db"
        self.app = create_app(f"sqlite:///{database_path}")
        self.app.testing = True
        self.client = self.app.test_client()

    def tearDown(self):
        self.app.extensions["espresso_engine"].dispose()
        self.temp_dir.cleanup()

    def tasting_payload(self, **updates):
        payload = {
            "cafe": "Test Café",
            "date": "2026-10-05",
            "double_price": "2.50",
            "single_price": "1.40",
            "note": "Balanced and sweet.",
            "ratings": {"0-0": 5, "2-4": 0},
        }
        payload.update(updates)
        return payload

    def test_create_and_list_tasting(self):
        response = self.client.post(
            "/api/tastings",
            json=self.tasting_payload(),
        )

        self.assertEqual(response.status_code, 201)
        created = response.get_json()
        self.assertEqual(created["score"], 12)
        self.assertEqual(created["double_price"], 2.5)
        self.assertEqual(created["single_price"], 1.4)
        self.assertEqual(created["ratings"], {"0-0": 5, "2-4": 0})

        listed = self.client.get("/api/tastings")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.get_json(), [created])

    def test_same_cafe_is_reused_and_removed_after_last_tasting(self):
        first = self.client.post("/api/tastings", json=self.tasting_payload())
        second = self.client.post(
            "/api/tastings",
            json=self.tasting_payload(date="2026-10-06", cafe="test café"),
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(len(self.client.get("/api/tastings").get_json()), 2)

        self.assertEqual(
            self.client.delete(f"/api/tastings/{first.get_json()['id']}").status_code,
            204,
        )
        self.assertEqual(len(self.client.get("/api/tastings").get_json()), 1)
        self.assertEqual(
            self.client.delete(f"/api/tastings/{second.get_json()['id']}").status_code,
            204,
        )
        self.assertEqual(self.client.get("/api/tastings").get_json(), [])

    def test_legacy_import_key_is_idempotent(self):
        payload = self.tasting_payload(client_key="legacy-123")

        first = self.client.post("/api/tastings", json=payload)
        repeated = self.client.post("/api/tastings", json=payload)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(first.get_json()["id"], repeated.get_json()["id"])
        self.assertEqual(len(self.client.get("/api/tastings").get_json()), 1)

    def test_invalid_ratings_and_prices_are_rejected(self):
        bad_rating = self.client.post(
            "/api/tastings",
            json=self.tasting_payload(ratings={"0-0": 6}),
        )
        bad_price = self.client.post(
            "/api/tastings",
            json=self.tasting_payload(double_price="-1"),
        )

        self.assertEqual(bad_rating.status_code, 400)
        self.assertEqual(bad_price.status_code, 400)
        self.assertEqual(self.client.get("/api/tastings").get_json(), [])

    def test_serves_page_and_assets(self):
        page = self.client.get("/")
        script = self.client.get("/assets/js/app.js")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(script.status_code, 200)
        page.close()
        script.close()


if __name__ == "__main__":
    unittest.main()
