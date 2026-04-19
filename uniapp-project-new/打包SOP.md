# CryptoSim Android 打包 SOP

> 技术栈：uni-app (Vue3 + Vite) → H5 → Capacitor → Android Studio / Gradle
> 签名密钥：`/Users/guozhengming/股了个股/QwenCoder/cryptosim-release.keystore`
> 密码：`cryptosim123`，别名：`cryptosim`

---

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18 | `node -v` |
| JDK | 17 | `java -version` |
| Android SDK | API 34/36 | `~/Library/Android/sdk` |
| Gradle | 8.14.3（自动下载）| 工程内置 wrapper |

---

## 完整打包流程（每次发版执行）

### 第一步：进入项目目录

```bash
cd /Users/guozhengming/股了个股/QwenCoder/uniapp-project-new
```

### 第二步：编译 H5 产物

```bash
npm run build:h5
```

> 产物输出到 `dist/build/h5/`

### 第三步：同步资源到 Android 工程

```bash
npx cap sync android
```

> 将 H5 产物复制到 `android/app/src/main/assets/public/`

### 第四步：修复 Java 版本（每次 sync 后必须执行）

```bash
sed -i '' 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' \
  android/app/capacitor.build.gradle \
  android/capacitor-cordova-android-plugins/build.gradle
```

> ⚠️ `cap sync` 每次都会重置这两个文件，必须在 sync 之后执行

### 第五步：打包 Release APK

```bash
cd android
export ANDROID_HOME=~/Library/Android/sdk
./gradlew assembleRelease
```

> 产物路径：`android/app/build/outputs/apk/release/app-release.apk`
> 耗时约 15~30 秒

### 第六步：复制 APK 到根目录

```bash
cp android/app/build/outputs/apk/release/app-release.apk \
  ../CryptoSim-vX.X-release.apk
```

> 将 `vX.X` 替换为实际版本号

---

## 一键打包脚本（推荐）

在 `uniapp-project-new/` 目录下直接运行：

```bash
npm run build:h5 && \
npx cap sync android && \
sed -i '' 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' \
  android/app/capacitor.build.gradle \
  android/capacitor-cordova-android-plugins/build.gradle && \
cd android && \
export ANDROID_HOME=~/Library/Android/sdk && \
./gradlew assembleRelease && \
cp app/build/outputs/apk/release/app-release.apk \
  ../../CryptoSim-release.apk && \
echo "✅ 打包完成：CryptoSim-release.apk"
```

---

## 版本号修改

打包前先更新版本号，编辑 `android/app/build.gradle`：

```groovy
defaultConfig {
    versionCode 2        // 整数，每次发版 +1
    versionName "2.1"    // 用户可见版本号
}
```

---

## 验证签名

```bash
~/Library/Android/sdk/build-tools/35.0.0/apksigner verify --verbose CryptoSim-release.apk
```

正常输出应包含：
```
Verifies
Verified using v2 scheme (APK Signature Scheme v2): true
```

---

## 常见问题

### Q: gradle 报 `无效的源发行版：21`
**A:** 执行第四步的 `sed` 命令，修复 Java 版本。

### Q: 安装 APK 提示"解析包出错"
**A:** 检查签名是否正确，用 `apksigner verify` 验证。

### Q: 打包后 App 连不上网络
**A:** 确认 `binanceService.js` 里的 `IS_CAPACITOR` 判断正确，App 环境应走 `https://fapi.binance.com` 直连。

### Q: 注册/登录失败
**A:** 确认 `supabaseClient.js` 使用原生 `fetch`（不使用 `customFetch`），Capacitor WebView 支持原生 fetch。

### Q: `cap sync` 后需要重新打包吗？
**A:** 是的，`cap sync` 后必须重新执行 `./gradlew assembleRelease`，否则 APK 中的 web 资源不会更新。

---

## 签名密钥备份说明

> ⚠️ **重要**：密钥文件丢失后无法用同一签名发布更新版本，已安装用户需卸载重装。

- 密钥文件：`cryptosim-release.keystore`
- 建议备份到：云盘 / 另一台电脑
- 密码：`cryptosim123`
- 别名：`cryptosim`
