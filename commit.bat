@echo off
REM Branch-aware commit script for Windows

for /f "tokens=*" %%i in ('git branch --show-current') do set BRANCH=%%i
set COMMIT_MSG=%1

if "%COMMIT_MSG%"=="" (
    echo ❌ Error: Commit message required
    echo Usage: commit.bat "Your commit message"
    exit /b 1
)

echo 📝 Current branch: %BRANCH%
echo 💬 Commit message: %COMMIT_MSG%

git add .
git commit -m %COMMIT_MSG%

if "%BRANCH%"=="main" (
    echo.
    echo 🚨 WARNING: DEPLOYING TO PRODUCTION ENVIRONMENT
    echo    - App Runner Service: issue-tracker ^(PROD^)
    echo    - DynamoDB Tables: IssueTracker-prod-*
    echo    - SSM Parameters: /IssueTracker/prod/*
    echo.
    set /p confirm="Are you sure you want to deploy to PRODUCTION? (y/N): "
    if /i "%confirm%"=="y" (
        git push origin main
        echo ✅ Deployed to PRODUCTION environment
    ) else (
        echo ❌ Production deployment cancelled
        echo 💡 Tip: Use 'git reset HEAD~1' to undo the commit if needed
    )
) else if "%BRANCH%"=="dev" (
    echo.
    echo 🧪 Deploying to DEVELOPMENT environment
    echo    - App Runner Service: IssuesTracker-dev
    echo    - DynamoDB Tables: IssueTracker-dev-*
    echo    - SSM Parameters: /IssueTracker/dev/*
    echo.
    git push origin dev
    echo ✅ Deployed to DEV environment
) else (
    echo.
    echo 📝 Pushing to feature branch: %BRANCH%
    echo    - No automatic deployment
    echo.
    git push origin %BRANCH%
    echo ✅ Pushed to %BRANCH% ^(no deployment^)
)