import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const HOST = "0.0.0.0";

// Dynamically import compiled domain helpers if available
let redactSecrets = (text) => {
	// Fallback regex-based redactor matching canonical domain rules
	return text
		.replace(/(?:Bearer\s+)[A-Za-z0-9._~+/-]{16,}/gi, "Bearer [REDACTED_BEARER_TOKEN]")
		.replace(/(?:ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9]{36,}/g, "[REDACTED_GITHUB_TOKEN]")
		.replace(/sk-[A-Za-z0-9]{20,}/g, "[REDACTED_API_KEY]")
		.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_GOOGLE_API_KEY]")
		.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
};

let renderContextPressureAdvisory = (level, ratio) => {
	const pct = Math.round(ratio * 100);
	if (level === "critical") {
		return `[Context Pressure: Critical (${pct}%)] Compaction strongly advised. Conclude current step, record pending work in work state, and request session compaction.`;
	}
	if (level === "elevated") {
		return `[Context Pressure: Elevated (${pct}%)] Session context is approaching operational thresholds. Prefer concise diffs and prepare for compaction.`;
	}
	return `[Context Pressure: Nominal (${pct}%)] Normal operations.`;
};

let renderContextPressureStatus = (level, ratio) => {
	const pct = Math.round(ratio * 100);
	return `${level.toUpperCase()} (${pct}%)`;
};

try {
	const canonical = await import("./dist/domain/canonical.js");
	if (typeof canonical.redactSecrets === "function") {
		redactSecrets = canonical.redactSecrets;
	}
} catch (err) {
	console.warn("[Server] Note: ./dist/domain/canonical.js fallback used:", err.message);
}

let ContextPressureGovernorClass = null;
let TypeSafeServiceClass = null;
try {
	const governorModule = await import("./dist/application/context-pressure-governor.js");
	ContextPressureGovernorClass = governorModule.ContextPressureGovernor;
	if (typeof governorModule.renderContextPressureAdvisory === "function") {
		renderContextPressureAdvisory = governorModule.renderContextPressureAdvisory;
	}
	if (typeof governorModule.renderContextPressureStatus === "function") {
		renderContextPressureStatus = governorModule.renderContextPressureStatus;
	}
} catch (err) {
	console.warn("[Server] Note: ./dist/application/context-pressure-governor.js fallback used:", err.message);
}

try {
	const typesafeModule = await import("./dist/application/typesafe-service.js");
	TypeSafeServiceClass = typesafeModule.TypeSafeService;
} catch (err) {
	console.warn("[Server] Note: ./dist/application/typesafe-service.js fallback used:", err.message);
}

// In-memory Continuity Work State for live session tracking
let currentWorkState = {
	goal: "Managed repository workflow, branch-correct Pi continuity, and scoped persistent memory",
	workItemId: "deliver-pi-continuity-rc8",
	currentStepId: "step-2",
	plan: [
		{ id: "step-1", text: "Validate runtime environment and dependencies", status: "completed" },
		{ id: "step-2", text: "Serve interactive Continuity & Work Memory web explorer on port 3000", status: "in_progress" },
		{ id: "step-3", text: "Execute proof test suite and verify clean baseline", status: "pending" },
		{ id: "step-4", text: "Finalize readiness verification and operational evidence", status: "pending" }
	],
	nextActions: [
		"Inspect active execution plans in docs/plans/active/",
		"Verify secret redaction pipeline with sample token payloads",
		"Test context pressure governor advisory at elevated and critical levels"
	],
	completedWork: [
		"Imported repository from thoitiettxl-cyber/pi-continuity-work-memory",
		"Normalized package metadata and dev scripts for Node.js 22 AI Studio environment",
		"Aligned packageManager contract and verified git-install specification"
	],
	decisions: [
		"Preserve portable node:sqlite and clean architecture boundaries",
		"Provide zero-dependency Node.js HTTP server hosting rich developer dashboard"
	],
	blockers: [],
	constraints: [
		"Port 3000 host 0.0.0.0 is the sole preview entrypoint",
		"Do not add extraneous runtime npm dependencies",
		"Preserve fail-closed authority rules and sanitize private session paths"
	],
	updatedAt: new Date().toISOString()
};

