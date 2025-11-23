import path from "node:path";
import {
  type ConfigPlugin,
  withDangerousMod,
  withPlugins,
} from "@expo/config-plugins";
import fs from "fs-extra";

/**
 * Expo Config Plugin for Native Modules (BluetoothModule, USBModule)
 *
 * This plugin automatically:
 * 1. Copies native Java modules from native-modules/ to android/
 * 2. Copies BalDongleLib AAR to android/app/libs/
 * 3. Updates build.gradle with dependencies
 * 4. Registers CustomModulePackage in MainApplication.kt
 */

const PACKAGE_NAME = "com.nostix";
const NATIVE_MODULES_SOURCE = "native-modules/android";
const CUSTOM_PACKAGE_NAME = "com.nostix";

// Regex patterns
const DEPENDENCIES_BLOCK_REGEX = /^dependencies\s*\{/m;
const IMPORT_REGEX = /(import.*?\n)+/;
const GET_PACKAGES_REGEX =
  /(override fun getPackages\(\): List<ReactPackage> =[\s\S]*?\.apply\s*{[\s\S]*?(?=}))/;
const DEPENDENCY_PACKAGE_REGEX = /"([^"]+)"/;

/**
 * Copy native module Java files
 */
const withNativeModuleFiles: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidProjectRoot = modConfig.modRequest.platformProjectRoot;

      const sourceDir = path.join(projectRoot, NATIVE_MODULES_SOURCE);
      const targetDir = path.join(
        androidProjectRoot,
        "app/src/main/java",
        CUSTOM_PACKAGE_NAME.replace(/\./g, "/")
      );

      // Check if source directory exists
      if (!fs.existsSync(sourceDir)) {
        throw new Error(
          `Native modules source directory not found: ${sourceDir}\n` +
            "Please create it and copy your native module files there."
        );
      }

      console.log("📁 Copying native module files...");
      console.log(`   From: ${sourceDir}`);
      console.log(`   To: ${targetDir}`);

      // Create target directory
      await fs.ensureDir(targetDir);

      // Copy all Java files and subdirectories
      const modulesDir = path.join(sourceDir, "modules");
      if (fs.existsSync(modulesDir)) {
        await fs.copy(modulesDir, targetDir, { overwrite: true });
        console.log("   ✓ Copied modules/");
      }

      // Copy device folder
      const deviceDir = path.join(sourceDir, "device");
      if (fs.existsSync(deviceDir)) {
        await fs.copy(deviceDir, path.join(targetDir, "device"), {
          overwrite: true,
        });
        console.log("   ✓ Copied device/");
      }

      // Copy usb folder
      const usbDir = path.join(sourceDir, "usb");
      if (fs.existsSync(usbDir)) {
        await fs.copy(usbDir, path.join(targetDir, "usb"), {
          overwrite: true,
        });
        console.log("   ✓ Copied usb/");
      }

      console.log("✅ Native module files copied successfully");

      return modConfig;
    },
  ]);
};

/**
 * Copy BalDongleLib AAR to android/app/libs/ and add dependency to build.gradle
 */
const withBalDongleLib: ConfigPlugin<{ aarPath?: string } | undefined> = (
  config,
  props
) => {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const platformRoot = modConfig.modRequest.platformProjectRoot;
      const buildGradlePath = path.join(platformRoot, "app/build.gradle");

      // Source: where your AAR lives in your project (outside android/)
      const defaultAarPath = path.join(
        projectRoot,
        "native-modules/android/libs/BalDongleLib-debug.aar"
      );
      const sourceAarPath = props?.aarPath ?? defaultAarPath;

      // Target: standard libs folder inside android/app/
      const targetLibsDir = path.join(platformRoot, "app/libs");
      const aarFileName = path.basename(sourceAarPath);
      const targetAarPath = path.join(targetLibsDir, aarFileName);

      console.log("📦 Setting up BalDongleLib AAR...");
      console.log(`   Source: ${sourceAarPath}`);
      console.log(`   Target: ${targetAarPath}`);

      // Copy AAR to android/app/libs/
      if (fs.existsSync(sourceAarPath)) {
        await fs.ensureDir(targetLibsDir);
        await fs.copy(sourceAarPath, targetAarPath, { overwrite: true });

        // Verify the file was copied and has content
        const stats = await fs.stat(targetAarPath);
        console.log(`   ✓ Copied ${aarFileName} (${stats.size} bytes)`);
      } else {
        console.error(`❌ AAR file not found at: ${sourceAarPath}`);
        console.error(
          "   Please place your AAR file at native-modules/android/libs/"
        );
        return modConfig;
      }

      // Add dependency to build.gradle
      let buildGradleContent = await fs.readFile(buildGradlePath, "utf8");
      const balDongleDep = `implementation files('libs/${aarFileName}')`;

      if (buildGradleContent.includes("BalDongleLib")) {
        console.log("   ✓ BalDongleLib dependency already in build.gradle");
      } else {
        const depsMatch = buildGradleContent.match(DEPENDENCIES_BLOCK_REGEX);

        if (depsMatch && depsMatch.index !== undefined) {
          const insertPosition = depsMatch.index + depsMatch[0].length;
          const depString = `\n    ${balDongleDep}`;

          buildGradleContent =
            buildGradleContent.slice(0, insertPosition) +
            depString +
            buildGradleContent.slice(insertPosition);

          await fs.writeFile(buildGradlePath, buildGradleContent);
          console.log("   ✓ Added BalDongleLib dependency to build.gradle");
        } else {
          console.error("❌ Could not find dependencies block in build.gradle");
        }
      }

      console.log("✅ BalDongleLib AAR setup complete");

      return modConfig;
    },
  ]);
};

