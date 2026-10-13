import type {Persistence} from "firebase/auth";

/**
 * Firebase ships `getReactNativePersistence` only in its React Native build, and
 * the public typings used by `firebase/auth` leave it out. Metro picks the RN
 * build at runtime (verified in Expo Go); this teaches TypeScript about it.
 */
declare module "firebase/auth" {
    export function getReactNativePersistence(storage: {
        setItem(key: string, value: string): Promise<void>;
        getItem(key: string): Promise<string | null>;
        removeItem(key: string): Promise<void>;
    }): Persistence;
}
