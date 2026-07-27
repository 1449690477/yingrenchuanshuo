@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title 广播监听服务
echo ============================================
echo   聊天室广播监听服务
echo   监听 @all / @cursor 等消息
echo   自动分发到各 AI 桌面窗口
echo ============================================
echo.
npm run broadcast
pause
