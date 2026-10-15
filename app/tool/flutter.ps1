<#
运行当前项目的 Flutter 命令，只设置本次进程的 SDK/JDK 环境。
FlutterArguments 为原样转发给 Flutter 的参数，例如 run、test 或 build apk --debug。
本机路径从未提交的 toolchain.local.json 读取；没有配置则使用 PATH 中的 Flutter。
#>
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FlutterArguments
)
# 脚本错误立即退出，避免将失败检查当作通过。
$ErrorActionPreference = 'Stop'
# 当前 app 工程绝对目录。
$appDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
# 本机工具链配置文件，忽略于 Git。
$configPath = Join-Path $appDirectory 'toolchain.local.json'
# 默认为使用系统已配置的 Flutter 命令。
$flutterExecutable = 'flutter'
# 保存 Android SDK 环境变量，脚本结束后恢复调用者的配置。
$originalAndroidHome = $env:ANDROID_HOME
# 保存备用 SDK 根目录，避免影响其他项目。
$originalAndroidSdkRoot = $env:ANDROID_SDK_ROOT
# 保存原 JDK 路径。
$originalJavaHome = $env:JAVA_HOME
# 保存原 JVM 参数。
$originalJavaToolOptions = $env:JAVA_TOOL_OPTIONS
if (Test-Path -LiteralPath $configPath) {
    # 开发者本机工具链配置，不包含账户凭证。
    $toolchainConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $flutterExecutable = Join-Path $toolchainConfig.flutterSdk 'bin/flutter.bat'
    $env:ANDROID_HOME = $toolchainConfig.androidSdk
    $env:ANDROID_SDK_ROOT = $toolchainConfig.androidSdk
    $env:JAVA_HOME = $toolchainConfig.javaHome
    if ($toolchainConfig.javaTemporaryDirectory) {
        # 短路径避免 Windows AF_UNIX 临时 socket 连接失败，仅影响本次工具进程。
        $javaTempPath = $toolchainConfig.javaTemporaryDirectory
        New-Item -ItemType Directory -Path $javaTempPath -Force | Out-Null
        $env:JAVA_TOOL_OPTIONS = "$env:JAVA_TOOL_OPTIONS -Djava.io.tmpdir=$javaTempPath -Djdk.net.unixdomain.tmpdir=$javaTempPath"
    }
}
Push-Location -LiteralPath $appDirectory
try {
    & $flutterExecutable @FlutterArguments
    # 返回 Flutter 的实际退出码，不吞掉检查失败。
    $flutterExitCode = $LASTEXITCODE
} finally {
    Pop-Location
    $env:ANDROID_HOME = $originalAndroidHome
    $env:ANDROID_SDK_ROOT = $originalAndroidSdkRoot
    $env:JAVA_HOME = $originalJavaHome
    $env:JAVA_TOOL_OPTIONS = $originalJavaToolOptions
}
exit $flutterExitCode
