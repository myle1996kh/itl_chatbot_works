@echo off
REM Production build and deployment script for ITL Chatbot on Windows

echo Building production Docker image...

REM Build the production image
docker build -f Dockerfile.prod -t itl-chatbot:prod .

if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)

echo Production image built successfully!

echo.
echo To run the production containers, use:
echo   docker-compose -f docker-compose.prod.yml up -d
echo.
echo To check the status of your containers:
echo   docker-compose -f docker-compose.prod.yml ps
echo.
echo To view logs:
echo   docker-compose -f docker-compose.prod.yml logs -f
echo.
echo For production deployment, you may want to set up environment variables in a .env file
echo and run with:
echo   docker-compose -f docker-compose.prod.yml --env-file .env up -d
echo.

pause