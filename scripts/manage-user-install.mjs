import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
	closeSync,
	copyFileSync,
	cpSync,
	existsSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	readdirSync,
	realpathSync,
	renameSync,
	rmdirSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "pi-continuity-work-memory";
const EXPECTED_SKILLS = ["audit-onboarding-proposal", "code-review", "codebase-design", "contract-first", "diagnosing-bugs", "domain-modeling", "encode-invariant", "grill-with-docs", "improve-harness", "onboard-repository", "tdd"];
const EXPECTED_SKILL_ENTRIES = EXPECTED_SKILLS.map((name) => `./skills/${name}`);
const TARGET_RELATIVE_PATH = `packages/${PACKAGE_NAME}`;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 1_000;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_PACKAGE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;

function fail(message) {
	throw new Error(message);
}

function usage() {
	return `Usage:
  node scripts/manage-user-install.mjs deploy (--archive <zip> | --package <directory>) [options]
  node scripts/manage-user-install.mjs remove [options]

Options:
  --agent-dir <path>           Pi user agent directory (default: PI_CODING_AGENT_DIR or ~/.pi/agent)
  --pi <path>                  Pi executable used by the isolated proof (default: PI_MANAGED_INSTALL_PI or pi)
  --checksum <path>            SHA-256 file for --archive (default: <archive>.sha256)
  --expected-sha256 <digest>   Trusted expected archive digest in addition to the checksum file
  --dry-run                    Verify and report the deployment plan without changing the agent directory
  --remove-runtime             With remove, archive the managed runtime after unregistering it
`;
}

function parseArguments(argv) {
	const [command, ...rest] = argv;
	if (command !== "deploy" && command !== "remove") fail(usage());
	const options = { command, dryRun: false, removeRuntime: false };
	for (let index = 0; index < rest.length; index += 1) {
		const argument = rest[index];
		if (argument === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (argument === "--remove-runtime") {
			options.removeRuntime = true;
			continue;
		}
		if (["--archive", "--package", "--agent-dir", "--pi", "--checksum", "--expected-sha256"].includes(argument)) {
			const value = rest[index + 1];
			if (!value) fail(`Missing value for ${argument}\n${usage()}`);
			options[argument.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = value;
			index += 1;
			continue;
		}
		fail(`Unknown argument: ${argument}\n${usage()}`);
	}
	if (command === "deploy" && Boolean(options.archive) === Boolean(options.package)) {
		fail("deploy requires exactly one of --archive or --package");
	}
	if (options.package && (options.checksum || options.expectedSha256)) {
		fail("--checksum and --expected-sha256 are valid only with --archive");
	}
	if (command === "remove" && (options.archive || options.package || options.checksum || options.expectedSha256 || options.dryRun)) {
		fail("remove accepts only --agent-dir, --pi, and --remove-runtime");
	}
	return options;
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		env: options.env,
		encoding: "utf8",
		timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
	});
	if (result.status !== 0) {
		const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
		fail(`${command} ${args.join(" ")} failed (${result.status ?? "no status"})${detail ? `: ${detail}` : ""}`);
	}
	return result.stdout;
}

function boundedFile(path, maximum, label) {
	const stats = statSync(path);
	if (!stats.isFile()) fail(`${label} is not a regular file: ${path}`);
	if (stats.size > maximum) fail(`${label} exceeds ${maximum} bytes: ${path}`);
	return readFileSync(path);
}

function readJson(path, maximum, label) {
	return JSON.parse(boundedFile(path, maximum, label).toString("utf8"));
}

function hashFile(path, maximum = MAX_ARCHIVE_BYTES) {
	return createHash("sha256").update(boundedFile(path, maximum, "File")).digest("hex");
}

function safeRelativePath(path, allowTrailingSlash = false) {
	if (!path || path.includes("\\") || path.includes("\0") || isAbsolute(path) || /^[A-Za-z]:/.test(path)) return false;
	const trimmed = allowTrailingSlash ? path.replace(/\/+$/, "") : path;
	if (!trimmed) return false;
	return trimmed.split("/").every((part) => part && part !== "." && part !== "..");
}

