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
  let lineNumber = 0;
  for await (const line of readLines(file)) {
    lineNumber++;
    if (filter.has(line)) {
      // we are pretty confident but cannot trust the filter because of false positives
      await exitIfExactMatch(file, lineNumber, line);
    } else {
      filter.add(line);
    }
  }
})();

async function exitIfExactMatch(
  file: Deno.FsFile,
  candidateLineNumber: number,
  candidate: string
): Promise<void> {
  const originalPosition = await file.seek(0, Deno.SeekMode.Current);

  try {
    // start looking from the start of the file
    await file.seek(0, Deno.SeekMode.Start);

    let lineNumber = 0;
    for await (const line of readLines(file)) {
      lineNumber++;
      if (lineNumber >= candidateLineNumber) {
        // we have reached the candidate line, false positives confirmed 😢
        return;
      }
      if (line === candidate) {
        console.log(line);
        Deno.exit(0); // success 🎉
      }
    }
  } finally {
    // restore the original position in case an exact match could not be found
    // this will allow the main loop to continue from where it left off
    await file.seek(originalPosition, Deno.SeekMode.Start);
  }
}
