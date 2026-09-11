/**
 * Demo Reset Endpoint
 * Resets the SpendGuard contract simulation state for a fresh demo run.
 * POST /api/demo/reset
 */

import { resetBudgetState } from '../../payment/verify/route';

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // defaults below
  }

  const agentId = String(body.agentId ?? 'ResearchAgent');
  const limitUSDC = Number(body.limitUSDC ?? 5);

  resetBudgetState(agentId, limitUSDC);

  return Response.json({
    success: true,
    agentId,
    limitUSDC,
    message: `Budget reset to $${limitUSDC}.00 USDC for agent "${agentId}"`,
  });
}