function verifyArchive(archivePath, checksumPath, trustedDigest) {
	const archive = resolve(archivePath);
	const checksum = resolve(checksumPath || `${archive}.sha256`);
	if (!existsSync(archive)) fail(`Release archive does not exist: ${archive}`);
	if (!existsSync(checksum)) fail(`Release checksum does not exist: ${checksum}`);
	const checksumLine = boundedFile(checksum, 4_096, "Checksum file").toString("utf8").trim().split(/\r?\n/, 1)[0] || "";
	const checksumMatch = checksumLine.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
	if (!checksumMatch) fail(`Invalid SHA-256 file: ${checksum}`);
	const expectedHash = checksumMatch[1].toLowerCase();
	const expectedName = basename(checksumMatch[2].trim());
	if (expectedName !== basename(archive)) fail(`Checksum names ${expectedName}, expected ${basename(archive)}`);
	const actualHash = hashFile(archive);
	if (actualHash !== expectedHash) fail(`SHA-256 mismatch for ${archive}`);
	if (trustedDigest) {
		if (!/^[a-fA-F0-9]{64}$/.test(trustedDigest)) fail("--expected-sha256 must be a 64-character hexadecimal digest");
		if (actualHash !== trustedDigest.toLowerCase()) fail(`Trusted SHA-256 mismatch for ${archive}`);
	}

	run("unzip", ["-t", archive]);
	const entries = run("unzip", ["-Z1", archive]).split(/\r?\n/).filter(Boolean);
	if (entries.length === 0) fail(`Release archive is empty: ${archive}`);
	if (entries.length > MAX_ARCHIVE_ENTRIES) fail(`Release archive has too many entries: ${entries.length}`);
	const seen = new Set();
	for (const entry of entries) {
		if (!safeRelativePath(entry, true)) fail(`Unsafe ZIP entry: ${JSON.stringify(entry)}`);
		if (entry !== `${PACKAGE_NAME}/` && !entry.startsWith(`${PACKAGE_NAME}/`)) {
			fail(`ZIP entry is outside ${PACKAGE_NAME}/: ${entry}`);
		}
		if (seen.has(entry)) fail(`Duplicate ZIP entry: ${entry}`);
		seen.add(entry);
	}
	const metadata = run("zipinfo", ["-l", archive])
		.split(/\r?\n/)
		.map((line) => ({ line, match: line.match(/^([bcdlps-])[rwxStTs-]{9}\s+\S+\s+\S+\s+(\d+)\s/) }))
		.filter((entry) => entry.match);
	if (metadata.length !== entries.length) fail("Could not verify every ZIP entry type and size");
	let totalUncompressed = 0;
	for (const entry of metadata) {
		const kind = entry.match[1];
		const size = Number(entry.match[2]);
		if (kind !== "-" && kind !== "d") fail(`Unsupported ZIP entry type: ${entry.line}`);
		if (!Number.isSafeInteger(size) || size < 0 || size > MAX_PACKAGE_FILE_BYTES) fail(`ZIP entry is too large: ${entry.line}`);
		totalUncompressed += size;
	}
	if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) fail(`Release archive expands beyond ${MAX_UNCOMPRESSED_BYTES} bytes`);
	const archiveBytes = statSync(archive).size;
	if (archiveBytes > 0 && totalUncompressed / archiveBytes > MAX_COMPRESSION_RATIO) fail("Release archive compression ratio is too high");
	return { archive, checksum, sha256: actualHash, entries: entries.length, uncompressedBytes: totalUncompressed };
}

function walkFiles(root) {
	const files = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = resolve(root, entry.name);
		const stats = lstatSync(path);
		if (stats.isSymbolicLink()) fail(`Symbolic links are not allowed in the install payload: ${path}`);
		if (stats.isDirectory()) files.push(...walkFiles(path));
		else if (stats.isFile()) files.push(path);
		else fail(`Special filesystem entry is not allowed in the install payload: ${path}`);
	}
	return files;
}

