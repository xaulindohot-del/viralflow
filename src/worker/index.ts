import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { claimDue, runTarget } from "./publish";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue("publish", { connection });

// Tick a cada 30s: o Postgres é a fonte da verdade; BullMQ distribui a execução.
new Worker("tick", async () => {
  for (const id of await claimDue()) await queue.add("run", { id }, { jobId: `target-${id}-${Date.now()}`, attempts: 1, removeOnComplete: 1000 });
}, { connection });
new Queue("tick", { connection }).upsertJobScheduler("tick-30s", { every: 30_000 });

// concorrência por processo; ordem por conta é garantida pelo claim ordenado.
new Worker("publish", async (job) => runTarget(job.data.id), { connection, concurrency: 5 });
console.log("ViralFlow worker ativo");
