# Web Lovable + operaciones Firebase (propuesta de integración)

Este cambio prepara **el backend y los adaptadores**. No migra datos ni cambia la web publicada, Meta, Supabase o Firebase automáticamente. HOTELJB no forma parte de esta integración. Fact mantiene su simulación existente (`testMode: true`); no se añade proveedor fiscal ni se envía dinero.

## Propiedad de los datos

- Firebase `orders`, `quotes`, `orders/{id}/events`, Storage y `recipients`: nueva fuente de verdad de las operaciones creadas por este flujo.
- Supabase puede conservar login, configuración del sitio y las sesiones/conversaciones WhatsApp. No se escribe una segunda operación maestra en `transfers`.
- Las operaciones existentes en cualquiera de las dos bases se conservan sin alterarlas. Las de Firebase sin `workflowStatus` aparecen en el listado general y como `legacyWithoutWorkflow` en el resumen; no se incluyen silenciosamente en bandejas nuevas. Requieren una migración auditada separada si se quieren clasificar.
- No hay sincronización de contraseñas. El puente comprueba el JWT de Supabase contra `/auth/v1/user` del **proyecto configurado** y emite identidad Firebase `supabase:<uuid>`. Ignora metadatos de rol del usuario.

## Funciones nuevas

Todas son callable salvo `exchangeSupabaseSession`, que es HTTP POST con Bearer del **usuario**, no service_role.

| Función | Uso |
|---|---|
| `exchangeSupabaseSession` | Login Firebase conservando Supabase Auth |
| `createWebQuote` | PEN/BRL, mismo motor de cotización de la app |
| `createWebOrder` | Cotización consumida una sola vez, destinatario, origen/motivo de fondos, preferencia y correo de comprobante simulado |
| `listOperations` | Operadores: bandeja/moneda o búsqueda exacta por documento/email/teléfono, fechas, cursor y límite máximo 100 |
| `getOperation` | Detalle y últimos 100 eventos |
| `getOperationsSummary` | Contadores por estado y número de operaciones legacy |
| `reviewOperation` | Verificar, pedir nuevo comprobante, rechazar, cancelar y registrar envío |
| `getOperationProof` | URL privada autorizada válida 5 minutos |
| `listSavedRecipients`, `saveRecipient`, `deleteRecipient` | Cuentas guardadas por usuario registrado; opt-in |
| `getOperationsConfig`, `updateOperationsConfig` | Lectura de catálogo para equipo; escritura solo admin de cuentas/tasas/comisiones |

`createOrder`, `submitProof`, `cancelOrder`, `reviewOrder` y `exportOrders` siguen existiendo para la app y delegan en el flujo seguro. `exported` sigue significando exportación de datos; no confirma movimiento bancario. El timeline deja de inferir pago desde aprobación/exportación o desde un PDF.

## Contrato de operaciones

| workflowStatus | Equivalente legacy | Acción siguiente |
|---|---|---|
| awaiting_payment | pending | adjuntar comprobante |
| proof_submitted | validating | validar, rechazar o pedir corrección |
| verified | approved o exported | registrar salida con referencia y constancia |
| paid_out | exported | consulta del estado, sin nuevas aprobaciones |
| rejected / cancelled | igual | terminal |

`reviewOperation` exige `requestId` UUID estable por intento y `expectedRevision` leído del detalle. Repetir **exactamente** ese intento devuelve el resultado sin duplicar; reutilizar su ID con otros datos falla. Una revisión vieja falla con `stale-operation-reload`. Cancelar exige además `confirmation` igual al código de operación y motivo. Payout exige rol operator/admin, `payoutReference` y archivo bajo `payouts/<orderId>/...`. No inicia una transferencia bancaria: registra la que hizo la persona.

Los archivos son JPEG/PNG/PDF hasta 8 MiB, privados e inmutables desde el cliente. El servidor comprueba también su cabecera real. La referencia de ingreso se reserva transaccionalmente por moneda+banco+referencia; se conserva incluso al cancelar para evitar reutilizaciones sin conciliación.

`createWebOrder` usa la moneda que **recibe el destinatario** para validar la preferencia de comprobante. Guarda esa preferencia, pero no configura ni dispara facturación real. La nueva API web solo admite PEN/BRL; se conserva compatibilidad del resto de la app con sus monedas previas.

## Despliegue: solo después de revisar/aceptar este PR

1. `bun install --frozen-lockfile`; `npm --prefix functions ci`; `bun run functions:build`.
2. Configurar parámetros de Functions (sin claves de administración en frontend):
   - `BRASPER_SUPABASE_URL=https://lfjnywpvunfrvkgcfobl.supabase.co`
   - `BRASPER_SUPABASE_PUBLISHABLE_KEY`: clave pública/anon de ese proyecto, **no service_role**.
   Estos parámetros deben quedar en el entorno privado de despliegue, no en Git.