function verifyPackageDirectory(packagePath) {
	const root = resolve(packagePath);
	if (!existsSync(root)) fail(`Package directory does not exist: ${root}`);
	const rootStats = lstatSync(root);
	if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) fail(`Package root must be a real directory: ${root}`);
	const manifestPath = resolve(root, "package.json");
	const inventoryPath = resolve(root, "PACKAGE_INVENTORY.json");
	if (!existsSync(manifestPath)) fail(`Package manifest is missing: ${manifestPath}`);
	if (!existsSync(inventoryPath)) fail(`Package inventory is missing: ${inventoryPath}`);
	const manifest = readJson(manifestPath, MAX_JSON_BYTES, "Package manifest");
	const inventory = readJson(inventoryPath, MAX_JSON_BYTES, "Package inventory");
	if (manifest.name !== PACKAGE_NAME) fail(`Unexpected package name: ${manifest.name}`);
	if (typeof manifest.version !== "string" || !manifest.version) fail("Package version is missing");
	if (!Array.isArray(manifest.pi?.extensions) || !manifest.pi.extensions.includes("./dist/extension.js")) {
		fail("Package manifest does not load ./dist/extension.js");
	}
	if (JSON.stringify(manifest.pi?.skills) !== JSON.stringify(EXPECTED_SKILL_ENTRIES)) fail("Package manifest does not load exactly the eleven package skill directories");
	for (const skill of EXPECTED_SKILLS) {
		if (!existsSync(resolve(root, "skills", skill, "SKILL.md"))) fail(`Package skill payload is missing: ${skill}`);
	}
	if (!existsSync(resolve(root, "dist", "extension.js"))) fail("Package entry point dist/extension.js is missing");
	if (!existsSync(resolve(root, "scripts", "validate-install.mjs"))) fail("Package install proof is missing");
	if (inventory.package !== manifest.name || inventory.version !== manifest.version) fail("Package inventory identity does not match package.json");
	if (inventory.inventoryFile !== "PACKAGE_INVENTORY.json" || inventory.inventoryFileExcludedFromEntries !== true) {
		fail("Package inventory metadata is invalid");
	}
	if (!Array.isArray(inventory.files) || inventory.files.length === 0 || inventory.files.length > MAX_ARCHIVE_ENTRIES) {
		fail("Package inventory has an invalid file count");
	}

	const expected = new Map();
	for (const entry of inventory.files) {
		if (!entry || typeof entry.path !== "string" || !safeRelativePath(entry.path)) fail("Package inventory contains an unsafe path");
		if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_PACKAGE_FILE_BYTES || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
			fail(`Package inventory metadata is invalid for ${entry.path}`);
		}
		if (expected.has(entry.path)) fail(`Package inventory contains a duplicate path: ${entry.path}`);
		expected.set(entry.path, entry);
	}

	const actualFiles = walkFiles(root);
	let totalBytes = 0;
	const actual = actualFiles
		.map((path) => {
			const size = statSync(path).size;
			if (size > MAX_PACKAGE_FILE_BYTES) fail(`Package file is too large: ${path}`);
			totalBytes += size;
			return relative(root, path).split(sep).join("/");
		})
		.filter((path) => path !== "PACKAGE_INVENTORY.json")
		.sort();
	if (totalBytes > MAX_UNCOMPRESSED_BYTES) fail(`Package exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`);
	const expectedPaths = [...expected.keys()].sort();
	if (JSON.stringify(actual) !== JSON.stringify(expectedPaths)) fail("Package file set does not match PACKAGE_INVENTORY.json");
	for (const relativePath of expectedPaths) {
		const entry = expected.get(relativePath);
		const bytes = boundedFile(resolve(root, relativePath), MAX_PACKAGE_FILE_BYTES, "Package file");
		if (bytes.length !== entry.size || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
			fail(`Package inventory mismatch: ${relativePath}`);
		}
	}
	return { root, name: manifest.name, version: manifest.version, files: expectedPaths.length, totalBytes };
}

function runInstallProof(packageRoot, pi) {
	const proof = resolve(packageRoot, "scripts", "validate-install.mjs");
	return run(process.execPath, [proof, "--package", packageRoot], {
		cwd: packageRoot,
		env: { ...process.env, PI_VALIDATION_PI: pi },
	});
}

function packageSource(entry) {
	return typeof entry === "string" ? entry : entry?.source;
}

function isNonLocalSource(source) {
	return source.startsWith("npm:") || source.startsWith("git:") || /^(?:https?|ssh|git):\/\//.test(source);
}

function resolveLocalSource(source, agentDir) {
	return resolve(agentDir, source);
}

