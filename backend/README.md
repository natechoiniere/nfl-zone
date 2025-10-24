# NFL Zone Backend API

Express-based authentication API with SQLite database.

## Environment Variables

- `ADMIN_PASSWORD` - Default admin password (set in .env)
- `JWT_SECRET` - JWT signing secret (set in .env for production)
- `API_PORT` - API server port (default: 3000)
- `DB_PATH` - SQLite database path (default: /app/data/nflzone.db)

## Default Credentials

- Username: `admin`
- Password: Set via `ADMIN_PASSWORD` environment variable

## Database

SQLite database is persisted in a Docker volume (`api-data` in production, `api-data-dev` in development).

## Development

```bash
cd backend
npm install
ADMIN_PASSWORD=yourpassword node server.js
```

## API Endpoints

- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/verify` - Verify JWT token
- `GET /health` - Health check