3. La identidad de ejecución de `exchangeSupabaseSession` debe poder firmar custom tokens (`iam.serviceAccounts.signBlob` en la cuenta adecuada). Ver [Firebase custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens). No descargar ni publicar claves de cuenta de servicio.
4. Desplegar `firestore:rules,firestore:indexes,storage`. Las reglas Storage nuevas consultan Firestore: habilitar la integración de permisos de reglas cuando Firebase lo solicite. Esperar que los índices estén listos.
5. Desplegar selectivamente las funciones nuevas y las modificadas: `createOrder,submitProof,cancelOrder,reviewOrder,exportOrders,createQuote,getRates,runFact,getReceipt` más las funciones de la tabla anterior. **No usar despliegue con borrado/force**: `createManualOrder` existe en la nube revisada y no en este main; debe preservarse y contrastarse con su autor.
6. Para personal que entra por Supabase, un administrador configura en Firestore `supabaseStaff/supabase:<uuid>` con `{role: "validator"}` o `operator`/`admin`/`billing`. Es server-only y se consulta en cada acción; no se otorga rol por correo ni por metadatos editables. Las cuentas nativas Firebase conservan sus claims. Sin asignación, el dashboard deniega acceso.
7. Mantener la web actual en Supabase hasta completar el piloto de integración de abajo. El PR por sí solo no cambia Lovable.

## Adaptación de Lovable (siguiente lote, sin rediseño)

`integrations/lovable/firebase-backend.ts` es el adaptador browser, sin dependencias Expo. Usa un FirebaseApp de nombre separado para no reemplazar otras sesiones. Conectar tras obtener `supabase.auth.getSession()` y limpiar Firebase en SIGNED_OUT/cambio de cuenta. Una sesión Firebase emitida tiene su propio ciclo de vida; no prometer revocación automática de clientes al cerrar sesión en Supabase. Roles de equipo bridged sí se vuelven a consultar.

Mapeo de la web actual:

| Web/Supabase | Adaptador Firebase |
|---|---|
| cotizar / fx_rates | `quote` (importes de servidor; no reutilizar tasas calculadas por navegador) |
| registrar transferencia | `create` con `quoteId` y datos completos |
| subir comprobante | `upload(..., "deposit", uploadId)` y luego `submitProof` |
| bandejas de revisión/envío | `list({status: "proof_submitted"})` / `list({status: "verified"})` |
| detalle y auditoría | `detail(orderId)` |
| confirmar ingreso | `review` action verify |
| registrar dinero enviado | subir `payout`, luego `review` action payout |
| visualizar constancias | `proof(orderId, kind)` |
| cuentas guardadas | savedRecipients / saveRecipient / deleteRecipient |

Para la función de WhatsApp que permanece en Supabase: `integrations/lovable/firebase-rest.ts` ofrece intercambio + callable + upload sin Node/Expo. Debe recibir el JWT anónimo real ya vinculado a la sesión cifrada del Flow. Guardar `firebaseOrderId`/`firebaseQuoteId` en esa sesión y reutilizarlos al reintentar. El nonce de Flow **no es** un JWT Firebase. Conservar firma Meta, RSA/AES y validación de medios del handler actual; reemplazar sus lecturas/escrituras de operaciones por el adaptador. No invocar a la vez `create_whatsapp_native_transfer` y `createWebOrder`. No usar la IA como operador. Los imports de tipos del adaptador browser deben copiarse junto al adaptador o redirigirse a un paquete compartido.

CORS del puente permite únicamente `https://brasper.jordybryan.com` y `https://brasper-connect-flow.lovable.app`; añadir explícitamente un origen de staging aprobado si se necesita. Los emuladores no dependen de CORS productivo.

## Tasas fijas opcionales

`updateOperationsConfig` admite `manualRates: {active, penPerUsd, brlPerUsd, validUntil}` y pricing con bps. El tipo PEN→BRL de referencia es `brlPerUsd / penPerUsd`; el motor aplica spread/comisión configurados. No introducir una tasa inversa inventada ni actualizar operaciones anteriores. Si las tasas manuales activas vencen, la cotización se bloquea en lugar de cambiar silenciosamente de proveedor. USD es una unidad interna de referencia, no habilita una operación web en dólares.

## Validación reproducible

```sh
bun run functions:build
bunx tsc --noEmit --skipLibCheck
bun run format:check
bun run test --runInBand --coverage=false
bunx --package firebase-tools firebase emulators:exec \
  --config firebase.web-test.json --project demo-brasper-web \
  --only auth,firestore,storage 'node functions/scripts/test-web-workflow.mjs'
```

La suite de integración se niega a arrancar si no hay emuladores loopback y un proyecto `demo-*`. Prueba concurrencia, identidad, roles, referencias duplicadas, reintentos, revisiones obsoletas, cancelación, salida, filtros, cuentas privadas y reglas con SDK cliente real. No usa aibrasper ni credenciales de producción. El intercambio custom-token completo y su IAM se deben verificar en staging; la suite prueba el verificador Supabase con respuestas controladas.

## Resultado local de esta rama

105 pruebas de la app (15 suites) y 17 escenarios de integración en emuladores aprobados; compilación de Functions, TypeScript de la app/adaptadores y lint del repositorio aprobados. No se hizo deploy ni prueba de extremo a extremo contra aibrasper/Lovable/Meta.