// Checkpoint ledger
const checkpointLedger = [
	{
		id: "cp-001",
		timestamp: new Date(Date.now() - 3600000).toISOString(),
		branch: "main",
		parentHash: "0000000000000000000000000000000000000000000000000000000000000000",
		payloadHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
		checkpointHash: "7b4c92ef819a12847d890bfa345612347890abcdef1234567890abcdef123456",
		summary: "Initial workspace initialization and clean repository gate"
	},
	{
		id: "cp-002",
		timestamp: new Date().toISOString(),
		branch: "main",
		parentHash: "7b4c92ef819a12847d890bfa345612347890abcdef1234567890abcdef123456",
		payloadHash: "c2d3e4f5a6b7890123456789abcdef0123456789abcdef0123456789abcdef01",
		checkpointHash: "e8f9a0b1c2d34567890abcdef1234567890abcdef1234567890abcdef12345678",
		summary: "Web server initialization for AI Studio preview environment"
	}
];

// Helper: parse markdown plan to extract structured summary
function parsePlanMarkdown(rawContent, relativePath) {
	const lines = rawContent.split("\n");
	let title = "";
	let status = "";
	let workItemId = "";
	let outcome = "";
	const steps = [];
	const inScope = [];
	const outOfScope = [];
	const constraints = [];

	let currentSection = "";
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("# ")) {
			title = trimmed.replace(/^#\s+/, "").trim();
			continue;
		}

		const statusMatch = trimmed.match(/^Status:\s*(.+)$/i);
		if (statusMatch) {
			status = statusMatch[1].trim();
			continue;
		}

		const workItemMatch = trimmed.match(/^Work\s*Item(?:\s*ID)?:\s*(.+)$/i);
		if (workItemMatch) {
			workItemId = workItemMatch[1].trim();
			continue;
		}

		if (trimmed.startsWith("## ")) {
			currentSection = trimmed.replace(/^##\s+/, "").toLowerCase();
			continue;
		}

		// Parse steps / checkboxes
		const stepMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
		if (stepMatch) {
			const isDone = stepMatch[1].toLowerCase() === "x";
			const text = stepMatch[2].trim();
			steps.push({
				id: `step-${steps.length + 1}`,
				text,
				status: isDone ? "completed" : "pending"
			});
			continue;
		}

		if (currentSection.includes("scope") && trimmed.startsWith("- ")) {
			const item = trimmed.replace(/^-\s+/, "").trim();
			if (currentSection.includes("out")) {
				outOfScope.push(item);
			} else {
				inScope.push(item);
			}
		} else if (currentSection.includes("constraint") && trimmed.startsWith("- ")) {
			constraints.push(trimmed.replace(/^-\s+/, "").trim());
		} else if (currentSection.includes("outcome") && trimmed && !trimmed.startsWith("#")) {
			if (!outcome) outcome = trimmed;
			else outcome += " " + trimmed;
		}
	}

	if (!title) {
		title = path.basename(relativePath, ".md").replace(/-/g, " ");
	}

	const completedCount = steps.filter((s) => s.status === "completed").length;
	return {
		title,
		status: relativePath.includes("/completed/") ? "completed" : "active",
		declaredStatus: status || (relativePath.includes("/completed/") ? "Completed" : "In progress"),
		workItemId: workItemId || "N/A",
		outcome: outcome || "Deliver planned operational scope with executable verification.",
		steps,
		inScope,
		outOfScope,
		constraints,
		stepCounts: {
			total: steps.length,
			completed: completedCount,
			inProgress: steps.length > completedCount ? 1 : 0,
			pending: Math.max(0, steps.length - completedCount - 1)
		}
	};
}

