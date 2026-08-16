-- Reset transforms only for the explicit selection.
if selection.count == 0 then
(
  messageBox "Select at least one object before resetting transforms." title:"URage"
)
else
(
  for node in selection do
  (
    resetXForm node
    collapseStack node
  )
  format "Reset XForm for % object(s).\n" selection.count
)
