import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import test from "node:test";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const root = resolve(import.meta.dirname, "..", "..");
const skillsRoot = join(root, "skills");
const expectedSkills = [
	"audit-onboarding-proposal",
	"code-review",
	"codebase-design",
	"contract-first",
	"diagnosing-bugs",
	"domain-modeling",
	"encode-invariant",
	"grill-with-docs",
	"improve-harness",
	"onboard-repository",
	"tdd",
] as const;
const mattPocockSkills = [
	"code-review",
	"codebase-design",
	"diagnosing-bugs",
	"domain-modeling",
	"grill-with-docs",
	"tdd",
] as const;
const repositoryHarnessSkills = [
	"audit-onboarding-proposal",
	"encode-invariant",
	"improve-harness",
	"onboard-repository",
] as const;
const eccSkills = [
	"contract-first",
	"tdd",
] as const;
const explicitOnlySkills = new Set([
	"audit-onboarding-proposal",
	"grill-with-docs",
	"improve-harness",
	"onboard-repository",
]);
const expectedSkillEntries = expectedSkills.map((name) => `./skills/${name}`);
const mattPocockCommit = "5b15a47f2d7150f545fbcacbfe381787fc0230dc";
const repositoryHarnessCommit = "e765792b635b4d5e3e5fc0578f82f9ca5dea2681";
const eccCommit = "d8409a4b0813771235555e32e3d8046a73988bfa";

function sourceCommitsFor(name: typeof expectedSkills[number]): string[] {
	const commits: string[] = [];
	if (mattPocockSkills.includes(name as typeof mattPocockSkills[number])) commits.push(mattPocockCommit);
	if (repositoryHarnessSkills.includes(name as typeof repositoryHarnessSkills[number])) commits.push(repositoryHarnessCommit);
	if (eccSkills.includes(name as typeof eccSkills[number])) commits.push(eccCommit);
	return commits;
}

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

function skillText(name: string): string {
	return readFileSync(join(skillsRoot, name, "SKILL.md"), "utf8");
}

test("package declares exactly the eleven shipped Pi skill directories", () => {
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
		assert.match(String(metadata.compatibility), /Pi >=0\.84\.1 <0\.86\.0/);
		const sourceCommits = sourceCommitsFor(name);
		assert.ok(sourceCommits.length > 0, `${name} has no reviewed source commit`);
		for (const sourceCommit of sourceCommits) {
			assert.ok(text.includes(sourceCommit), `${name} omits pinned source commit ${sourceCommit}`);
		}
		assert.ok(statSync(path).size < 16_000);
		const headings = text.match(/^#{1,6} .+$/gm) ?? [];
		for (let index = 1; index < headings.length; index += 1) {
			assert.notEqual(headings[index], headings[index - 1], `${name} has an adjacent duplicate heading: ${headings[index]}`);
		}
		for (const target of markdownLinks(text)) {
			assert.ok(existsSync(resolve(dirname(path), target)), `missing ${relative(root, resolve(dirname(path), target))}`);
		}
		assert.equal(metadata["disable-model-invocation"] === true, explicitOnlySkills.has(name), `${name} explicit-only policy drifted`);
	}
});

test("adapted skills retain authority and avoid cross-harness or unsafe delivery assumptions", () => {
	const files = filesBelow(skillsRoot);
	const text = files
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
	for (const name of ["grill-with-docs", "diagnosing-bugs", "tdd", "domain-modeling", "encode-invariant", "onboard-repository", "improve-harness"]) {
		assert.ok(skillText(name).includes("continuity_prepare_work"), `${name} must explain managed preparation before mutation`);
	}
	const grill = skillText("grill-with-docs");
	assert.match(grill, /explicit invocation authorizes clarification only/);
	assert.match(grill, /does not authorize\s+any repository mutation/);
	const diagnosis = skillText("diagnosing-bugs");
	assert.match(diagnosis, /Diagnose-only/);
	assert.match(diagnosis, /Fix-authorized/);
	assert.match(diagnosis, /Automatic skill loading never upgrades/);
	const domain = skillText("domain-modeling");
	assert.match(domain, /does not\s+authorize a repository edit/);
	const review = skillText("code-review");
	assert.match(review, /Review is read-only/);
	assert.match(review, /calls may run sequentially/);
	assert.ok(text.includes("safe checkpoint proves repository/operation safety only"));
	assert.ok(text.includes("Do not commit, push"));
	assert.ok(!files.some((path) => path.endsWith("agents/openai.yaml")));
	assert.ok(files.every((path) => [".md", ".txt"].includes(extname(path))), "skills must remain prompt/reference-only resources");

	const repositoryHarnessText = repositoryHarnessSkills.map((name) => skillText(name)).join("\n");
	for (const forbidden of [
		"ONBOARDING_EVIDENCE_CAPSULE",
		"agents/openai.yaml",
		"render_patch.py",
		"emit_evidence_bundle.py",
		"validate_evidence_capsule.py",
	]) assert.ok(!repositoryHarnessText.includes(forbidden), `Repository Harness protocol leaked into Pi skill: ${forbidden}`);
});

