export type ToolClassification = "ignored" | "read" | "mutation" | "validation";
export declare function normalizeCommand(command: string): string;
export declare function isExecutableValidationCommand(command: string): boolean;
export declare function splitValidationCommand(command: string): {
    program: string;
    args: string[];
};
export declare function classifyTool(toolName: string, input: Record<string, unknown>): ToolClassification;
//# sourceMappingURL=tool-classifier.d.ts.map