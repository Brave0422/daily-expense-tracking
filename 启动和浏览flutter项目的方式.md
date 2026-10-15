# 启动和浏览flutter项目的方式

本文面向已有本项目源码的开发者，介绍通过模拟器、手机调试、安装包和浏览器启动并查看 Flutter 应用的方法。

以下项目命令均在 `app/` 目录执行，该目录包含 `pubspec.yaml`。Android 示例使用 Windows PowerShell；iOS 使用 Mac 终端；Web 可使用 Windows 或 Mac。路径、设备 ID 和接口地址按实际情况替换。

## 1. 选择方式与准备环境

### 浏览方式对照

| 方式 | 查看位置 | 适用场景 |
| --- | --- | --- |
| Android 模拟器（2.2～2.3） | 电脑上的虚拟手机 | 开发、调试，支持热重载 |
| Android USB 调试（2.4） | 安卓手机 | 连接数据线查看实际效果 |
| Android Wi-Fi 扫码配对（2.5） | 安卓手机 | 无线调试，支持热重载 |
| APK 下载链接或二维码（2.6） | 安卓手机 | 安装后体验，修改后重新打包 |
| iOS 模拟器（3.2） | Mac 上的虚拟 iPhone | 开发、调试，支持热重载 |
| iPhone 真机调试（3.3） | iPhone | 连接 Mac 查看实际效果 |
| TestFlight 邀请链接或二维码（3.4） | iPhone | 安装测试版供他人体验 |
| Flutter Web 链接或二维码（4） | 电脑／手机浏览器 | 无需安装 App，可本地调试或分享站点 |

### 运行环境

| 运行目标 | 需要准备 |
| --- | --- |
| Android | Windows、Flutter SDK、Android Studio、Android SDK、完整 JDK 21、Android 模拟器或真机 |
| iOS | Mac、Flutter macOS SDK、完整 Xcode、iOS 模拟器或 iPhone |
| Web | Flutter SDK、Chrome 或手机浏览器 |

