$file = 'src\js\main.js'
$lines = Get-Content $file -Encoding UTF8

for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'demoWorkspace\(\) \{') {
        if ($lines[$i+1] -match 'return this._reconcile\(') {
            $lines[$i+1] = "      return this._reconcile({ tasks: [], projects: [], goals: [], habits: [], upcoming: [], notes: [], journal: [], inbox: [], time: [], activity: [], transactions: [], files: [], user: { name: '', focus: [], onboardedAt: null }, finance: { currency: 'USD', budgets: {} } });"
            break
        }
    }
}

$lines | Set-Content $file -Encoding UTF8
