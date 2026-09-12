import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm'; 

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');

    const logs = await db
      .select()
      .from(auditLogs)
      .where(owner ? eq(auditLogs.ownerAddress, owner.toLowerCase()) : undefined)
      .orderBy(desc(auditLogs.createdAt));

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}