"""Run with python -m unittest discover -s tests -v; never use the real DB."""
import os
import uuid
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from urllib.parse import urljoin, urlparse
from html.parser import HTMLParser

TEST_DIR = Path(__file__).resolve().parents[1] / "data" / ("test-" + uuid.uuid4().hex)
TEST_DIR.mkdir(parents=True)
os.environ.update(APP_ENV="production", DATABASE_PATH=str(TEST_DIR / "test.db"),
                  UPLOAD_DIR=str(TEST_DIR / "uploads"), GEMINI_API_KEY="")

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_connection
from backend.services.password_service import hash_password
from backend.services import ai_service
from google.genai.errors import APIError


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(v for k, v in attrs if k in {"src", "href"})


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, base_url="https://testserver")

    def test_pages_and_local_assets(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        for page in ("index", "products", "product_detail", "skin_quiz", "ai_consultant", "cart", "login", "register", "admin_index"):
            url = f"/frontend/html/{page}.html"
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            parser = Links()
            parser.feed(response.text)
            for link in parser.links:
                path = urlparse(urljoin("https://testserver" + url, link))
                if path.netloc == "testserver" and path.path:
                    self.assertEqual(self.client.get(path.path).status_code, 200, link)

    def test_public_catalog_and_private_files(self):
        products = self.client.get("/api/products").json()["products"]
        self.assertEqual(len(products), 10)
        for product in products:
            self.assertEqual(self.client.get(f'/api/products/{product["id"]}').status_code, 200)
            image = urljoin("/frontend/html/products.html", product["image"])
            self.assertEqual(self.client.get(image).status_code, 200, image)
        for path in ("/.env", "/.git/config", "/data/glowguide.db", "/data/products.json", "/backend/main.py", "/frontend/../.env", "/docs", "/openapi.json"):
            self.assertEqual(self.client.get(path).status_code, 404, path)
        self.assertEqual(self.client.get("/api/quiz").status_code, 200)

    def test_auth_roles_admin_modules_upload_and_lock(self):
        password = "Only-for-isolated-test-934!"
        result = self.client.post("/api/auth/register", json={"username": "deployuser", "email": "deploy@example.invalid", "password": password})
        self.assertEqual(result.status_code, 201)
        uid = result.json()["user"]["id"]
        self.assertNotIn("password_hash", result.text)
        self.assertEqual(self.client.get("/api/admin/me").status_code, 401)
        response = self.client.post("/api/auth/login", json={"identifier": "deployuser", "password": password})
        self.assertEqual(response.status_code, 200)
        cookie = response.headers["set-cookie"]
        for flag in ("Secure", "HttpOnly", "SameSite=lax"):
            self.assertIn(flag, cookie)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)
        self.assertEqual(self.client.get("/api/admin/products").status_code, 403)
        with get_connection() as conn:
            conn.execute("INSERT INTO users(username,email,password_hash,role) VALUES(?,?,?,'admin')", ("deployadmin", "admin@example.invalid", hash_password(password)))
        admin = TestClient(app, base_url="https://testserver")
        self.assertEqual(admin.post("/api/auth/login", json={"identifier": "deployadmin", "password": password, "role": "admin"}).status_code, 200)
        for path in ("me", "overview", "products", "analytics", "quiz", "content", "ai/status", "users", "audit-logs"):
            self.assertEqual(admin.get("/api/admin/" + path).status_code, 200, path)
        self.assertEqual(admin.put("/api/admin/content/test", json={"value": "demo"}).status_code, 200)
        quiz = admin.post("/api/admin/quiz", json={"title": "Published test", "answers": [{"text": "Dry", "type": "dry"}], "published": True})
        self.assertEqual(quiz.status_code, 201)
        self.assertTrue(self.client.get("/api/quiz").json()["questions"])
        upload = admin.post("/api/admin/products/1/image", files={"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")})
        self.assertEqual(upload.status_code, 200)
        self.assertEqual(admin.get(upload.json()["image"]).status_code, 200)
        self.assertEqual(admin.patch(f"/api/admin/users/{uid}/lock?locked=true").status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.assertEqual(admin.post("/api/auth/logout").status_code, 200)
        self.assertEqual(admin.get("/api/admin/me").status_code, 401)

    def test_cross_origin_writes(self):
        self.assertEqual(self.client.post("/api/auth/logout", headers={"Origin": "https://evil.invalid"}).status_code, 403)

    def test_ai_fallback_and_unavailable(self):
        fake = Mock()
        fake.models.generate_content.side_effect = [APIError(503, {"error": {"message": "unavailable", "status": "UNAVAILABLE"}}), Mock(text="Test reply")]
        with patch.object(ai_service, "client", fake), patch.object(ai_service, "MODEL_NAMES", ["first", "second"]):
            response = self.client.post("/api/chat", json={"message": "Dry skin?"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["reply"], "Test reply")
            self.assertEqual(fake.models.generate_content.call_count, 2)
        with patch.object(ai_service, "client", None):
            self.assertEqual(self.client.post("/api/chat", json={"message": "Dry skin?"}).status_code, 503)


if __name__ == "__main__":
    unittest.main()