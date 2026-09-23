$file = 'src\js\main.js'
$lines = Get-Content $file -Encoding UTF8

$lines = @("import { App as CapApp } from '@capacitor/app';") + $lines

for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'demoWorkspace\(\) \{') {
        if ($lines[$i+1] -match 'return this._reconcile\(\{\}\);') {
            $lines[$i+1] = '      return this._reconcile({ tasks: [], projects: [], goals: [], habits: [], upcoming: [], notes: [], journal: [], inbox: [], time: [], activity: [] });'
            break
        }
    }
}

for ($i=$lines.Count - 1; $i -ge 0; $i--) {
    if ($lines[$i] -match "if \(typeof window \!== 'undefined'\) window.__NEXUS__ = NEXUS;") {
        $insert = @(
            "  CapApp.addListener('backButton', ({ canGoBack }) => {",
            "    if (location.hash.length > 1 && location.hash !== '#dashboard') {",
            "      window.history.back();",
            "    } else {",
            "      CapApp.exitApp();",
            "    }",
            "  });",
            ""
        )
        $lines = $lines[0..($i-1)] + $insert + $lines[$i..($lines.Count-1)]
        break
    }
}

$lines | Set-Content $file -Encoding UTF8
