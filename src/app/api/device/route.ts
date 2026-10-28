import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { config, formatPrice } from "@/lib/config";
import { getOrCreateDeviceId } from "@/lib/device";
import { listStores } from "@/lib/services/storeService";

export const dynamic = "force-dynamic";

/** Ensures the anonymous device cookie exists and returns public app config. */
export const GET = handle(async () => {
  await getOrCreateDeviceId();
  return NextResponse.json({
    dealTitle: config.dealTitle,
    dealItems: config.dealItems,
    price: formatPrice(config.dealPriceCents),
    devMode: config.devMode,
    proximityMode: config.proximityMode,
    allowTypedCode: config.allowTypedCode,
    // Store list is only exposed for the dev-mode picker.
    devStores: config.devMode ? (await listStores()).map(({ id, name }) => ({ id, name })) : [],
  });
});
