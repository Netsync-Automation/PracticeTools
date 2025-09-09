@echo off
echo === DEPLOYING RELEASE NOTES FIX ===
echo.

echo 1. Adding changes to git...
git add .

echo 2. Committing with descriptive message...
git commit -m "Fix: Resolve production release notes environment detection issue

- Convert static ENV variable to dynamic getEnvironment() function
- Fix database table name generation to use runtime environment detection
- Add comprehensive debugging to releases API
- Ensure ENVIRONMENT variable is properly detected in production
- This fixes the issue where production was showing dev release notes

Root cause: Environment detection was happening at module load time
instead of runtime, causing incorrect database table selection."

echo 3. Pushing to trigger App Runner deployment...
git push origin main

echo.
echo === DEPLOYMENT INITIATED ===
echo.
echo App Runner will now:
echo 1. Detect the new commit
echo 2. Build the application with the fix
echo 3. Deploy to production
echo.
echo Wait 3-5 minutes for deployment to complete, then run:
echo   node test-prod-fix.js
echo.
echo Or test manually at:
echo   https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/releases
echo   https://cfm2pd2zmq.us-east-1.awsapprunner.com/release-notes
echo.
pause