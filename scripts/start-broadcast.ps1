<#
.SYNOPSIS
  一键启动聊天室 + 广播服务（各开一个窗口）
.DESCRIPTION
  窗口1: npm run chat:ui   （聊天室 web 服务，端口 5200）
  窗口2: npm run broadcast  （监听 @all/@某AI 消息，自动分发到各 AI 窗口）
#>
$dir = Split-Path $PSScriptRoot -Parent

# 窗口1：聊天室服务
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$dir'; Write-Host '=== 聊天室服务 ===' -ForegroundColor Cyan; npm run chat:ui" -WindowStyle Normal
Write-Host "✓ 聊天室服务已在新窗口启动（端口 5200）" -ForegroundColor Green
Start-Sleep -Seconds 3

# 窗口2：广播监听服务
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$dir'; Write-Host '=== 广播监听服务 ===' -ForegroundColor Cyan; npm run broadcast" -WindowStyle Normal
Write-Host "✓ 广播监听服务已在新窗口启动" -ForegroundColor Green

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  两个服务已启动！" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "  现在可以：" -ForegroundColor White
Write-Host "  1. 浏览器打开 http://localhost:5200/" -ForegroundColor White
Write-Host "  2. 在聊天室发消息：@all 大家开始做第3块" -ForegroundColor White
Write-Host "  3. 所有 AI 窗口会自动收到消息并激活" -ForegroundColor White
Write-Host ""
Write-Host "  定向发送：@cursor 你接战斗动作" -ForegroundColor Gray
Write-Host "  组合发送：@claude @kimi 你们配合一下" -ForegroundColor Gray
Write-Host ""
