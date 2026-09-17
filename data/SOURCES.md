# Where the command facts came from

Every command in `data/commands.js` was checked against Microsoft Learn before it was
written. Syntax, switches, whether administrator rights are needed, and whether the
command reads or changes the system were all verified against the current documentation,
not from memory.

Below are the places where two sources disagreed. Both readings are shown. Nothing was
silently picked.

## part-a.js

Verification notes and source conflicts (checked against learn.microsoft.com, September 2026):

1. Conflict on "netsh winhttp show proxy": the current Windows Commands reference
   (learn.microsoft.com/windows-server/administration/windows-commands/netsh-winhttp) still lists and
   demonstrates "netsh winhttp show proxy" as a working example with no deprecation notice. A separate,
   older Win32 API page (learn.microsoft.com/windows/win32/winhttp/netsh-exe-commands) states "show proxy
   is deprecated. Use show advproxy instead." This file keeps "show proxy" because it is what the actively
   maintained command reference documents today, and because "show proxy" (classic static proxy) and
   "show advproxy" (newer per-user or autodetect proxy) are not simple synonyms for the same setting.

2. Conflict on whether "netsh winhttp show proxy" needs elevation: a Microsoft Azure File Sync
   troubleshooting article says to run it "from an elevated command prompt or PowerShell," while a
   separate Microsoft Virtual Machine Manager troubleshooting article shows the same command with no
   elevation mentioned. This file marks adminRequired as false for that command, since it only reads a
   machine-wide setting, but a technician on a locked-down machine should try an elevated prompt if a
   plain prompt shows nothing useful.

3. WMIC (wmic.exe) was deliberately not used anywhere in this file. Microsoft documents WMIC as deprecated
   since Windows 10 version 21H1, and as removed (no longer available even as an optional Feature on
   Demand) from Windows 11 version 24H2 and newer as of August 2026. PowerShell's Get-CimInstance is used
   instead for the system model and serial number lookup, since it reads the same data and keeps working
   on current and future Windows 11 builds.

4. quser is marked as requiring administrator rights. The official reference page states plainly that
   "you must have Full Control permission or special access permission" to use it, and this is consistent
   with reports of standard, non-elevated sessions receiving an access denied error when querying sessions.

---

## part-b.js

Verification notes and source conflicts found while building this file.

1. Order of sfc and DISM. Microsoft's own guidance is not fully consistent.
   The Windows Hardware Dev Center article "Repair a Windows Image"
   (learn.microsoft.com/windows-hardware/manufacture/desktop/repair-a-windows-image)
   says to try sfc /scannow first for a quick check, and use DISM /Cleanup-Image
   only for a more extensive check on the component store. Several Microsoft
   troubleshoot articles, for example the pages for update errors 0x80071A91 and
   0x80070005 (learn.microsoft.com/troubleshoot/windows-client/installing-updates-features-roles/)
   and the KB on SFC flagging Windows Defender PowerShell files as corrupted,
   instead run DISM /Online /Cleanup-Image /RestoreHealth before sfc /scannow,
   reasoning that sfc repairs files from the component store, so the store
   should be healthy first. This file lists sfc /scannow (id 51) and DISM
   RestoreHealth (id 53) as separate entries and does not force an order on the
   technician. When both are needed on the same machine, running DISM before sfc
   matches the more common Microsoft troubleshooting guidance.

2. Steps to reset the Windows Update components also differ slightly between
   Microsoft's own troubleshoot articles. The page
   learn.microsoft.com/troubleshoot/windows-client/installing-updates-features-roles/additional-resources-for-windows-update
   gives a short version that only stops and restarts wuauserv and deletes the
   SoftwareDistribution folder outright. Other Microsoft troubleshoot articles,
   for example the pages for update errors 0x80070005, 0x80071A91 and
   0x80240439, repeat a longer version that also stops bits and cryptsvc and
   renames, rather than deletes, both SoftwareDistribution and catroot2. Id 56
   in this file uses the longer, rename based version, since it appears more
   consistently across Microsoft's troubleshooting content and a rename is
   easier to undo than a delete.

3. The Windows Management Instrumentation command line tool (WMIC) is
   documented as deprecated since Windows 10 version 21H1, and as removed from
   Windows 11 version 24H2 and 25H2 as of the August 2026 servicing update
   (learn.microsoft.com/windows/whats-new/removed-features and
   learn.microsoft.com/windows/win32/wmisdk/wmic). No command in this file
   uses wmic. PowerShell Get-CimInstance and the Storage module cmdlets
   (Get-Disk, Get-Volume, Get-PhysicalDisk) were used instead, since Microsoft
   documents these as the current replacement.

4. Id 38, Get-CimInstance -ClassName Win32_StartupCommand, is marked as
   requiring an administrator prompt. This is not obvious from the command
   text. Microsoft's reference page for the Win32_StartupCommand WMI class
   (learn.microsoft.com/windows/win32/cimwin32prov/win32-startupcommand)
   states that the calling process must hold the SeRestorePrivilege, a
   privilege normally available only in an elevated Administrator session,
   not in a standard non-elevated session even when the signed in account is
   an administrator.

---

## part-c.js

Verification notes (2026-09-16), checked against learn.microsoft.com:
- MSOnline and AzureAD (and AzureAD Preview) PowerShell modules are deprecated; Azure AD Graph API
  is in its retirement path (fully retired 2025-08-31). No command in this file uses those modules
  or Azure AD Graph. Entra ID lookups use the current Microsoft Graph PowerShell SDK (Microsoft.Graph.Users,
  Microsoft.Graph.Reports, Microsoft.Graph.DeviceManagement modules), confirmed current on learn.microsoft.com.
- Conflict found: powercfg /batteryreport. The official command-line reference
  (learn.microsoft.com/windows-hardware/design/device-experiences/powercfg-command-line-options) does not
  list an elevation requirement for /batteryreport, unlike /systemsleepdiagnostics and /systempowerreport,
  which explicitly state "requires administrator privileges and must be executed from an elevated command
  prompt." A separate Microsoft doc ("Delivering a great energy efficiency experience with Modern Standby")
  shows /batteryreport run from an elevated prompt as a matter of habit. This file follows the dedicated
  command reference and marks adminRequired false for /batteryreport, while powercfg /energy is marked
  adminRequired true on the explicit instruction in a separate Microsoft Learn article
  (windows-hardware/drivers/usbcon/usb-etw-and-power-management) to "run the following command from an
  elevated command prompt: powercfg /energy".
- dsregcmd /status does not require an elevated prompt for normal user-context status (Microsoft Learn:
  "Troubleshoot devices by using the dsregcmd command" says to run it "as a domain user account"); some
  diagnostic sub-sections (for example KeySignTest) only populate when run elevated, and running it elevated
  can even blank the WamDefaultSet field, so the non-elevated form is the one included here.
