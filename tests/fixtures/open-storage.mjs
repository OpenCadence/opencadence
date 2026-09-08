if (process.env.STORAGE_TEST_UMASK)
  process.umask(Number(process.env.STORAGE_TEST_UMASK));

const { db } = await import("../../src/lib/storage.ts");
db({ readOnly: process.env.STORAGE_READ_ONLY === "1" }).close();
