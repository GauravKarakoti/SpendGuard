import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');

  if (!owner) {
    return NextResponse.json({ error: 'Owner address is required' }, { status: 400 });
  }

  try {
    const results = await db
      .select()
      .from(agents)
      .where(eq(agents.ownerAddress, owner.toLowerCase()))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ agent: null });
    }

    return NextResponse.json({ agent: results[0] });
  } catch (error: any) {
    console.error('Failed to fetch agent by owner:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}