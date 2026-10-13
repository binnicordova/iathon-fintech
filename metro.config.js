const {getSentryExpoConfig} = require("@sentry/react-native/metro");

const defaultConfig = getSentryExpoConfig(__dirname);

defaultConfig.resolver.unstable_enablePackageExports = true;

/**
 * `langsmith` (a LangChain dependency we never call) ships ESM builds with
 * circular imports. In dev, Metro's React Refresh hook reads every ESM export
 * getter right after a module loads and trips the cycle ("Cannot access
 * 'Client' before initialization"). Its CommonJS build hoists `exports.X =
 * void 0`, so the same cycle is harmless there.
 */
const CJS_ONLY = /^langsmith(\/|$)/;

/**
 * `getSentryExpoConfig` swaps `@sentry/core`'s server-side AI modules for empty
 * stubs on iOS and Android to save bytes. That includes the LangGraph and
 * LangChain tracing, so `Sentry.instrumentStateGraph` comes back `undefined` on
 * a phone (the web build is unaffected). The documented manual LangGraph
 * instrumentation needs them, so let those two through to the real files.
 */
const SENTRY_LANGGRAPH = /\/tracing\/(langchain|langgraph)(\/|\.js|$)/;
const isNative = (platform) => platform === "ios" || platform === "android";
const cjsConditions = ["require", "react-native", "default"];
const defaultResolveRequest = defaultConfig.resolver.resolveRequest;

defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
        isNative(platform) &&
        context.originModulePath?.includes("@sentry/core") &&
        SENTRY_LANGGRAPH.test(moduleName)
    ) {
        return context.resolveRequest(context, moduleName, platform);
    }
    const resolve = defaultResolveRequest ?? context.resolveRequest;
    if (CJS_ONLY.test(moduleName)) {
        return resolve(
            {
                ...context,
                isESMImport: false,
                unstable_conditionNames: cjsConditions,
                unstable_conditionsByPlatform: {},
            },
            moduleName,
            platform
        );
    }
    return resolve(context, moduleName, platform);
};

module.exports = defaultConfig;