test("grill-with-docs scales the decision frontier without weakening mutation authority", () => {
	const grill = skillText("grill-with-docs");
	for (const expected of [
		"problem being addressed",
		"audience or operator",
		"current behavior",
		"target behavior",
		"decision chain",
		"process friction",
	]) assert.ok(grill.toLowerCase().includes(expected), `grill-with-docs omits ${expected}`);
	assert.match(grill, /ask \*\*one question at a time\*\*/i);
	assert.match(grill, /ask \*\*two to five independent frontier questions per round\*\*/i);
	assert.match(grill, /delegates the recommended default[\s\S]*resolved/i);
	assert.match(grill, /unresolved material[\s\S]*authority-blocked/i);
	assert.match(grill, /generic request to proceed[\s\S]*does not resolve/i);
	assert.match(grill, /separately\s+authorizes that exact change/i);
	assert.match(grill, /bounded mutation creates no lifecycle execution plan/i);
	assert.doesNotMatch(grill, /continue despite unresolved uncertainty/i);
	assert.doesNotMatch(grill, /fix it within scope if trivial/i);
});

test("contract-first coordinates independent boundaries without creating ceremony or authority", () => {
	const contract = skillText("contract-first");
	assert.match(contract, /independently evolving consumers and providers/i);
	assert.match(contract, /same atomic change[\s\S]*shared type/i);
	assert.match(contract, /one authoritative[\s\S]*artifact/i);
	assert.match(contract, /consumer jobs/i);
	assert.match(contract, /nullability[\s\S]*enums[\s\S]*errors/i);
	assert.match(contract, /actual serialized/i);
	assert.match(contract, /materially distinct paths/i);
	assert.match(contract, /untrusted data/i);
	assert.match(contract, /do not install/i);
	assert.match(contract, /automatic skill loading[\s\S]*does not authorize/i);
	assert.match(contract, /continuity_prepare_work/);
	assert.match(contract, /Do not commit, push/i);
});

test("tdd turns reproducible bugs into regression guards across material paths", () => {
	const tdd = skillText("tdd");
	assert.match(tdd, /reproducible bug[\s\S]*regression test/i);
	assert.match(tdd, /confirm it fails[\s\S]*reported behavior/i);
	assert.match(tdd, /Do not fabricate a RED state/i);
	assert.match(tdd, /materially distinct execution paths/i);
	for (const path of ["production", "sandbox", "test adapter", "feature flag", "error path"]) assert.ok(tdd.includes(path));
	assert.match(tdd, /same agent[\s\S]*not independent\s+proof/i);
	assert.doesNotMatch(tdd, /80% coverage/i);
	assert.doesNotMatch(tdd, /test every path/i);
});

