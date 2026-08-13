const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.emailAccount.findMany().then(a => console.log('Email Accounts in DB:', JSON.stringify(a, null, 2))).catch(console.error).finally(() => p.$disconnect());
