"use strict";
require('@next/env').loadEnvConfig(process.cwd());
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const perf_hooks_1 = require("perf_hooks");
const prisma = new client_1.PrismaClient();
const API_BASE = "http://localhost:3000";
async function clearData() {
    console.log("Clearing existing data...");
    await prisma.sequenceStep.deleteMany({});
    await prisma.sequence.deleteMany({});
    await prisma.prospect.deleteMany({});
    console.log("Data cleared.");
}
async function seedProspects(count) {
    console.log(`Seeding ${count} prospects...`);
    const prospectsData = Array.from({ length: count }).map((_, i) => ({
        email: `prospect${i}@example.com`,
        name: `Prospect ${i}`,
        company: `Company ${i % 100}`,
        timezone: 'America/New_York',
    }));
    const chunkSize = 1000;
    for (let i = 0; i < prospectsData.length; i += chunkSize) {
        const chunk = prospectsData.slice(i, i + chunkSize);
        await prisma.prospect.createMany({ data: chunk });
    }
    const prospects = await prisma.prospect.findMany({ select: { id: true } });
    console.log(`Seeding sequences for ${count} prospects...`);
    const sequencesData = prospects.map((p) => ({
        prospect_id: p.id,
        status: 'ACTIVE',
    }));
    for (let i = 0; i < sequencesData.length; i += chunkSize) {
        const chunk = sequencesData.slice(i, i + chunkSize);
        await prisma.sequence.createMany({ data: chunk });
    }
    const sequences = await prisma.sequence.findMany({ select: { id: true } });
    console.log(`Seeding steps for ${count} sequences...`);
    const stepsData = sequences.flatMap((s) => [
        { sequence_id: s.id, step_number: 1, subject: 'Step 1', body: 'Body 1', status: 'PENDING', scheduled_at_utc: new Date(), scheduled_time_local: '09:00', timezone: 'America/New_York' },
        { sequence_id: s.id, step_number: 2, subject: 'Step 2', body: 'Body 2', status: 'PENDING', scheduled_at_utc: new Date(), scheduled_time_local: '09:00', timezone: 'America/New_York' },
    ]);
    for (let i = 0; i < stepsData.length; i += chunkSize) {
        const chunk = stepsData.slice(i, i + chunkSize);
        await prisma.sequenceStep.createMany({ data: chunk });
    }
    console.log(`Seeding complete. ${count} prospects, ${count} sequences, ${count * 2} steps.`);
}
async function measureEndpoint(name, url) {
    const start = perf_hooks_1.performance.now();
    const startMem = process.memoryUsage().heapUsed;
    try {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const end = perf_hooks_1.performance.now();
        const endMem = process.memoryUsage().heapUsed;
        // Attempt to guess size based on array length
        let itemLength = 0;
        if (Array.isArray(data))
            itemLength = data.length;
        else if (data && data.data && Array.isArray(data.data))
            itemLength = data.data.length;
        console.log(`[${name}] Latency: ${(end - start).toFixed(2)} ms | Items returned: ${itemLength} | Heap delta: ${((endMem - startMem) / 1024 / 1024).toFixed(2)} MB`);
    }
    catch (err) {
        console.error(`[${name}] Error:`, err instanceof Error ? err.message : String(err));
    }
}
async function runBenchmark(count) {
    console.log(`\n========================================`);
    console.log(`BENCHMARK TARGET: ${count} PROSPEcripts`);
    console.log(`========================================\n`);
    await clearData();
    await seedProspects(count);
    console.log("\n--- Testing API Endpoints ---");
    await measureEndpoint("GET /api/prospects", `${API_BASE}/api/prospects`);
    await measureEndpoint("GET /api/sequences", `${API_BASE}/api/sequences`);
    await measureEndpoint("GET /api/observability/diagnostics", `${API_BASE}/api/observability/diagnostics`);
    console.log("\n--- Testing Scheduler ---");
    const schedStart = perf_hooks_1.performance.now();
    try {
        const res = await fetch(`${API_BASE}/api/cron/scheduler`, { method: "POST" });
        const schedEnd = perf_hooks_1.performance.now();
        console.log(`[Scheduler POST] Latency: ${(schedEnd - schedStart).toFixed(2)} ms`);
    }
    catch (err) {
        console.log(`[Scheduler POST] Error:`, err);
    }
}
async function main() {
    const args = process.argv.slice(2);
    const count = args.length > 0 ? parseInt(args[0]) : 100;
    await runBenchmark(count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