function sourceReferencesPackage(source, agentDir) {
	if (typeof source !== "string" || !source) return false;
	if (source.startsWith("npm:")) {
		const spec = source.slice(4);
		return spec === PACKAGE_NAME || spec.startsWith(`${PACKAGE_NAME}@`);
	}
	if (isNonLocalSource(source)) return new RegExp(`(?:^|[/:])${PACKAGE_NAME}(?:\\.git)?(?:@[^/]+)?$`).test(source);
	const localPath = resolveLocalSource(source, agentDir);
	try {
		const manifest = readJson(resolve(localPath, "package.json"), MAX_JSON_BYTES, "Registered package manifest");
		return manifest.name === PACKAGE_NAME;
	} catch (error) {
		if (existsSync(resolve(localPath, "package.json"))) throw error;
		return basename(localPath) === PACKAGE_NAME;
	}
}

function matchingEntries(settings, agentDir) {
	const packages = Array.isArray(settings.packages) ? settings.packages : [];
	return packages
		.map((entry, index) => ({ entry, index, source: packageSource(entry) }))
		.filter((item) => sourceReferencesPackage(item.source, agentDir));
}

function migratedSettings(settings, agentDir) {
	const packages = Array.isArray(settings.packages) ? settings.packages : [];
	const matches = matchingEntries(settings, agentDir);
	for (const match of matches) {
		if (isNonLocalSource(match.source)) fail(`Refusing to replace non-local package registration automatically: ${match.source}`);
	}
	const firstMatch = matches[0];
	const replacement = firstMatch && typeof firstMatch.entry === "object"
		? { ...firstMatch.entry, source: TARGET_RELATIVE_PATH }
		: TARGET_RELATIVE_PATH;
	const matchIndexes = new Set(matches.map((match) => match.index));
	const nextPackages = [];
	let inserted = false;
	for (let index = 0; index < packages.length; index += 1) {
		if (!matchIndexes.has(index)) {
			nextPackages.push(packages[index]);
			continue;
		}
		if (!inserted) {
			nextPackages.push(replacement);
			inserted = true;
		}
	}
	if (!inserted) nextPackages.push(TARGET_RELATIVE_PATH);
	return { settings: { ...settings, packages: nextPackages }, replacedSources: matches.map((match) => match.source) };
}

function settingsWithoutPackage(settings, agentDir) {
	const packages = Array.isArray(settings.packages) ? settings.packages : [];
	const matches = matchingEntries(settings, agentDir);
	for (const match of matches) {
		if (isNonLocalSource(match.source)) fail(`Refusing to remove non-local package registration automatically: ${match.source}`);
	}
	const indexes = new Set(matches.map((match) => match.index));
	return {
		settings: { ...settings, packages: packages.filter((_entry, index) => !indexes.has(index)) },
		removedSources: matches.map((match) => match.source),
	};
}

function readSettingsText(settingsPath) {
	return existsSync(settingsPath) ? boundedFile(settingsPath, MAX_JSON_BYTES, "Pi settings").toString("utf8") : undefined;
}

function parseSettings(text) {
	return text === undefined ? {} : JSON.parse(text);
}

function atomicWrite(path, content) {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const temporary = `${path}.tmp-${uniqueSuffix()}`;
	let descriptor;
	try {
		descriptor = openSync(temporary, "wx", 0o600);
		writeFileSync(descriptor, content, "utf8");
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = undefined;
		renameSync(temporary, path);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
		rmSync(temporary, { force: true });
	}
}

function writeSettings(path, settings) {
	atomicWrite(path, `${JSON.stringify(settings, null, 2)}\n`);
}

function sleep(milliseconds) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function sameLockIdentity(left, right) {
	return left.dev === right.dev && left.ino === right.ino && left.birthtimeMs === right.birthtimeMs;
}

