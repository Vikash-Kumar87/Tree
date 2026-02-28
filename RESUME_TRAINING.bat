@echo off
title YOLOv8 Tree Training - Auto Resume
color 0A
echo.
echo ============================================
echo   YOLOv8 Tree Trunk Training - Auto Resume
echo ============================================
echo.

cd /d "C:\Users\vk654\OneDrive\Documents\Desktop\Tree\backend"

REM Check if last.pt checkpoint exists
IF EXIST "..\ml\runs\yolo_tree\tree_trunk_combined_v1\weights\last.pt" (
    echo [+] Checkpoint mila! Wahi se resume ho rahi hai training...
    echo.
) ELSE (
    echo [!] Koi checkpoint nahi mila. Fresh training shuru ho rahi hai...
    echo.
)

.\venv\Scripts\python.exe "..\ml\training\run_training.py"

echo.
echo ============================================
IF %ERRORLEVEL% EQU 0 (
    echo   Training COMPLETE! Backend weights update ho gaye.
) ELSE (
    echo   Training band ho gayi. Dobara run karo is file ko.
)
echo ============================================
pause
