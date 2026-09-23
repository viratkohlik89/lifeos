$js = Get-Content 'src\js\main.js' -Encoding UTF8
$js = $js | Where-Object { -not ($_ -match 'Open pricing' -or $_ -match 'Try NEXUS Pro') }
Set-Content 'src\js\main.js' -Value $js -Encoding UTF8