function acquireOwnedDirectoryLock(lockPath, attempts, lockedMessage, staleMilliseconds = 10_000) {
	let identity;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			mkdirSync(lockPath);
			const now = new Date();
			utimesSync(lockPath, now, now);
			identity = lstatSync(lockPath);
			break;
		} catch (error) {
			if (error?.code !== "EEXIST") throw error;
			try {
				const existing = lstatSync(lockPath);
				if (existing.isDirectory() && existing.mtimeMs < Date.now() - staleMilliseconds) {
					try {
						rmdirSync(lockPath);
						attempt -= 1;
						continue;
					} catch (removeError) {
						if (removeError?.code !== "ENOENT") throw removeError;
					}
				}
			} catch (statError) {
				if (statError?.code === "ENOENT") {
					attempt -= 1;
					continue;
				}
				throw statError;
			}
			if (attempt === attempts) fail(`${lockedMessage}; inspect ${lockPath}`);
			sleep(50);
		}
	}
	if (!identity) fail(`${lockedMessage}; inspect ${lockPath}`);
	const isOwned = () => {
		try {
			return sameLockIdentity(identity, lstatSync(lockPath));
		} catch {
			return false;
		}
	};
	const assertOwned = () => {
		if (!isOwned()) fail(`Lock ownership was lost: ${lockPath}`);
		const now = new Date();
		utimesSync(lockPath, now, now);
		if (!isOwned()) fail(`Lock ownership changed while refreshing: ${lockPath}`);
	};
	const release = () => {
		if (!isOwned()) return `Lock ownership changed before release: ${lockPath}`;
		try {
			rmdirSync(lockPath);
			return undefined;
		} catch (error) {
			return `Could not release ${lockPath}: ${error instanceof Error ? error.message : String(error)}`;
		}
	};
	return { assertOwned, isOwned, release };
}

function withSettingsLock(settingsPath, operation) {
	mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
	const lock = acquireOwnedDirectoryLock(`${settingsPath}.lock`, 100, "Could not acquire Pi settings lock");
	try {
		return operation(lock);
	} finally {
		lock.release();
	}
}

function acquireInstallerLock(packagesRoot) {
	const lockPath = resolve(packagesRoot, `.${PACKAGE_NAME}.install.lock`);
	return acquireOwnedDirectoryLock(lockPath, 1, "Another managed install may be active", 60_000);
}

function timestamp() {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

function uniqueSuffix() {
	return `${process.pid}-${randomBytes(4).toString("hex")}`;
}

function prepareStagedPackage(options, stagingParent) {
	const stageRoot = resolve(stagingParent, `.${PACKAGE_NAME}.staging-${uniqueSuffix()}`);
	const stagedPackage = resolve(stageRoot, PACKAGE_NAME);
	mkdirSync(stageRoot, { recursive: false, mode: 0o700 });
	let archiveEvidence;
	try {
		if (options.archive) {
			const sourceArchive = resolve(options.archive);
			const sourceChecksum = resolve(options.checksum || `${sourceArchive}.sha256`);
			const snapshotRoot = resolve(stageRoot, ".input");
			const snapshotArchive = resolve(snapshotRoot, basename(sourceArchive));
			const snapshotChecksum = resolve(snapshotRoot, basename(sourceChecksum));
			mkdirSync(snapshotRoot, { mode: 0o700 });
			copyFileSync(sourceArchive, snapshotArchive);
			copyFileSync(sourceChecksum, snapshotChecksum);
			const snapshotEvidence = verifyArchive(snapshotArchive, snapshotChecksum, options.expectedSha256);
			archiveEvidence = { ...snapshotEvidence, archive: sourceArchive, checksum: sourceChecksum };
			run("unzip", ["-q", snapshotArchive, "-d", stageRoot]);
		} else {
			const source = resolve(options.package);
			if (!existsSync(source)) fail(`Package directory does not exist: ${source}`);
			const sourceStats = lstatSync(source);
			if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) fail(`Package source must be a real directory: ${source}`);
			cpSync(source, stagedPackage, { recursive: true, errorOnExist: true });
		}
		const packageEvidence = verifyPackageDirectory(stagedPackage);
		return { stageRoot, stagedPackage, archiveEvidence, packageEvidence };
	} catch (error) {
		rmSync(stageRoot, { recursive: true, force: true });
		throw error;
	}
}

