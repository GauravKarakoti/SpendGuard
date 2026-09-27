import 'dotenv/config';
import { db } from '../lib/db';
import { providers } from '../lib/db/schema';

// ─── Configure Real 0G Provider Endpoints ────────────────────────────────────
const ZG_NODES = [
  {
    id: 'prov_trans_primary',
    name: '0G Serving - Llama 3 8B',
    iconType: 'translate' as const,
    url: "",
    model: 'meta-llama/Meta-Llama-3-8B-Instruct',
    fallbackPrice: 0.0005,
  },
  {
    id: 'prov_trans_secondary',
    name: '0G Serving - Mixtral 8x7B',
    iconType: 'translate' as const,
    url: "",
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    fallbackPrice: 0.0012,
  },
  {
    id: 'prov_comp_primary',
    name: '0G Serving - Mathstral',
    iconType: 'compute' as const,
    url: "",
    model: 'mathstral',
    fallbackPrice: 0.0008,
  },
  {
    id: 'prov_comp_secondary',
    name: '0G Serving - Qwen Math',
    iconType: 'compute' as const,
    url: "",
    model: 'qwen-math',
    fallbackPrice: 0.0004,
  }
];

/**
 * Pings the actual 0G decentralized serving nodes to get real latency,
 * uptime quality, and dynamic pricing directly from their HTTP 402 headers.
 */
async function evaluateNodes() {
  const evaluations = await Promise.all(ZG_NODES.map(async (node) => {
    const start = performance.now();
    let currentLatency = 999;
    let currentQuality = 0.0;
    let currentPrice = node.fallbackPrice.toFixed(6);

    try {
      const res = await fetch(node.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: node.model,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 1
        }),
        signal: AbortSignal.timeout(5000) 
      });

      const elapsed = (performance.now() - start) / 1000;

      if (res.status === 402) {
        currentQuality = 1.0;
        currentLatency = elapsed;
        
        const priceHeader = res.headers.get('X-Price-0G') || res.headers.get('X-Price');
        if (priceHeader && !isNaN(Number(priceHeader))) {
          currentPrice = Number(priceHeader).toFixed(6);
        }
      } 
      else if (res.ok) {
        currentQuality = 1.0;
        currentLatency = elapsed;
      } 
      else {
        console.warn(`[!] Node ${node.name} returned status ${res.status}`);
        currentQuality = 0.4; 
        currentLatency = elapsed;
      }

    } catch (error: any) {
      console.warn(`[!] Node ${node.name} unreachable: ${error.message}`);
      currentQuality = 0.0; 
      currentLatency = 999;
    }

    return {
      id: node.id,
      name: node.name,
      iconType: node.iconType,
      price: currentPrice.toString(),
      quality: currentQuality.toFixed(2),
      latency: currentLatency === 999 ? '999' : currentLatency.toFixed(2),
      selected: false,
      reason: null as string | null,
    };
  }));

  return evaluations;
}

async function syncDatabase() {
  console.log(`\n[${new Date().toISOString()}] Pinging 0G Providers...`);
  
  try {
    const liveNodes = await evaluateNodes();

    const translateNodes = liveNodes.filter(n => n.iconType === 'translate');
    const computeNodes = liveNodes.filter(n => n.iconType === 'compute');

    const selectOptimal = (nodes: typeof liveNodes, typeLabel: string) => {
      const healthyNodes = nodes.filter(n => parseFloat(n.quality) >= 0.90 && parseFloat(n.latency) < 100);
      
      if (healthyNodes.length === 0) {
        console.log(`[-] No healthy ${typeLabel} nodes available.`);
        return;
      }

      let optimal = healthyNodes.reduce((prev, curr) => 
        (parseFloat(curr.latency) < parseFloat(prev.latency)) ? curr : prev
      );
      
      optimal.selected = true;
      optimal.reason = `Lowest latency ${typeLabel} node (${optimal.latency}s) responsive at $${optimal.price}`;
      return optimal;
    };

    selectOptimal(translateNodes, 'translation');
    selectOptimal(computeNodes, 'compute');

    await db.delete(providers);
    await db.insert(providers).values(liveNodes);

    console.log(`[${new Date().toISOString()}] ✓ Successfully pushed ${liveNodes.length} active nodes to SpendGuard.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ✗ Failed to sync providers:`, error);
  }
}

// ─── Autonomous Loop ─────────────────────────────────────────────────────────
const SYNC_INTERVAL_MS = 15000;

console.log('Starting autonomous 0G Provider indexer...');
syncDatabase();

setInterval(() => {
  syncDatabase();
}, SYNC_INTERVAL_MS);