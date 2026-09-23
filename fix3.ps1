$html = Get-Content 'index.html' -Raw -Encoding UTF8
$html = $html -replace '(?s)<!-- The visible path to pricing.*?</button>\r?\n', ''
Set-Content 'index.html' -Value $html -Encoding UTF8

$js = Get-Content 'src\js\main.js' -Raw -Encoding UTF8
$js = $js -replace "get isPro\(\) \{ return this\.entitlement\.status === 'PRO'; \},", "get isPro() { return true; },"
$js = $js -replace "(?m)^\s*\$\('#upgradeBtn'\)\.addEventListener\('click', \(\) => Router\.go\('pro'\)\);\r?\n", ""
$js = $js -replace "(?s)      const up = \$\('#upgradeBtn'\);\r?\n      if \(up\) up\.hidden = pro;\r?\n", ""
$js = $js -replace "(?m)^\s*Router\.register\('pro', \(\) => ProPage\.render\(\)\);\r?\n", ""
Set-Content 'src\js\main.js' -Value $js -Encoding UTF8
