import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { http402Flows } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const flows = await db.query.http402Flows.findMany({
      orderBy: [desc(http402Flows.createdAt)],
      limit: 10,
    });
    return NextResponse.json(flows);
  } catch (error) {
    console.error("GET Flows Error:", error);
    return NextResponse.json({ error: "Failed to fetch flows" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await db.insert(http402Flows).values({
      id: body.id,
      label: body.label,
      method: body.method,
      endpoint: body.endpoint,
      requestPayload: body.requestPayload,
      response402: body.response402,
      response200: body.response200,
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("POST Flow Error:", error);
    return NextResponse.json({ error: "Failed to push HTTP flow" }, { status: 500 });
  }
}