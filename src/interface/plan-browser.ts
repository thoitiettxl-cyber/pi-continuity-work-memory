import { stripVTControlCharacters } from "node:util";

import { getMarkdownTheme, type ExtensionCommandContext, type KeybindingsManager, type Theme } from "@earendil-works/pi-coding-agent";
import { Input, Key, Markdown, SelectList, fuzzyMatch, matchesKey, truncateToWidth, type Component, type Focusable } from "@earendil-works/pi-tui";

import { redactSecrets } from "../domain/canonical.js";
import { buildPlanDraft, canWorkOnPlan, type PlanCatalog, type PlanDetail, type PlanDraftAction, type PlanSummary } from "../domain/plan-browser.js";

type PlanScope = "all" | "active" | "completed";
type BrowserAction = "view" | PlanDraftAction;
export interface PlanSelection {
	plan: PlanSummary;
	action: BrowserAction;
	query: string;
	scope: PlanScope;
}
interface BrowserSource {
	listExecutionPlans(): Promise<PlanCatalog>;
	readExecutionPlan(path: string, expectedDigest?: string): Promise<PlanDetail>;
}
interface BrowserUi {
	theme: Theme;
	keybindings: Pick<KeybindingsManager, "matches" | "getKeys">;
	rows(): number;
	requestRender(): void;
}

function displayText(text: string): string {
	return redactSecrets(stripVTControlCharacters(text))
		.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, "");
}
function label(text: string): string {
	return displayText(text).replace(/\s+/g, " ");
}
function searchText(text: string): string {
	return label(text).normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}
function height(ui: BrowserUi): number {
	return Math.max(3, Math.floor((ui.rows() || 24) * 0.8));
}
function keyHint(ui: BrowserUi, key: Parameters<KeybindingsManager["getKeys"]>[0], action: string): string {
	return `${ui.keybindings.getKeys(key).join("/") || "unbound"} ${action}`;
}

export function filterPlans(plans: readonly PlanSummary[], query: string, scope: PlanScope): PlanSummary[] {
	const tokens = searchText(query.slice(0, 500)).trim().split(/\s+/).filter(Boolean);
	return plans.filter((plan) => scope === "all" || plan.status === scope)
		.map((plan) => {
			const text = searchText(`${plan.title} ${plan.relativePath} ${plan.declaredStatus} ${plan.workItemId}`);
			const matches = tokens.map((token) => fuzzyMatch(token, text));
			return { plan, matches: matches.every((match) => match.matches), score: matches.reduce((sum, match) => sum + match.score, 0) };
		})
		.filter((item) => item.matches)
		.sort((left, right) => Number(left.plan.status === "completed") - Number(right.plan.status === "completed")
			|| left.score - right.score || left.plan.relativePath.localeCompare(right.plan.relativePath))
		.map((item) => item.plan);
}

/** Ephemeral selector. SelectList renders; injected keybindings own navigation. */
export class PlanSelector implements Component, Focusable {
	private readonly input = new Input();
	private filtered: PlanSummary[] = [];
	private selected = 0;
	private scope: PlanScope;
	private closed = false;

	get focused(): boolean { return this.input.focused; }
	set focused(value: boolean) { this.input.focused = value; }

	constructor(
		private readonly catalog: PlanCatalog,
		private readonly ui: BrowserUi,
		private readonly done: (selection: PlanSelection | undefined) => void,
		initial: { query?: string; scope?: PlanScope; path?: string } = {},
	) {
		this.scope = initial.scope ?? "all";
		this.input.setValue(displayText(initial.query ?? "").replace(/\s+/g, " ").slice(0, 500));
		this.filter();
		this.selected = Math.max(0, this.filtered.findIndex((plan) => plan.relativePath === initial.path));
	}

