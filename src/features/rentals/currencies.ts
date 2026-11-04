import { z } from "zod";
export const currencies = { USD: "US dollar", GBP: "British pound", EUR: "Euro", KES: "Kenyan shilling", GHS: "Ghanaian cedi", ZAR: "South African rand", EGP: "Egyptian pound", MAD: "Moroccan dirham", TZS: "Tanzanian shilling", UGX: "Ugandan shilling", RWF: "Rwandan franc", ETB: "Ethiopian birr", XOF: "West African CFA franc", XAF: "Central African CFA franc", BWP: "Botswana pula", ZMW: "Zambian kwacha", AOA: "Angolan kwanza", DZD: "Algerian dinar", TND: "Tunisian dinar", CAD: "Canadian dollar", AED: "UAE dirham" } as const;
const ratesSchema = z.object({ result: z.literal("success"), base_code: z.literal("NGN"), time_last_update_unix: z.number().positive(), rates: z.record(z.string(), z.number().positive().finite()) });
export function convertNaira(amount: number, payload: unknown, now = Date.now()) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new Error("Invalid amount");
  const data = ratesSchema.parse(payload), updated = data.time_last_update_unix * 1000;
  if (updated > now + 300_000 || now - updated > 72 * 3600_000) throw new Error("Exchange rates are outdated");
  return { updatedAt: new Date(updated).toISOString(), amounts: Object.fromEntries(Object.keys(currencies).flatMap(code => data.rates[code] ? [[code, amount * data.rates[code]]] : [])) };
}
