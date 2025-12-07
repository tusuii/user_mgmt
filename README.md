# Node.js Microservice Application

A simple 2-tier microservice application with:
- Frontend service (port 3000)
- Backend API service (port 3001) 
- MySQL database (port 3306)

## Run the application

```bash
docker-compose up --build
```

## Test the application

1. Open http://localhost:3000 in your browser
2. Add users using the form
3. View the list of users

## API Endpoints

- GET /api/users - Get all users
- POST /api/users - Create a new user

## Stop the application

```bash
docker-compose down
```
