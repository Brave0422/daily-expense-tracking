#!/bin/bash
# 在Mac上记录真实工具链并编译应用和测试；指定SIMULATOR_ID后才运行设备测试。
set -euo pipefail

# 当前脚本所在ios工程绝对路径，避免从其他目录调用时输出错位。
IOS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 本次可审查的日志与结果包目录，不提交凭证或业务数据。
ARTIFACTS_DIR="$IOS_ROOT/artifacts"
mkdir -p "$ARTIFACTS_DIR"
cd "$IOS_ROOT"

# 记录实际安装版本，不把兼容工程元数据当作已经使用过的工具链。
xcodebuild -version | tee "$ARTIFACTS_DIR/toolchain.txt"
xcrun swift --version | tee -a "$ARTIFACTS_DIR/toolchain.txt"
xcrun --sdk iphonesimulator --show-sdk-version | tee -a "$ARTIFACTS_DIR/toolchain.txt"
xcodebuild -list -project DailyExpenseTracking.xcodeproj | tee "$ARTIFACTS_DIR/project-list.txt"

# 模拟器构建无需开发团队；build-for-testing同时检查三种target的类型和链接。
xcodebuild -project DailyExpenseTracking.xcodeproj -scheme DailyExpenseTracking \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath DerivedData CODE_SIGNING_ALLOWED=NO build-for-testing \
  | tee "$ARTIFACTS_DIR/build.log"

# SIMULATOR_ID为用户选定的可用模拟器UDID；未提供时只列出后续验证入口。
if [[ -n "${SIMULATOR_ID:-}" ]]; then
  # 结果包采用唯一时间名称，避免覆盖上次测试证据。
  RESULT_NAME="TestResults-$(date +%Y%m%d-%H%M%S).xcresult"
  xcodebuild -project DailyExpenseTracking.xcodeproj -scheme DailyExpenseTracking \
    -configuration Debug -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
    -derivedDataPath DerivedData -resultBundlePath "$ARTIFACTS_DIR/$RESULT_NAME" \
    CODE_SIGNING_ALLOWED=NO test-without-building | tee "$ARTIFACTS_DIR/tests.log"
else
  printf '%s\n' '构建完成；请用xcrun simctl list devices available获取UDID，再设置SIMULATOR_ID运行本脚本。'
fi
