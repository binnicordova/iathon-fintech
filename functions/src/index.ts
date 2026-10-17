import {setGlobalOptions} from "firebase-functions/v2";
import "./lib/firebase";

// São Paulo: closest region to both Brazil and Peru, and where Firestore lives.
setGlobalOptions({region: "southamerica-east1", maxInstances: 10});

export {assistantGenerate} from "./assistant";
export {getReceipt, runFact} from "./fact";
export {getQueueInfo, leaveQueue, requestHuman} from "./handoff";
export {cancelOrder, createOrder, submitProof} from "./orders";
export {createQuote} from "./quotes";
export {getRates} from "./rates";
export {createManualOrder, exportOrders, reviewOrder} from "./staff";

export {exchangeSupabaseSession} from "./supabase-session";
export {reviewOperation, getOperationProof} from "./web-workflow";
export {listOperations, getOperation, getOperationsSummary} from "./dashboard";
export {
    createWebQuote,
    createWebOrder,
    listSavedRecipients,
    saveRecipient,
    deleteRecipient,
} from "./web-client";
export {getOperationsConfig, updateOperationsConfig} from "./operations-config";