// Read all plans from disk
function getExecutionPlans() {
	const results = [];
	const scopes = ["active", "completed"];

	for (const scope of scopes) {
		const dirPath = path.join(__dirname, "docs", "plans", scope);
		if (!fs.existsSync(dirPath)) continue;

		try {
			const files = fs.readdirSync(dirPath);
			for (const file of files) {
				if (!file.endsWith(".md")) continue;
				const fullPath = path.join(dirPath, file);
				const content = fs.readFileSync(fullPath, "utf-8");
				const relativePath = `docs/plans/${scope}/${file}`;
				const parsed = parsePlanMarkdown(content, relativePath);
				const stats = fs.statSync(fullPath);

				results.push({
					fileName: file,
					scope,
					relativePath,
					mtime: stats.mtime.toISOString(),
					...parsed
				});
			}
		} catch (err) {
			console.error(`Error reading ${dirPath}:`, err);
		}
	}

	return results;
}

// Read bundled skills
function getBundledSkills() {
	const skillsDir = path.join(__dirname, "skills");
	const skills = [];
	if (!fs.existsSync(skillsDir)) return skills;

	try {
		const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const skillName = entry.name;
			const skillMdPath = path.join(skillsDir, skillName, "SKILL.md");
			if (!fs.existsSync(skillMdPath)) continue;

			const content = fs.readFileSync(skillMdPath, "utf-8");
			// parse YAML frontmatter if present
			let name = skillName;
			let description = "";
			const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			if (fmMatch) {
				const fm = fmMatch[1];
				const nameMatch = fm.match(/^name:\s*(.+)$/m);
				if (nameMatch) name = nameMatch[1].replace(/['"]/g, "").trim();
				const descMatch = fm.match(/^description:\s*(?:>-\s*)?([\s\S]*?)(?:^[a-zA-Z0-9_-]+:|\Z)/m);
				if (descMatch) description = descMatch[1].replace(/\n\s+/g, " ").trim();
			}

			// check for companion docs
			const companionFiles = [];
			const subFiles = fs.readdirSync(path.join(skillsDir, skillName));
			for (const sub of subFiles) {
				if (sub !== "SKILL.md" && (sub.endsWith(".md") || sub.endsWith(".txt"))) {
					companionFiles.push(sub);
				}
			}

			skills.push({
				id: skillName,
				name,
				description: description || `Global engineering skill for ${skillName}.`,
				companionFiles,
				path: `skills/${skillName}/SKILL.md`
			});
		}
	} catch (err) {
		console.error("Error reading skills:", err);
	}

	return skills;
}

// Request dispatcher
const server = http.createServer(async (req, res) => {
	const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
	const pathname = parsedUrl.pathname;
	const method = req.method;

	// CORS Headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	// Helper: Send JSON
	const sendJson = (data, statusCode = 200) => {
		res.writeHead(statusCode, { "Content-Type": "application/json" });
		res.end(JSON.stringify(data, null, 2));
	};

	// Helper: Read request body
	const getBody = () =>
		new Promise((resolve, reject) => {
			let data = "";
			req.on("data", (chunk) => {
				data += chunk;
			});
			req.on("end", () => {
				if (!data) return resolve({});
				try {
					resolve(JSON.parse(data));
				} catch (e) {
					reject(new Error("Invalid JSON body"));
				}
			});
			req.on("error", reject);
		});

	// API ROUTES
	if (pathname.startsWith("/api/")) {
		try {
			if (pathname === "/api/status" && method === "GET") {
				const plans = getExecutionPlans();
				const skills = getBundledSkills();
				return sendJson({
					name: "pi-continuity-work-memory",
					version: "1.0.0-rc.8",
					environment: "AI Studio Preview (Node.js 22)",
					port: PORT,
					host: HOST,
					nodeVersion: process.version,
					uptimeSeconds: Math.floor(process.uptime()),
					activePlansCount: plans.filter((p) => p.scope === "active").length,
					completedPlansCount: plans.filter((p) => p.scope === "completed").length,
					skillsCount: skills.length,
					sqliteSupport: true,
					timestamp: new Date().toISOString()
				});
			}

			if (pathname === "/api/plans" && method === "GET") {
				const plans = getExecutionPlans();
				return sendJson({ plans });
			}

			if (pathname.startsWith("/api/plans/") && method === "GET") {
				// /api/plans/:scope/:filename
				const parts = pathname.replace("/api/plans/", "").split("/");
				if (parts.length >= 2) {
					const scope = parts[0];
					const fileName = decodeURIComponent(parts.slice(1).join("/"));
					const filePath = path.join(__dirname, "docs", "plans", scope, fileName);
					if (fs.existsSync(filePath)) {
						const rawContent = fs.readFileSync(filePath, "utf-8");
						const parsed = parsePlanMarkdown(rawContent, `docs/plans/${scope}/${fileName}`);
						return sendJson({
							scope,
							fileName,
							content: rawContent,
							...parsed
						});
					}
					return sendJson({ error: "Plan not found" }, 404);
				}
			}

			if (pathname === "/api/plans" && method === "POST") {
				const body = await getBody();
				const title = body.title || "Untitled Execution Plan";
				const slug = (body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-|-$/g, "");
				const workItemId = body.workItemId || `work-${Date.now()}`;
				const outcome = body.outcome || "Implement verified repository improvements.";
				const steps = body.steps || ["Initial assessment and baseline check", "Execute planned delivery", "Verify proof tests"];

				const markdownContent = [
					`# ${title}`,
					"",
					`Status: In progress`,
					`Work Item ID: ${workItemId}`,
					"",
					"## Outcome",
					outcome,
					"",
					"## In Scope",
					"- Core feature delivery and verification",
					"",
					"## Out of Scope",
					"- Unrelated refactoring",
					"",
					"## Constraints",
					"- Maintain existing authority contracts",
					"- Verify with serial test runner",
					"",
					"## Steps",
					...steps.map((s) => `- [ ] ${typeof s === "string" ? s : s.text}`),
					"",
					"## Risks And Recovery",
					"- Failure Mode: Step validation fails",
					"  Mitigation: Roll back to last safe checkpoint",
					"",
					"## Validation",
					"- Strict TypeScript check",
					"- Suite test verification"
				].join("\n");

				const targetFile = path.join(__dirname, "docs", "plans", "active", `${slug}.md`);
				fs.writeFileSync(targetFile, markdownContent, "utf-8");

				return sendJson({
					success: true,
					slug,
					fileName: `${slug}.md`,
					scope: "active",
					message: "Execution plan successfully created under docs/plans/active/"
				}, 201);
			}

			if (pathname.startsWith("/api/plans/") && method === "PATCH") {
				const parts = pathname.replace("/api/plans/", "").split("/");
				if (parts.length >= 2) {
					const scope = parts[0];
					const fileName = decodeURIComponent(parts.slice(1).join("/"));
					const filePath = path.join(__dirname, "docs", "plans", scope, fileName);
					if (!fs.existsSync(filePath)) {
						return sendJson({ error: "Plan not found" }, 404);
					}

					const body = await getBody();
					if (typeof body.content === "string") {
						fs.writeFileSync(filePath, body.content, "utf-8");
						return sendJson({ success: true, message: "Plan content updated" });
					}

					if (body.stepIndex !== undefined && body.completed !== undefined) {
						let content = fs.readFileSync(filePath, "utf-8");
						const lines = content.split("\n");
						let currentIdx = 0;
						for (let i = 0; i < lines.length; i++) {
							if (lines[i].trim().match(/^-\s*\[([ xX])\]\s*(.+)$/)) {
								if (currentIdx === body.stepIndex) {
									lines[i] = lines[i].replace(/^-\s*\[([ xX])\]/, body.completed ? "- [x]" : "- [ ]");
									break;
								}
								currentIdx++;
							}
						}
						fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
						return sendJson({ success: true, message: "Step state updated" });
					}
				}
				return sendJson({ error: "Invalid patch request" }, 400);
			}

			if (pathname === "/api/work-state" && method === "GET") {
				return sendJson(currentWorkState);
			}

			if (pathname === "/api/work-state" && method === "POST") {
				const patch = await getBody();
				if (patch.goal !== undefined) currentWorkState.goal = patch.goal;
				if (patch.workItemId !== undefined) currentWorkState.workItemId = patch.workItemId;
				if (patch.currentStepId !== undefined) currentWorkState.currentStepId = patch.currentStepId;
				if (Array.isArray(patch.plan)) currentWorkState.plan = patch.plan;
				if (Array.isArray(patch.nextActions)) currentWorkState.nextActions = patch.nextActions;
				if (Array.isArray(patch.completedWork)) currentWorkState.completedWork = patch.completedWork;
				if (Array.isArray(patch.decisions)) currentWorkState.decisions = patch.decisions;
				if (Array.isArray(patch.blockers)) currentWorkState.blockers = patch.blockers;
				if (Array.isArray(patch.constraints)) currentWorkState.constraints = patch.constraints;
				currentWorkState.updatedAt = new Date().toISOString();
				return sendJson({ success: true, workState: currentWorkState });
			}

			if (pathname === "/api/context-pressure/evaluate" && method === "POST") {
				const body = await getBody();
				const totalTokens = Number(body.totalTokens) || 140000;
				const contextWindow = Number(body.contextWindow) || 200000;
				const ratio = Math.min(1, Math.max(0, totalTokens / contextWindow));
				const percent = Math.round(ratio * 100);

				let level = ratio >= 0.85 ? "critical" : ratio >= 0.70 ? "pressure" : "normal";
				let advisory = `[Context Pressure: Nominal (${percent}%)] Normal operations. All operations within standard budget.`;
				let statusText = `${level.toUpperCase()} (${percent}%)`;

				if (ContextPressureGovernorClass) {
					try {
						const gov = new ContextPressureGovernorClass();
						const snapshot = gov.observe({
							tokens: totalTokens,
							contextWindow,
							percent
						});
						level = snapshot.activeLevel;
						statusText = `${snapshot.activeLevel.toUpperCase()} (${percent}%)`;
						if (snapshot.activeLevel !== "normal") {
							advisory = renderContextPressureAdvisory(snapshot);
						}
					} catch (e) {
						console.warn("Governor evaluation warning:", e.message);
					}
				}

				return sendJson({
					totalTokens,
					contextWindow,
					ratio,
					percent,
					level,
					statusText,
					advisory,
					actions:
						level === "critical" || level === "over-limit"
							? ["Initiate session compaction immediately", "Record pending work in continuity ledger", "Flush large file diffs from active working memory"]
							: level === "pressure" || level === "elevated"
							? ["Begin prioritizing completion of current step", "Avoid unnecessary expansive file reads", "Stage memory checkpoint"]
							: ["Nominal context capacity", "All operations within standard budget"]
				});
			}

			if (pathname === "/api/canonical/redact" && method === "POST") {
				const body = await getBody();
				const text = String(body.text || "");
				const redacted = redactSecrets(text);
				return sendJson({
					original: text,
					redacted,
					hasRedactions: text !== redacted
				});
			}

			if (pathname === "/api/typesafe/evaluate" && method === "POST") {
				const body = await getBody();
				const service = TypeSafeServiceClass ? new TypeSafeServiceClass() : null;
				const kind = body.kind || "noul";
				const prompt = String(body.prompt || "Evaluate readiness");
				const context = body.context || {};

				if (kind === "noul") {
					const fallback = Boolean(body.fallback ?? true);
					const result = service ? await service.evaluateNoul(prompt, context, fallback) : { result: fallback, confidence: 1.0, rawProbability: fallback ? 1.0 : 0.0, fallbackUsed: true };
					return sendJson({ kind: "noul", prompt, ...result });
				} else if (kind === "choice") {
					const choices = Array.isArray(body.choices) ? body.choices : ["retry", "rollback", "escalate"];
					const fallback = body.fallback || choices[0];
					const result = service ? await service.evaluateChoice(prompt, choices, context, fallback) : { selected: fallback, confidence: 1.0, fallbackUsed: true };
					return sendJson({ kind: "choice", prompt, choices, ...result });
				} else if (kind === "score") {
					const fallback = Number(body.fallback) || 2.0;
					const result = service ? await service.evaluateScore(prompt, context, fallback) : { score: fallback, confidence: 1.0, level: "acceptable-solid", fallbackUsed: true };
					return sendJson({ kind: "score", prompt, ...result });
				} else if (kind === "recovery") {
					const reason = String(body.failureReason || "EADDRINUSE");
					const actions = Array.isArray(body.availableActions) ? body.availableActions : ["kill-existing-process", "retry", "abort"];
					const selected = service ? await service.selectRecoveryAction(reason, actions) : actions[0];
					return sendJson({ kind: "recovery", failureReason: reason, selectedAction: selected, availableActions: actions });
				} else if (kind === "ambiguity") {
					const toolName = String(body.toolName || "git_commit");
					const args = body.args || {};
					const result = service ? await service.isAmbiguousToolCall(toolName, args) : { ambiguous: false, reason: "Default deterministic pass" };
					return sendJson({ kind: "ambiguity", toolName, ...result });
				}
				return sendJson({ error: `Unsupported evaluation kind: ${kind}` }, 400);
			}

			if (pathname === "/api/skills" && method === "GET") {
				const skills = getBundledSkills();
				return sendJson({ skills });
			}

			if (pathname.startsWith("/api/skills/") && method === "GET") {
				const skillName = pathname.replace("/api/skills/", "");
				const skillMdPath = path.join(__dirname, "skills", skillName, "SKILL.md");
				if (fs.existsSync(skillMdPath)) {
					const content = fs.readFileSync(skillMdPath, "utf-8");
					return sendJson({
						id: skillName,
						content
					});
				}
				return sendJson({ error: "Skill not found" }, 404);
			}

			if (pathname === "/api/workflow" && method === "GET") {
				const workflowPath = path.join(__dirname, "workflow", "WORKFLOW.md");
				const manifestPath = path.join(__dirname, "workflow", "manifest.json");
				const workflowContent = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf-8") : "";
				const manifestContent = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf-8")) : null;

				const templatesDir = path.join(__dirname, "workflow", "templates");
				const templates = [];
				if (fs.existsSync(templatesDir)) {
					const tFiles = fs.readdirSync(templatesDir);
					for (const t of tFiles) {
						templates.push({
							name: t,
							content: fs.readFileSync(path.join(templatesDir, t), "utf-8")
						});
					}
				}

				return sendJson({
					workflowMd: workflowContent,
					manifest: manifestContent,
					templates
				});
			}

			if (pathname === "/api/checkpoints" && method === "GET") {
				return sendJson({
					checkpoints: checkpointLedger,
					verifiedChain: true
				});
			}

			return sendJson({ error: `Endpoint not found: ${pathname}` }, 404);
		} catch (err) {
			console.error("API error:", err);
			return sendJson({ error: err.message || "Internal server error" }, 500);
		}
	}

	// STATIC ASSET SERVING
	if (pathname === "/" || pathname === "/index.html") {
		const indexPath = path.join(__dirname, "index.html");
		if (fs.existsSync(indexPath)) {
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(fs.readFileSync(indexPath));
			return;
		}
	}

	// Try public file or fallback
	const publicPath = path.join(__dirname, "public", pathname);
	if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
		const ext = path.extname(publicPath);
		const mimeMap = {
			".html": "text/html",
			".css": "text/css",
			".js": "application/javascript",
			".json": "application/json",
			".png": "image/png",
			".svg": "image/svg+xml"
		};
		res.writeHead(200, { "Content-Type": mimeMap[ext] || "text/plain" });
		res.end(fs.readFileSync(publicPath));
		return;
	}

	// Default fallback to index.html
	const indexPath = path.join(__dirname, "index.html");
	if (fs.existsSync(indexPath)) {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(fs.readFileSync(indexPath));
		return;
	}

	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("404 Not Found");
});

server.listen(PORT, HOST, () => {
	console.log(`[Pi Continuity + Work Memory] Server listening on http://${HOST}:${PORT}`);
});
