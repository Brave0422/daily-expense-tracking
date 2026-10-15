"""生成无第三方运行依赖的Xcode工程；稳定ID使重复执行可审查。"""
import hashlib
import json
import plistlib
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree, indent

# 当前原生工程根目录。
ROOT = Path(__file__).resolve().parents[1]
# 工程产品基础名。
NAME = "DailyExpenseTracking"
# 所有PBX对象，以稳定24位标识索引。
OBJECTS = {}


def identifier(value):
    """value为对象语义名称；返回稳定PBX对象ID。"""
    return hashlib.sha1(value.encode()).hexdigest()[:24].upper()


def add(key, isa, **fields):
    """注册PBX对象；key为稳定语义名，isa为对象类型，fields为对象属性。"""
    # 当前对象稳定标识。
    identity = identifier(key)
    OBJECTS[identity] = {"isa": isa, **fields}
    return identity


def encode(value, depth=0):
    """将value递归编码为OpenStep属性列表；depth控制缩进。"""
    if isinstance(value, dict):
        return "{\n" + "".join("\t" * (depth + 1) + f"{key} = {encode(item, depth + 1)};\n" for key, item in value.items()) + "\t" * depth + "}"
    if isinstance(value, list):
        return "(" + ", ".join(encode(item, depth) for item in value) + ")"
    if isinstance(value, int):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


def file_ref(path, kind=None):
    """注册工程文件；path为根目录相对路径，kind为可选Xcode类型。"""
    return add("file:" + path, "PBXFileReference", path=path, sourceTree="SOURCE_ROOT", lastKnownFileType=kind or ("sourcecode.swift" if path.endswith(".swift") else "text"))


def write_plists():
    """Debug仅允许本地网络，Release无HTTP例外；服务地址由构建变量注入。"""
    # Bundle运行所需通用属性。
    common = {"CFBundleDevelopmentRegion": "zh-Hans", "CFBundleDisplayName": "日常记账", "CFBundleExecutable": "$(EXECUTABLE_NAME)", "CFBundleIdentifier": "$(PRODUCT_BUNDLE_IDENTIFIER)", "CFBundleInfoDictionaryVersion": "6.0", "CFBundleName": "$(PRODUCT_NAME)", "CFBundlePackageType": "APPL", "CFBundleShortVersionString": "$(MARKETING_VERSION)", "CFBundleVersion": "$(CURRENT_PROJECT_VERSION)", "LSRequiresIPhoneOS": True, "API_BASE_URL": "$(API_BASE_URL)", "UILaunchScreen": {"UIColorName": "Page"}, "UIApplicationSceneManifest": {"UIApplicationSupportsMultipleScenes": False}, "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"], "UISupportedInterfaceOrientations~ipad": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]}
    # mode为两种独立构建配置。
    for mode in ["Debug", "Release"]:
        # 每种配置独立复制，避免开发例外进入Release。
        values = dict(common)
        if mode == "Debug":
            values["NSLocalNetworkUsageDescription"] = "连接您配置的局域网开发记账服务，以读取和保存账本。"
            values["NSAppTransportSecurity"] = {"NSAllowsLocalNetworking": True, "NSExceptionDomains": {"localhost": {"NSExceptionAllowsInsecureHTTPLoads": True, "NSIncludesSubdomains": False}}}
        (ROOT / f"Config/Info-{mode}.plist").write_bytes(plistlib.dumps(values, sort_keys=False))


