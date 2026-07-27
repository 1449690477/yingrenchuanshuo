@echo off
chcp 65001 >nul
echo [1/2] 启动聊天室服务...
start "聊天室服务" "%~dp0\run-chat-ui.bat"
echo       等待 3 秒让服务就绪...
ping 127.0.0.1 -n 4 >nul 2>&1
echo [2/2] 启动广播监听服务...
start "广播监听服务" "%~dp0\run-broadcast.bat"
echo.
echo ════════════════════════════════════════════════════
echo   两个服务已启动！
echo ════════════════════════════════════════════════════
echo.
echo   现在可以：
echo   1. 浏览器打开 http://localhost:5200/
echo   2. 在聊天室发消息: @all 大家开始做第3块
echo   3. 所有 AI 窗口会自动收到消息并激活
echo.
echo   定向发送: @cursor 你接战斗动作
echo   组合发送: @claude @kimi 你们配合一下
echo.
echo   关闭服务: 直接关掉那两个窗口即可
echo.
pause
