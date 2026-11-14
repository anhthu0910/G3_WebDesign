"""Run create_admin against the disposable test database from test_deployment."""
import io
import unittest
import uuid
from contextlib import redirect_stdout
from unittest.mock import patch

import test_deployment  # noqa: F401  (sets DATABASE_PATH to a temporary database)
from backend import create_admin
from backend.database import get_connection


class CreateAdminTests(unittest.TestCase):
    def run_create_admin(self, username, email, password="Long-password-123"):
        output = io.StringIO()
        with patch("builtins.input", side_effect=[username, email]), \
             patch("getpass.getpass", return_value=password), \
             redirect_stdout(output):
            create_admin.main()
        return output.getvalue()

    def test_duplicate_username_or_email_is_reported(self):
        name = "admin-" + uuid.uuid4().hex[:8]
        self.assertIn("Admin account created.", self.run_create_admin(name, name + "@example.test"))
        self.assertIn("already exists", self.run_create_admin(name, "other-" + name + "@example.test"))
        self.assertIn("already exists", self.run_create_admin("other-" + name, name + "@example.test"))
        with get_connection() as conn:
            count = conn.execute("SELECT COUNT(*) FROM users WHERE username=? AND role='admin'", (name,)).fetchone()[0]
        self.assertEqual(count, 1)

    def test_short_password_is_rejected(self):
        name = "admin-" + uuid.uuid4().hex[:8]
        self.assertIn("at least 12 characters", self.run_create_admin(name, name + "@example.test", "short"))


if __name__ == "__main__":
    unittest.main()