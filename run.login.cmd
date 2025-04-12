@echo off
echo Starting to run login.ts
tsx src/login.ts
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to run login.ts
    pause
) else (
    echo Successfully ran login.ts
    pause
)