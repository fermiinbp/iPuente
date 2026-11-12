import { readFileSync } from "node:fs";

const { tool_name, tool_input = {} } = JSON.parse(readFileSync(0, "utf8"));
const objetivo = tool_name === "Bash" ? (tool_input.command ?? "") : (tool_input.file_path ?? "");

const reglas = [
  [/(?:^|[^\w])\.env(?:\.(?!example\b)\w+)?(?![\w.])/, "acceder a .env está prohibido"],
  [/\brm\s+-\w*(?:rf|fr)\w*/i, "rm -rf está prohibido"],
  [/\bgit\s+push\b.*(?:--force\b|\s-f\b)/, "git push --force está prohibido"],
];

for (const [patron, motivo] of reglas) {
  if (patron.test(objetivo)) {
    console.error(`Bloqueado por un hook del proyecto: ${motivo}.`);
    process.exit(2);
  }
}