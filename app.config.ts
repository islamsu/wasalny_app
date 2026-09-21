// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";
import { withDangerousMod } from "expo/config-plugins";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "com.app.wasalny_app";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = "com.app.wasalny.app";

const servicesPath = resolve(__dirname, process.env.GOOGLE_SERVICES_JSON ?? "google-services.json");
const hasServices = existsSync(servicesPath);
if (process.env.GOOGLE_SERVICES_JSON && !hasServices) {
  throw new Error("GOOGLE_SERVICES_JSON points to a missing file.");
}
if (hasServices) {
  const services = JSON.parse(readFileSync(servicesPath, "utf8"));
  const project = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project || services.project_info?.project_id !== project) {
    throw new Error("google-services.json project must match EXPO_PUBLIC_FIREBASE_PROJECT_ID.");
  }
  const client = services.client?.find((entry: any) =>
    entry.client_info?.android_client_info?.package_name === "com.app.wasalny.app");
  if (!client?.client_info?.mobilesdk_app_id) {
    throw new Error("google-services.json must contain an Android client for com.app.wasalny.app.");
  }
  if (!services.project_info?.project_number || !client.api_key?.some((key: any) => key.current_key)) {
    throw new Error("google-services.json is missing Firebase project number/API key.");
  }
}

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "وصلني",
  appSlug: "wasalny_app",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "/manus-storage/wasalny-icon_06eacc86.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    ...(hasServices ? { googleServicesFile: servicesPath } : {}),
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "" } },
    adaptiveIcon: {
      backgroundColor: "#137A5A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    ["expo-location", { locationWhenInUsePermission: "السماح لتطبيق وصلني بتحديد موقعك للعثور على أقرب سائق ومكان الركوب." }],
    ["expo-notifications", { icon: "./assets/images/icon.png", color: "#137A5A" }],
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#F8FBF8",
        dark: {
          backgroundColor: "#10201A",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

// Web config evaluation remains available without a private Android registration file.
// The Android prebuild path must never silently ship an unconfigured Firebase build.
export default withDangerousMod(config, ["android", async (mod) => {
  if (!hasServices) throw new Error("Android Firebase build requires GOOGLE_SERVICES_JSON for com.app.wasalny.app. Native sign-in SDK/device/signing verification is still deferred.");
  return mod;
}]);
