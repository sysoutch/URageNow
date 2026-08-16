-- Write a plain-text scene report for the active 3ds Max scene.
local outputPath = (getDir #temp) + "\\urage-3dsmax-scene-report.txt"
local reportFile = createFile outputPath
format "suite=3dsmax\n" to:reportFile
format "scene=%\n" maxFilePath to:reportFile
format "selected=%\n" selection.count to:reportFile
format "geometry=%\n" (objects.count) to:reportFile
for node in selection do format "selection=%\n" node.name to:reportFile
close reportFile
format "URage scene report written to: %\n" outputPath
