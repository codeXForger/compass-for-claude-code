/**
 * Read-only worked examples shown via the "Example" button in PageHeader.
 * Each sample is a fully filled-in resource so non-technical users can see what
 * good field values look like. Keyed by route pathname, like `getGuide`.
 */

export interface SampleField {
  label: string;
  value: string;
  note?: string;
}

export interface Sample {
  title: string;
  blurb: string;
  fields: SampleField[];
  /** How the user actually triggers/runs this resource. */
  usage?: { value: string; note?: string };
  body?: { label: string; value: string };
  extras?: SampleField[];
  raw: { label: string; value: string };
}

const HOOKS_SAMPLE: Sample = {
  title: "Sample hook",
  blurb:
    "Run a guard script before Claude edits files — it can block writes to protected paths.",
  fields: [
    {
      label: "When should it run?",
      value: "Before a tool runs (PreToolUse)",
      note: "Fires before the tool, so the script can allow or block it.",
    },
    {
      label: "Run on which tools?",
      value: "Edit, Write",
      note: "matcher: Edit|Write",
    },
    { label: "Command to run", value: "./.claude/scripts/protect.sh" },
  ],
  usage: {
    value: "Runs automatically — no command to type.",
    note: "Once saved, it fires on its own before every Edit/Write. A non-zero exit from the script blocks the edit.",
  },
  raw: {
    label: "settings.json → hooks",
    value: `{
  "PreToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        { "type": "command", "command": "./.claude/scripts/protect.sh" }
      ]
    }
  ]
}`,
  },
};

const SKILLS_SAMPLE: Sample = {
  title: "Sample skill",
  blurb:
    "A skill bundles instructions plus optional resource files and runnable scripts.",
  fields: [
    { label: "Name", value: "pdf-export" },
    {
      label: "Description",
      value:
        "Export a Markdown or HTML document to a polished PDF using the bundled cover template.",
      note: "Claude reads this to decide when to use the skill — be specific.",
    },
  ],
  usage: {
    value: 'Just ask — e.g. "export this doc to PDF".',
    note: "Claude invokes the skill automatically when your request matches the description. You can also name it: \"use the pdf-export skill\".",
  },
  body: {
    label: "Instructions · SKILL.md body",
    value: `# PDF export

Use this skill when the user asks to turn a document into a PDF.

1. Read the source file the user names.
2. Run \`scripts/convert.sh <source> out.pdf\` to render it.
3. Use \`templates/cover.html\` as the cover page when a title is provided.
4. Report the path to the generated PDF.`,
  },
  extras: [
    {
      label: "scripts/convert.sh",
      value: "runnable",
      note: "Executable helper script (chmod +x) the skill calls.",
    },
    {
      label: "templates/cover.html",
      value: "resource",
      note: "A supporting file bundled with the skill.",
    },
  ],
  raw: {
    label: "skills/pdf-export/SKILL.md",
    value: `---
name: pdf-export
description: Export a Markdown or HTML document to a polished PDF using the bundled cover template.
---

# PDF export

Use this skill when the user asks to turn a document into a PDF.

1. Read the source file the user names.
2. Run \`scripts/convert.sh <source> out.pdf\` to render it.
3. Use \`templates/cover.html\` as the cover page when a title is provided.
4. Report the path to the generated PDF.`,
  },
};

const COMMANDS_SAMPLE: Sample = {
  title: "Sample command",
  blurb:
    "A slash command is a reusable prompt. Its body is injected when you run it; $1, $2… are arguments.",
  fields: [
    {
      label: "Description",
      value: "Review an open pull request and summarize risks.",
      note: "Shown in the command picker.",
    },
    { label: "Argument hint", value: "[pr-number]" },
    { label: "Allowed tools", value: "Bash, Read, Grep" },
    { label: "Model", value: "Sonnet 4.6 (claude-sonnet-4-6)" },
  ],
  usage: {
    value: "/review 123",
    note: 'Type it in Claude Code; "123" fills $1 (the pr-number). Type "/" to see all available commands in the picker.',
  },
  body: {
    label: "Prompt · command body",
    value: `Review pull request #$1.

- Fetch the diff with \`gh pr diff $1\`.
- Flag correctness bugs, security issues, and missing tests.
- End with a short risk summary (low / medium / high) and why.`,
  },
  raw: {
    label: "commands/review.md",
    value: `---
description: Review an open pull request and summarize risks.
argument-hint: [pr-number]
allowed-tools: Bash, Read, Grep
model: claude-sonnet-4-6
---

Review pull request #$1.

- Fetch the diff with \`gh pr diff $1\`.
- Flag correctness bugs, security issues, and missing tests.
- End with a short risk summary (low / medium / high) and why.`,
  },
};

const AGENTS_SAMPLE: Sample = {
  title: "Sample agent",
  blurb:
    "A subagent has its own system prompt and tool scope. Claude delegates to it based on the description.",
  fields: [
    { label: "Name", value: "code-reviewer" },
    {
      label: "Description",
      value:
        "Use after writing or changing code to review it for bugs, security issues, and clarity.",
      note: "Controls when Claude auto-delegates to this agent.",
    },
    {
      label: "Tools",
      value: "Read, Grep, Glob, Bash",
      note: "The agent can only use these tools.",
    },
    { label: "Model", value: "Sonnet 4.6 (claude-sonnet-4-6)" },
  ],
  usage: {
    value: 'Ask Claude to review code, or name it: "use the code-reviewer agent".',
    note: "Claude delegates to the agent automatically when a task matches the description.",
  },
  body: {
    label: "System prompt · agent body",
    value: `You are a senior code reviewer.

When invoked:
- Inspect the most recent changes (git diff) and the files they touch.
- Prioritize correctness bugs and security issues over style.
- For each finding give the file, the problem, and a concrete fix.
- If the code is sound, say so plainly. Do not invent problems.`,
  },
  raw: {
    label: "agents/code-reviewer.md",
    value: `---
name: code-reviewer
description: Use after writing or changing code to review it for bugs, security issues, and clarity.
tools: Read, Grep, Glob, Bash
model: claude-sonnet-4-6
---

You are a senior code reviewer.

When invoked:
- Inspect the most recent changes (git diff) and the files they touch.
- Prioritize correctness bugs and security issues over style.
- For each finding give the file, the problem, and a concrete fix.
- If the code is sound, say so plainly. Do not invent problems.`,
  },
};

export const SAMPLES: Record<string, Sample> = {
  "/hooks": HOOKS_SAMPLE,
  "/skills": SKILLS_SAMPLE,
  "/commands": COMMANDS_SAMPLE,
  "/agents": AGENTS_SAMPLE,
};

export function getSample(pathname: string): Sample | undefined {
  return SAMPLES[pathname];
}