/**
 * Extract dependency identifier from a gradle dependency string
 */
function getDependencyIdentifier(dep: string): string {
  if (dep.includes("fileTree")) {
    return "fileTree";
  }

  const match = dep.match(DEPENDENCY_PACKAGE_REGEX);
  if (match) {
    const parts = match[1].split(":");
    return `${parts[0]}:${parts[1]}`;
  }

  return dep;
}

/**
 * Check which dependencies need to be added to build.gradle
 */
function findMissingDependencies(
  buildGradleContent: string,
  dependencies: string[]
): string[] {
  const depsToAdd: string[] = [];

  for (const dep of dependencies) {
    const identifier = getDependencyIdentifier(dep);

    if (buildGradleContent.includes(identifier)) {
      console.log(`   ✓ Already present: ${identifier}`);
    } else {
      console.log(`   + Adding: ${identifier}`);
      depsToAdd.push(dep);
    }
  }

  return depsToAdd;
}

/**
 * Insert dependencies into build.gradle content
 */
function insertDependencies(
  buildGradleContent: string,
  insertPosition: number,
  depsToAdd: string[]
): string {
  const depsString = `\n    // Native module dependencies\n    ${depsToAdd.join("\n    ")}`;

  return (
    buildGradleContent.slice(0, insertPosition) +
    depsString +
    buildGradleContent.slice(insertPosition)
  );
}

/**
 * Update build.gradle with native module dependencies
 */
const withNativeModuleDependencies: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const buildGradlePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/build.gradle"
      );

      let buildGradleContent = await fs.readFile(buildGradlePath, "utf8");

      // Dependencies to add
      const dependencies = [
        'implementation fileTree(dir: "libs", include: ["*.jar", "*.aar"])',
        'implementation "androidx.lifecycle:lifecycle-livedata-ktx:2.5.1"',
      ];

      console.log("📝 Checking native module dependencies...");

      // Find the dependencies block
      const depsMatch = buildGradleContent.match(DEPENDENCIES_BLOCK_REGEX);

      if (!depsMatch || depsMatch.index === undefined) {
        console.warn("⚠️  Could not find dependencies block in build.gradle");
        return modConfig;
      }

      // Check which dependencies need to be added
      const depsToAdd = findMissingDependencies(
        buildGradleContent,
        dependencies
      );

      // Insert all new dependencies at once
      if (depsToAdd.length > 0) {
        const insertPosition = depsMatch.index + depsMatch[0].length;
        buildGradleContent = insertDependencies(
          buildGradleContent,
          insertPosition,
          depsToAdd
        );

        await fs.writeFile(buildGradlePath, buildGradleContent);
      }

      console.log("✅ Dependencies check complete");

      return modConfig;
    },
  ]);
};

/**
 * Register CustomModulePackage in MainApplication.kt
 */
const withCustomModulePackage: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const mainApplicationPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/java",
        PACKAGE_NAME.replace(/\./g, "/"),
        "MainApplication.kt"
      );

      if (!fs.existsSync(mainApplicationPath)) {
        console.warn(
          "⚠️  MainApplication.kt not found, skipping package registration"
        );
        return modConfig;
      }

      console.log("📝 Updating MainApplication.kt...");

      let mainAppContent = await fs.readFile(mainApplicationPath, "utf8");

      // Add import if not present
      if (!mainAppContent.includes("import com.nostix.CustomModulePackage")) {
        mainAppContent = mainAppContent.replace(
          IMPORT_REGEX,
          (match: string) => `${match}import com.nostix.CustomModulePackage\n`
        );
        console.log("   ✓ Added CustomModulePackage import");
      }

      // Add package registration if not present
      if (!mainAppContent.includes("CustomModulePackage()")) {
        if (GET_PACKAGES_REGEX.test(mainAppContent)) {
          mainAppContent = mainAppContent.replace(
            GET_PACKAGES_REGEX,
            (match: string) =>
              `${match}\n              // Custom native modules\n              add(CustomModulePackage())`
          );
          console.log("   ✓ Registered CustomModulePackage");
        } else {
          console.warn(
            "⚠️  Could not find getPackages() method to inject CustomModulePackage"
          );
        }
      }

      await fs.writeFile(mainApplicationPath, mainAppContent);
      console.log("✅ MainApplication.kt updated");

      return modConfig;
    },
  ]);
};

/**
 * Main plugin export
 * @param props.aarPath - Optional custom path to BalDongleLib AAR file
 */
const withNativeModules: ConfigPlugin<{ aarPath?: string } | undefined> = (
  config,
  props
) => {
  console.log("\n🚀 Applying Native Modules Config Plugin...\n");

  const updatedConfig = withPlugins(config, [
    withNativeModuleFiles,
    [withBalDongleLib, props],
    withNativeModuleDependencies,
    withCustomModulePackage,
  ]);

  console.log("\n✅ Native Modules Config Plugin applied successfully!\n");

  return updatedConfig;
};

export default withNativeModules;
