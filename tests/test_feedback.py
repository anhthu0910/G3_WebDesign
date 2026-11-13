import unittest
from unittest.mock import patch

import test_deployment as deployment
from backend.admin_routes import QuizPayload, overview
from pydantic import ValidationError


class FeedbackTests(unittest.TestCase):
    def test_quiz_completions_persist_and_retries_are_idempotent(self):
        from uuid import uuid4
        from backend.database import init_database
        client = deployment.TestClient(deployment.app, base_url="https://testserver")
        self.addCleanup(client.close)
        before = overview({})["cards"]["quiz_completions"]
        payload = {"completion_id": str(uuid4())}
        for _ in range(2):
            self.assertEqual(client.post("/api/quiz/completions", json=payload).status_code, 200)
        self.assertEqual(overview({})["cards"]["quiz_completions"], before + 1)
        init_database()
        self.assertEqual(overview({})["cards"]["quiz_completions"], before + 1)
        self.assertEqual(client.post("/api/quiz/completions", json={"completion_id": str(uuid4())}).status_code, 200)
        self.assertEqual(overview({})["cards"]["quiz_completions"], before + 2)
        self.assertEqual(client.post("/api/quiz/completions", json={"completion_id": "invalid"}).status_code, 422)
        self.assertEqual(overview({})["cards"]["quiz_completions"], before + 2)

    def test_quiz_rejects_blank_titles_and_answers(self):
        for title, answers in [(" ", [{"text": "Dry"}]), ("Question", []),
                               ("Question", [{"text": " "}]),
                               ("Question", [{"type": "dry"}])]:
            with self.assertRaises(ValidationError):
                QuizPayload(title=title, answers=answers)

    def test_dashboard_counts_chat_success_failure_and_affiliate_click(self):
        client = deployment.TestClient(deployment.app, base_url="https://testserver")
        self.addCleanup(client.close)
        before = overview({})["cards"]
        with patch("backend.main.generate_skincare_reply", return_value="Test reply"):
            self.assertEqual(client.post("/api/chat", json={"message": "Hello"}).status_code, 200)
        with patch("backend.main.generate_skincare_reply", side_effect=RuntimeError("Test failure")):
            self.assertEqual(client.post("/api/chat", json={"message": "Hello"}).status_code, 503)
        self.assertEqual(client.post("/api/products/1/affiliate-click").status_code, 200)
        after = overview({})["cards"]
        self.assertEqual(after["ai_requests"], before["ai_requests"] + 2)
        self.assertEqual(after["affiliate_clicks"], before["affiliate_clicks"] + 1)
