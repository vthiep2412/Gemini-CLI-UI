## 2024-03-25 - [Fix Path Traversal in Project File Endpoints]
**Vulnerability:** The API endpoints for reading, serving and modifying files (/api/projects/:projectName/file and /api/projects/:projectName/files/content) validated if `filePath` was absolute, but did not validate if the requested file path was inside the project directory, allowing arbitrary file read/write.
**Learning:** Checking for `path.isAbsolute(filePath)` is not sufficient. An absolute path could be anything on the system (`/etc/passwd`). Must use `path.relative` to check if a path belongs inside a specific boundary.
**Prevention:** Always check if user-provided absolute/relative paths are inside the intended boundary folder using `path.relative` and preventing `..` or absolute prefixes.
