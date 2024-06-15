import { readLines } from "https://deno.land/std@0.50.0/io/bufio.ts";
import bf from "npm:bloom-filters@3.0.2";

(async function main() {
  const path = Deno.args[0];
  if (typeof path === "undefined" || Deno.args.length > 1) {
    console.error("Usage: deno run --allow-read deno.ts <path>");
    Deno.exit(1);
  }

  // https://hur.st/bloomfilter/?n=200000000&p=&m=8GiB&k=8
  // with a 200GB file and each line at 1KB maximum, that will be 200M+ lines
  // give this m & k, we have the probability of false positives of 1 in 12.7 trillion 🤯
  // this filter require ~8GB of memory
  const filter = new bf.BloomFilter(8 * 8 * 1024 * 1024 * 1024, 8);

  const file = await Deno.open(path, { read: true });
  const candidates: string[] = [];
  for await (const line of readLines(file)) {
    if (filter.has(line)) {
      candidates.push(line);
    } else {
      filter.add(line);
    }
  }

  // naive implementation: read the file again to find the exact match
  // we are pretty confident but cannot trust the filter because of false positives
  file.seek(0, Deno.SeekMode.Start);
  for await (const line of readLines(file)) {
    if (candidates.includes(line)) {
      console.log(line);
      return;
    }
  }
})();
