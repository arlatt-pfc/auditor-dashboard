type Primitive = boolean | number | string;

type QueryOptions = {
  accessToken?: string;
  eq?: Record<string, Primitive>;
  limit?: number;
  order?: {
    ascending?: boolean;
    column: string;
  };
  params?: Record<string, string>;
  select?: string;
};

type InsertOptions = {
  accessToken?: string;
  select?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function supabaseSelect<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
  const request = buildSupabaseRequest(table, options);

  if (!request) {
    return [];
  }

  const response = await fetch(request.url, {
    headers: request.headers,
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return [];
  }

  return response.json() as Promise<T[]>;
}

export async function supabaseInsert<T>(table: string, payload: Record<string, unknown>, options: InsertOptions = {}): Promise<T | null> {
  const request = buildSupabaseRequest(table, {
    accessToken: options.accessToken,
    select: options.select ?? "*",
  });

  if (!request) {
    return null;
  }

  const response = await fetch(request.url, {
    body: JSON.stringify(payload),
    headers: {
      ...request.headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    method: "POST",
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

function buildSupabaseRequest(table: string, options: QueryOptions) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  const baseUrl = SUPABASE_URL.endsWith("/") ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
  const url = new URL(`${baseUrl}/rest/v1/${table}`);

  url.searchParams.set("select", options.select ?? "*");

  for (const [column, value] of Object.entries(options.eq ?? {})) {
    url.searchParams.set(column, `eq.${value}`);
  }

  if (options.order) {
    url.searchParams.set("order", `${options.order.column}.${options.order.ascending === false ? "desc" : "asc"}`);
  }

  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }

  return {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${options.accessToken ?? SUPABASE_ANON_KEY}`,
    },
    url,
  };
}
