// Run once with the path to the Styleguide checkout. Only the shared knowledge index is read.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const dotenv = require("dotenv");

async function main() {
  if (!process.argv[2]) throw new Error("Provide the Styleguide checkout path");
  const root = path.resolve(process.argv[2]);
  const sourceRequire = createRequire(path.join(root, "package.json"));
  const { Pinecone } = sourceRequire("@pinecone-database/pinecone");
  const env = {};
  for (const name of [".env", ".env.local"]) {
    try { Object.assign(env, dotenv.parse(await fs.readFile(path.join(root, name)))); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const index = new Pinecone({ apiKey: env.PINECONE_API_KEY }).index("hometruth-knowledge-base");
  const stats = await index.describeIndexStats();
  const docs = new Map();
  for (const namespace of ["general", "urls"]) {
    const ns = index.namespace(namespace);
    const seen = new Set();
    let paginationToken;
    do {
      const page = await ns.listPaginated({ limit: 100, paginationToken });
      const ids = (page.vectors || []).map(row => row.id);
      if (ids.length) {
        const { records } = await ns.fetch(ids);
        for (const id of ids) {
          if (seen.has(id)) throw new Error("Duplicate record in snapshot");
          seen.add(id);
          const m = records[id]?.metadata;
          const text = m?.chunk_text || m?.chunkText || m?.text || m?.content;
          if (typeof text !== "string" || !text.trim()) throw new Error("Missing text in " + namespace + " for " + id);
          const key = createHash("sha256").update(JSON.stringify([namespace,m.document_id || m.documentId || m.url || id])).digest("hex");
          if (!docs.has(key)) docs.set(key,{id:key, namespace, name:m.name || m.title || m.url || id, chunks:[]});
          docs.get(key).chunks.push({id, order:Number(m.chunkIndex ?? m.chunk_index ?? 0), text});
        }
      }
      paginationToken = page.pagination?.next;
    } while (paginationToken);
    if (seen.size !== stats.namespaces?.[namespace]?.recordCount) throw new Error("Incomplete snapshot in " + namespace);
    console.log(namespace, seen.size, "records");
  }
  const documents = Array.from(docs.values()).sort((a,b)=>a.name.localeCompare(b.name));
  for (const doc of documents) doc.chunks.sort((a,b)=>a.order-b.order || a.id.localeCompare(b.id,undefined,{numeric:true}));
  const dir = path.join(__dirname,"../../.investor-demo");
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  const tmp = path.join(dir,"knowledge-" + randomUUID() + ".tmp");
  await fs.writeFile(tmp,JSON.stringify(documents),{mode:0o600});
  await fs.rename(tmp,path.join(dir,"knowledge.json"));
  console.log(documents.length,"knowledge documents saved locally.");
}
main().catch(e=>{ console.error(e.message); process.exitCode=1; });
