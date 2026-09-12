import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { providers } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables from .env
config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const mockProviders = [
  // --- Active/Selected Providers ---
  {
    id: 'prov_trans_primary',
    name: 'TranslationService (Fast)',
    iconType: 'globe', // Use an icon string your frontend expects
    price: '2.00',
    quality: '0.98',
    latency: '150.5',
    selected: true,
    reason: 'Optimal balance of cost and speed for general NLP.',
  },
  {
    id: 'prov_comp_primary',
    name: 'ComputeService (Pro)',
    iconType: 'cpu',
    price: '3.00',
    quality: '0.99',
    latency: '350.0',
    selected: true,
    reason: 'High FLOPS performance for matrix multiplication.',
  },
  // --- Alternative/Unselected Providers (For the UI Marketplace) ---
  {
    id: 'prov_trans_eco',
    name: 'EcoTranslate',
    iconType: 'leaf',
    price: '0.50',
    quality: '0.85',
    latency: '900.0',
    selected: false,
    reason: 'Budget alternative. High latency, lower accuracy.',
  },
  {
    id: 'prov_comp_basic',
    name: 'Basic Compute',
    iconType: 'server',
    price: '1.00',
    quality: '0.90',
    latency: '850.0',
    selected: false,
    reason: 'Lower priority queue, best for background jobs.',
  }
];

async function main() {
  console.log('🌱 Seeding providers table...');

  try {
    for (const provider of mockProviders) {
      // Upsert logic: insert if not exists, update if exists
      const existing = await db
        .select()
        .from(providers)
        .where(eq(providers.id, provider.id))
        .limit(1);

      if (existing.length > 0) {
        await db.update(providers).set(provider).where(eq(providers.id, provider.id));
        console.log(`Updated: ${provider.name}`);
      } else {
        await db.insert(providers).values(provider);
        console.log(`Inserted: ${provider.name}`);
      }
    }
    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    process.exit(0);
  }
}

main();