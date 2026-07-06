import { supabase } from "./supabase";

export type AdSetting = { key: string; enabled: boolean; config: any };

let cache: Record<string, AdSetting> | null = null;

// RLS상 anon은 enabled=true 행만 읽을 수 있음
export async function loadAdSettings(): Promise<Record<string, AdSetting>> {
  if (cache) return cache;
  const { data } = await supabase.from("monetization_settings").select("key,enabled,config");
  cache = {};
  (data ?? []).forEach((r: any) => (cache![r.key] = r));
  return cache;
}

export async function getAdSetting(key: string): Promise<AdSetting | null> {
  return (await loadAdSettings())[key] ?? null;
}
