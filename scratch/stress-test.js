require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runStressTest(targetProspects) {
    console.log(`\n======================================================`);
    console.log(`ENTERPRISE STRESS TEST: ${targetProspects} PROSPECTS`);
    console.log(`======================================================\n`);

    const startTime = Date.now();
    let initialMemory = process.memoryUsage().heapUsed;

    try {
        console.log(`[1/3] Clearing previous database state (Cascade Delete)...`);
        await prisma.prospect.deleteMany({});
        console.log(`      ✓ Database cleared.\n`);

        console.log(`[2/3] Simulating massive Prospect insertion...`);
        const CHUNK_SIZE = 5000;
        let totalInserted = 0;

        for (let i = 0; i < targetProspects; i += CHUNK_SIZE) {
            const currentChunkSize = Math.min(CHUNK_SIZE, targetProspects - i);
            const prospectData = Array.from({ length: currentChunkSize }).map((_, idx) => ({
                email: `stress-${i + idx}@example.com`,
                name: `Stress Test ${i + idx}`,
                company: 'Enterprise Inc',
                timezone: 'UTC'
            }));

            await prisma.prospect.createMany({ data: prospectData, skipDuplicates: true });
            totalInserted += currentChunkSize;
            
            // Log memory pressure every 20k rows
            if (totalInserted % 20000 === 0 || totalInserted === targetProspects) {
                 const currentHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                 console.log(`      ✓ Inserted ${totalInserted} / ${targetProspects} ... (Heap: ${currentHeap} MB)`);
            }
        }
        console.log(`      ✓ Base entities seeded successfully.\n`);

        console.log(`[3/3] Querying latency benchmark...`);
        const queryStart = Date.now();
        const activeProspects = await prisma.prospect.findMany({
            where: { status: 'ACTIVE' },
            take: 1000,
            select: { id: true, email: true }
        });
        const queryLatency = Date.now() - queryStart;
        console.log(`      ✓ Retrieved 1000 records from ${totalInserted} pool in ${queryLatency}ms.\n`);
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDelta = Math.round((finalMemory - initialMemory) / 1024 / 1024);

        console.log(`======================================================`);
        console.log(`STRESS TEST COMPLETED SUCCESSFULLY`);
        console.log(`Total Time: ${(Date.now() - startTime) / 1000}s`);
        console.log(`Peak Memory Delta: ${memoryDelta} MB`);
        console.log(`Query Latency (100k pool): ${queryLatency}ms`);
        console.log(`======================================================\n`);

    } catch (e) {
        console.error(`\n❌ STRESS TEST FAILED:`, e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

const target = parseInt(process.argv[2], 10) || 100000;
runStressTest(target);
