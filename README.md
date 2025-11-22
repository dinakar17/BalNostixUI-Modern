# BalNostixUI-Modern

A modern React Native application built with Expo, featuring TypeScript, NativeWind (Tailwind CSS), and Zustand for state management.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Development](#development)
- [Project Structure](#project-structure)
- [Code Quality](#code-quality)
- [Build Configuration](#build-configuration)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js**: v18 or higher (LTS recommended)
- **npm** or **yarn**: Latest version
- **Java Development Kit (JDK)**: OpenJDK 17.0.13 or compatible
  ```
  openjdk 17.0.13 2024-10-15
  OpenJDK Runtime Environment Temurin-17.0.13+11
  ```
- **Android Studio**: Latest version (for Android development)
- **Xcode**: Latest version (for iOS development, macOS only)

### Android Development Setup

The project uses the following Android configuration:

- **Build Tools**: 36.0.0
- **Min SDK**: 24 (Android 7.0)
- **Compile SDK**: 36
- **Target SDK**: 36
- **NDK**: 27.1.12297006
- **Kotlin**: 2.1.20
- **KSP**: 2.1.20-2.0.1

#### Android Studio Configuration

1. Install Android Studio from [developer.android.com](https://developer.android.com/studio)
2. Open Android Studio and install the following:
   - Android SDK Platform 36
   - Android SDK Build-Tools 36.0.0
   - NDK version 27.1.12297006
   - Android Emulator (optional, for testing)
3. Set up environment variables:
   ```powershell
   # Add to your system environment variables
   ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
   JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot
   ```
4. Add to your PATH:
   ```powershell
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\tools
   %JAVA_HOME%\bin
   ```

### iOS Development Setup (macOS only)

1. Install Xcode from the Mac App Store
2. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```
3. Install CocoaPods:
   ```bash
   sudo gem install cocoapods
   ```

## 🛠 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) 0.81.5
- **Navigation**: [Expo Router](https://expo.github.io/router/) ~6.0.10
- **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) ^4.5.1
- **Language**: TypeScript ~5.9.2
- **Build Tool**: [Expo](https://expo.dev/) ^54.0.0
- **Code Quality**: [Biome](https://biomejs.dev/) ^2.3.6 with [Ultracite](https://github.com/linhub15/ultracite) preset
- **Git Hooks**: [Lefthook](https://github.com/evilmartians/lefthook) ^2.0.4

## 📦 Installation

1. **Clone the repository**

   ```powershell
   git clone <repository-url>
   cd BalNostixUI-Modern
   ```

2. **Install dependencies**

   ```powershell
   npm install
   ```

   or

   ```powershell
   yarn install
   ```

3. **Install Git hooks** (for code quality automation)

   ```powershell
   npx lefthook install
   ```

4. **Prebuild native directories** (if running on device/emulator)
   ```powershell
   npm run prebuild
   ```

## 🚀 Running the App

### Development Server

Start the Expo development server:

```powershell
npm start
```

This will open the Expo Dev Tools in your browser. From there, you can:

- Press `a` to run on Android emulator/device
- Press `i` to run on iOS simulator/device (macOS only)
- Press `w` to run in web browser
- Scan the QR code with Expo Go app on your physical device

### Run on Android

```powershell
npm run android
```

**Requirements**:

- Android emulator running, or
- Physical Android device connected via USB with USB debugging enabled

### Run on iOS (macOS only)

```powershell
npm run ios
```

**Requirements**:

- iOS simulator, or
- Physical iOS device connected

### Run on Web

```powershell
npm run web
```

## 💻 Development

### Code Quality

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards.

#### Quick Commands

```powershell
# Auto-fix formatting and linting issues
npx ultracite fix

# Check for issues without fixing
npx ultracite check

# Diagnose setup issues
npx ultracite doctor

# Run project lint script
npm run lint

# Auto-format code
npm run format
```

#### Pre-commit Hooks

Lefthook is configured to automatically run code quality checks before commits:

- Lints and formats staged files
- Runs type checking
- Validates commit messages (Conventional Commits)

### Key Development Guidelines

- Use **TypeScript** for all new files
- Follow **Ultracite/Biome** code standards (see `.github/copilot-instructions.md`)
- Use **arrow functions** for components and callbacks
- Leverage **React 19** features (ref as prop, no forwardRef needed)
- Use **NativeWind** for styling (Tailwind CSS classes)
- Write **accessible** code with proper ARIA attributes
- Use **Zustand** for global state management

### File-based Routing

This project uses Expo Router for file-based routing. Routes are defined in the `app/` directory:

- `app/_layout.tsx` - Root layout
- `app/index.tsx` - Home screen
- `app/details.tsx` - Details screen
- `app/+not-found.tsx` - 404 page

## 📁 Project Structure

```
BalNostixUI-Modern/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
│   └── details.tsx        # Details screen
├── assets/                 # Images, fonts, etc.
├── components/             # Reusable React components
│   ├── Button.tsx
│   ├── Container.tsx
│   └── ScreenContent.tsx
├── store/                  # Zustand state management
│   └── store.ts
├── android/                # Native Android code
├── ios/                    # Native iOS code
├── .github/                # GitHub configuration
│   └── copilot-instructions.md
├── app.json               # Expo configuration
├── babel.config.js        # Babel configuration
├── biome.jsonc            # Biome linter config
├── lefthook.yml           # Git hooks configuration
├── metro.config.js        # Metro bundler config
├── package.json           # Dependencies
├── tailwind.config.js     # Tailwind CSS config
└── tsconfig.json          # TypeScript config
```

## 🏗 Build Configuration

### Android Build

The project is configured with the following Android build settings:

```gradle
buildTools: 36.0.0
minSdkVersion: 24
compileSdkVersion: 36
targetSdkVersion: 36
ndkVersion: 27.1.12297006
kotlinVersion: 2.1.20
```

### Creating Production Builds

#### Android APK/AAB

```powershell
# Build APK
cd android
.\gradlew assembleRelease

# Build Android App Bundle (AAB)
.\gradlew bundleRelease
```

#### iOS Build (macOS only)

```bash
# Create production build
cd ios
pod install
xcodebuild -workspace BalNostixUI-Modern.xcworkspace -scheme BalNostixUI-Modern -configuration Release
```

### EAS Build (Recommended)

For production builds, use Expo Application Services (EAS):

```powershell
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## 🔍 Troubleshooting

### Common Issues

1. **Metro bundler cache issues**

   ```powershell
   npx expo start -c
   ```

2. **Node modules issues**

   ```powershell
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

3. **Android build issues**

   ```powershell
   cd android
   .\gradlew clean
   cd ..
   npm run prebuild
   ```

4. **JDK version mismatch**

   - Ensure JDK 17 is installed and set in `JAVA_HOME`
   - Verify with: `java -version`

5. **Gradle issues**
   ```powershell
   cd android
   .\gradlew --stop
   Remove-Item -Recurse -Force .gradle
   .\gradlew clean
   ```

## 📝 Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm start`        | Start Expo development server  |
| `npm run android`  | Run on Android device/emulator |
| `npm run ios`      | Run on iOS simulator/device    |
| `npm run web`      | Run in web browser             |
| `npm run prebuild` | Generate native directories    |
| `npm run lint`     | Check code quality             |
| `npm run format`   | Auto-fix formatting issues     |

## 🤝 Contributing

1. Follow the Ultracite code standards
2. Write meaningful commit messages (Conventional Commits)
3. Ensure all tests pass before submitting PR
4. Run `npm run format` before committing

## 📄 License

[Add your license here]

## 🙋 Support

For issues and questions:

- Check the [Expo documentation](https://docs.expo.dev/)
- Review the [React Native documentation](https://reactnative.dev/docs/getting-started)
- Open an issue in the repository

---

Built with ❤️ using Expo and React Native
