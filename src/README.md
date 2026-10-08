# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Sign up for activities

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## Teacher access

Only signed-in teachers can register or unregister students. Visitors can still view activities and participant rosters.

Create the local teacher credentials file from the `src` directory. The password prompt is hidden, and only a PBKDF2 hash is written to `teachers.json`:

```
python -c 'import getpass, json; from app import hash_teacher_password; username = input("Teacher username: "); password = getpass.getpass("Teacher password: "); print(json.dumps({"teachers": [{"username": username, "password_hash": hash_teacher_password(password)}]}, indent=2))' > teachers.json
```

Add additional entries to the `teachers` array to configure more teachers. `teachers.json` is local-only and ignored by Git. Teacher sessions expire after eight hours and are cleared when the server restarts. Set `COOKIE_SECURE=1` when serving the app over HTTPS.

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up for an activity                                             |

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
