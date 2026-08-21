import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const root = resolve(import.meta.dirname, "..", "..");
const skillsRoot = join(root, "skills");
const expectedSkills = [
	"code-review",
	"codebase-design",
	"diagnosing-bugs",
	"domain-modeling",
	"grill-with-docs",
	"tdd",
] as const;
const expectedSkillEntries = expectedSkills.map((name) => `./skills/${name}`);
const upstreamCommit = "5b15a47f2d7150f545fbcacbfe381787fc0230dc";

function filesBelow(path: string): string[] {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const candidate = join(path, entry.name);
		return entry.isDirectory() ? filesBelow(candidate) : [candidate];
	});
}

function frontmatter(text: string): Record<string, string | boolean> {
	assert.ok(text.startsWith("---\n"), "skill must start with YAML frontmatter");
	const end = text.indexOf("\n---\n", 4);
	assert.ok(end > 4, "skill frontmatter must terminate");
	const result: Record<string, string | boolean> = {};
	for (const line of text.slice(4, end).split("\n")) {
		if (/^\s/.test(line)) continue;
		const match = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
		if (!match) continue;
		const raw = match[2]!.trim();
		result[match[1]!] = raw === "true" ? true : raw === "false" ? false : raw.replace(/^"|"$/g, "");
	}
	return result;
}

function markdownLinks(text: string): string[] {
	return [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
		.map((match) => match[1]!)
		.filter((target) => !target.startsWith("http") && !target.startsWith("#"));
}

test("package declares exactly the six shipped Pi skill directories", () => {
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
		files?: string[];
		pi?: { extensions?: string[]; skills?: string[] };
	};
	assert.deepEqual(manifest.pi?.skills, expectedSkillEntries);
	assert.ok(manifest.pi?.extensions?.includes("./dist/extension.js"));
	assert.ok(manifest.files?.includes("skills"));
});

test("Pi loads each manifest skill path without diagnostics", () => {
	const loaded = expectedSkills.map((name) => loadSkillsFromDir({ dir: join(skillsRoot, name), source: "path" }));
	assert.deepEqual(loaded.flatMap((result) => result.skills.map((skill) => skill.name)), [...expectedSkills]);
	assert.deepEqual(loaded.flatMap((result) => result.diagnostics), []);
});

test("skill inventory and frontmatter are Pi-compatible", () => {
	const actual = readdirSync(skillsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, "SKILL.md")))
		.map((entry) => entry.name)
		.sort();
	assert.deepEqual(actual, [...expectedSkills]);
	for (const name of expectedSkills) {
		const path = join(skillsRoot, name, "SKILL.md");
		const text = readFileSync(path, "utf8");
		const metadata = frontmatter(text);
		assert.equal(metadata.name, name);
		assert.equal(typeof metadata.description, "string");
		assert.ok(String(metadata.description).length > 20 && String(metadata.description).length <= 1_024);
		assert.match(String(metadata.compatibility), /Pi >=0\.84\.1 <0\.85\.0/);
		assert.ok(text.includes(upstreamCommit));
		assert.ok(statSync(path).size < 16_000);
		for (const target of markdownLinks(text)) {
			assert.ok(existsSync(resolve(dirname(path), target)), `missing ${relative(root, resolve(dirname(path), target))}`);
		}
	}
	assert.equal(frontmatter(readFileSync(join(skillsRoot, "grill-with-docs", "SKILL.md"), "utf8"))["disable-model-invocation"], true);
	for (const name of expectedSkills.filter((candidate) => candidate !== "grill-with-docs")) {
		assert.notEqual(frontmatter(readFileSync(join(skillsRoot, name, "SKILL.md"), "utf8"))["disable-model-invocation"], true);
	}
});

test("adapted skills retain authority and avoid cross-harness or unsafe delivery assumptions", () => {
	const text = filesBelow(skillsRoot)
		.filter((path) => path.endsWith(".md") || path.endsWith(".txt"))
		.map((path) => readFileSync(path, "utf8"))
		.join("\n");
	for (const forbidden of [
		"Call the Skill tool",
		"/clear",
		"xdg-open",
		"Commit your work to the current branch",
		"spawn both sub-agents in parallel",
	]) assert.ok(!text.includes(forbidden), `forbidden upstream assumption remains: ${forbidden}`);
	for (const name of ["grill-with-docs", "diagnosing-bugs", "tdd", "domain-modeling"]) {
		assert.ok(readFileSync(join(skillsRoot, name, "SKILL.md"), "utf8").includes("continuity_prepare_work"));
	}
	const grill = readFileSync(join(skillsRoot, "grill-with-docs", "SKILL.md"), "utf8");
	assert.match(grill, /explicit invocation authorizes clarification only/);
	assert.match(grill, /does not authorize\s+any repository mutation/);
	const diagnosis = readFileSync(join(skillsRoot, "diagnosing-bugs", "SKILL.md"), "utf8");
	assert.match(diagnosis, /Diagnose-only/);
	assert.match(diagnosis, /Fix-authorized/);
	assert.match(diagnosis, /Automatic skill loading never upgrades/);
	const domain = readFileSync(join(skillsRoot, "domain-modeling", "SKILL.md"), "utf8");
	assert.match(domain, /does not\s+authorize a repository edit/);
	const review = readFileSync(join(skillsRoot, "code-review", "SKILL.md"), "utf8");
	assert.match(review, /Review is read-only/);
	assert.match(review, /calls may run sequentially/);
	assert.ok(text.includes("safe checkpoint proves repository/operation safety only"));
	assert.ok(text.includes("Do not commit, push"));
	assert.ok(!filesBelow(skillsRoot).some((path) => path.endsWith("agents/openai.yaml")));
});

test("upstream provenance and MIT notice are shipped", () => {
	const provenance = readFileSync(join(skillsRoot, "UPSTREAM.md"), "utf8");
	const license = readFileSync(join(skillsRoot, "UPSTREAM_LICENSE.txt"), "utf8");
	assert.ok(provenance.includes(upstreamCommit));
	for (const name of expectedSkills) assert.ok(provenance.includes(`\`${name}\``));
	assert.match(license, /Copyright \(c\) 2026 Matt Pocock/);
	assert.match(license, /Permission is hereby granted/);
});