Windows 可以直接运行 Android 版本。iOS 编译和官方模拟器需要 macOS；在 Windows 屏幕上查看 iOS 时，先远程连接 Mac，再在 Mac 上执行第 3 节操作。[Flutter iOS 环境要求](https://docs.flutter.dev/platform-integration/ios/setup)

### 安装 Flutter SDK

1. 从 [Flutter SDK 归档页面](https://docs.flutter.dev/install/archive)下载本项目使用的 **Flutter 3.47.7 stable**，选择对应操作系统和芯片架构。Dart 随 SDK 提供。
2. 解压 SDK，将其 `bin` 目录加入环境变量：
   - Windows：在用户环境变量 `Path` 中添加 SDK 的 `bin`，例如 `D:\tools\flutter\bin`。
   - macOS：假设解压到 `~/development/flutter`，在 `~/.zprofile` 中添加：

     ```zsh
     export PATH="$HOME/development/flutter/bin:$PATH"
     ```

3. 重新打开终端，执行 `flutter --version`，确认能显示版本信息。[Flutter 环境变量配置](https://docs.flutter.dev/install/add-to-path)

## 2. Android：启动并查看

### 2.1 配置 Android 工具链

1. 安装并打开 [Android Studio](https://developer.android.com/studio)。
2. 进入 `Tools → SDK Manager`；欢迎页可从 `More Actions → SDK Manager` 进入。
3. 在 `SDK Platforms` 中安装 **Android API 36**；在 `SDK Tools` 中安装 **Build-Tools、Platform-Tools、Command-line Tools、Android Emulator**。NDK、CMake 按构建提示安装对应版本。
4. 记录 `Android SDK Location`，将 Flutter 指向该目录。默认路径示例：

   ```powershell
   flutter config --android-sdk "$env:LOCALAPPDATA\Android\Sdk"
   ```

5. 执行环境检查，并按提示处理许可：

   ```powershell
   flutter doctor --android-licenses
   flutter doctor -v
   ```

6. 如果检查提示 Java 不兼容，安装完整 JDK 21，再指定其实际目录：

   ```powershell
   flutter config --jdk-dir "D:\tools\jdk-21"
   ```

确认 `Android toolchain` 没有阻止运行的问题。[Flutter Android 环境配置](https://docs.flutter.dev/platform-integration/android/setup)

### 2.2 创建并启动模拟器

1. 打开 Android Studio 的 `Tools → Device Manager`；欢迎页从 `More Actions → Virtual Device Manager` 进入。
2. 点击 `Create Virtual Device`，选择一款 Phone 设备。
3. 下载并选择 API 36 系统镜像。Intel／AMD x64 Windows 选择 `x86_64` 镜像。
4. 完成创建，点击设备旁的播放按钮，等待进入 Android 桌面。
5. 执行以下命令，记录 Android 模拟器的设备 ID，例如 `emulator-5554`：

   ```powershell
   flutter devices
   ```

### 2.3 运行项目

在 `app/` 目录执行：

```powershell
flutter pub get
dart run build_runner build
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

将设备 ID 和接口地址换成实际值，接口地址示例见第 5 节。首次编译完成后，应用会自动安装并打开，在模拟器窗口中即可操作和查看效果。

### 2.4 Android 真机：USB 调试

1. 在手机上开启“开发者选项”和“USB 调试”。
2. 用数据线连接 Windows，在手机上允许 USB 调试授权。
3. 执行 `flutter devices` 获取手机 ID，再按第 2.3 节运行，将 `-d` 后的设备 ID 替换为手机 ID。

真机访问开发电脑上的接口时，使用电脑的局域网地址，例如 `http://192.168.1.10:3000`。

### 2.5 Android 真机：Wi-Fi 扫码配对

准备 Android 11 或更高版本的手机，手机和电脑连接同一 Wi-Fi。

1. 手机进入“开发者选项”，开启“无线调试”。
2. Android Studio 中选择 `Pair Devices Using Wi-Fi`，切换到二维码配对页。
3. 手机进入“无线调试 → 使用二维码配对设备”，扫描电脑上的二维码。
4. 配对成功后执行 `flutter devices`，确认手机已出现在列表。
5. 按第 2.3 节安装依赖并运行，将设备 ID 换成手机 ID，接口地址换成手机可访问的地址。

这个二维码用于连接调试设备。连接后由 Flutter 安装并启动项目 App，修改 Dart 代码可热重载。[Android 无线调试与扫码配对](https://developer.android.com/studio/run/device#wireless)

### 2.6 Android：扫码下载 APK 后安装

适用于让手机直接安装体验，无需持续连接开发电脑。

1. 构建测试 APK，将接口地址替换为体验手机能够访问的地址：

   ```powershell
   flutter pub get
   dart run build_runner build
   flutter build apk --debug --dart-define=API_BASE_URL=http://192.168.1.10:3000
   ```

2. 找到生成的 `build/app/outputs/flutter-apk/app-debug.apk`，可直接传到手机安装。
3. 需要扫码安装时，将 APK 放到手机可访问的文件下载地址，再将下载链接生成为二维码。
4. 手机扫码后用浏览器下载，按系统提示允许该来源安装应用，安装后打开 App。

此二维码用于下载 APK。修改代码后需重新构建并安装；安装包中的接口地址由构建参数决定。[Flutter Android 构建与安装](https://docs.flutter.dev/deployment/android)

## 3. iOS：启动并查看

以下操作在 Mac 上执行。本项目 iOS 最低部署版本为 **15.0**，所选模拟器和真机系统版本需满足该要求。

### 3.1 配置 Xcode

1. 从 Mac App Store 安装 [Xcode](https://developer.apple.com/xcode/)，打开并完成首次组件安装。
2. 在 Mac 终端依次执行，按提示接受许可：

   ```zsh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   sudo xcodebuild -license
   ```

3. 下载 iOS 平台、模拟器运行时及 Flutter 构建资源，再检查环境：

   ```zsh
   xcodebuild -downloadPlatform iOS
   flutter precache --ios
   flutter doctor -v
   ```

确认 `Xcode` 工具链没有阻止运行的问题。本项目已接入 Swift Package Manager；若运行时提示需要 CocoaPods，按 [CocoaPods 安装指南](https://guides.cocoapods.org/using/getting-started.html)安装后重试。[Flutter iOS 环境配置](https://docs.flutter.dev/platform-integration/ios/setup)

### 3.2 启动 iOS 模拟器并运行

1. 在 Xcode 的 `Window → Devices and Simulators → Simulators` 中，选择已有设备；没有设备时点击 `+` 创建一台 iPhone 模拟器。
2. 打开模拟器应用：Xcode 26 及更早版本执行 `open -a Simulator`；Xcode 27 执行 `open -a DeviceHub`。
3. 等待模拟器进入系统桌面，执行 `flutter devices`，记录 iOS 模拟器设备 ID。
4. 在 `app/` 目录执行：

   ```zsh
   flutter pub get
   dart run build_runner build
   flutter run -d "<iOS模拟器设备ID>" --dart-define=API_BASE_URL=http://127.0.0.1:3000
   ```

替换设备 ID 和接口地址。编译完成后，应用自动打开，在模拟器窗口中即可查看效果。[Flutter 模拟器启动说明](https://docs.flutter.dev/platform-integration/ios/setup)

### 3.3 使用 iPhone 真机

1. 用数据线连接 iPhone 和 Mac，解锁手机并选择“信任这台电脑”。
2. iOS 16 及更高版本进入 `设置 → 隐私与安全性 → 开发者模式`，开启并按提示重启。[Apple 开发者模式说明](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
3. 在 Xcode 的账户设置中登录 Apple 账户；在 `app/` 目录执行：

   ```zsh
   flutter pub get
   dart run build_runner build
   open ios/Runner.xcworkspace
   ```

4. 选择 `TARGETS → Runner → Signing & Capabilities`，勾选 `Automatically manage signing`，选择自己的 `Team`，填写自己可用的唯一 `Bundle Identifier`。
5. 等待 Xcode 完成设备与签名配置，执行 `flutter devices` 获取 iPhone 设备 ID，然后运行：

   ```zsh
   flutter run -d "<iPhone设备ID>" --dart-define=API_BASE_URL=http://192.168.1.10:3000
   ```

6. 按提示处理手机上的开发者信任和局域网访问权限，在 iPhone 上查看应用。

将示例地址替换为手机能访问的接口地址。真机调试需要有效的开发签名，个人调试可使用 Apple 免费账户，具体能力以 Xcode 签名检查结果为准。[Flutter 真机调试配置](https://docs.flutter.dev/platform-integration/ios/setup)

### 3.4 iOS：通过 TestFlight 安装测试版

应用提供方需要 Mac／Xcode、Apple Developer Program 会员资格、App Store Connect 中的应用记录及有效签名；签名设置参照第 3.3 节。体验者只需 iPhone 和 TestFlight。

1. 在 Mac 上构建，填入手机可访问的 HTTPS 接口地址：

   ```zsh
   flutter pub get
   dart run build_runner build
   flutter build ipa --release --dart-define=API_BASE_URL=https://api.example.com
   ```

2. 通过 Xcode Organizer 上传构建归档，或使用 Transporter 上传 `build/ios/ipa/` 中的 IPA 到 App Store Connect。
3. 在 App Store Connect 的 TestFlight 中选择构建并添加测试人员；外部测试按要求完成审核，取得邀请链接。
4. 将邀请链接发给体验者，也可将链接生成为二维码。体验者在 iPhone 安装 TestFlight，打开邀请链接或扫码，再安装测试版。

修改代码后需要重新构建、上传并更新测试版。面向 iPhone 的 IPA 需要匹配签名和分发方式，不能直接拖入 Android 或 iOS 模拟器运行。[Flutter iOS 构建与 TestFlight 分发](https://docs.flutter.dev/deployment/ios)、[Apple TestFlight 说明](https://testflight.apple.com/)

## 4. Flutter Web：浏览器及扫码访问

本项目已区分原生端与浏览器的 Cookie 管理，并配置 Flutter 开发代理。

| 目录 | 用途 |
| --- | --- |
| `app/web/` | Flutter Web 入口文件，包含 `index.html`、图标和 manifest |
| `app/build/web/` | `flutter build web` 生成的浏览器发布文件 |
| 仓库根目录的 `web/` | 原有 Vue 项目，与 Flutter 工程相互独立 |

`flutter create . --platforms=web` 中的 `.` 表示当前目录。在 `app/` 执行时生成的是 `app/web/`；本项目已有该目录，无需再次生成。

### 4.1 在电脑的 Chrome 中运行

1. 在包含 `pubspec.yaml` 的 `app/` 目录执行：

   ```powershell
   flutter pub get
   dart run build_runner build
   flutter run -d chrome
   ```

2. 等待编译完成，Chrome 自动打开 `http://localhost:5174`，即可查看登录页和操作应用。
3. 保留运行终端，修改 Dart 代码后按 `r` 热重载。

项目的 `app/web_dev_config.yaml` 将开发端口固定为 `5174`，接口请求同源转发到 `http://127.0.0.1:3000`。接口运行在其他地址时，修改该文件的 `target`。本地预览使用上述命令即可，无需传入 `API_BASE_URL`；接口不可访问时页面会显示连接失败及重试入口。

文中的 `https://api.example.com` 是占位示例，不能作为真实接口使用。主动指定其他接口地址时，需填写实际地址，并满足浏览器的跨域及 Cookie 要求。[Flutter Web 开发代理](https://docs.flutter.dev/platform-integration/web/web-dev-config-file)

### 4.2 手机浏览器访问开发预览

1. 手机和电脑连接同一 Wi-Fi，在 `app/` 目录执行：

   ```powershell
   flutter run -d web-server --web-hostname=0.0.0.0
   ```

2. 在手机浏览器打开 `http://电脑的局域网IP:5174`，例如 `http://192.168.1.10:5174`。Windows 防火墙如有提示，允许该开发服务通过当前专用网络。
3. 也可将这个网址生成为二维码，手机扫码后在浏览器打开。
4. 保持开发命令运行；修改代码后，在终端按 `r` 重载，并按需刷新手机页面。

手机请求仍通过 Flutter 开发代理访问接口，直接使用预览网址即可，无需安装 App。[Flutter Web 运行方式](https://docs.flutter.dev/platform-integration/web/building)

### 4.3 构建可分享的 Web 站点

1. 在 `app/` 目录构建：

   ```powershell
   flutter build web
   ```

2. 将生成的 `app/build/web/` 部署到 HTTPS 站点，并将 `/auth`、`/verification-codes`、`/categories`、`/tags`、`/transactions`、`/statistics` 接口路径转发到实际服务，保持页面与接口同源。
3. 将站点链接发给体验者或生成为二维码，安卓和 iPhone 均可使用浏览器打开。
4. 修改代码后重新构建并更新站点文件。

`web_dev_config.yaml` 的代理仅在 Flutter 开发服务中生效，发布站点需配置对应的接口转发。独立接口域名可通过实际的 `API_BASE_URL` 构建参数指定，并配置匹配的跨域与 Cookie 策略。[Flutter Web 构建说明](https://docs.flutter.dev/platform-integration/web/building)

## 5. 运行参数与界面刷新

### 接口地址参数

本项目通过 `--dart-define=API_BASE_URL=地址` 指定接口地址，以下仅用于选择 Flutter 启动参数：

| 运行场景 | `API_BASE_URL` 示例 |
| --- | --- |
| Windows 上的官方 Android 模拟器 | `http://10.0.2.2:3000` |
| Mac 上的 iOS 模拟器，接口也在同一台 Mac | `http://127.0.0.1:3000` |
| iOS 模拟器访问其他电脑，或 Android／iPhone 真机 | 对应电脑可访问的局域网地址，例如 `http://192.168.1.10:3000` |
| Flutter Web 本地开发 | 通常省略此参数，默认使用页面同源地址和开发代理 |
| 任意设备访问已部署的服务 | 实际服务地址；`https://api.example.com` 仅为占位示例 |

本项目 Release 构建（例如 TestFlight）要求 HTTPS 接口地址。

使用局域网地址时，设备与接口所在电脑需能够互通；iOS 弹出局域网权限请求时选择允许。`10.0.2.2` 是官方 Android 模拟器的宿主机地址，不能用于 iOS。[Android 模拟器网络说明](https://developer.android.com/studio/run/emulator-networking)

### 热重载

运行 `flutter run` 后保留终端。修改并保存 Dart 文件，在该终端按：

| 按键 | 操作 |
| --- | --- |
| `r` | 热重载，查看界面变化 |
| `R` | 热重启 |
| `q` | 退出调试 |

修改接口地址或原生配置后，重新执行运行命令；修改模型声明后，先执行 `dart run build_runner build`。APK、TestFlight 和已部署 Web 版本的更新按各节重新构建与分发。

## 6. 常见启动问题

| 问题 | 处理方式 |
| --- | --- |
| 找不到 `flutter` 命令 | 检查 Flutter SDK 的 `bin` 是否加入 `Path`，重新打开终端 |
| 找不到 Android SDK 或 Java 不兼容 | 执行 `flutter doctor -v`，按第 2.1 节指定 SDK 或完整 JDK 目录 |
| Android 模拟器无法启动 | 检查 BIOS 虚拟化及 Windows Hypervisor Platform，参考[模拟器加速配置](https://developer.android.com/studio/run/emulator-acceleration) |
| `flutter devices` 没有目标设备 | 启动模拟器；真机检查 USB 授权，iPhone 另检查开发者模式和 Xcode 设备识别 |
| 扫码配对后找不到 Android 手机 | 确认手机仍开启无线调试、两端在同一 Wi-Fi，并重新配对 |
| APK 安装后连接失败 | 检查构建时的 `API_BASE_URL` 是否为手机可访问的地址 |
| Web 页面提示网络连接失败 | 检查 `app/web_dev_config.yaml` 中的 `target`，确认对应接口可访问 |
| Web 启动时报 CookieManager 不支持浏览器 | 更新项目代码，结束旧的 `flutter run` 后重新启动 |
| Web 文件生成位置不清楚 | `app/web/` 是 Flutter 入口；仓库根目录的 `web/` 是独立 Vue 项目 |
| iPhone 提示签名失败 | 检查 Runner 的 Team、唯一 Bundle Identifier 和自动签名设置 |
| Windows 无法构建 iOS | 在 Mac 上执行 iOS 构建和运行命令；Windows 可通过远程桌面查看 Mac 中的模拟器 |
