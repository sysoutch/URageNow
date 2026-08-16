-- Export selected objects to FBX. Change outputPath before executing.
local outputPath = (getDir #export) + "\\urage-selected.fbx"
if selection.count == 0 then
(
  messageBox "Select one or more objects before exporting FBX." title:"URage"
)
else if doesFileExist outputPath then
(
  messageBox ("Refusing to overwrite existing file:\n" + outputPath) title:"URage"
)
else
(
  exportFile outputPath #noPrompt selectedOnly:true using:FBXEXP
  format "URage FBX export written to: %\n" outputPath
)
