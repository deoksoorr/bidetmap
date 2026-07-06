import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Storage 공개 URL (restroom-photos 버킷은 공개 읽기)
export const photoUrl = (path: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/restroom-photos/${path}`;
