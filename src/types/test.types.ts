/**
 * TypeScript type definitions for TestModule (CustomModule)
 * Native module for file operations and device information
 *
 * Java Implementation: android/app/src/main/java/com/nostix/CustomModule.java
 */

import type { NativeModule } from "react-native";

/**
 * TestModule interface
 * Provides utility methods for file operations and device information
 */
export interface TestModuleType extends NativeModule {
  /**
   * Copies files from source directory to app's internal storage
   *
   * @param sourcePath - Absolute path to source directory containing files to copy
   * @returns Promise that resolves to true if copy successful, false otherwise
   *
   * @description
   * - Copies all files from sourcePath to internal storage at /data/data/com.nostix/balDownload/
   * - Deletes existing destination directory before copying
   * - Recursively deletes old files to ensure clean state
   *
   * @example
   * ```typescript
   * import { NativeModules } from 'react-native';
   * import '@/types/test.types';
   *
   * const { TestModule } = NativeModules;
   *
   * // Copy downloaded files to internal storage
   * const sourcePath = '/data/user/0/com.nostix/files/balDownload';
   * const success = await TestModule.copyFilesToLocation(sourcePath);
   *
   * if (success) {
   *   console.log('Files copied successfully');
   * } else {
   *   console.log('Failed to copy files');
   * }
   * ```
   *
   * @throws IOException if file operations fail
   */
  copyFilesToLocation(sourcePath: string): Promise<boolean>;

  /**
   * Gets the Android device's unique identifier
   *
   * @returns Promise that resolves to the Android ID string
   *
   * @description
   * - Retrieves Settings.Secure.ANDROID_ID
   * - Returns a 64-bit number as a hex string
   * - Unique to each combination of app-signing key, user, and device
   *
   * @example
   * ```typescript
   * import { NativeModules } from 'react-native';
   * import '@/types/test.types';
   *
   * const { TestModule } = NativeModules;
   *
   * // Get Android device ID
   * try {
   *   const androidId = await TestModule.getAndroidID();
   *   console.log('Android ID:', androidId); // e.g., "9774d56d682e549c"
   * } catch (error) {
   *   console.error('Failed to get Android ID:', error);
   * }
   * ```
   *
   * @throws Error with code "100" if retrieval fails
   */
  getAndroidID(): Promise<string>;

  /**
   * Gets the module name (always returns "TestModule")
   *
   * @returns The string "TestModule"
   */
  getName(): string;
}

/**
 * Extend React Native's NativeModules to include TestModule
 */
declare module "react-native" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: <T> Use type keyword
  interface NativeModulesStatic {
    TestModule: TestModuleType;
  }
}

/**
 * Usage Notes:
 *
 * 1. File Copy Operation:
 *    - Used after downloading hex files, XML configs, and JSON response
 *    - Ensures files are in app's internal storage for native library access
 *    - Automatically handles cleanup of old files
 *
 * 2. Android ID:
 *    - Can be used for device identification
 *    - Changes if app is uninstalled or user/device changes
 *    - Should not be used as sole identifier for critical operations
 *
 * 3. Error Handling:
 *    - copyFilesToLocation returns false on failure (doesn't throw)
 *    - getAndroidID rejects promise with error code on failure
 *
 * 4. Platform Support:
 *    - Android only (requires API 29+ for FileUtils.copy)
 *    - iOS not supported
 *
 * 5. Permissions:
 *    - No additional permissions required (operates on app's internal storage)
 *
 * @see ReadVINScreen.js line 372 for copyFilesToLocation usage
 * @see app/(main)/vin/read.tsx line 434 for TypeScript usage example
 */
