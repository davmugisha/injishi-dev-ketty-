@echo off
REM Detached dev-server launcher.
REM Harness-spawned processes inherit the session job object and die when the
REM turn ends, so this is launched via WMI Win32_Process.Create instead, which
REM starts outside that job. Logs go to dev.log at the repo root.
cd /d "%~dp0.."
call pnpm --filter @injishi/web dev > "%~dp0..\dev.log" 2>&1
