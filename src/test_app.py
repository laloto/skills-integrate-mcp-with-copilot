import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException, Response
from starlette.requests import Request

import app as activity_api


def make_request(cookie=None):
    headers = []
    if cookie:
        headers.append((b"cookie", cookie.encode("ascii")))
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": headers,
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }
    )


class AdminModeTests(unittest.TestCase):
    def setUp(self):
        self.original_activities = activity_api.activities
        self.original_teachers_file = activity_api.TEACHERS_FILE
        self.original_teacher_sessions = activity_api.teacher_sessions
        self.temp_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_directory.cleanup)
        self.addCleanup(setattr, activity_api, "activities", self.original_activities)
        self.addCleanup(
            setattr, activity_api, "TEACHERS_FILE", self.original_teachers_file
        )
        self.addCleanup(
            setattr, activity_api, "teacher_sessions", self.original_teacher_sessions
        )

        activity_api.activities = {
            "Chess Club": {
                "description": "Play chess",
                "schedule": "Fridays",
                "max_participants": 2,
                "participants": ["existing@mergington.edu"],
            }
        }
        activity_api.TEACHERS_FILE = Path(self.temp_directory.name) / "teachers.json"
        activity_api.teacher_sessions = {}
        salt = "test-salt"
        password = "correct-password"
        password_hash = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("ascii"), 600_000
        ).hex()
        activity_api.TEACHERS_FILE.write_text(
            json.dumps(
                {
                    "teachers": [
                        {
                            "username": "teacher@mergington.edu",
                            "password_hash": f"pbkdf2_sha256$600000${salt}${password_hash}",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )

    def test_activity_list_is_public(self):
        self.assertIn("Chess Club", activity_api.get_activities())

    def test_signup_and_unregister_require_teacher_session(self):
        for operation in (
            lambda request: activity_api.signup_for_activity(
                "Chess Club", "new@mergington.edu", request
            ),
            lambda request: activity_api.unregister_from_activity(
                "Chess Club", "existing@mergington.edu", request
            ),
        ):
            with self.subTest(operation=operation), self.assertRaises(HTTPException) as error:
                operation(make_request())
            self.assertEqual(error.exception.status_code, 401)

    def test_teacher_can_sign_in_and_manage_participants(self):
        response = Response()
        result = activity_api.teacher_login(
            activity_api.TeacherLogin(
                username="teacher@mergington.edu", password="correct-password"
            ),
            make_request(),
            response,
        )
        cookie = response.headers["set-cookie"].split(";", 1)[0]
        request = make_request(cookie)

        self.assertTrue(activity_api.get_auth_status(request)["authenticated"])
        self.assertEqual(result["username"], "teacher@mergington.edu")
        activity_api.signup_for_activity("Chess Club", "new@mergington.edu", request)
        activity_api.unregister_from_activity(
            "Chess Club", "existing@mergington.edu", request
        )
        self.assertEqual(
            activity_api.activities["Chess Club"]["participants"],
            ["new@mergington.edu"],
        )

    def test_invalid_password_is_rejected(self):
        response = Response()
        with self.assertRaises(HTTPException) as error:
            activity_api.teacher_login(
                activity_api.TeacherLogin(
                    username="teacher@mergington.edu", password="wrong-password"
                ),
                make_request(),
                response,
            )
        self.assertEqual(error.exception.status_code, 401)

    def test_logout_clears_teacher_session(self):
        token = "test-token"
        activity_api.teacher_sessions[token] = {
            "username": "teacher@mergington.edu",
            "expires_at": activity_api.time.time() + 60,
        }
        response = Response()
        activity_api.teacher_logout(
            make_request(f"mergington_teacher_session={token}"), response
        )
        self.assertFalse(
            activity_api.get_auth_status(
                make_request(f"mergington_teacher_session={token}")
            )["authenticated"]
        )


if __name__ == "__main__":
    unittest.main()