def target(name, resource_refs):
    """创建App或测试target；name为目标名，resource_refs仅用于App资源。"""
    # App、单元测试、UI测试分别从自己的目录收集源文件。
    sources = sorted((ROOT / name).rglob("*.swift"))
    # 源文件引用集合。
    refs = [file_ref(path.relative_to(ROOT).as_posix()) for path in sources]
    # 每个目标的编译条目独立，避免测试源进入正式包。
    builds = [add(f"build:{name}:{ref}", "PBXBuildFile", fileRef=ref) for ref in refs]
    # Source构建阶段。
    source_phase = add("sources:" + name, "PBXSourcesBuildPhase", buildActionMask=2147483647, files=builds, runOnlyForDeploymentPostprocessing=0)
    # 仅App复制资源。
    resources = [add("resource-build:" + ref, "PBXBuildFile", fileRef=ref) for ref in resource_refs] if name == NAME else []
    # 资源构建阶段。
    resource_phase = add("resources:" + name, "PBXResourcesBuildPhase", buildActionMask=2147483647, files=resources, runOnlyForDeploymentPostprocessing=0)
    # Swift导入框架由编译器自动链接。
    framework_phase = add("frameworks:" + name, "PBXFrameworksBuildPhase", buildActionMask=2147483647, files=[], runOnlyForDeploymentPostprocessing=0)
    # 原生产品类型。
    product_type = "com.apple.product-type.application" if name == NAME else ("com.apple.product-type.bundle.ui-testing" if name.endswith("UITests") else "com.apple.product-type.bundle.unit-test")
    # 构建输出的产品引用。
    product = add("product:" + name, "PBXFileReference", explicitFileType="wrapper.application" if name == NAME else "wrapper.cfbundle", includeInIndex=0, path=name + (".app" if name == NAME else ".xctest"), sourceTree="BUILT_PRODUCTS_DIR")
    # 每种配置对象。
    configurations = []
    # mode为Debug或Release，目标配置均明确最低系统。
    for mode in ["Debug", "Release"]:
        # 目标基础构建设置，不推定用户开发团队。
        settings = {"PRODUCT_NAME": "$(TARGET_NAME)", "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator", "SWIFT_VERSION": "5.0", "SWIFT_STRICT_CONCURRENCY": "complete", "IPHONEOS_DEPLOYMENT_TARGET": "17.0"}
        # 仅App通过xcconfig注入环境；测试不能覆盖正式装配。
        fields = {}
        if name == NAME:
            fields["baseConfigurationReference"] = identifier(f"file:Config/{mode}.xcconfig")
            settings["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks"]
        else:
            settings.update({"GENERATE_INFOPLIST_FILE": "YES", "PRODUCT_BUNDLE_IDENTIFIER": "com.example." + name.lower(), "CODE_SIGN_STYLE": "Automatic", "TARGETED_DEVICE_FAMILY": "1,2", "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@executable_path/Frameworks", "@loader_path/Frameworks"]})
            if name.endswith("UITests"):
                settings["TEST_TARGET_NAME"] = NAME
            else:
                settings["TEST_HOST"] = f"$(BUILT_PRODUCTS_DIR)/{NAME}.app/{NAME}"
                settings["BUNDLE_LOADER"] = "$(TEST_HOST)"
        if mode == "Debug":
            settings.update({"SWIFT_OPTIMIZATION_LEVEL": "-Onone", "ENABLE_TESTABILITY": "YES", "DEBUG_INFORMATION_FORMAT": "dwarf"})
        configurations.append(add(f"config:{name}:{mode}", "XCBuildConfiguration", buildSettings=settings, name=mode, **fields))
    # 配置列表。
    config_list = add("configs:" + name, "XCConfigurationList", buildConfigurations=configurations, defaultConfigurationIsVisible=0, defaultConfigurationName="Release")
    # 测试需要先构建App。
    dependencies = []
    if name != NAME:
        # 目标依赖代理。
        proxy = add("proxy:" + name, "PBXContainerItemProxy", containerPortal=identifier("project"), proxyType=1, remoteGlobalIDString=identifier("target:" + NAME), remoteInfo=NAME)
        dependencies.append(add("dependency:" + name, "PBXTargetDependency", target=identifier("target:" + NAME), targetProxy=proxy))
    # 最终原生目标。
    identity = add("target:" + name, "PBXNativeTarget", buildConfigurationList=config_list, buildPhases=[source_phase, framework_phase, resource_phase], buildRules=[], dependencies=dependencies, name=name, productName=name, productReference=product, productType=product_type)
    return identity, product, add("group:" + name, "PBXGroup", children=refs, name=name, sourceTree="<group>")


