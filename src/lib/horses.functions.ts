// 더비온 출전표 캡처 이미지에서 출전마 정보 추출 (Lovable AI Gateway 비전).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const Input = z.object({
  raceId: z.string().uuid(),
  imageBase64: z.string().min(100),
  mimeType: z.string().min(3).max(64),
});

type HorseRow = {
  horse_no: number;
  horse_name: string;
  jockey?: string | null;
  trainer?: string | null;
  carried_weight?: number | null;
  sex_age?: string | null;
};

const SYSTEM = `당신은 한국 경마 출전표(더비온 앱 캡처) OCR 어시스턴트다.
이미지에서 각 출전마의 정보를 추출해 JSON으로만 반환하라.
스키마: { "horses": [ { "horse_no": number, "horse_name": string,
"jockey": string|null, "trainer": string|null,
"carried_weight": number|null, "sex_age": string|null } ] }
- horse_no는 마번(번호), horse_name은 마명.
- 부담중량은 kg 단위 숫자(예: 56.5).
- 성별/연령은 "거6", "암4" 같은 표기 그대로.
- 알 수 없는 필드는 null.
- 코드 펜스나 설명 없이 JSON 객체만 출력.`;

export const extractHorsesFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "LOVABLE_API_KEY 미설정", inserted: 0 };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "이 캡처에서 출전마 표를 JSON으로 추출하라." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${data.mimeType};base64,${data.imageBase64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) {
      return { ok: false as const, error: "AI 요청이 너무 잦습니다. 잠시 후 다시 시도하세요.", inserted: 0 };
    }
    if (res.status === 402) {
      return { ok: false as const, error: "AI 크레딧이 소진되었습니다.", inserted: 0 };
    }
    if (!res.ok) {
      return { ok: false as const, error: `AI 오류 (${res.status})`, inserted: 0 };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { horses?: HorseRow[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false as const, error: "AI 응답 파싱 실패", inserted: 0 };
    }
    const horses = Array.isArray(parsed.horses) ? parsed.horses : [];
    const rows = horses
      .map((h) => ({
        race_id: data.raceId,
        horse_no: Number(h.horse_no),
        horse_name: String(h.horse_name ?? "").trim(),
        jockey: h.jockey ? String(h.jockey) : null,
        trainer: h.trainer ? String(h.trainer) : null,
        carried_weight:
          h.carried_weight != null && Number.isFinite(Number(h.carried_weight))
            ? Number(h.carried_weight)
            : null,
        sex_age: h.sex_age ? String(h.sex_age) : null,
      }))
      .filter((r) => Number.isFinite(r.horse_no) && r.horse_no > 0 && r.horse_name);

    if (!rows.length) {
      return { ok: false as const, error: "추출된 출전마가 없습니다.", inserted: 0 };
    }

    // 서버에서 직접 supabase 호출 (RLS는 public 정책이라 service_role 불요).
    const supaUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const supaKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supaUrl || !supaKey) {
      return { ok: false as const, error: "DB 설정 누락", inserted: 0 };
    }
    const supabase = createClient(supaUrl, supaKey);

    // 기존 horse_no와 중복되지 않게 필터링
    const { data: existing } = await supabase
      .from("horses")
      .select("horse_no")
      .eq("race_id", data.raceId);
    const has = new Set((existing ?? []).map((e: { horse_no: number }) => e.horse_no));
    const toInsert = rows.filter((r) => !has.has(r.horse_no));
    if (!toInsert.length) {
      return { ok: true as const, inserted: 0, skipped: rows.length };
    }
    const { error } = await supabase.from("horses").insert(toInsert);
    if (error) {
      return { ok: false as const, error: `DB 저장 실패: ${error.message}`, inserted: 0 };
    }
    return { ok: true as const, inserted: toInsert.length, skipped: rows.length - toInsert.length };
  });
