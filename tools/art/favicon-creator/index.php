<?php
// Read and include the content from index.html
$htmlContent = file_get_contents("index.html");
?>

<?php
// Include the footer before the </body> tag of the $htmlContent content where data-theme can be any value and is optional
$headerCss = "<link rel=\"stylesheet\" href=\"../../header.css\">";
$footerCss = "<link rel=\"stylesheet\" href=\"../../footer.css\">";
$toolShellCss = "<link rel=\"stylesheet\" href=\"../../tool-shell.css\">";
$faCss = "<link href=\"../../shared/libs/fontawesome/css/all.min.css\" rel=\"stylesheet\">";
$htmlContent = str_replace("</head>", $headerCss . $footerCss . $toolShellCss . $faCss . "</head>", $htmlContent);
?>

<?php
// Preserve any body attributes from index.html while wrapping the tool shell.
$header = file_get_contents("../../header.html");
$contentWithHeader = preg_replace('/<body([^>]*)>/', '<body$1>' . $header . '<div class="app-shell">', $htmlContent, 1);
?>

<?php
// Include the footer before the </body> tag of the $htmlContent content where data-theme can be any value and is optional
$footer = file_get_contents("../../footer.html");
echo str_replace("</body>", "</div>" . $footer . "</body>", $contentWithHeader);
?>