function bestEffortRollback({ target, runtimeBackup, previousRuntimeMoved, stagedRuntimeActivated, settingsPath, originalSettingsText, restoreSettings }) {
	const errors = [];
	try {
		if (stagedRuntimeActivated) rmSync(target, { recursive: true, force: true });
		if (previousRuntimeMoved && existsSync(runtimeBackup)) renameSync(runtimeBackup, target);
	} catch (error) {
		errors.push(`runtime rollback failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (restoreSettings) {
		try {
			if (originalSettingsText === undefined) rmSync(settingsPath, { force: true });
			else atomicWrite(settingsPath, originalSettingsText);
		} catch (error) {
			errors.push(`settings rollback failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return errors;
}

export function deployManaged(options, hooks = {}) {
	const agentDir = resolve(options.agentDir || process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"));
	const pi = options.pi || process.env.PI_MANAGED_INSTALL_PI || "pi";
	const target = resolve(agentDir, TARGET_RELATIVE_PATH);
	const settingsPath = resolve(agentDir, "settings.json");
	const dryRunRoot = options.dryRun ? mkdtempSync(join(tmpdir(), "pi-managed-install-dry-run-")) : undefined;
	const packagesRoot = options.dryRun ? dryRunRoot : resolve(agentDir, "packages");
	if (!options.dryRun) {
		mkdirSync(agentDir, { recursive: true, mode: 0o700 });
		mkdirSync(packagesRoot, { recursive: true, mode: 0o755 });
	}
	const prepared = prepareStagedPackage(options, packagesRoot);
	try {
		runInstallProof(prepared.stagedPackage, pi);
		const currentSettings = parseSettings(readSettingsText(settingsPath));
		const migration = migratedSettings(currentSettings, agentDir);
		const plan = {
			status: "PASS",
			action: options.dryRun ? "deploy-dry-run" : "deploy",
			package: `${prepared.packageEvidence.name}@${prepared.packageEvidence.version}`,
			target,
			replaceSources: migration.replacedSources,
			storesChanged: false,
			restartRequired: !options.dryRun,
			archive: prepared.archiveEvidence,
			inventoryFiles: prepared.packageEvidence.files,
		};
		if (options.dryRun) return plan;

		const installerLock = acquireInstallerLock(packagesRoot);
		try {
			installerLock.assertOwned();
			const backupRoot = resolve(agentDir, "backups", PACKAGE_NAME, `${timestamp()}-${uniqueSuffix()}`);
			const settingsBackup = resolve(backupRoot, "settings.json");
			const runtimeBackup = resolve(backupRoot, "runtime");
			mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
			let registeredSource;
			let replacedSources = migration.replacedSources;
			withSettingsLock(settingsPath, (settingsLock) => {
				settingsLock.assertOwned();
				installerLock.assertOwned();
				const originalSettingsText = readSettingsText(settingsPath);
				const lockedSettings = parseSettings(originalSettingsText);
				const lockedMigration = migratedSettings(lockedSettings, agentDir);
				replacedSources = lockedMigration.replacedSources;
				if (originalSettingsText !== undefined) writeFileSync(settingsBackup, originalSettingsText, { encoding: "utf8", mode: 0o600 });
				writeFileSync(resolve(backupRoot, "deployment.json"), `${JSON.stringify({
					format: 1,
					package: prepared.packageEvidence.name,
					version: prepared.packageEvidence.version,
					target,
					replacedSources: lockedMigration.replacedSources,
					settingsExisted: originalSettingsText !== undefined,
				}, null, 2)}\n`, "utf8");
				let previousRuntimeMoved = false;
				let stagedRuntimeActivated = false;
				let settingsMayHaveChanged = false;
				try {
					if (existsSync(target)) {
						renameSync(target, runtimeBackup);
						previousRuntimeMoved = true;
					}
					renameSync(prepared.stagedPackage, target);
					stagedRuntimeActivated = true;
					hooks.afterActivate?.({ target, backupRoot });
					settingsLock.assertOwned();
					installerLock.assertOwned();
					settingsMayHaveChanged = true;
					writeSettings(settingsPath, lockedMigration.settings);
					settingsLock.assertOwned();
					const verified = matchingEntries(parseSettings(readSettingsText(settingsPath)), agentDir);
					if (verified.length !== 1 || resolveLocalSource(verified[0].source, agentDir) !== target) {
						fail(`Expected exactly one ${PACKAGE_NAME} registration at ${target}`);
					}
					registeredSource = verified[0].source;
				} catch (error) {
					const rollbackErrors = bestEffortRollback({
						target,
						runtimeBackup,
						previousRuntimeMoved,
						stagedRuntimeActivated,
						settingsPath,
						originalSettingsText,
						restoreSettings: settingsMayHaveChanged && settingsLock.isOwned(),
					});
					if (rollbackErrors.length) fail(`${error instanceof Error ? error.message : String(error)}; ${rollbackErrors.join("; ")}`);
					throw error;
				}
			});
			rmSync(prepared.stageRoot, { recursive: true, force: true });
			return { ...plan, replaceSources: replacedSources, backupRoot, registeredSource };
		} finally {
			installerLock.release();
		}
	} finally {
		rmSync(prepared.stageRoot, { recursive: true, force: true });
		if (dryRunRoot) rmSync(dryRunRoot, { recursive: true, force: true });
	}
}

export function removeManaged(options) {
	const agentDir = resolve(options.agentDir || process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"));
	const target = resolve(agentDir, TARGET_RELATIVE_PATH);
	const packagesRoot = resolve(agentDir, "packages");
	const settingsPath = resolve(agentDir, "settings.json");
	mkdirSync(agentDir, { recursive: true, mode: 0o700 });
	mkdirSync(packagesRoot, { recursive: true, mode: 0o755 });
	const installerLock = acquireInstallerLock(packagesRoot);
	try {
		installerLock.assertOwned();
		const backupRoot = resolve(agentDir, "backups", PACKAGE_NAME, `${timestamp()}-${uniqueSuffix()}-remove`);
		const settingsBackup = resolve(backupRoot, "settings.json");
		const runtimeBackup = resolve(backupRoot, "runtime");
		const removalMetadata = resolve(backupRoot, "removal.json");
		mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
		let removedSources = [];
		let runtimeArchived = false;
		let metadataWarning;
		withSettingsLock(settingsPath, (settingsLock) => {
			settingsLock.assertOwned();
			installerLock.assertOwned();
			const originalSettingsText = readSettingsText(settingsPath);
			const removal = settingsWithoutPackage(parseSettings(originalSettingsText), agentDir);
			removedSources = removal.removedSources;
			if (originalSettingsText !== undefined) writeFileSync(settingsBackup, originalSettingsText, { encoding: "utf8", mode: 0o600 });
			writeFileSync(removalMetadata, `${JSON.stringify({
				format: 1,
				status: "prepared",
				package: PACKAGE_NAME,
				removedSources,
				removeRuntime: Boolean(options.removeRuntime),
				storesChanged: false,
			}, null, 2)}\n`, "utf8");
			let settingsMayHaveChanged = false;
			try {
				if (options.removeRuntime && existsSync(target)) {
					renameSync(target, runtimeBackup);
					runtimeArchived = true;
				}
				settingsLock.assertOwned();
				installerLock.assertOwned();
				settingsMayHaveChanged = true;
				writeSettings(settingsPath, removal.settings);
				settingsLock.assertOwned();
				if (matchingEntries(parseSettings(readSettingsText(settingsPath)), agentDir).length) fail("Package registration remains after remove");
			} catch (error) {
				const rollbackErrors = bestEffortRollback({
					target,
					runtimeBackup,
					previousRuntimeMoved: runtimeArchived,
					stagedRuntimeActivated: false,
					settingsPath,
					originalSettingsText,
					restoreSettings: settingsMayHaveChanged && settingsLock.isOwned(),
				});
				if (rollbackErrors.length) fail(`${error instanceof Error ? error.message : String(error)}; ${rollbackErrors.join("; ")}`);
				throw error;
			}
		});
		try {
			atomicWrite(removalMetadata, `${JSON.stringify({
				format: 1,
				status: "complete",
				package: PACKAGE_NAME,
				removedSources,
				runtimeArchived,
				storesChanged: false,
			}, null, 2)}\n`);
		} catch (error) {
			metadataWarning = `Removal completed but backup metadata could not be finalized: ${error instanceof Error ? error.message : String(error)}`;
		}
		return {
			status: "PASS",
			action: "remove",
			removedSources,
			runtimeArchived,
			backupRoot,
			storesChanged: false,
			restartRequired: true,
			...(metadataWarning ? { warning: metadataWarning } : {}),
		};
	} finally {
		installerLock.release();
	}
}

export function main(argv = process.argv.slice(2)) {
	const options = parseArguments(argv);
	return options.command === "deploy" ? deployManaged(options) : removeManaged(options);
}

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
	try {
		process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`);
	} catch (error) {
		process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
