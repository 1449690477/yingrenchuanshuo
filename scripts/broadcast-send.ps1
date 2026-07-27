<#
.SYNOPSIS
  聊天室消息广播 —— 把一条消息发送到指定的 AI 窗口
.DESCRIPTION
  用 Win32 SetForegroundWindow 激活窗口 + UIAutomation 自动查找输入框并聚焦 +
  剪贴板粘贴 + 回车提交。UIAutomation 能精准定位编辑框控件，比快捷键可靠得多。
#>
param(
  [Parameter(Mandatory)][string]$titleMatch,
  [string]$focusKeys = "",
  [string]$submitKey = "{ENTER}",
  [Parameter(Mandatory)][string]$msgBase64
)

$ErrorActionPreference = "Stop"

# 解码消息
$msg = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($msgBase64))

# ── 1. 找到目标窗口 ──────────────────────────────────────
$proc = Get-Process |
  Where-Object { $_.MainWindowTitle -like "*$titleMatch*" -and $_.MainWindowTitle -ne "" } |
  Select-Object -First 1

if (-not $proc) {
  Write-Error "找不到窗口: $titleMatch"
  exit 1
}
$hwnd = $proc.MainWindowHandle
$title = $proc.MainWindowTitle
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Error "窗口句柄为空: $title"
  exit 1
}

# ── 2. 编译 Win32 + UIAutomation 调用代码 ─────────────────
$csFile = [System.IO.Path]::GetTempFileName() + ".cs"
$csCode = @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Automation;

public class WinFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  // 用 UIAutomation 查找窗口内的输入框并聚焦
  public static bool FocusInputElement(IntPtr hwnd) {
    try {
      Condition cond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
      TreeScope scope = TreeScope.Descendants;
      AutomationElement element = AutomationElement.FromHandle(hwnd).FindFirst(scope, cond);
      if (element == null) {
        // 找不到 Edit 就找 Document（某些网页型输入框是 Document 类型）
        cond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Document);
        element = AutomationElement.FromHandle(hwnd).FindFirst(scope, cond);
      }
      if (element == null) {
        // 再找自定义控件
        cond = new PropertyCondition(AutomationElement.IsValuePatternAvailableProperty, true);
        element = AutomationElement.FromHandle(hwnd).FindFirst(scope, cond);
      }
      if (element != null) {
        element.SetFocus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
'@
[System.IO.File]::WriteAllText($csFile, $csCode, [System.Text.Encoding]::UTF8)

try {
  # 引用 UIAutomation 相关程序集
  Add-Type -Path $csFile -ReferencedAssemblies @(
    'UIAutomationClient', 'UIAutomationTypes', 'WindowsBase'
  ) -ErrorAction Stop
} catch {
  # 如果已加载过或编译失败，回退到简单方式
  $fallback = $true
} finally {
  Remove-Item $csFile -Force -ErrorAction SilentlyContinue
}

# ── 3. 激活窗口（强制聚焦）──────────────────────────────
[WinFocus]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
[WinFocus]::ShowWindow($hwnd, 5) | Out-Null  # SW_SHOW
Start-Sleep -Milliseconds 300

$fgHwnd = [WinFocus]::GetForegroundWindow()
$outPid = 0
$fgThread = [WinFocus]::GetWindowThreadProcessId($fgHwnd, [ref]$outPid)
$myThread = [WinFocus]::GetCurrentThreadId()
if ($fgThread -ne $myThread -and $fgThread -ne 0) {
  [WinFocus]::AttachThreadInput($myThread, $fgThread, $true) | Out-Null
  [WinFocus]::SetForegroundWindow($hwnd) | Out-Null
  [WinFocus]::AttachThreadInput($myThread, $fgThread, $false) | Out-Null
} else {
  [WinFocus]::SetForegroundWindow($hwnd) | Out-Null
}
Start-Sleep -Milliseconds 600

# ── 4. 用 UIAutomation 聚焦输入框 ────────────────────────
$inputFocused = $false
if (-not $fallback) {
  try {
    $inputFocused = [WinFocus]::FocusInputElement($hwnd)
  } catch {
    $inputFocused = $false
  }
}

# ── 5. 兜底：用 WScript.Shell + 快捷键 ───────────────────
$wsh = New-Object -ComObject WScript.Shell
if (-not $inputFocused) {
  # UIAutomation 失败时，用配置的 focusKeys 快捷键
  if ($focusKeys) {
    $wsh.SendKeys($focusKeys)
    Start-Sleep -Milliseconds 400
  } else {
    # 没配快捷键就按 Tab 几次尝试聚焦到输入框
    $wsh.SendKeys("{TAB}")
    Start-Sleep -Milliseconds 200
  }
}

# ── 6. 复制消息到剪贴板并粘贴 ────────────────────────────
Set-Clipboard -Value $msg
Start-Sleep -Milliseconds 200
$wsh.SendKeys("^v")
Start-Sleep -Milliseconds 600

# ── 7. 提交 ──────────────────────────────────────────────
$wsh.SendKeys($submitKey)
Start-Sleep -Milliseconds 200

Write-Output "OK $title"
