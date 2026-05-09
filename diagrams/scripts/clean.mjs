import { rmSync } from "node:fs";

for (const path of ["dist", ".cache"]) {
  rmSync(path, { recursive: true, force: true });
}
