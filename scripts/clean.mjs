import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
for (const relative of ["dist", ".test-build"]) {
	rmSync(resolve(root, relative), { recursive: true, force: true });
}