def write_scheme(targets):
    """生成共享方案；targets依次为App、单元测试、UI测试的PBX元组。"""
    # 根共享方案。
    scheme = Element("Scheme", LastUpgradeVersion="1530", version="1.7")
    # 编译App并用于所有动作。
    build = SubElement(scheme, "BuildAction", parallelizeBuildables="YES", buildImplicitDependencies="YES")
    # 编译条目容器。
    entries = SubElement(build, "BuildActionEntries")
    # App构建条目。
    entry = SubElement(entries, "BuildActionEntry", buildForTesting="YES", buildForRunning="YES", buildForProfiling="YES", buildForArchiving="YES", buildForAnalyzing="YES")
    reference(entry, NAME, targets[0][0])
    # 测试动作同时包括契约与UI测试。
    test = SubElement(scheme, "TestAction", buildConfiguration="Debug", selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB", selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB", shouldUseLaunchSchemeArgsEnv="YES")
    # 测试目标容器。
    tests = SubElement(test, "Testables")
    # index为目标序号，item是PBX元组。
    for index, item in enumerate(targets[1:]):
        # 单元或UI测试名。
        name = NAME + ("Tests" if index == 0 else "UITests")
        reference(SubElement(tests, "TestableReference", skipped="NO", parallelizable="NO"), name, item[0])
    # 启动动作。
    launch = SubElement(scheme, "LaunchAction", buildConfiguration="Debug", selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB", selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB", launchStyle="0", useCustomWorkingDirectory="NO", ignoresPersistentStateOnLaunch="NO", debugDocumentVersioning="YES", debugServiceExtension="internal", allowLocationSimulation="YES")
    reference(SubElement(launch, "BuildableProductRunnable", runnableDebuggingMode="0"), NAME, targets[0][0])
    SubElement(scheme, "ProfileAction", buildConfiguration="Release", shouldUseLaunchSchemeArgsEnv="YES", savedToolIdentifier="", useCustomWorkingDirectory="NO", debugDocumentVersioning="YES")
    SubElement(scheme, "AnalyzeAction", buildConfiguration="Debug")
    SubElement(scheme, "ArchiveAction", buildConfiguration="Release", revealArchiveInOrganizer="YES")
    indent(scheme)
    # 共享方案可由CI和用户直接调用。
    path = ROOT / f"{NAME}.xcodeproj/xcshareddata/xcschemes/{NAME}.xcscheme"
    path.parent.mkdir(parents=True, exist_ok=True)
    ElementTree(scheme).write(path, encoding="utf-8", xml_declaration=True)


def reference(parent, name, identity):
    """添加产品引用；parent为XML节点，name为目标名，identity为PBX目标ID。"""
    SubElement(parent, "BuildableReference", BuildableIdentifier="primary", BlueprintIdentifier=identity, BuildableName=name + (".app" if name == NAME else ".xctest"), BlueprintName=name, ReferencedContainer=f"container:{NAME}.xcodeproj")


