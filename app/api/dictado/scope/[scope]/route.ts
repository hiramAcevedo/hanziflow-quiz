import { NextRequest, NextResponse } from "next/server";
import { isSupportedScope } from "@/lib/audio-urls";
import { loadDictadoScope } from "@/lib/dictado-data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scope: string }> }
) {
  const { scope } = await params;
  if (!isSupportedScope(scope)) {
    return NextResponse.json({ error: `scope no soportado: ${scope}` }, { status: 404 });
  }
  try {
    const entries = loadDictadoScope(scope);
    return NextResponse.json({ scope, count: entries.length, entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
