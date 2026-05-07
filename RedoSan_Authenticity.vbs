Set objArgs = WScript.Arguments
If objArgs.Count = 0 Then
    MsgBox "Drag & drop a file onto this icon.", vbInformation, "RedoSan Authenticity"
    WScript.Quit
End If

sFile = objArgs(0)
Set fso = CreateObject("Scripting.FileSystemObject")

If Not fso.FileExists(sFile) Then
    MsgBox "File not found:" & vbCrLf & sFile, vbExclamation, "RedoSan Authenticity"
    WScript.Quit
End If

sScript = fso.GetParentFolderName(WScript.ScriptFullName) & "\RedoSan_Authenticity.bat"
sCmd = "cmd.exe /c """ & sScript & """ """ & sFile & """"
CreateObject("WScript.Shell").Run sCmd, 1, True
