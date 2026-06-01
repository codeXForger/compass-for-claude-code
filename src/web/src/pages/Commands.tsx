import { FileResourcePage } from "./FileResourcePage";
import { FieldSpec } from "../components/MetadataForm";

const COMMAND_FIELDS: FieldSpec[] = [
  {
    key: "description",
    label: "Description",
    type: "text",
    help: "Shown in the command picker.",
    rephrase: true,
  },
  {
    key: "argument-hint",
    label: "Argument hint",
    type: "text",
    placeholder: "[file] [message]",
    help: "Hint shown after the command name for expected arguments.",
  },
  {
    key: "allowed-tools",
    label: "Allowed tools",
    type: "tools-csv",
    help: "Tools this command may use without a prompt. Leave empty for the default.",
  },
  { key: "model", label: "Model", type: "model" },
];

export function Commands() {
  return (
    <FileResourcePage
      title="Commands"
      description="CRUD slash commands. Each file is a markdown command in .claude/commands/<name>.md."
      resource="commands"
      chapter="VI"
      glyph="/"
      subtitle={
        <>
          slash incantations · stored in{" "}
          <code className="font-mono not-italic text-ink">
            .claude/commands/&lt;name&gt;.md
          </code>
        </>
      }
      fields={COMMAND_FIELDS}
      bodyLabel="Prompt · command body"
      template={(name) =>
        `---\ndescription: ${name} — TODO\n---\n\nDescribe what this slash command does.\n`
      }
    />
  );
}