	private filter(): void {
		this.filtered = filterPlans(this.catalog.plans, this.input.getValue(), this.scope);
		this.selected = 0;
	}
	private choose(action: BrowserAction): void {
		const plan = this.filtered[this.selected];
		if (!plan || (action === "work" && !canWorkOnPlan(plan))) return;
		this.closed = true;
		this.done({ plan, action, query: this.input.getValue(), scope: this.scope });
	}
	handleInput(data: string): void {
		if (this.closed) return;
		const kb = this.ui.keybindings;
		if (kb.matches(data, "tui.select.cancel")) {
			this.closed = true;
			this.done(undefined);
		} else if (kb.matches(data, "tui.select.confirm")) this.choose("view");
		else if (matchesKey(data, Key.ctrlShift("w"))) this.choose("work");
		else if (matchesKey(data, Key.ctrlShift("r"))) this.choose("refine");
		else if (kb.matches(data, "tui.input.tab")) {
			this.scope = this.scope === "all" ? "active" : this.scope === "active" ? "completed" : "all";
			this.filter();
		} else if (kb.matches(data, "tui.select.up") || kb.matches(data, "tui.select.down")) {
			const delta = kb.matches(data, "tui.select.up") ? -1 : 1;
			this.selected = this.filtered.length ? (this.selected + delta + this.filtered.length) % this.filtered.length : 0;
		} else {
			const previous = this.input.getValue();
			this.input.handleInput(data);
			const value = displayText(this.input.getValue()).replace(/\s+/g, " ").slice(0, 500);
			if (value !== this.input.getValue()) this.input.setValue(value);
			if (value !== previous) this.filter();
		}
		this.ui.requestRender();
	}
	render(width: number): string[] {
		if (width <= 0) return [];
		const { theme } = this.ui;
		const maxHeight = height(this.ui);
		const clip = (line: string) => truncateToWidth(line, width);
		if (width < 8 || maxHeight < 10) return ["Plans", label(this.filtered[this.selected]?.title ?? "No matching plans"), keyHint(this.ui, "tui.select.cancel", "close")].map(clip);
		const list = new SelectList(this.filtered.map((plan) => ({
			value: plan.relativePath,
			label: `[${plan.status}] ${label(plan.title)}`,
			description: label(plan.declaredStatus),
		})), Math.max(1, maxHeight - 9), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});
		list.setSelectedIndex(this.selected);
		const issues = `${this.catalog.issues.length} skipped/unavailable${this.catalog.truncated ? "; scan limited to 500 entries per directory" : ""}`;
		return [
			theme.fg("accent", theme.bold(`Execution plans — ${this.scope} (${this.filtered.length}/${this.catalog.plans.length})`)),
			theme.fg("dim", "Read-only browser; recorded status is not completion proof."),
			...this.input.render(width),
			...list.render(width),
			theme.fg("muted", label(this.filtered[this.selected]?.relativePath ?? "No matching plans")),
			theme.fg("dim", `${keyHint(this.ui, "tui.select.up", "up")} • ${keyHint(this.ui, "tui.select.down", "down")} • ${keyHint(this.ui, "tui.select.confirm", "view")}`),
			theme.fg("dim", `${keyHint(this.ui, "tui.input.tab", "filter")} • Ctrl+Shift+W Work • Ctrl+Shift+R Refine • ${keyHint(this.ui, "tui.select.cancel", "close")}`),
			theme.fg(this.catalog.issues.length || this.catalog.truncated ? "warning" : "dim", issues),
		].slice(0, maxHeight).map(clip);
	}
	invalidate(): void { this.input.invalidate(); }
}

export class PlanDetailView implements Component {
	private markdown: Markdown;
	private offset = 0;
	private pageSize = 1;
	private total = 0;
	private closed = false;

