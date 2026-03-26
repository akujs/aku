import { CliExitError } from "./cli-errors.ts";
import type {
	ArgumentSchema,
	CommandDefinition,
	CommandExecuteContext,
	InferArgs,
} from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";

const completionsArgs = {
	shell: {
		type: "string",
		positional: true,
		required: true,
		description: "Shell to generate completions for (bash, zsh, or fish)",
	},
} as const satisfies ArgumentSchema;

async function completionsHandler({
	args,
	cli,
}: CommandExecuteContext<InferArgs<typeof completionsArgs>>): Promise<void> {
	switch (args.shell) {
		case "bash":
			cli.raw(bashCompletions());
			break;
		case "zsh":
			cli.raw(zshCompletions());
			break;
		case "fish":
			cli.raw(fishCompletions());
			break;
		default:
			throw new CliExitError(
				`Unsupported shell: "${args.shell}". Supported shells: bash, zsh, fish`,
			);
	}
}

function bashCompletions(): string {
	return `\
# Aku shell completions for Bash
# Add the following to your ~/.bashrc:
#
#   eval "$(aku completions bash)"
#
_aku_completions() {
  local IFS=$'\\n'
  COMPREPLY=($(aku _complete "$COMP_LINE" "$COMP_POINT"))
  [[ \${#COMPREPLY[@]} -eq 1 && \${COMPREPLY[0]} == *= ]] && compopt -o nospace
}
complete -o default -F _aku_completions aku
`;
}

function zshCompletions(): string {
	return `\
# Aku shell completions for Zsh
# Add the following to your ~/.zshrc:
#
#   eval "$(aku completions zsh)"
#
_aku_completions() {
  local completions
  completions=(\${(f)"$(aku _complete "$BUFFER" "$CURSOR")"})
  if (( \${#completions} )); then
    local c
    for c in $completions; do
      if [[ $c == *= ]]; then
        compadd -S '' -- $c
      else
        compadd -- $c
      fi
    done
  else
    _files
  fi
}
compdef _aku_completions aku
`;
}

function fishCompletions(): string {
	return `\
# Aku shell completions for Fish
# Add the following to your ~/.config/fish/config.fish:
#
#   aku completions fish | source
#
complete -c aku -a '(aku _complete (commandline) (commandline -C))'
`;
}

export const completionsCommand: CommandDefinition = defineCommand({
	name: "completions",
	description: "Get tab completion for aku commands in your shell",
	args: completionsArgs,
	handler: completionsHandler,
});
