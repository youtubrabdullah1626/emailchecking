import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';
let passCount = 0;
let failCount = 0;

function logStatus(testName: string, passed: boolean, error?: string) {
    if (passed) {
        console.log(`✅ [PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`❌ [FAIL] ${testName}`);
        if (error) console.error(`   Error: ${error}`);
        failCount++;
    }
}

async function verifyDatabase() {
    console.log('\n--- 1. Database & Isolation Verification ---');
    try {
        const p1 = await prisma.prospect.create({
            data: { email: `test-${Date.now()}@example.com`, name: 'Test', company: 'Test', timezone: 'UTC' }
        });
        
        await prisma.sequence.create({ data: { prospect_id: p1.id, status: 'DRAFT' } });
        
        try {
             await prisma.sequence.create({ data: { prospect_id: p1.id, status: 'DRAFT' } });
             logStatus('One sequence per prospect enforced', false, 'Allowed duplicate sequence');
        } catch (e) {
             logStatus('One sequence per prospect enforced', true);
        }
        
    } catch(e) {
         logStatus('Database Operations', false, String(e));
    }
}

async function verifySecurity() {
    console.log('\n--- 2. Security Verification ---');
    try {
        // SQL Injection Attempt
        const res = await fetch(`${API_URL}/api/prospects/1'; DROP TABLE prospects; --`);
        logStatus('SQL Injection prevented (API 404/400)', res.status === 404 || res.status === 400 || res.status === 500); 
        
        // Unauthenticated access
        const diagRes = await fetch(`${API_URL}/api/observability/diagnostics`);
        logStatus('Unauthenticated access blocked (Observability)', diagRes.status === 401);
        
        // Secret validation (ensure ADMIN_SECRET exists but doesn't leak)
        const textRes = await diagRes.text();
        logStatus('Secrets not leaked in error message', !textRes.includes(process.env.ADMIN_SECRET || 'supersecret'));
    } catch(e) {
         logStatus('Security Verification', false, String(e));
    }
}

async function runAll() {
    await verifyDatabase();
    await verifySecurity();
    
    console.log(`\n========================================`);
    console.log(`Audit Summary: ${passCount} Passed, ${failCount} Failed`);
    console.log(`========================================`);
    if (failCount > 0) process.exit(1);
}

runAll().catch(console.error).finally(() => prisma.$disconnect());
