import { FileResourcePage } from "./FileResourcePage";
import { FieldSpec } from "../components/MetadataForm";

const AGENT_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", type: "text", placeholder: "code-reviewer" },
  {
    key: "description",
    label: "Description",
    type: "text",
    help: "When Claude should delegate to this agent — drives auto-delegation.",
    rephrase: true,
  },
  {
    key: "tools",
    label: "Tools",
    type: "tools-csv",
    help: "Tools this agent may use. Leave empty to inherit all tools.",
  },
  { key: "model", label: "Model", type: "model" },
];

export function Agents() {
  return (
    <FileResourcePage
      title="Agents"
      description="CRUD custom agents in .claude/agents/<name>.md."
      resource="agents"
      chapter="VII"
      glyph="◉"
      subtitle={
        <>
          custom subagents · stored in{" "}
          <code className="font-mono not-italic text-ink">
            .claude/agents/&lt;name&gt;.md
          </code>
        </>
      }
      fields={AGENT_FIELDS}
      bodyLabel="System prompt · agent body"
      template={(name) =>
        `---\nname: ${name}\ndescription: TODO\ntools: Read, Edit\nmodel: claude-sonnet-4-6\n---\n\nYou are the ${name} agent. Describe behavior here.\n`
      }
    />
  );
}
