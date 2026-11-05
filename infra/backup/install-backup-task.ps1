# Registers (or replaces) the Windows scheduled task that runs backup.mjs, and copies the tool to a stable folder
# first so that switching git branches can never take the backups away.
#
#   powershell -ExecutionPolicy Bypass -File infra\backup\install-backup-task.ps1 `
#       -ConfigPath "C:\Users\<you>\Documents\injishi-demo\backup.config.json" [-IntervalHours 6] [-Uninstall]
#
# The task runs as the current user, only while that user is logged on (a laptop that is asleep or off misses a run;
# StartWhenAvailable runs it as soon as the machine is back). It changes nothing outside the task and the tool copy.
param(
  [Parameter(Mandatory = $true)][string]$ConfigPath,
  [int]$IntervalHours = 6,
  [string]$TaskName = 'Injishi POS database backup',
  [string]$InstallDir = (Join-Path (Split-Path -Parent $ConfigPath) 'backup'),
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; "removed task '$TaskName' (the backups and the tool copy are left in place)" }
  else { "no task named '$TaskName'" }
  return
}

if (-not (Test-Path $ConfigPath)) { throw "config not found: $ConfigPath" }
$node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force $InstallDir | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot 'backup.mjs') (Join-Path $InstallDir 'backup.mjs')
$script = Join-Path $InstallDir 'backup.mjs'

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`" --config `"$ConfigPath`"" -WorkingDirectory $InstallDir
# First run in 2 minutes, then every $IntervalHours hours, indefinitely.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours $IntervalHours)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Verified pg_dump backups of the Injishi POS demo databases with a restore drill. See infra/backup/BACKUPS.md.' | Out-Null
$t = Get-ScheduledTask -TaskName $TaskName
"registered '$TaskName': every $IntervalHours h, state $($t.State), runs $script"
"next run: " + (Get-ScheduledTaskInfo -TaskName $TaskName).NextRunTime
