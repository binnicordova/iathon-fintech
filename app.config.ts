import type {ExpoConfig} from "@expo/config-types";

const EAS_OWNER = process.env.EAS_OWNER;
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

const VERSION = "0.1.0";

const APP_VARIANTS = {
    development: {
        identifier: "com.brasper.app.dev",
        name: "BRASPER (Dev)",
        scheme: "brasper-dev",
    },
    preview: {
        identifier: "com.brasper.app.preview",
        name: "BRASPER (Preview)",
        scheme: "brasper-preview",
    },
    production: {
        identifier: "com.brasper.app",
        name: "BRASPER",
        scheme: "brasper",
    },
};

const getAppVariant = () => {
    if (process.env.APP_VARIANT === "development")
        return APP_VARIANTS.development;
    if (process.env.APP_VARIANT === "preview") return APP_VARIANTS.preview;
    return APP_VARIANTS.production;
};

const {identifier, name, scheme} = getAppVariant();

export default ({config}: {config: ExpoConfig}): ExpoConfig => ({
    ...config,
    name,
    scheme,
    slug: "brasper",
    version: VERSION,
    orientation: "portrait",
    icon: "./assets/icon.png",
    // OTA updates need an EAS project; Expo Go ignores this block entirely.
    ...(EAS_PROJECT_ID
        ? {
              updates: {
                  url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
                  fallbackToCacheTimeout: 0,
                  enabled: true,
                  checkAutomatically: "ON_LOAD" as const,
              },
          }
        : {}),
    assetBundlePatterns: ["**/*"],
    ios: {
        supportsTablet: true,
        bundleIdentifier: identifier,
        infoPlist: {
            ITSAppUsesNonExemptEncryption: false,
        },
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#060C24",
        },
        package: identifier,
    },
    web: {
        favicon: "./assets/favicon.png",
        bundler: "metro",
        output: "single",
    },
    extra: {
        router: {
            root: "src/app",
        },
        eas: {
            projectId: EAS_PROJECT_ID,
        },
    },
    owner: EAS_OWNER,
    runtimeVersion: VERSION,
    userInterfaceStyle: "automatic",
    plugins: [
        [
            "expo-router",
            {
                root: "src/app",
            },
        ],
        [
            "expo-image-picker",
            {
                photosPermission:
                    "BRASPER needs your photos so you can send the proof of your transfer.",
                cameraPermission:
                    "BRASPER needs the camera so you can photograph the proof of your transfer.",
            },
        ],
        "expo-updates",
        [
            "expo-splash-screen",
            {
                image: "./assets/splash.png",
                imageWidth: 200,
                resizeMode: "contain",
                backgroundColor: "#060C24",
            },
        ],
        "expo-status-bar",
        "expo-font",
        "expo-sharing",
        "expo-localization",
    ],
});
