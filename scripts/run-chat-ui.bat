@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title 聊天室服务 (端口5200)
echo ============================================
echo   聊天室 Web 服务
echo   地址: http://localhost:5200/
echo ============================================
echo.
npm run chat:ui
pause