	constructor(private readonly plan: PlanDetail, private readonly ui: BrowserUi, private readonly done: (action: PlanDraftAction | undefined) => void) {
		this.markdown = this.createMarkdown();
	}
	private createMarkdown(): Markdown {
		return new Markdown(displayText(this.plan.content), 0, 0, getMarkdownTheme());
	}
	handleInput(data: string): void {
		if (this.closed) return;
		const kb = this.ui.keybindings;
		if (kb.matches(data, "tui.select.cancel")) {
			this.closed = true;
			this.done(undefined);
		} else if ((data === "w" || matchesKey(data, Key.ctrlShift("w"))) && canWorkOnPlan(this.plan)) {
			this.closed = true;
			this.done("work");
		} else if (data === "r" || matchesKey(data, Key.ctrlShift("r"))) {
			this.closed = true;
			this.done("refine");
		} else {
			const delta = kb.matches(data, "tui.select.up") ? -1 : kb.matches(data, "tui.select.down") ? 1
				: kb.matches(data, "tui.select.pageUp") ? -this.pageSize : kb.matches(data, "tui.select.pageDown") ? this.pageSize : 0;
			this.offset = Math.max(0, Math.min(this.offset + delta, this.total - this.pageSize));
		}
		this.ui.requestRender();
	}
	render(width: number): string[] {
		if (width <= 0) return [];
		const { theme } = this.ui;
		const maxHeight = height(this.ui);
		const clip = (line: string) => truncateToWidth(line, width);
		if (width < 8 || maxHeight < 8) return ["Plan detail", label(this.plan.title), keyHint(this.ui, "tui.select.cancel", "back")].map(clip);
		const lines = this.markdown.render(width);
		this.total = lines.length;
		this.pageSize = Math.max(1, maxHeight - 5);
		this.offset = Math.max(0, Math.min(this.offset, this.total - this.pageSize));
		return [
			theme.fg("accent", theme.bold(label(this.plan.title))),
			theme.fg("muted", label(`${this.plan.relativePath} — recorded: ${this.plan.declaredStatus}`)),
			theme.fg("dim", "Read-only; status is not completion proof. Work/Refine only draft text."),
			...lines.slice(this.offset, this.offset + this.pageSize),
			theme.fg("dim", `${keyHint(this.ui, "tui.select.pageUp", "up")} • ${keyHint(this.ui, "tui.select.pageDown", "down")} • ${this.offset + 1}-${Math.min(this.total, this.offset + this.pageSize)}/${this.total}`),
			theme.fg("dim", `${canWorkOnPlan(this.plan) ? "w Work" : "History: Work disabled"} • r Refine • ${keyHint(this.ui, "tui.select.cancel", "back")}`),
		].map(clip);
	}
	invalidate(): void { this.markdown = this.createMarkdown(); }
}

/** UI orchestration has only read ports. No binding, mutation, message or store capability. */
export async function showPlanBrowser(ctx: ExtensionCommandContext, source: BrowserSource, isCurrent: () => boolean, query: string): Promise<void> {
	if (ctx.mode !== "tui" || !ctx.hasUI || !ctx.isProjectTrusted() || !isCurrent()) return;
	try {
		const catalog = await source.listExecutionPlans();
		if (!isCurrent()) return;
		let initial: { query?: string; scope?: PlanScope; path?: string } = { query };
		for (;;) {
			const selection = await ctx.ui.custom<PlanSelection | undefined>((tui, theme, keybindings, done) =>
				new PlanSelector(catalog, { theme, keybindings, rows: () => tui.terminal.rows, requestRender: () => tui.requestRender() }, done, initial),
			{ overlay: true, overlayOptions: { width: "90%", maxHeight: "80%" } });
			if (!isCurrent() || !selection) return;
			const selected = catalog.plans.find((plan) => plan.relativePath === selection.plan.relativePath && plan.digest === selection.plan.digest);
			if (!selected) throw new Error("Plan selection is no longer available");
			const detail = await source.readExecutionPlan(selected.relativePath, selected.digest);
			if (!isCurrent()) return;
			let action: PlanDraftAction | undefined;
			if (selection.action === "view") {
				action = await ctx.ui.custom<PlanDraftAction | undefined>((tui, theme, keybindings, done) =>
					new PlanDetailView(detail, { theme, keybindings, rows: () => tui.terminal.rows, requestRender: () => tui.requestRender() }, done),
				{ overlay: true, overlayOptions: { width: "90%", maxHeight: "80%" } });
			} else action = selection.action;
			if (!isCurrent()) return;
			if (!action) {
				initial = { query: selection.query, scope: selection.scope, path: selected.relativePath };
				continue;
			}
			if (action === "work" && !canWorkOnPlan(selected)) return;
			// Detail may have stayed open while another process changed or moved the plan.
			const fresh = await source.readExecutionPlan(selected.relativePath, detail.digest);
			if (!isCurrent() || (action === "work" && !canWorkOnPlan(fresh))) return;
			const draft = buildPlanDraft(fresh, action);
			if (!isCurrent()) return;
			const existing = ctx.ui.getEditorText();
			ctx.ui.setEditorText(existing ? `${existing}\n\n${draft}` : draft);
			ctx.ui.notify("Plan draft appended to editor; review before submitting. No plan or binding was changed.", "info");
			return;
		}
	} catch {
		if (isCurrent()) ctx.ui.notify("Plan browser could not read the selected plan safely, or it changed. Reopen /continuity plans; no draft was applied.", "warning");
	}
}
