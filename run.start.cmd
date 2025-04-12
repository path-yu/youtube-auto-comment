@echo off
echo Starting to tsx src/run.ts...
tsx src/run.ts
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to run tsx src/run.ts
    pause
) else (
    echo Successfully ran tsx src/run.ts
    pause
)