test("repository workflow skills preserve their distinct authority and proof boundaries", () => {
	const invariant = skillText("encode-invariant");
	assert.match(invariant, /Automatic skill loading.*does not authorize/is);
	assert.match(invariant, /code patterns.*tests.*defaults.*conventions.*do not establish/is);
	assert.match(invariant, /positive proof/i);
	assert.match(invariant, /negative proof/i);
	for (const level of ["Local validation", "Optional hook", "CI", "Branch protection"]) assert.ok(invariant.includes(level));
	assert.match(invariant, /human-only reconciliation/i);
	assert.match(invariant, /checkpoint.*never.*completion/is);

	const onboarding = skillText("onboard-repository");
	assert.match(onboarding, /first pass is always read-only/i);
	assert.match(onboarding, /does not authorize.*repository mutation/is);
	for (const classification of ["Authoritative", "Observed", "Derived", "Decision required", "Unknown"]) assert.ok(onboarding.includes(classification));
	for (const finding of ["Enforced", "Partially enforced", "Unenforced rule", "Check lacking authority"]) assert.ok(onboarding.includes(finding));
	assert.match(onboarding, /exact approved.*hunk/is);
	assert.match(onboarding, /base.*drift/is);
	assert.match(onboarding, /do not call `continuity_prepare_work`.*first pass/is);

	const audit = skillText("audit-onboarding-proposal");
	assert.match(audit, /independent.*fresh/is);
	assert.match(audit, /read-only/i);
	assert.match(audit, /exact hunk IDs/i);
	assert.match(audit, /counterexample pass/i);
	for (const disposition of ["SUPPORTED", "SPLIT_OR_REISSUE", "UNSUPPORTED"]) assert.ok(audit.includes(disposition));
	assert.match(audit, /does not.*approval/is);
	assert.match(audit, /do not call `continuity_prepare_work`/i);

	const improve = skillText("improve-harness");
	assert.match(improve, /observed baseline/i);
	assert.match(improve, /one.*bound execution plan/is);
	assert.match(improve, /fresh Pi.*rerun/is);
	assert.match(improve, /Pending fresh rerun/);
	assert.match(improve, /available.*retrieved.*relevant/is);
	assert.match(improve, /rerun that never exercised[\s\S]*cannot support an improvement\s+claim/i);
	assert.match(improve, /\*\*Keep\*\*[\s\S]*rerun exercised/i);
	assert.match(improve, /continuity_finalize_work/);
	assert.match(improve, /fresh post-move validation/i);
	assert.match(improve, /human-only reconciliation/i);
});

test("domain-modeling uses Continuity without creating parallel authority", () => {
	const domain = skillText("domain-modeling");
	for (const tool of [
		"continuity_workflow_status",
		"continuity_status",
		"continuity_prepare_work",
		"continuity_bind_work_document",
		"continuity_recover",
		"memory_search",
		"continuity_validate",
		"continuity_finalize_work",
		"continuity_checkpoint",
	]) assert.ok(domain.includes(`\`${tool}\``), `domain-modeling must explain ${tool}`);
	assert.match(domain, /grill-with-docs/);
	assert.match(domain, /do not retry/i);
	assert.match(domain, /human-only\s+reconciliation/i);
	assert.match(domain, /fresh post-move validation/i);
	assert.match(domain, /glossary.*reusable domain truth/is);
	assert.match(domain, /decision record.*lasting accepted trade-off/is);
	assert.match(domain, /execution plan.*task-local progress/is);
	assert.match(domain, /Memory.*untrusted leads/is);
	assert.match(domain, /checkpoint.*never.*completion/is);
});

test("source provenance and all three MIT notices are shipped", () => {
	const provenance = readFileSync(join(skillsRoot, "UPSTREAM.md"), "utf8");
	const mattLicense = readFileSync(join(skillsRoot, "UPSTREAM_LICENSE.txt"), "utf8");
	const repositoryHarnessLicense = readFileSync(join(skillsRoot, "REPOSITORY_HARNESS_LICENSE.txt"), "utf8");
	const eccLicense = readFileSync(join(skillsRoot, "ECC_LICENSE.txt"), "utf8");
	assert.ok(provenance.includes(mattPocockCommit));
	assert.ok(provenance.includes(repositoryHarnessCommit));
	assert.ok(provenance.includes(eccCommit));
	for (const name of mattPocockSkills) assert.ok(provenance.includes(`\`${name}\``));
	for (const name of repositoryHarnessSkills) assert.ok(provenance.includes(`\`${name}\``));
	for (const name of eccSkills) assert.ok(provenance.includes(`\`${name}\``));
	assert.match(mattLicense, /Copyright \(c\) 2026 Matt Pocock/);
	assert.match(mattLicense, /Permission is hereby granted/);
	assert.match(repositoryHarnessLicense, /Copyright \(c\) 2025 Hoang Nguyen/);
	assert.match(repositoryHarnessLicense, /Permission is hereby granted/);
	assert.match(eccLicense, /Copyright \(c\) 2026 Affaan Mustafa/);
	assert.match(eccLicense, /Permission is hereby granted/);
});
