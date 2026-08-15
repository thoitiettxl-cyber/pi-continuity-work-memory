import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const releaseRoot = resolve(root, "release");
const stageRoot = resolve(releaseRoot, "stage");
const topName = manifest.name;
const packageRoot = resolve(stageRoot, topName);
const zipName = `${manifest.name}-${manifest.version}.zip`;
const zipPath = resolve(releaseRoot, zipName);
const checksumPath = `${zipPath}.sha256`;

function hashFile(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(path) {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const full = resolve(path, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

function run(command, args, cwd = root) {
	const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 10 * 60_000 });
	if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
	return result.stdout;
}

run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
rmSync(stageRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
rmSync(checksumPath, { force: true });
mkdirSync(packageRoot, { recursive: true });

if (!Array.isArray(manifest.files) || manifest.files.some((entry) => typeof entry !== "string" || !entry.trim()
	|| entry.startsWith("/") || entry.replaceAll("\\", "/").split("/").includes(".."))) {
	throw new Error("package.json files must contain safe non-empty relative paths");
}
const payload = ["package.json", ...new Set(manifest.files)];
for (const relativePath of payload) {
	const source = resolve(root, relativePath);
	if (!existsSync(source)) throw new Error(`Release input missing: ${relativePath}`);
	const target = resolve(packageRoot, relativePath);
	mkdirSync(dirname(target), { recursive: true });
	cpSync(source, target, { recursive: true });
}

const forbiddenPath = /(^|\/)(?:\.git|node_modules|target|sessions?|logs?)(?:\/|$)|(^|\/)(?:auth|settings|credentials)\.json$|\.(?:sqlite|sqlite3|db|wal|shm|log)$/i;
const secretPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|rk|pk)-[-A-Za-z0-9_]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\b(?:glpat|xox[baprs])-[-A-Za-z0-9_]{12,}|\bgsk_[A-Za-z0-9]{20,}|\bnpm_[A-Za-z0-9]{20,}|\bya29\.[A-Za-z0-9._-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i;
for (const path of walk(packageRoot)) {
	const relativePath = relative(packageRoot, path).replaceAll("\\", "/");
	if (forbiddenPath.test(relativePath)) throw new Error(`Forbidden artifact path: ${relativePath}`);
	if (statSync(path).size <= 4 * 1024 * 1024) {
		const bytes = readFileSync(path);
		if (!bytes.includes(0) && secretPattern.test(bytes.toString("utf8"))) throw new Error(`Secret-like content in artifact: ${relativePath}`);
	}
}

const inventory = walk(packageRoot)
	.map((path) => ({
		path: relative(packageRoot, path).replaceAll("\\", "/"),
		size: statSync(path).size,
		sha256: hashFile(path),
	}))
	.sort((left, right) => left.path.localeCompare(right.path));
writeFileSync(resolve(packageRoot, "PACKAGE_INVENTORY.json"), `${JSON.stringify({
	format: 1,
	package: manifest.name,
	version: manifest.version,
	inventoryFile: "PACKAGE_INVENTORY.json",
	inventoryFileExcludedFromEntries: true,
	files: inventory,
}, null, 2)}\n`, "utf8");

run(process.execPath, [resolve(root, "scripts", "validate-install.mjs"), "--package", packageRoot]);

mkdirSync(releaseRoot, { recursive: true });
run("zip", ["-X", "-q", "-r", zipPath, topName], stageRoot);
run("unzip", ["-t", zipPath], releaseRoot);
const checksum = hashFile(zipPath);
writeFileSync(checksumPath, `${checksum}  ${basename(zipPath)}\n`, "utf8");
const archiveList = run("unzip", ["-Z1", zipPath], releaseRoot).trim().split("\n").filter(Boolean);
const expected = new Set([`${topName}/`, ...walk(packageRoot).map((path) => `${topName}/${relative(packageRoot, path).replaceAll("\\", "/")}`)]);
for (const entry of archiveList) {
	if (!entry.endsWith("/") && !expected.has(entry)) throw new Error(`Unexpected ZIP entry: ${entry}`);
}
const report = {
	status: "PASS",
	artifact: zipPath,
	sha256: checksum,
	files: inventory.length + 1,
	unzipTest: "PASS",
	sanitized: true,
	independentInstallPayload: true,
};
writeFileSync(resolve(releaseRoot, "release-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