def main():
    """生成配置、工程、共享方案及源码本地化目录。"""
    write_plists()
    # 显式资源引用避免复制开发脚本、测试或PRD到App包。
    resources = [file_ref(f"{NAME}/Resources/Assets.xcassets", "folder.assetcatalog"), file_ref(f"{NAME}/Resources/CategoryIconMapping.json", "text.json"), file_ref(f"{NAME}/Resources/THIRD_PARTY_NOTICES.md", "net.daringfireball.markdown"), file_ref(f"{NAME}/Resources/Localizable.xcstrings", "text.json.xcstrings")]
    # 配置文件组。
    configs = [file_ref(f"Config/{name}", "text.xcconfig" if name.endswith("xcconfig") else "text.plist.xml") for name in ["Shared.xcconfig", "Debug.xcconfig", "Release.xcconfig", "Info-Debug.plist", "Info-Release.plist"]]
    # 三个原生目标。
    targets = [target(name, resources) for name in [NAME, NAME + "Tests", NAME + "UITests"]]
    # 产品导航分组。
    products = add("products", "PBXGroup", children=[item[1] for item in targets], name="Products", sourceTree="<group>")
    # 配置导航分组。
    config_group = add("config-group", "PBXGroup", children=configs, name="Config", sourceTree="<group>")
    # 资源导航分组。
    resource_group = add("resource-group", "PBXGroup", children=resources, name="Resources", sourceTree="<group>")
    # 主导航分组。
    main_group = add("main-group", "PBXGroup", children=[item[2] for item in targets] + [resource_group, config_group, products], sourceTree="<group>")
    # 工程通用编译配置。
    project_configs = [add("project-config:" + mode, "XCBuildConfiguration", name=mode, buildSettings={"CLANG_ENABLE_MODULES": "YES", "CLANG_ENABLE_OBJC_ARC": "YES", "SDKROOT": "iphoneos", "IPHONEOS_DEPLOYMENT_TARGET": "17.0", "SWIFT_VERSION": "5.0", "SWIFT_STRICT_CONCURRENCY": "complete", "ENABLE_TESTABILITY": "YES" if mode == "Debug" else "NO"}) for mode in ["Debug", "Release"]]
    # 工程配置列表。
    project_list = add("project-configs", "XCConfigurationList", buildConfigurations=project_configs, defaultConfigurationIsVisible=0, defaultConfigurationName="Release")
    add("project", "PBXProject", attributes={"BuildIndependentTargetsInParallel": "YES", "LastUpgradeCheck": "1530"}, buildConfigurationList=project_list, compatibilityVersion="Xcode 14.0", developmentRegion="zh-Hans", hasScannedForEncodings=0, knownRegions=["zh-Hans", "en", "Base"], mainGroup=main_group, productRefGroup=products, projectDirPath="", projectRoot="", targets=[item[0] for item in targets])
    # OpenStep工程根，不依赖XcodeGen或CocoaPods。
    document = {"archiveVersion": 1, "classes": {}, "objectVersion": 56, "objects": OBJECTS, "rootObject": identifier("project")}
    (ROOT / f"{NAME}.xcodeproj").mkdir(parents=True, exist_ok=True)
    (ROOT / f"{NAME}.xcodeproj/project.pbxproj").write_text("// !$*UTF8*$!\n" + encode(document) + "\n", encoding="utf-8")
    # 自包含工作区引用当前工程，Xcode打开项目后不需外部依赖工程。
    workspace = ROOT / f"{NAME}.xcodeproj/project.xcworkspace"
    workspace.mkdir(exist_ok=True)
    (workspace / "contents.xcworkspacedata").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<Workspace version="1.0"><FileRef location="self:"></FileRef></Workspace>\n', encoding="utf-8")
    write_scheme(targets)
    # 从当前中文静态字面量汇集本地化键，动态数据仍来自服务端。
    import re
    # 可本地化静态字符串集合。
    strings = set()
    # path为每个正式Swift源文件。
    for path in (ROOT / NAME).rglob("*.swift"):
        # value为不包含插值的中文静态文案。
        for value in re.findall(r'"([^"\n]*[\u4e00-\u9fff][^"\n]*)"', path.read_text(encoding="utf-8")):
            if "\\(" not in value and "\\" not in value:
                strings.add(value)
    # String Catalog单语言基线，可继续添加翻译。
    catalog = {"sourceLanguage": "zh-Hans", "strings": {value: {"localizations": {"zh-Hans": {"stringUnit": {"state": "translated", "value": value}}}} for value in sorted(strings)}, "version": "1.0"}
    (ROOT / f"{NAME}/Resources/Localizable.xcstrings").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已生成共享Xcode工程，{sum(len(list((ROOT / name).rglob('*.swift'))) for name in [NAME, NAME + 'Tests', NAME + 'UITests'])}个Swift文件")


if __name__ == "__main__":
    main()
