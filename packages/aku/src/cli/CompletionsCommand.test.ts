import { describe, expect, test } from "bun:test";
import { createTestApplication } from "../testing/create-test-application.ts";
import { completionsCommand } from "./CompletionsCommand.ts";

describe(completionsCommand.handler, () => {
	test("bash completions", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions bash");

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# Aku shell completions for Bash
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
		  "
		`);
	});

	test("zsh completions", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions zsh");

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# Aku shell completions for Zsh
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
		  "
		`);
	});

	test("fish completions", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions fish");

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# Aku shell completions for Fish
		  # Add the following to your ~/.config/fish/config.fish:
		  #
		  #   aku completions fish | source
		  #
		  complete -c aku -a '(aku _complete (commandline) (commandline -C))'
		  "
		`);
	});

	test("unsupported shell produces an error", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions powershell");

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain('Unsupported shell: "powershell"');
	});
});
