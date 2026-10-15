# 本脚本只从 Web 读取图标，生成 App 自有 SVG 与映射，不修改原资源。
# 任一源目录读取失败时终止，防止将缺失资源误判为需要清理的旧图标。
$ErrorActionPreference = 'Stop'
# 当前脚本目录用于定位 app 与仓库。
$appDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
# Web 分类资源根目录。
$sourceDirectory = Join-Path $appDirectory '../web/src/assets/icons/categories'
# App 平面资源目录。
$targetDirectory = Join-Path $appDirectory 'assets/icons/categories'
New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
# 所有可适配的中心图案文件，排除预览。
$sourceFiles = @('level1', 'level2', 'general') | ForEach-Object {
    # $_ 为当前资源分类子目录，不包括生成预览。
    Get-ChildItem -LiteralPath (Join-Path $sourceDirectory $_) -Filter '*.svg' -File
}
# 清理 Web 已移除的图标，避免 App 的旧资源在重新生成后继续留存。
$expectedFileNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($sourceFile in $sourceFiles) {
    [void]$expectedFileNames.Add($sourceFile.Name)
}
Get-ChildItem -LiteralPath $targetDirectory -Filter '*.svg' -File |
    Where-Object { -not $expectedFileNames.Contains($_.Name) } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName }
# 已生成的 iconKey 映射条目。
$mappingLines = @()
# 每次仅转换当前 SVG，去除依赖 CSS 的圆形背景。
foreach ($sourceFile in $sourceFiles) {
    # 源 SVG 原文，中心图案保持不变。
    $svgText = (Get-Content -LiteralPath $sourceFile.FullName -Raw).Replace("`r`n", "`n")
    # 背景由 Flutter 根据后端颜色绘制，移除 var() 的背景 path。
    $adaptedText = $svgText -replace '<path fill="var\(--category-icon-background,[^\r\n]+\r?\n', ''
    # 内容一致时不重写，避免无意义的资源变动和已打开文件的写入冲突。
    $targetPath = Join-Path $targetDirectory $sourceFile.Name
    $targetText = "$adaptedText`n"
    if (-not (Test-Path -LiteralPath $targetPath) -or [System.IO.File]::ReadAllText($targetPath).Replace("`r`n", "`n") -ne $targetText) {
        [System.IO.File]::WriteAllText($targetPath, $targetText, [System.Text.UTF8Encoding]::new($false))
    }
    $mappingLines += "  'icon-$($sourceFile.BaseName)',"
}
# 生成的集中资源键表，不允许按未知名称拼出任意资源 URL。
$mappingText = "/// 已适配的本地分类 SVG 键；由 tool/adapt_category_icons.ps1 生成。`nconst categoryIconKeys = <String>{`n$($mappingLines -join "`n")`n};`n"
$mappingPath = Join-Path $appDirectory 'lib/core/widgets/category_icon_keys.dart'
if (-not (Test-Path -LiteralPath $mappingPath) -or [System.IO.File]::ReadAllText($mappingPath).Replace("`r`n", "`n") -ne $mappingText) {
    [System.IO.File]::WriteAllText($mappingPath, $mappingText, [System.Text.UTF8Encoding]::new($false))
}
Copy-Item -LiteralPath (Join-Path $sourceDirectory 'THIRD_PARTY_NOTICES.md') -Destination $targetDirectory -Force
