import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providers } from '@/lib/db/schema';

export async function GET() {
  try {
    const activeProviders = await db.query.providers.findMany({
      orderBy: (providers, { asc }) => [asc(providers.price)],
    });
    return NextResponse.json(activeProviders);
  } catch (error) {
    console.error("GET Providers Error:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Upsert the provider (update price/latency if it already exists)
    const result = await db.insert(providers).values({
      id: body.id,
      name: body.name,
      iconType: body.iconType,
      price: body.price.toString(), // Drizzle numeric types expect strings
      quality: body.quality.toString(),
      latency: body.latency.toString(),
      selected: body.selected || false,
      reason: body.reason || null,
    }).onConflictDoUpdate({
      target: providers.id,
      set: {
        price: body.price.toString(),
        quality: body.quality.toString(),
        latency: body.latency.toString(),
        selected: body.selected || false,
        reason: body.reason || null,
      }
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("POST Provider Error:", error);
    return NextResponse.json({ error: "Failed to push provider" }, { status: 500 });
  }
}