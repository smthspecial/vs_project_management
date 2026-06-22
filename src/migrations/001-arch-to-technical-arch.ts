import * as fs from "fs";
import * as path from "path";
import type { Migration } from "./index";

// arch-NNN.md files were previously written directly into technical/.
// They now belong in technical/arch/.
const migration: Migration = {
  id: "001-arch-to-technical-arch",
  description: "Move arch-NNN.md files from technical/ into technical/arch/",

  async run(specDir: string) {
    const oldDir = path.join(specDir, "technical");
    const newDir = path.join(specDir, "technical", "arch");
    const moved: string[] = [];

    if (!fs.existsSync(oldDir)) {
      return { moved };
    }

    const files = fs
      .readdirSync(oldDir)
      .filter(
        (f) =>
          /^arch-\d{3}\.md$/.test(f) &&
          fs.statSync(path.join(oldDir, f)).isFile(),
      );

    if (files.length === 0) {
      return { moved };
    }

    fs.mkdirSync(newDir, { recursive: true });

    for (const file of files) {
      const src = path.join(oldDir, file);
      const dest = path.join(newDir, file);
      fs.renameSync(src, dest);
      moved.push(`technical/${file} → technical/arch/${file}`);
    }

    return { moved };
  },
};

export default migration;
